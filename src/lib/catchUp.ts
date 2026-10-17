import { parseIsoDate } from "@/lib/dates";
import type { WorkoutSession } from "@/types/database";

// Weekend catch-up (0101): a training calendar workout missed this week can
// be done on Saturday or Sunday. The server works out which ones were missed
// (my_missed_workouts); this decides which workout the screen opens on.

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
  if (!isWeekend(today)) return null;
  if (chosen === "today") return null;
  if (chosen && missed.some((m) => m.workout_date === chosen)) return chosen;
  return missed[0]?.workout_date ?? null;
}
