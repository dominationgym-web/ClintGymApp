// The Progress section (0143, GRIZZ 2026-10-22): main lifts from the training
// log, timed cardio tests, and weight and measurements, each as a line over
// time with start, best and latest to compare.

export type Point = { date: string; value: number; note?: string };
export type Better = "up" | "down" | null;

// ---------------------------------------------------------------------------
// Strength
// ---------------------------------------------------------------------------

export type LiftLog = { exercise_name: string; log_date: string; weight_kg: number | null; reps: number; warm_up?: boolean | null };

export const MAIN_LIFTS: { key: string; label: string; test: (n: string) => boolean }[] = [
  { key: "squat", label: "Squats", test: (n) => /squat/.test(n) && !/split|bulgarian|jump|pistol|wall|goblet/.test(n) },
  { key: "legpress", label: "Leg press", test: (n) => /leg\s*press/.test(n) },
  { key: "pullup", label: "Pull-ups", test: (n) => /pull[\s-]?ups?\b|chin[\s-]?ups?\b/.test(n) && !/assist|band/.test(n) },
  {
    key: "bench",
    label: "Flat barbell bench",
    test: (n) => /bench/.test(n) && !/incline|decline|dumb|\bdb\b|dbell|db\s/.test(n) && (/barbell|bb\b/.test(n) || /^(flat\s+)?bench(\s+press)?$/.test(n)),
  },
  { key: "dbbench", label: "Dumbbell bench", test: (n) => /bench/.test(n) && /dumb|\bdb\b|dbell/.test(n) && !/incline|decline/.test(n) },
  { key: "deadlift", label: "Deadlift", test: (n) => /deadlift/.test(n) && !/romanian|rdl|stiff|single/.test(n) },
];

const clean = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

/** Which main lift an exercise name belongs to, or null. */
export function mainLiftOf(name: string): string | null {
  const n = clean(name);
  return MAIN_LIFTS.find((l) => l.test(n))?.key ?? null;
}

/** Group key: a main lift's key, or the exercise's own name. */
export function liftKey(name: string): string {
  return mainLiftOf(name) ?? `ex:${clean(name)}`;
}

export type LiftChoice = { key: string; label: string; sessions: number };

/** The main lifts the client has done, then their other exercises most-done first. */
export function liftChoices(logs: LiftLog[], others = 8): LiftChoice[] {
  const days = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  for (const l of logs) {
    const k = liftKey(l.exercise_name);
    if (!days.has(k)) days.set(k, new Set());
    days.get(k)!.add(l.log_date);
    if (!names.has(k)) names.set(k, l.exercise_name.trim());
  }
  const main = MAIN_LIFTS.filter((m) => days.has(m.key)).map((m) => ({ key: m.key, label: m.label, sessions: days.get(m.key)!.size }));
  const rest = [...days.entries()]
    .filter(([k, d]) => k.startsWith("ex:") && d.size >= 2)
    .map(([k, d]) => ({ key: k, label: names.get(k)!, sessions: d.size }))
    .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label))
    .slice(0, others);
  return [...main, ...rest];
}

/**
 * One point per day: the heaviest working set (with its reps), or for
 * body-weight exercises like pull-ups, the most reps in a set.
 */
export function liftSeries(logs: LiftLog[], key: string): { points: Point[]; unit: "kg" | "reps" } {
  const mine = logs.filter((l) => !l.warm_up && liftKey(l.exercise_name) === key);
  const weighted = mine.some((l) => (l.weight_kg ?? 0) > 0);
  const byDay = new Map<string, Point>();
  for (const l of mine) {
    const kg = l.weight_kg ?? 0;
    if (weighted && kg <= 0) continue;
    const value = weighted ? kg : l.reps;
    const prev = byDay.get(l.log_date);
    const prevReps = prev?.note ? Number(prev.note.split("×")[1]) : 0;
    if (!prev || value > prev.value || (weighted && value === prev.value && l.reps > prevReps)) {
      byDay.set(l.log_date, { date: l.log_date, value, note: weighted ? `${kg}kg×${l.reps}` : undefined });
    }
  }
  return { points: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)), unit: weighted ? "kg" : "reps" };
}

// ---------------------------------------------------------------------------
// Cardio tests
// ---------------------------------------------------------------------------

export const CARDIO_MACHINES = ["Assault bike", "SkiErg", "Rower", "Bike erg", "Treadmill", "Run", "Stairs"];

