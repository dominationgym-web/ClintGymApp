// The shape of what Claude reads out of another app's screenshots or files,
// and the checks that make it safe to save (0142, GRIZZ 2026-10-22). Plain
// TypeScript with no Deno or app imports, so the edge function and the app's
// tests both use it.

export type ImportedSet = { weight_kg: number | null; reps: number };
export type ImportedWorkout = { date: string; exercise: string; sets: ImportedSet[] };
export type ImportedBody = {
  date: string;
  weight_kg?: number;
  body_fat_pct?: number;
  waist_cm?: number;
  hips_cm?: number;
  chest_cm?: number;
  arm_cm?: number;
  thigh_cm?: number;
};
export type ImportResult = {
  app_name: string | null;
  workouts: ImportedWorkout[];
  body: ImportedBody[];
  note: string | null;
};

export const BODY_FIELDS = ["weight_kg", "body_fat_pct", "waist_cm", "hips_cm", "chest_cm", "arm_cm", "thigh_cm"] as const;

// Sensible ranges: anything outside is a misread, not a real number.
const LIMITS: Record<(typeof BODY_FIELDS)[number], [number, number]> = {
  weight_kg: [25, 350],
  body_fat_pct: [2, 70],
  waist_cm: [40, 250],
  hips_cm: [50, 250],
  chest_cm: [50, 250],
  arm_cm: [15, 80],
  thigh_cm: [25, 120],
};

const MAX_WORKOUTS = 3000;
const MAX_SETS = 30;

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** A real yyyy-mm-dd date from 2000 up to today, or null. */
export function cleanDate(v: unknown, today: string): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (v < "2000-01-01" || v > today) return null;
  return v;
}

/** Keep only what makes sense: real dates, named exercises, whole reps, sane numbers. */
export function cleanResult(raw: unknown, today: string): ImportResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const workouts: ImportedWorkout[] = [];
  for (const w of Array.isArray(o.workouts) ? o.workouts : []) {
    if (workouts.length >= MAX_WORKOUTS) break;
    const date = cleanDate(w?.date, today);
    const exercise = typeof w?.exercise === "string" ? w.exercise.trim().replace(/\s+/g, " ").slice(0, 120) : "";
    if (!date || !exercise) continue;
    const sets: ImportedSet[] = [];
    for (const s of Array.isArray(w.sets) ? w.sets : []) {
      const reps = num(s?.reps);
      if (reps === null || reps < 1 || reps > 500) continue;
      const kg = num(s?.weight_kg);
      sets.push({ reps: Math.round(reps), weight_kg: kg !== null && kg > 0 && kg <= 1000 ? Math.round(kg * 100) / 100 : null });
      if (sets.length >= MAX_SETS) break;
    }
    if (sets.length) workouts.push({ date, exercise, sets });
  }
  const body: ImportedBody[] = [];
  for (const b of Array.isArray(o.body) ? o.body : []) {
    const date = cleanDate(b?.date, today);
    if (!date) continue;
    const row: ImportedBody = { date };
    for (const f of BODY_FIELDS) {
      const n = num(b?.[f]);
      if (n !== null && n >= LIMITS[f][0] && n <= LIMITS[f][1]) row[f] = Math.round(n * 10) / 10;
    }
    if (Object.keys(row).length > 1) body.push(row);
  }
  workouts.sort((a, b) => a.date.localeCompare(b.date));
  body.sort((a, b) => a.date.localeCompare(b.date));
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return { app_name: text(o.app_name, 60), workouts, body, note: text(o.note, 600) };
}

/** How exercise names are compared: lower case, letters and digits only. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type ImportCounts = { days: number; workouts: number; sets: number; body: number; from: string | null; to: string | null };

/** What the trainer sees before adding: training days, exercises, sets, body entries and the date range. */
export function importCounts(r: ImportResult): ImportCounts {
  const dates = [...r.workouts.map((w) => w.date), ...r.body.map((b) => b.date)].sort();
  return {
    days: new Set(r.workouts.map((w) => w.date)).size,
    workouts: r.workouts.length,
    sets: r.workouts.reduce((n, w) => n + w.sets.length, 0),
    body: r.body.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}
