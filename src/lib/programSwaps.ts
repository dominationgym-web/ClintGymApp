import { addDays } from "@/lib/programSchedule";
import { mondayOf } from "@/lib/trainingCalendar";
import type { ProgramExercise } from "@/types/database";

// A trainer changes an exercise in a workout they built (GRIZZ, 2026-10-21),
// for good or just for now (0139). A swap for now keeps the row's own
// exercise and names the stand-in and its last day; after that day every
// client gets the original back without anyone touching it.

/** "Until I put it back" is stored as a last day nobody reaches. */
export const NO_END = "9999-12-31";

export type SwapLength = "week" | "twoWeeks" | "fourWeeks" | "open";

export const SWAP_LENGTHS: { key: SwapLength; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "twoWeeks", label: "2 weeks" },
  { key: "fourWeeks", label: "4 weeks" },
  { key: "open", label: "Until I put it back" },
];

/** The stand-in's last day: this week ends on Sunday; 2 and 4 weeks count from today. */
export function swapUntil(length: SwapLength, today: string): string {
  if (length === "week") return addDays(mondayOf(today), 6);
  if (length === "twoWeeks") return addDays(today, 13);
  if (length === "fourWeeks") return addDays(today, 27);
  return NO_END;
}

/** Whether a stand-in is in place on this day. */
export function swapActive(row: Pick<ProgramExercise, "swap_exercise_name" | "swap_until">, date: string): boolean {
  return !!row.swap_exercise_name && !!row.swap_until && date <= row.swap_until;
}

/** The rows as clients do them on this day: stand-ins in, with swapped_from naming the original. */
export function withTemporarySwaps<T extends ProgramExercise>(rows: T[], date: string): T[] {
  return rows.map((row) =>
    swapActive(row, date)
      ? {
          ...row,
          exercise_id: row.swap_exercise_id ?? null,
          exercise_name: row.swap_exercise_name as string,
          swapped_from: { exercise_id: row.exercise_id, exercise_name: row.exercise_name },
        }
      : row,
  );
}

/** "until Sun 26 Oct", or "until you put it back". */
export function swapUntilLabel(until: string): string {
  if (until >= NO_END) return "until you put it back";
  const d = new Date(`${until}T12:00:00`);
  return `until ${d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}`;
}
