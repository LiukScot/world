import { expect, type Page } from "@playwright/test";

export function uniqueText(prefix: string): string {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

/*
 * The app has one local user and no login.
 * Each test gets a new browser context, so it also starts on an empty install;
 * there is nothing to purge before or after.
 *
 * Wait for the shell's title rather than a heading: which realm the app
 * restores is remembered in localStorage, hence the alternation.
 */
export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle(/ - (Health|Money|Settings)$/);
}

type DiaryRow = {
  entryDate: string;
  entryTime: string;
  moodLevel: number | null;
  depressionLevel: number | null;
  anxietyLevel: number | null;
  positiveMoods: string;
  negativeMoods: string;
  generalMoods: string;
  description: string;
  gratitude: string;
};

type PainRow = {
  entryDate: string;
  entryTime: string;
  painLevel: number | null;
  fatigueLevel: number | null;
  coffeeCount: number | null;
  area: string;
  symptoms: string;
  activities: string;
  medicines: string;
  habits: string;
  other: string;
  note: string;
};

type MemorableDayRow = { date: string; title: string; emoji: string; description: string };

export function diaryRow(overrides: Partial<DiaryRow> = {}): DiaryRow {
  return {
    entryDate: "2026-03-28",
    entryTime: "10:30",
    moodLevel: 6,
    depressionLevel: 3,
    anxietyLevel: 4,
    positiveMoods: "happy",
    negativeMoods: "",
    generalMoods: "tired",
    description: uniqueText("dashboard-diary"),
    gratitude: "coffee",
    ...overrides,
  };
}

export function painRow(overrides: Partial<PainRow> = {}): PainRow {
  return {
    entryDate: "2026-03-28",
    entryTime: "11:00",
    painLevel: 5,
    fatigueLevel: 4,
    coffeeCount: 1,
    area: "head",
    symptoms: "nausea",
    activities: "work",
    medicines: "200mg celebrex, 4mg sirdalud",
    habits: "good sleep",
    other: "",
    note: uniqueText("dashboard-pain"),
    ...overrides,
  };
}

export function memorableDayRow(overrides: Partial<MemorableDayRow> = {}): MemorableDayRow {
  return { date: "2024-06-10", title: uniqueText("memorable"), emoji: "✨", description: "important date", ...overrides };
}

/**
 * Loads health data through Settings → Data → Import JSON, the same path a
 * person uses, then returns to the Health realm. The import replaces every
 * health entry, so pass all the rows a test needs in one call.
 */
export async function seedHealth(
  page: Page,
  seed: { diary?: DiaryRow[]; pain?: PainRow[]; memorableDays?: MemorableDayRow[] },
) {
  const health = {
    diary: { rows: seed.diary ?? [] },
    pain: { rows: seed.pain ?? [] },
    memorableDays: seed.memorableDays ?? [],
  };
  await openApp(page);
  await openSettingsRealm(page);
  await openSettingsSection(page, "Data");
  await page.getByLabel("Import JSON").setInputFiles({
    name: "seed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ health })),
  });
  await expect(page.getByText("JSON import completed.")).toBeVisible();
  await page.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Health" }).click();
}

/** Settings is its own realm: its sections are sidebar entries reached from
 *  the switcher tile, not tabs inside a page. */
export async function openSettingsRealm(page: Page) {
  await page.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
}

/** Scoped to the sections nav: "Health" and "Money" name both a settings
 *  section and a realm tile. */
export async function openSettingsSection(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

export async function navigateTo(page: Page, section: string) {
  await page.getByRole("button", { name: section }).click();
}

/*
 * The saved log is a sibling view of the form, not a tail below it, so a
 * test that has just saved something has to switch views before it can
 * see it. The page tabs and the mobile sticky head render the same
 * control, so target the visible one.
 */
export async function openEntryView(page: Page, view: "new" | "history") {
  const group = page.getByRole("group", { name: "Entry or history" });
  await group.first().getByRole("button").nth(view === "new" ? 0 : 1).click();
}
