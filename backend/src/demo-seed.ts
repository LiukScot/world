import fs from "node:fs";
import path from "node:path";
import { backupImportSchema, moneyBackupImportSchema } from "./schemas.ts";

/*
 * Writes a backup file with a year of invented data across both realms. Import
 * it from Settings → Data in the app to see every page filled. The file is
 * checked against the import schemas before it is written, so a seed that the
 * app would refuse fails here instead. Dates are relative to today, so every
 * dashboard range has something to show whenever the script runs.
 */

const outPath = path.resolve(import.meta.dir, "../../data/demo-backup.json");

// Fixed seed: every run produces the same demo, which keeps screenshots comparable.
let seed = 42;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
const pickSome = <T>(items: readonly T[], max: number): T[] =>
  items.filter(() => random() < max / items.length).slice(0, max);
const clamp = (n: number) => Math.max(1, Math.min(9, Math.round(n)));

const today = new Date();
function isoDaysAgo(days: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const time = (hour: number) => `${String(hour).padStart(2, "0")}:${pick(["00", "15", "30", "45"])}`;

const DAYS = 365;

// ── Health ────────────────────────────────────────────────────────────────

const positiveMoods = ["happy", "calm", "grateful", "hopeful", "energetic", "content"];
const negativeMoods = ["sad", "anxious", "irritable", "lonely", "overwhelmed"];
const generalMoods = ["tired", "focused", "restless", "bored"];
const descriptions = [
  "Long walk by the river after work.",
  "Quiet day at home, read most of the afternoon.",
  "Busy day at the office, too many meetings.",
  "Dinner with friends, laughed a lot.",
  "Slept badly, slow morning.",
  "Cleaned the flat and cooked for the week.",
  "Rainy day, stayed in and watched a film.",
  "Went to the gym before breakfast.",
];
const gratitudes = ["A warm coffee in the morning.", "A call with my sister.", "Sunny weather.", "A good book.", "Fresh bread from the bakery."];

const diaryRows: Record<string, unknown>[] = [];
const painRows: Record<string, unknown>[] = [];
for (let day = DAYS; day >= 0; day--) {
  // A slow wave plus noise, so the charts show trends instead of static.
  const wave = Math.sin(day / 18);
  if (random() < 0.85) {
    const mood = clamp(5.5 + wave * 1.8 + (random() - 0.5) * 2);
    diaryRows.push({
      entryDate: isoDaysAgo(day),
      entryTime: time(20 + Math.floor(random() * 3)),
      moodLevel: mood,
      depressionLevel: clamp(10 - mood + (random() - 0.5) * 2),
      anxietyLevel: clamp(4 - wave * 1.5 + (random() - 0.5) * 3),
      positiveMoods: mood >= 5 ? pickSome(positiveMoods, 2).join(", ") : "",
      negativeMoods: mood < 5 ? pickSome(negativeMoods, 2).join(", ") : "",
      generalMoods: pickSome(generalMoods, 1).join(", "),
      description: pick(descriptions),
      gratitude: random() < 0.6 ? pick(gratitudes) : "",
      reflection: "",
    });
  }
  if (random() < 0.7) {
    const pain = clamp(3.5 - wave * 1.5 + (random() - 0.5) * 3);
    painRows.push({
      entryDate: isoDaysAgo(day),
      entryTime: time(9 + Math.floor(random() * 10)),
      painLevel: pain,
      fatigueLevel: clamp(pain + (random() - 0.5) * 3),
      coffeeCount: Math.floor(random() * 4),
      area: pickSome(["head", "neck", "back", "shoulders", "legs"], 2),
      symptoms: pickSome(["stiffness", "throbbing", "burning", "aching"], 2),
      activities: pickSome(["walking", "desk work", "cycling", "yoga", "cooking"], 2),
      medicines: pain >= 6 ? ["ibuprofen"] : [],
      habits: pickSome(["stretching", "late screen time", "early night"], 1),
      other: [],
      note: pain >= 7 ? "Rough day, had to lie down for an hour." : "",
    });
  }
}

const cbt = [
  {
    entryDate: isoDaysAgo(3),
    entryTime: "18:30",
    intensity: 7,
    situation: "My manager asked to talk tomorrow without saying why.",
    thoughts: "I must have done something wrong.",
    mainUnhelpfulThought: "I'm going to be let go.",
    effectOfBelieving: "Couldn't focus for the rest of the afternoon.",
    evidenceForAgainst: "For: the message was short. Against: last review was good, and she often schedules chats like this.",
    alternativeExplanation: "She probably wants to plan the next project.",
    worstBestScenario: "Worst: bad news I can handle. Best: a new opportunity.",
    friendAdvice: "Wait for the meeting before deciding what it means.",
    productiveResponse: "Write down questions for the meeting and go for a walk.",
  },
  {
    entryDate: isoDaysAgo(17),
    entryTime: "22:10",
    intensity: 5,
    situation: "A friend didn't answer my message all day.",
    thoughts: "They're annoyed with me.",
    mainUnhelpfulThought: "Nobody wants to hear from me.",
    effectOfBelieving: "Felt lonely and checked the phone every few minutes.",
    evidenceForAgainst: "They told me they had a busy week.",
    alternativeExplanation: "They're busy and will answer later.",
    worstBestScenario: "Worst: they answer tomorrow. Best: they call tonight.",
    friendAdvice: "People get busy; it's not about you.",
    productiveResponse: "Put the phone away and cook dinner.",
  },
];

const dbt = [
  {
    entryDate: isoDaysAgo(5),
    entryTime: "21:00",
    intensity: 6,
    emotionName: "Frustration",
    allowAffirmation: "It's okay to feel frustrated after a long day.",
    watchEmotion: "It rose quickly, then levelled off after a few minutes.",
    bodyLocation: "Jaw and shoulders",
    bodyFeeling: "Tight, warm",
    presentMoment: "Sitting on the sofa, the radiator ticking.",
    emotionReturns: "Came back briefly when I thought about the train delay.",
  },
  {
    entryDate: isoDaysAgo(26),
    entryTime: "07:45",
    intensity: 4,
    emotionName: "Worry",
    allowAffirmation: "Worry is trying to protect me.",
    watchEmotion: "A low hum that faded once I started moving.",
    bodyLocation: "Stomach",
    bodyFeeling: "Fluttering",
    presentMoment: "Morning light, kettle boiling.",
    emotionReturns: "Not today.",
  },
];

const anniversary = (yearsAgo: number) => {
  const d = new Date(today.getFullYear() - yearsAgo, today.getMonth(), today.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const memorableDays = [
  { date: anniversary(3), title: "Moved into the new flat", emoji: "🏠", description: "First night on a mattress on the floor." },
  { date: isoDaysAgo(40), title: "Finished the half marathon", emoji: "🏃", description: "2 hours 4 minutes, sore for three days." },
  { date: isoDaysAgo(120), title: "Trip to the mountains", emoji: "⛰️", description: "Hiked to the lake and swam in freezing water." },
  { date: isoDaysAgo(200), title: "Adopted Miso", emoji: "🐱", description: "A small grey cat who sleeps on the keyboard." },
  { date: isoDaysAgo(300), title: "First day at the new job", emoji: "💼", description: "" },
  {
    date: isoDaysAgo(9),
    title: "A very long memorable day title to check how the list handles overflow on small screens",
    emoji: "📏",
    description: "And an equally long description that keeps going well past the edge of a phone screen.",
  },
];

// ── Money ─────────────────────────────────────────────────────────────────

const assets = [
  { name: "World ETF", risk: "medium", color: "#4f8cff", monthly: 300, drift: 0.007 },
  { name: "Government bonds", risk: "low", color: "#3fb68b", monthly: 150, drift: 0.002 },
  { name: "Tech stocks", risk: "high", color: "#f0a03c", monthly: 100, drift: 0.01 },
  { name: "Savings account", risk: "low", color: "#a37cf0", monthly: 200, drift: 0.0025 },
] as const;

const transactions: Record<string, unknown>[] = [];
const snapshots: Record<string, unknown>[] = [];
const totals = { low: 2000, medium: 0, high: 0, liquid: 3000 };
for (let month = 12; month >= 0; month--) {
  const day = month * 30;
  for (const asset of assets) {
    transactions.push({ txDate: isoDaysAgo(day + 2), asset: asset.name, tipo: "nuovo vincolo", buyValue: asset.monthly, pnl: 0, note: "" });
    const invested = asset.monthly * (13 - month);
    const change = Math.round(invested * (asset.drift + (random() - 0.45) * 0.02) * 100) / 100;
    transactions.push({ txDate: isoDaysAgo(day), asset: asset.name, tipo: "Variazione Valore", buyValue: 0, pnl: change, note: "" });
    totals[asset.risk] += asset.monthly + change;
  }
  if (month % 3 === 0) {
    transactions.push({ txDate: isoDaysAgo(day + 5), asset: "Government bonds", tipo: "cedola", buyValue: 0, pnl: 12.5, note: "Quarterly coupon" });
    transactions.push({ txDate: isoDaysAgo(day + 5), asset: "World ETF", tipo: "commissione", buyValue: 0, pnl: -2.95, note: "Broker fee" });
  }
  transactions.push({ txDate: isoDaysAgo(day + 1), asset: "Savings account", tipo: "interessi", buyValue: 0, pnl: 4.2, note: "" });
  totals.liquid += 250 + Math.round((random() - 0.5) * 200);
  snapshots.push({
    snapshotDate: isoDaysAgo(day),
    lowRisk: Math.round(totals.low),
    mediumRisk: Math.round(totals.medium),
    highRisk: Math.round(totals.high),
    liquid: Math.round(totals.liquid),
  });
}

const monthlyMovements = [
  { name: "Salary", direction: "income", amount: 2400, cadence: "monthly", note: "" },
  { name: "Side project", direction: "income", amount: 1200, cadence: "annual", note: "Paid once a year" },
  { name: "Rent", direction: "expense", amount: 850, cadence: "monthly", note: "" },
  { name: "Groceries", direction: "expense", amount: 320, cadence: "monthly", note: "" },
  { name: "Gym", direction: "expense", amount: 45, cadence: "monthly", note: "" },
  { name: "Streaming", direction: "expense", amount: 13, cadence: "monthly", note: "" },
  { name: "Car insurance", direction: "expense", amount: 540, cadence: "annual", note: "" },
];

// ── Write ─────────────────────────────────────────────────────────────────

const backup = {
  health: backupImportSchema.parse({ diary: { rows: diaryRows }, pain: { rows: painRows }, cbt, dbt, memorableDays }),
  money: moneyBackupImportSchema.parse({
    transactions,
    monthlyMovements,
    monthlySnapshots: snapshots,
    assetColors: Object.fromEntries(assets.map((a) => [a.name, a.color])),
    assetRisks: Object.fromEntries(assets.map((a) => [a.name, a.risk])),
    preferences: { showZeroAssets: false },
  }),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(backup));
console.log(`Demo backup written to ${outPath}`);
console.log("Import it from Settings → Data. It replaces the data already in the app.");
console.log(`  ${diaryRows.length} diary, ${painRows.length} pain, ${cbt.length} CBT, ${dbt.length} DBT, ${memorableDays.length} memorable days`);
console.log(`  ${transactions.length} transactions, ${monthlyMovements.length} movements, ${snapshots.length} snapshots`);
