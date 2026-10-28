import { addDays, weekdayOf } from "@/lib/programSchedule";
import type { ClientWorkoutSwap } from "@/types/database";

// Swap with tomorrow (0167, GRIZZ, 2026-10-28): a client who doesn't feel like
// today's workout swaps it with their next training workout on the calendar,
// up to 7 days ahead. The server checks the rules again (nothing logged today,
// once a day, a workout swapped onto today can't move again).

export const SWAP_DAYS_AHEAD = 7;

/** The day of the next training workout after today that today's can swap with, or null. */
export function nextSwapDate(
  today: string,
  entries: { workout_date: string; program_id: string }[],
  isTraining: (programId: string) => boolean,
): string | null {
  const last = addDays(today, SWAP_DAYS_AHEAD);
  const later = entries
    .filter((e) => e.workout_date > today && e.workout_date <= last && isTraining(e.program_id))
    .map((e) => e.workout_date)
    .sort();
  return later[0] ?? null;
}

/** "tomorrow's" or "Thursday's". */
export function swapDayName(today: string, date: string): string {
  return date === addDays(today, 1) ? "tomorrow's" : `${weekdayOf(date)}'s`;
}

/** Why today's workout can't be swapped, or null when it can. */
export function swapBlocked(
  today: string,
  swaps: Pick<ClientWorkoutSwap, "swapped_on" | "later_date" | "undone_at">[],
  startedToday: boolean,
): "started" | "swapped" | "swappedIn" | null {
  const active = swaps.filter((s) => !s.undone_at);
  if (active.some((s) => s.swapped_on === today)) return "swapped";
  if (active.some((s) => s.later_date === today)) return "swappedIn";
  if (startedToday) return "started";
  return null;
}

/** Each day touched by a swap, with the line it shows on the calendar. */
export function swapLabels(
  swaps: Pick<ClientWorkoutSwap, "swapped_on" | "later_date" | "undone_at">[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const s of swaps) {
    if (s.undone_at) continue;
    labels[s.swapped_on] = `🔄 Swapped with ${weekdayOf(s.later_date)}`;
    labels[s.later_date] = `🔄 Swapped with ${weekdayOf(s.swapped_on)}`;
  }
  return labels;
}
