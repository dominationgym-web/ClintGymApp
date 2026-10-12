import type { WorkoutLog, WorkoutSessionStatus } from "@/types/database";

// Workout completion (0076): green when every set and cardio block was done,
// orange when only part of it was, red when the client couldn't train. A gold
// star when they pushed their weights up compared with last time.

export const SESSION_COLORS: Record<WorkoutSessionStatus, string> = {
  complete: "#22C55E",
  partial: "#F59E0B",
  missed: "#EF4444",
};

export const SESSION_LABELS: Record<WorkoutSessionStatus, string> = {
  complete: "Completed",
  partial: "Partly done",
  missed: "Couldn't train",
};

export const STAR_GOLD = "#FFD700";

export const PARTIAL_REASONS = ["Ran out of time", "Pain or injury", "Too tired", "Gym busy / no equipment", "Felt unwell"];
export const MISSED_REASONS = ["No time today", "Pain or injury", "Too tired", "Felt unwell", "Family or work"];

export function sessionStatus(done: number, planned: number): "complete" | "partial" {
  return planned > 0 && done >= planned ? "complete" : "partial";
}

export type Improvement = { exercise: string; before: string; after: string };

type SetLike = Pick<WorkoutLog, "exercise_id" | "exercise_name" | "weight_kg" | "reps" | "log_date">;

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}kg`;
const keyOf = (s: SetLike) => s.exercise_id ?? `name:${s.exercise_name}`;

/** Heaviest weight and the reps done at it (all reps for bodyweight work). */
function best(sets: SetLike[]): { weight: number | null; reps: number; topReps: number } {
  const weighted = sets.filter((s) => s.weight_kg !== null && Number(s.weight_kg) > 0);
  if (weighted.length === 0) {
    return { weight: null, reps: sets.reduce((t, s) => t + s.reps, 0), topReps: Math.max(0, ...sets.map((s) => s.reps)) };
  }
  const top = Math.max(...weighted.map((s) => Number(s.weight_kg)));
  const atTop = weighted.filter((s) => Number(s.weight_kg) === top);
  return { weight: top, reps: atTop.reduce((t, s) => t + s.reps, 0), topReps: Math.max(...atTop.map((s) => s.reps)) };
}

const describe = (b: ReturnType<typeof best>) =>
  b.weight === null ? `${b.topReps} reps` : `${kg(b.weight)} × ${b.topReps}`;

/**
 * Exercises where today beat the last time the client did them: a heavier top
 * weight, or more reps at the same top weight (more reps for bodyweight work).
 * `earlier` holds sets from before today; only each exercise's latest day counts.
 */
export function findImprovements(today: SetLike[], earlier: SetLike[]): Improvement[] {
  const result: Improvement[] = [];
  const todayBy = new Map<string, SetLike[]>();
  for (const s of today) todayBy.set(keyOf(s), [...(todayBy.get(keyOf(s)) ?? []), s]);
  for (const [key, sets] of todayBy) {
    const before = earlier.filter((s) => keyOf(s) === key && s.log_date < sets[0].log_date);
    if (before.length === 0) continue;
    const lastDay = before.reduce((d, s) => (s.log_date > d ? s.log_date : d), "");
    const last = best(before.filter((s) => s.log_date === lastDay));
    const now = best(sets);
    const heavier = now.weight !== null && last.weight !== null && now.weight > last.weight;
    const moreReps = now.weight === last.weight && now.reps > last.reps;
    if (heavier || moreReps) result.push({ exercise: sets[0].exercise_name, before: describe(last), after: describe(now) });
  }
  return result;
}
