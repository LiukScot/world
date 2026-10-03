import { expect, test, type BrowserContext } from "@playwright/test";
import { openSettingsRealm, openSettingsSection } from "./helpers";

/*
 * The device build has no server. These run against static files, so every
 * API call has to be answered by the backend running inside the page.
 */
test("opens signed in, saves an entry, and keeps it after a reload", async ({ page }) => {
  const escaped: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) escaped.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "CBT", exact: true }).click();
  await expect(page.getByRole("heading", { name: "CBT Thought Response" })).toBeVisible();
  await page.getByLabel("Situation").fill("written with no server");
  await page.getByRole("button", { name: /Save entry/i }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("details").filter({ hasText: "written with no server" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "CBT", exact: true }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("details").filter({ hasText: "written with no server" })).toBeVisible();

  expect(escaped).toEqual([]);
});

test("a JSON export restores into a fresh install", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CBT", exact: true }).click();
  await page.getByLabel("Situation").fill("carried over in a backup");
  await page.getByRole("button", { name: /Save entry/i }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("details").filter({ hasText: "carried over in a backup" })).toBeVisible();

  await openSettingsRealm(page);
  await openSettingsSection(page, "Data");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const backupPath = await (await downloading).path();

  // A new context has its own IndexedDB: an empty install.
  const fresh = await browser.newContext({ baseURL });
  try {
    const phone = await fresh.newPage();
    await phone.goto("/");
    await openSettingsRealm(phone);
    await openSettingsSection(phone, "Data");
    await phone.getByLabel("Import JSON").setInputFiles(backupPath);
    await expect(phone.getByText("JSON import completed.")).toBeVisible();

    await phone.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Health" }).click();
    await phone.getByRole("button", { name: "CBT", exact: true }).click();
    await phone.getByRole("button", { name: "History" }).click();
    await expect(phone.locator("details").filter({ hasText: "carried over in a backup" })).toBeVisible();
  } finally {
    await fresh.close();
  }
});

/** An in-memory WebDAV folder on the page's own origin, which the device CSP allows. */
async function fakeWebdav(context: BrowserContext, files: Map<string, Buffer>): Promise<void> {
  await context.route("**/dav/**", async (route) => {
    const request = route.request();
    const name = decodeURIComponent(new URL(request.url()).pathname.split("/").pop() ?? "");
    switch (request.method()) {
      case "MKCOL":
        return route.fulfill({ status: 405 });
      case "PUT":
        files.set(name, request.postDataBuffer() ?? Buffer.alloc(0));
        return route.fulfill({ status: 201 });
      case "PROPFIND": {
        const hrefs = ["/dav/", ...[...files.keys()].map((n) => `/dav/${n}`)];
        const body = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${hrefs.map((h) => `<d:response><d:href>${h}</d:href></d:response>`).join("")}</d:multistatus>`;
        return route.fulfill({ status: 207, contentType: "application/xml", body });
      }
      case "GET":
        return files.has(name) ? route.fulfill({ status: 200, body: files.get(name) }) : route.fulfill({ status: 404 });
      case "DELETE":
        files.delete(name);
        return route.fulfill({ status: 204 });
      default:
        return route.fulfill({ status: 405 });
    }
  });
}

test("a WebDAV backup restores into a fresh install without its password", async ({ page, context, browser, baseURL }) => {
  const files = new Map<string, Buffer>();
  const password = "keychain-only-secret";
  await fakeWebdav(context, files);

  await page.goto("/");
  await page.getByRole("button", { name: "CBT", exact: true }).click();
  await page.getByLabel("Situation").fill("carried over by WebDAV");
  await page.getByRole("button", { name: /Save entry/i }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("details").filter({ hasText: "carried over by WebDAV" })).toBeVisible();

  await openSettingsRealm(page);
  await openSettingsSection(page, "Data");
  await page.getByLabel("Server address").fill(`${baseURL}/dav`);
  await page.getByLabel("Username").fill("me");
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Back up every day").check();
  await page.getByRole("button", { name: "Back up now" }).click();
  await expect(page.getByText("Backup uploaded")).toBeVisible();
  await expect(page.getByText(/^Last backup:/)).toBeVisible();

  expect([...files.keys()]).toEqual([expect.stringMatching(/^world-\d{4}-\d{2}-\d{2}\.sqlite$/)]);
  const uploaded = [...files.values()][0];
  expect(uploaded.subarray(0, 15).toString()).toBe("SQLite format 3");
  expect(uploaded.includes(password)).toBe(false);

  const fresh = await browser.newContext({ baseURL });
  try {
    await fakeWebdav(fresh, files);
    const phone = await fresh.newPage();
    await phone.goto("/");
    await openSettingsRealm(phone);
    await openSettingsSection(phone, "Data");
    await phone.getByLabel("Server address").fill(`${baseURL}/dav`);
    await phone.getByLabel("Username").fill("me");
    await phone.getByLabel("Password").fill(password);
    await phone.getByRole("button", { name: "Save" }).click();
    await phone.getByRole("button", { name: "Show backups" }).click();
    await phone.getByRole("button", { name: "Restore", exact: true }).click();
    await phone.getByRole("button", { name: "Replace all data" }).click();

    // The page reloads on the restored database, settings included.
    await openSettingsRealm(phone);
    await openSettingsSection(phone, "Data");
    await expect(phone.getByLabel("Back up every day")).toBeChecked();
    await expect(phone.getByText(/^Last backup:/)).toBeVisible();

    await phone.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Health" }).click();
    await phone.getByRole("button", { name: "CBT", exact: true }).click();
    await phone.getByRole("button", { name: "History" }).click();
    await expect(phone.locator("details").filter({ hasText: "carried over by WebDAV" })).toBeVisible();
  } finally {
    await fresh.close();
  }
});
