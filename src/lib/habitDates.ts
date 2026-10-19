import { addDays } from "@/lib/programSchedule";
import { mondayOf } from "@/lib/trainingCalendar";

// The trainer's habit dates as quick taps instead of typed YYYY-MM-DD
// (review 2026-10-18), so a typo can't give a database error.

/** Start choices: today, or next Monday. */
export function habitStartChoices(today: string): { label: string; date: string }[] {
  return [
    { label: "Today", date: today },
    { label: "Next Monday", date: addDays(mondayOf(today), 7) },
  ];
}

/** How long it runs: no end, or 2, 4 or 6 weeks. */
export const HABIT_LENGTHS: (number | null)[] = [null, 2, 4, 6];

export function habitLengthLabel(weeks: number | null): string {
  return weeks === null ? "No end" : `${weeks} weeks`;
}

/** The last day of a habit that runs `weeks` weeks from `start` (both days counted), or null for no end. */
export function habitEndDate(start: string, weeks: number | null): string | null {
  return weeks === null ? null : addDays(start, weeks * 7 - 1);
}
