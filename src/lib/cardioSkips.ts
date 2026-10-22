import type { ProgramExercise } from "@/types/database";

// Cardio taken off a client's workout by their trainer (0140, GRIZZ,
// 2026-10-22): one day, or every week (workout_date null). A block is named
// by its program row, or for cardio the trainer added for the client (0136)
// by what it is, since those rows are made in the app.

export type CardioSkip = { id?: string; client_id?: string; workout_date: string | null; cardio_key: string };

/** The cardio the trainer added for this client, rather than the program's own. */
export function isClientCardio(row: Pick<ProgramExercise, "id">): boolean {
  return row.id.startsWith("extra-cardio-");
}

export function cardioKey(row: Pick<ProgramExercise, "id" | "exercise_name" | "reps">): string {
  return isClientCardio(row) ? `extra:${row.exercise_name}|${row.reps}` : `row:${row.id}`;
}

/** Whether this cardio block is off on this day. */
export function cardioSkipped(row: Pick<ProgramExercise, "id" | "exercise_name" | "reps" | "kind">, skips: CardioSkip[], date: string): boolean {
  if (row.kind !== "cardio") return false;
  const key = cardioKey(row);
  return skips.some((s) => s.cardio_key === key && (s.workout_date == null || s.workout_date === date));
}

/** The day's rows without the cardio taken off. */
export function withoutSkippedCardio<T extends ProgramExercise>(rows: T[], skips: CardioSkip[], date: string): T[] {
  return skips.length ? rows.filter((r) => !cardioSkipped(r, skips, date)) : rows;
}
