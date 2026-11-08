// The shape of what Claude reads out of another app's screenshots or files,
// and the checks that make it safe to save (0142, GRIZZ 2026-10-22). Plain
// TypeScript with no Deno or app imports, so the edge function and the app's
// tests both use it.

export type ImportedSet = { weight_kg: number | null; reps: number };
// date null: the files showed no date (0189). Such workouts are kept as
// "before the app" sessions in the order the files show them, never given a
// made-up date. session is the label the files gave it, like "Week 1".
export type ImportedWorkout = { date: string | null; session?: string | null; exercise: string; sets: ImportedSet[] };
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
  // 0189: which units unlabelled numbers were read in (the trainer's setting),
  // and whether any number had no unit shown, so the trainer can check.
  units?: Units;
  units_assumed?: boolean;
};

/** A trainer's units (0189): metric is kg and cm, imperial is lb and inches. */
export type Units = "metric" | "imperial";
export const LB_TO_KG = 0.45359237;
export const IN_TO_CM = 2.54;

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

/** Keep only what makes sense: real dates, named exercises, whole reps, sane numbers.
 *  Weights come as "weight" with a unit ("kg", "lb" or none shown); with none
 *  shown they are read in the trainer's units. Older results gave weight_kg. */
export function cleanResult(raw: unknown, today: string, units: Units = "metric"): ImportResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let assumed = false;
  const massUnit = (v: unknown): "kg" | "lb" | null => {
    const u = typeof v === "string" ? v.toLowerCase().trim() : "";
    if (/^(kg|kgs|kilo|kilos|kilograms?)$/.test(u)) return "kg";
    if (/^(lb|lbs|pounds?)$/.test(u)) return "lb";
    return null;
  };
  const lengthUnit = (v: unknown): "cm" | "in" | null => {
    const u = typeof v === "string" ? v.toLowerCase().trim() : "";
    if (/^(cm|cms|centimet(er|re)s?)$/.test(u)) return "cm";
    if (/^(in|inch|inches|")$/.test(u)) return "in";
    return null;
  };
  const fileMass = massUnit(o.weight_unit);
  const fileLength = lengthUnit(o.length_unit);
  /** A weight in kg: weight_kg as is, or weight in its unit (or the trainer's). */
  const toKg = (src: Record<string, unknown> | undefined, unit: "kg" | "lb" | null, kgField = "weight_kg", field = "weight"): number | null => {
    const kg = num(src?.[kgField]);
    if (kg !== null) return kg;
    const n = num(src?.[field]);
    if (n === null) return null;
    if (n > 0 && !unit) assumed = true;
    return (unit ?? (units === "imperial" ? "lb" : "kg")) === "lb" ? n * LB_TO_KG : n;
  };

  const dated: ImportedWorkout[] = [];
  const undated: ImportedWorkout[] = [];
  for (const w of Array.isArray(o.workouts) ? o.workouts : []) {
    if (dated.length + undated.length >= MAX_WORKOUTS) break;
    const rawDate = typeof w?.date === "string" ? w.date.trim() : "";
    const date = rawDate ? cleanDate(rawDate, today) : null;
    // A date that was given but can't be right (future, impossible) is a misread.
    if (rawDate && !date) continue;
    const exercise = typeof w?.exercise === "string" ? w.exercise.trim().replace(/\s+/g, " ").slice(0, 120) : "";
    if (!exercise) continue;
    const unit = massUnit(w?.unit) ?? fileMass;
    const sets: ImportedSet[] = [];
    for (const s of Array.isArray(w.sets) ? w.sets : []) {
      // Empty boxes in a spreadsheet: no reps means the set wasn't done.
      const reps = num(s?.reps);
      if (reps === null || reps < 1 || reps > 500) continue;
      const kg = toKg(s, unit);
      sets.push({ reps: Math.round(reps), weight_kg: kg !== null && kg > 0 && kg <= 1000 ? Math.round(kg * 100) / 100 : null });
      if (sets.length >= MAX_SETS) break;
    }
    // An exercise with nothing filled in is left out.
    if (!sets.length) continue;
    if (date) dated.push({ date, exercise, sets });
    else {
      const session = typeof w?.session === "string" && w.session.trim() ? w.session.trim().replace(/\s+/g, " ").slice(0, 40) : null;
      undated.push({ date: null, session, exercise, sets });
    }
  }
  const body: ImportedBody[] = [];
  for (const b of Array.isArray(o.body) ? o.body : []) {
    // Body stats need a day to go on the graph, so undated ones are left out.
    const date = cleanDate(b?.date, today);
    if (!date) continue;
    const row: ImportedBody = { date };
    const mass = massUnit(b?.weight_unit) ?? fileMass;
    const length = lengthUnit(b?.length_unit) ?? fileLength;
    for (const f of BODY_FIELDS) {
      let n: number | null;
      if (f === "weight_kg") n = toKg(b, mass);
      else if (f === "body_fat_pct") n = num(b?.[f]);
      else {
        n = num(b?.[f]);
        if (n === null) {
          n = num(b?.[f.replace(/_cm$/, "")]);
          if (n !== null) {
            if (!length) assumed = true;
            if ((length ?? (units === "imperial" ? "in" : "cm")) === "in") n *= IN_TO_CM;
          }
        }
      }
      if (n !== null && n >= LIMITS[f][0] && n <= LIMITS[f][1]) row[f] = Math.round(n * 10) / 10;
    }
    if (Object.keys(row).length > 1) body.push(row);
  }
  dated.sort((a, b) => a.date!.localeCompare(b.date!));
  body.sort((a, b) => a.date.localeCompare(b.date));
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  // Undated first: it all happened before the dated history and the app.
  return { app_name: text(o.app_name, 60), workouts: [...undated, ...dated], body, note: text(o.note, 600), units, units_assumed: assumed };
}

/** The undated workouts grouped into sessions, in the order the files showed them. */
export function undatedSessions(r: ImportResult): { label: string | null; workouts: ImportedWorkout[] }[] {
  const out: { label: string | null; workouts: ImportedWorkout[] }[] = [];
  for (const w of r.workouts) {
    if (w.date) continue;
    const label = w.session ?? null;
    const last = out[out.length - 1];
    // Same label, and the exercise isn't already in it: same session.
    if (last && last.label === label && !last.workouts.some((x) => nameKey(x.exercise) === nameKey(w.exercise))) last.workouts.push(w);
    else out.push({ label, workouts: [w] });
  }
  return out;
}

/** How exercise names are compared: lower case, letters and digits only. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type ImportCounts = {
  days: number;
  workouts: number;
  sets: number;
  body: number;
  from: string | null;
  to: string | null;
  // 0189: sessions with no date (and their exercises), kept as "before the app".
  undated: number;
  undated_workouts: number;
};

/** What the trainer sees before adding: training days, exercises, sets, body entries and the date range. */
export function importCounts(r: ImportResult): ImportCounts {
  const datedWorkouts = r.workouts.filter((w) => w.date);
  const dates = [...datedWorkouts.map((w) => w.date!), ...r.body.map((b) => b.date)].sort();
  return {
    days: new Set(datedWorkouts.map((w) => w.date)).size,
    workouts: datedWorkouts.length,
    sets: datedWorkouts.reduce((n, w) => n + w.sets.length, 0),
    body: r.body.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    undated: undatedSessions(r).length,
    undated_workouts: r.workouts.length - datedWorkouts.length,
  };
}
