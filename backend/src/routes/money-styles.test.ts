import { describe, expect, test } from "bun:test";
import stylesRoute from "./money-styles.ts";
import { setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  return setupAuthedApp([
    { path: "/styles", route: stylesRoute },
  ]);
}

function put(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, styles: object) {
  return app.request("/styles", {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ styles }),
  });
}

describe("money asset styles", () => {
  test("requires authentication", async () => {
    const { app } = await setup();
    expect((await app.request("/styles")).status).toBe(401);
  });

  test("returns an empty map before anything is saved", async () => {
    const { app, cookie } = await setup();
    const body = await (await app.request("/styles", { headers: { cookie } })).json();
    expect(body.data).toEqual({});
  });

  test("saves and reads back a style map", async () => {
    const { app, cookie } = await setup();
    const res = await put(app, cookie, {
      "ETF-A": { colorHex: "#34d399", riskLevel: "low" },
      "Crypto-B": { colorHex: "#fb7185", riskLevel: "high" },
    });
    expect(res.status).toBe(200);

    const body = await (await app.request("/styles", { headers: { cookie } })).json();
    expect(body.data).toEqual({
      "ETF-A": { colorHex: "#34d399", riskLevel: "low" },
      "Crypto-B": { colorHex: "#fb7185", riskLevel: "high" },
    });
  });

  // The PUT replaces the whole map, so an asset left out of the new payload
  // has to disappear rather than linger from the previous save.
  test("drops assets missing from the new payload", async () => {
    const { app, cookie } = await setup();
    await put(app, cookie, { "ETF-A": { colorHex: "#34d399" }, "Old-C": { colorHex: "#60a5fa" } });
    await put(app, cookie, { "ETF-A": { colorHex: "#111111" } });

    const body = await (await app.request("/styles", { headers: { cookie } })).json();
    expect(Object.keys(body.data)).toEqual(["ETF-A"]);
    expect(body.data["ETF-A"].colorHex).toBe("#111111");
  });

  test("rejects a malformed colour and an unknown risk level", async () => {
    const { app, cookie } = await setup();
    expect((await put(app, cookie, { "ETF-A": { colorHex: "red" } })).status).toBe(400);
    expect((await put(app, cookie, { "ETF-A": { riskLevel: "extreme" } })).status).toBe(400);
  });

  test("ignores blank asset names", async () => {
    const { app, cookie } = await setup();
    expect((await put(app, cookie, { "   ": { colorHex: "#34d399" } })).status).toBe(200);
    const body = await (await app.request("/styles", { headers: { cookie } })).json();
    expect(body.data).toEqual({});
  });
});
