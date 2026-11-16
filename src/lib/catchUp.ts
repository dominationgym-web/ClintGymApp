import { parseIsoDate } from "@/lib/dates";
import type { WorkoutSession } from "@/types/database";

// Weekend catch-up (0101): a training calendar workout missed this week can
// be done on Saturday or Sunday, where the screen opens on it. On other days
// (GRIZZ, 2026-11-16, 0216) the client can choose to do any workout missed
// this week instead of today's; today's then counts as missed. The server
// works out which ones were missed (my_missed_workouts); this decides which
// workout the screen opens on and which ones the client can pick.

export type MissedWorkout = {
  workout_date: string;
  program_id: string;
  program_name: string;
  program_trainer_id: string | null;
};

export function isWeekend(iso: string): boolean {
  const day = parseIsoDate(iso).getDay();
  return day === 0 || day === 6;
}

/**
 * The missed workouts the client can do today: any from this week, on any
 * day (GRIZZ, 2026-11-16; before that only yesterday's on a weekday).
 */
export function catchUpChoices<T extends Pick<MissedWorkout, "workout_date">>(_today: string, missed: T[]): T[] {
  return missed;
}

/**
 * The missed day whose workout to show today, or null for today's own.
 * `chosen` is the client's pick: a date, "today" for today's own workout, or
 * null when they haven't picked. Once today's workout is recorded the screen
 * stays on whatever it made up.
 */
export function catchUpDate(
  today: string,
  missed: Pick<MissedWorkout, "workout_date">[],
  todaySession: Pick<WorkoutSession, "makeup_for"> | null,
  chosen: string | null,
): string | null {
  if (todaySession) return todaySession.makeup_for ?? null;
  if (chosen === "today") return null;
  // On a weekday the screen stays on today's workout unless they pick a missed one.
  if (!isWeekend(today)) return chosen && catchUpChoices(today, missed).some((m) => m.workout_date === chosen) ? chosen : null;
  if (chosen && missed.some((m) => m.workout_date === chosen)) return chosen;
  return missed[0]?.workout_date ?? null;
}

/**
 * Missed workouts in the order to offer them: the one that works the fewest
 * of the body parts trained the day before comes first (legs yesterday, so an
 * upper body workout today), earliest first when they tie.
 */
export function orderByRestedMuscles<T extends Pick<MissedWorkout, "workout_date">>(
  missed: T[],
  partsByDate: Record<string, string[]>,
  yesterdayParts: string[],
): T[] {
  const tired = new Set(yesterdayParts);
  const overlap = (m: T) => new Set((partsByDate[m.workout_date] ?? []).filter((p) => tired.has(p))).size;
  return [...missed].sort((a, b) => overlap(a) - overlap(b) || a.workout_date.localeCompare(b.workout_date));
}
