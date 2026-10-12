import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { programFamily, type ProgramFamily } from "@/lib/programs";
import type { ClientCalendarWorkout, ClientWorkoutReset, Program, ProgramExercise } from "@/types/database";

// Training calendar (0069): the trainer puts a workout on each training day
// of a client's month. Dates are local calendar dates (YYYY-MM-DD).

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const CALENDAR_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A month, with `month` 0 = January. */
export interface CalendarMonth {
  year: number;
  month: number;
}

export function monthOf(iso: string): CalendarMonth {
  const date = parseIsoDate(iso);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function shiftMonth({ year, month }: CalendarMonth, by: number): CalendarMonth {
  const date = new Date(year, month + by, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** "October 2026". */
export function monthLabel({ year, month }: CalendarMonth): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** The first and last date of the month, for loading its workouts. */
export function monthRange({ year, month }: CalendarMonth): { from: string; to: string } {
  return { from: toIsoDate(new Date(year, month, 1)), to: toIsoDate(new Date(year, month + 1, 0)) };
}

/**
 * The month as rows of 7 days, Monday first. Days outside the month are null,
 * so the first row starts on the right weekday.
 */
export function monthWeeks({ year, month }: CalendarMonth): (string | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toIsoDate(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * A short label for a workout in a calendar cell: "Upper 3", "Lower SS 2", or
 * the name cut to fit. Clients see the calendar workouts without the number.
 */
export function shortWorkoutName(name: string, withNumber = true): string {
  const m = name.match(/^(upper|lower) body( superset)?( \d+)?$/i);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}${m[2] ? " SS" : ""}${withNumber && m[3] ? m[3] : ""}`;
  return name.length <= 12 ? name : `${name.slice(0, 11)}…`;
}

/**
 * The workouts already used for a client, which the trainer shouldn't pick
 * again: every program on their calendar since its batch was last reset.
 * Once every workout in a batch is used, the whole batch is free again.
 */
export function usedWorkoutIds(
  entries: Pick<ClientCalendarWorkout, "program_id" | "created_at">[],
  resets: Pick<ClientWorkoutReset, "batch" | "reset_at">[],
  programs: Pick<Program, "id" | "name" | "trainer_id">[],
): Set<string> {
  const byId = new Map(programs.map((p) => [p.id, p]));
  const resetAt = new Map(resets.map((r) => [r.batch, r.reset_at]));
  const used = new Set<string>();
  for (const e of entries) {
    const program = byId.get(e.program_id);
    if (!program) continue;
    const since = resetAt.get(programFamily(program));
    if (!since || new Date(e.created_at).getTime() > new Date(since).getTime()) used.add(e.program_id);
  }
  const batches = new Set(programs.map(programFamily));
  for (const batch of batches) {
    const inBatch = programs.filter((p) => programFamily(p) === batch);
    if (inBatch.length > 0 && inBatch.every((p) => used.has(p.id))) inBatch.forEach((p) => used.delete(p.id));
  }
  return used;
}

/** How many of a batch's workouts are used, for "5 of 15 used". */
export function usedInBatch(
  batch: ProgramFamily,
  programs: Pick<Program, "id" | "name" | "trainer_id">[],
  used: Set<string>,
): number {
  return programs.filter((p) => programFamily(p) === batch && used.has(p.id)).length;
}

// Pace (GRIZZ, 2026-10-12): the client can do a calendar workout faster, with
// short rests to keep their heart rate up, or slower and heavier with longer
// rests. It changes the rest timer between sets.
export type WorkoutPace = "faster" | "planned" | "slower";

export const PACE_OPTIONS: { key: WorkoutPace; label: string; guide: string }[] = [
  {
    key: "faster",
    label: "Faster",
    guide:
      "Heart rate up. Use a weight you can move for the top of the rep range. Lift in 1 second, lower in 2, and rest 45 seconds between sets. Supersets stay back to back.",
  },
  {
    key: "planned",
    label: "As planned",
    guide: "The rests your coach set for each exercise. Lift in 1 second and lower under control in 2-3 seconds.",
  },
  {
    key: "slower",
    label: "Slower",
    guide:
      "Heavier and more controlled. Lower for 3 seconds, pause for 1, then lift strong. Rest 90 seconds to 2 minutes so you're ready for the next heavy set.",
  },
];

/** The rest after a set at this pace. 0 (straight into a superset partner) always stays 0. */
export function paceRest(restSeconds: number, pace: WorkoutPace): number {
  if (restSeconds === 0 || pace === "planned") return restSeconds;
  if (pace === "faster") return Math.min(restSeconds, 45);
  return Math.min(Math.max(restSeconds + 30, 90), 150);
}

export function withPace(rows: ProgramExercise[], pace: WorkoutPace): ProgramExercise[] {
  if (pace === "planned") return rows;
  return rows.map((r) => (r.kind === "cardio" ? r : { ...r, rest_seconds: paceRest(r.rest_seconds, pace) }));
}
