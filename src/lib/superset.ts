import type { ProgramExercise, SetEffort, WorkoutLog } from "@/types/database";

// Superset logger (GRIZZ, 2026-10-23): pick 2, 3 or 4 exercises, start, do
// one set of each back to back, then log the whole round at once and rest.
// Works on any workout and in live sessions.

export const SUPERSET_MIN = 2;
export const SUPERSET_MAX = 4;
/** Rounds when none of the exercises come from today's workout. */
export const SUPERSET_DEFAULT_ROUNDS = 3;
/** Rest after a round when the workout doesn't say. */
export const SUPERSET_DEFAULT_REST = 90;

export type SupersetPick = {
  exercise_id: string | null;
  exercise_name: string;
  /** The row in today's workout it came from, for its sets, reps and rest. */
  row: Pick<ProgramExercise, "sets" | "reps" | "rest_seconds"> | null;
};

export type RoundEntry = { weight: string; reps: string; effort: SetEffort | null };

const same = (log: Pick<WorkoutLog, "exercise_id" | "exercise_name">, pick: Pick<SupersetPick, "exercise_id" | "exercise_name">) =>
  pick.exercise_id ? log.exercise_id === pick.exercise_id : log.exercise_name === pick.exercise_name;

/** Rounds to do: the most sets any picked workout exercise has, else 3. */
export function supersetRounds(picks: SupersetPick[]): number {
  const sets = picks.map((p) => p.row?.sets ?? 0);
  return Math.max(...sets, 0) || SUPERSET_DEFAULT_ROUNDS;
}

/** Rest after each round: the longest rest of the picked workout exercises, else 90 seconds. */
export function supersetRest(picks: SupersetPick[]): number {
  return Math.max(...picks.map((p) => p.row?.rest_seconds ?? 0), 0) || SUPERSET_DEFAULT_REST;
}

/** Working sets of this exercise already logged today. */
export function workingSetsOf(pick: SupersetPick, todays: Pick<WorkoutLog, "exercise_id" | "exercise_name" | "warm_up">[]): number {
  return todays.filter((l) => !l.warm_up && same(l, pick)).length;
}

/** The weight to start from: the latest one logged for this exercise. */
export function lastWeightOf(
  pick: SupersetPick,
  logs: Pick<WorkoutLog, "exercise_id" | "exercise_name" | "weight_kg" | "log_date" | "created_at">[],
): number | null {
  const mine = logs
    .filter((l) => same(l, pick) && l.weight_kg != null)
    .sort((a, b) => (a.log_date + a.created_at < b.log_date + b.created_at ? 1 : -1));
  return mine[0]?.weight_kg ?? null;
}

/**
 * Checks a round before saving. An exercise left without reps is skipped
 * (they didn't get to it); one with reps needs the effort too. Returns the
 * problem to show, or null when it can be saved.
 */
export function roundProblem(picks: SupersetPick[], entries: RoundEntry[]): string | null {
  const filled = entries.filter((e) => e.reps.trim() !== "");
  if (filled.length === 0) return "Enter the reps for at least one exercise.";
  for (let i = 0; i < picks.length; i++) {
    const e = entries[i];
    if (!e || e.reps.trim() === "") continue;
    const reps = Number(e.reps);
    if (!Number.isInteger(reps) || reps <= 0) return `Check the reps for ${picks[i].exercise_name}.`;
    if (!e.effort) return `Pick how many more reps you had left on ${picks[i].exercise_name}.`;
  }
  return null;
}