export type CardioTest = { id: string; test_date: string; machine: string; seconds: number; distance_m: number | null; calories: number | null };

export function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return sec ? `${m}:${String(sec).padStart(2, "0")} min` : `${m} min`;
}

/** "10", "10:30" or "1:05:00" → seconds; null if it isn't a time. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  const s = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 60;
  return s >= 10 ? s : null;
}

const testKey = (t: Pick<CardioTest, "machine" | "seconds">) => `${t.machine.trim().toLowerCase()}|${t.seconds}`;

export type CardioChoice = { key: string; label: string; count: number };

/** The same machine for the same time is one test to compare over time. */
export function cardioChoices(tests: CardioTest[]): CardioChoice[] {
  const map = new Map<string, CardioChoice>();
  for (const t of tests) {
    const k = testKey(t);
    const c = map.get(k) ?? { key: k, label: `${t.machine.trim()} · ${formatSeconds(t.seconds)}`, count: 0 };
    c.count++;
    map.set(k, c);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function cardioSeries(tests: CardioTest[], key: string, measure: "distance" | "calories"): Point[] {
  const byDay = new Map<string, Point>();
  for (const t of tests) {
    if (testKey(t) !== key) continue;
    const v = measure === "distance" ? t.distance_m : t.calories;
    if (v === null || v === undefined) continue;
    const prev = byDay.get(t.test_date);
    if (!prev || v > prev.value) byDay.set(t.test_date, { date: t.test_date, value: Number(v) });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Weight and measurements
// ---------------------------------------------------------------------------

export const BODY_MEASURES = [
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "body_fat_pct", label: "Body fat", unit: "%" },
  { key: "waist_cm", label: "Waist", unit: "cm" },
  { key: "hips_cm", label: "Hips", unit: "cm" },
  { key: "chest_cm", label: "Chest", unit: "cm" },
  { key: "arm_cm", label: "Arm", unit: "cm" },
  { key: "thigh_cm", label: "Thigh", unit: "cm" },
] as const;

export type BodyMeasureKey = (typeof BODY_MEASURES)[number]["key"];
export type BodyStat = { id: string; measured_on: string } & Partial<Record<BodyMeasureKey, number | null>>;

export function bodySeries(stats: BodyStat[], key: BodyMeasureKey): Point[] {
  const byDay = new Map<string, Point>();
  for (const s of stats) {
    const v = s[key];
    if (v === null || v === undefined) continue;
    byDay.set(s.measured_on, { date: s.measured_on, value: Number(v) });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export const WEIGH_IN_OPTIONS = [
  { key: "week", label: "Every week", days: 7 },
  { key: "2weeks", label: "Every 2 weeks", days: 14 },
  { key: "month", label: "Once a month", days: 30 },
] as const;
export type WeighInEvery = (typeof WEIGH_IN_OPTIONS)[number]["key"];

/** Days until the next weigh-in (0 or less means due now), or null when no schedule is set. */
export function weighInDueIn(every: WeighInEvery | null | undefined, lastWeighIn: string | null, today: string): number | null {
  const opt = WEIGH_IN_OPTIONS.find((o) => o.key === every);
  if (!opt) return null;
  if (!lastWeighIn) return 0;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastWeighIn}T00:00:00Z`)) / 86400000);
  return opt.days - days;
}

// ---------------------------------------------------------------------------
// Comparing
// ---------------------------------------------------------------------------

export type Compare = { start: Point; best: Point; latest: Point; change: number; pct: number | null; trend: "better" | "worse" | "same" | null };

export function compare(points: Point[], better: Better): Compare | null {
  if (!points.length) return null;
  const start = points[0];
  const latest = points[points.length - 1];
  const best = points.reduce((b, p) => (better === "down" ? (p.value < b.value ? p : b) : p.value > b.value ? p : b), start);
  const change = Math.round((latest.value - start.value) * 100) / 100;
  const pct = start.value ? Math.round((change / start.value) * 1000) / 10 : null;
  const trend = !better || points.length < 2 ? null : change === 0 ? "same" : (change > 0) === (better === "up") ? "better" : "worse";
  return { start, best, latest, change, pct, trend };
}

/** Only points from the last `months` months (null = everything). */
export function sinceMonths(points: Point[], months: number | null, today: string): Point[] {
  if (!months) return points;
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - months, d));
  const from = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  return points.filter((p) => p.date >= from);
}
