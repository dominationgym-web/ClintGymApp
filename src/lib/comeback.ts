import type { Checkin, Client, WorkoutLog, WorkoutSession } from "@/types/database";

// Returning clients (0097): their first time with the trainer ("then") set
// against the time since they came back ("now"), so the trainer can see how
// close they are to their old form.

export type StintData = {
  /** Length of the stint in days, at least 1. */
  days: number;
  checkins: Pick<Checkin, "sleep_quality" | "water_litres" | "alcohol_units">[];
  sessions: Pick<WorkoutSession, "status" | "star">[];
  sets: Pick<WorkoutLog, "exercise_name" | "weight_kg" | "warm_up">[];
};

export type StintSummary = {
  weeks: number;
  checkinsPerWeek: number;
  avgSleep: number | null;
  avgWater: number | null;
  avgAlcohol: number | null;
  workoutsPerWeek: number;
  completePct: number | null;
  stars: number;
  /** Heaviest working set per exercise name. */
  bests: Map<string, number>;
  /** Working sets logged per exercise name, to pick the lifts that matter. */
  setCounts: Map<string, number>;
};

/** Whether a higher number is better, lower is better, or neither. */
export type Direction = "up" | "down" | "none";

export type CompareRow = { label: string; then: string; now: string; better: boolean | null };

const avg = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);
const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function summarizeStint(d: StintData): StintSummary {
  const weeks = Math.max(1, d.days) / 7;
  const bests = new Map<string, number>();
  const setCounts = new Map<string, number>();
  for (const s of d.sets) {
    if (s.warm_up) continue;
    const w = s.weight_kg === null ? 0 : Number(s.weight_kg);
    if (!(w > 0)) continue;
    setCounts.set(s.exercise_name, (setCounts.get(s.exercise_name) ?? 0) + 1);
    if (w > (bests.get(s.exercise_name) ?? 0)) bests.set(s.exercise_name, w);
  }
  const trained = d.sessions.filter((s) => s.status !== "missed");
  return {
    weeks,
    checkinsPerWeek: d.checkins.length / weeks,
    avgSleep: avg(d.checkins.flatMap((c) => (c.sleep_quality ? [c.sleep_quality] : []))),
    avgWater: avg(d.checkins.map((c) => Number(c.water_litres))),
    avgAlcohol: avg(d.checkins.map((c) => Number(c.alcohol_units))),
    workoutsPerWeek: trained.length / weeks,
    completePct: d.sessions.length ? Math.round((100 * d.sessions.filter((s) => s.status === "complete").length) / d.sessions.length) : null,
    stars: d.sessions.filter((s) => s.star).length,
    bests,
    setCounts,
  };
}

function row(label: string, then: number | null, now: number | null, dir: Direction, fmt: (n: number) => string): CompareRow | null {
  if (then === null && now === null) return null;
  const better = then === null || now === null || dir === "none" || now === then ? null : dir === "up" ? now > then : now < then;
  return { label, then: then === null ? "-" : fmt(then), now: now === null ? "-" : fmt(now), better };
}

/** Habits and training side by side. */
export function compareStints(then: StintSummary, now: StintSummary): CompareRow[] {
  return [
    row("Workouts a week", then.workoutsPerWeek, now.workoutsPerWeek, "up", one),
    row("Workouts fully done", then.completePct, now.completePct, "up", (n) => `${n}%`),
    row("Gold stars a week", then.stars / then.weeks, now.stars / now.weeks, "up", one),
    row("Check-ins a week", then.checkinsPerWeek, now.checkinsPerWeek, "up", one),
    row("Sleep (out of 5)", then.avgSleep, now.avgSleep, "up", one),
    row("Water a day", then.avgWater, now.avgWater, "up", (n) => `${one(n)}L`),
    row("Alcohol units a day", then.avgAlcohol, now.avgAlcohol, "down", one),
  ].filter((r): r is CompareRow => r !== null);
}

/** Best weight on the lifts they've done both times, most-trained first. */
export function compareLifts(then: StintSummary, now: StintSummary, limit = 6): CompareRow[] {
  return [...now.bests.keys()]
    .filter((name) => then.bests.has(name))
    .sort((a, b) => (now.setCounts.get(b) ?? 0) - (now.setCounts.get(a) ?? 0) || a.localeCompare(b))
    .slice(0, limit)
    .map((name) => row(name, then.bests.get(name)!, now.bests.get(name)!, "up", (n) => `${one(n)}kg`)!);
}

const INTAKE_ROWS: { key: string; label: string }[] = [
  { key: "weight_kg", label: "Body weight (kg)" },
  { key: "activity_level", label: "Activity" },
  { key: "training_goals", label: "Goals" },
  { key: "training_experience", label: "Experience" },
  { key: "job_stress_level", label: "Work stress" },
  { key: "bedtime", label: "Bedtime" },
];

/** What they wrote on the intake form the first time and this time. */
export function compareIntake(first: Record<string, string> | null, current: Record<string, string> | null): CompareRow[] {
  if (!first || !current || Object.keys(current).length === 0) return [];
  return INTAKE_ROWS.flatMap(({ key, label }) =>
    first[key] && current[key] ? [{ label, then: String(first[key]), now: String(current[key]), better: null }] : []
  );
}

type ArchiveFields = Pick<
  Client,
  "access_status" | "archived_at" | "first_stint_ended_at" | "returned_at" | "intake_responses" | "first_intake_responses" | "training_level"
>;

/** Archiving hides them and closes their access. Nothing is deleted. */
export function archiveChanges(client: ArchiveFields, nowIso: string): Partial<ArchiveFields> {
  return {
    archived_at: nowIso,
    access_status: "expired",
    // Only the first archive ends their "prime" stint.
    first_stint_ended_at: client.first_stint_ended_at ?? nowIso,
  };
}

/**
 * Bringing them back keeps all their data. Their intake answers from the
 * first time are kept aside and the form is cleared, so the app asks them to
 * fill it in again and the trainer can compare. Activating them after payment
 * is still a separate step.
 */
export function bringBackChanges(client: ArchiveFields, nowIso: string): Partial<ArchiveFields> {
  const base = { archived_at: null, returned_at: nowIso };
  if (Object.keys(client.intake_responses ?? {}).length === 0) return base;
  return {
    ...base,
    // Keep the answers from their very first time, not a later return.
    first_intake_responses: client.first_intake_responses ?? client.intake_responses,
    intake_responses: {},
    training_level: null,
  };
}
