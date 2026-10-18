import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { isFunctionalProgram, programFamily, slotOf, WEEKDAY_NAMES, type ProgramFamily } from "@/lib/programs";
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
 * Single days of weekly programs (day_slot set, 0098) never count as used.
 */
export function usedWorkoutIds(
  entries: (Pick<ClientCalendarWorkout, "program_id" | "created_at"> & { day_slot?: number | null })[],
  resets: Pick<ClientWorkoutReset, "batch" | "reset_at">[],
  programs: Pick<Program, "id" | "name" | "trainer_id">[],
): Set<string> {
  const byId = new Map(programs.map((p) => [p.id, p]));
  const resetAt = new Map(resets.map((r) => [r.batch, r.reset_at]));
  const used = new Set<string>();
  for (const e of entries) {
    if (e.day_slot != null) continue;
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

// Single days from any program (GRIZZ, 2026-10-16, 0098): a calendar workout
// or extra block can be one session of a weekly or multi-week program, kept
// as its slot, (week - 1) * 7 + weekday.

/** The exercises for one session (slot) of a program, or all of them when the slot is null. */
export function exercisesForSlot<T extends { day_number: number; week_number?: number | null }>(rows: T[], slot: number | null): T[] {
  return slot == null ? rows : rows.filter((r) => slotOf(r) === slot);
}

/** "Week 2 · Wed: Mobility flow", or "Wed: Mobility flow" in a one-week program. */
export function slotLabel(program: Pick<Program, "day_titles" | "weeks">, slot: number): string {
  const weekday = WEEKDAY_NAMES[(slot - 1) % 7].slice(0, 3);
  const title = program.day_titles[slot - 1];
  const day = title ? `${weekday}: ${title}` : weekday;
  return (program.weeks ?? 1) > 1 ? `Week ${Math.floor((slot - 1) / 7) + 1} · ${day}` : day;
}

/** A program's training sessions (slots with exercises), in order. Rest days are left out. */
export function programSlots(rows: { day_number: number; week_number?: number | null }[]): number[] {
  return [...new Set(rows.map(slotOf))].sort((a, b) => a - b);
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

export type CalendarMove = "missed" | "caughtUp";

/**
 * Weekend catch-ups (0101) on the calendar (GRIZZ, 2026-10-17): the workout
 * moves to the day it was done, which shows "Moved" in green, and the day it
 * was missed shows "Moved" in red.
 */
export function applyMoves(
  labels: Record<string, string>,
  sessions: { session_date: string; makeup_for: string | null }[],
): { labels: Record<string, string>; moves: Record<string, CalendarMove> } {
  const shown = { ...labels };
  const moves: Record<string, CalendarMove> = {};
  for (const s of sessions) {
    if (!s.makeup_for) continue;
    moves[s.makeup_for] = "missed";
    moves[s.session_date] = "caughtUp";
    if (labels[s.makeup_for]) shown[s.session_date] = labels[s.makeup_for];
  }
  return { labels: shown, moves };
}

/** Teal for mobility, flexibility and other Functional sessions on the calendar (GRIZZ, 2026-10-18). */
export const FUNCTIONAL_TEAL = "#2DD4BF";

/**
 * Each day's calendar labels: the training workout (with "+N" for extra
 * training blocks) in gold, and Functional sessions (mobility, flexibility)
 * apart, in teal, whether they are the day's workout or an extra block.
 */
export function calendarDayLabels(
  entries: { workout_date: string; program_id: string }[],
  blocks: { workout_date: string; program_id: string }[],
  program: (id: string) => Pick<Program, "name" | "trainer_id"> | undefined,
  label: (p: Pick<Program, "name" | "trainer_id">) => string,
): { labels: Record<string, string>; functional: Record<string, string> } {
  const labels: Record<string, string> = {};
  const functional: Record<string, string> = {};
  const dates = new Set([...entries.map((e) => e.workout_date), ...blocks.map((b) => b.workout_date)]);
  for (const date of dates) {
    let main = "";
    let extra = 0;
    const fun: string[] = [];
    const entry = entries.find((e) => e.workout_date === date);
    const p = entry ? program(entry.program_id) : undefined;
    if (p) {
      if (isFunctionalProgram(p)) fun.push(label(p));
      else main = label(p);
    }
    for (const b of blocks) {
      if (b.workout_date !== date) continue;
      const bp = program(b.program_id);
      if (!bp) continue;
      if (isFunctionalProgram(bp)) fun.push(label(bp));
      else extra++;
    }
    if (main || extra) labels[date] = main ? (extra ? `${main} +${extra}` : main) : `+${extra}`;
    if (fun.length) functional[date] = fun.length > 1 ? `${fun[0]} +${fun.length - 1}` : fun[0];
  }
  return { labels, functional };
}

/** "Flexibility 4 – Lower Back Release" → "Flex 4" (or "Flexibility" without the number) for a calendar cell. */
export function functionalShortName(name: string, withNumber = true): string {
  const head = name.split(" – ")[0];
  return shortWorkoutName(withNumber ? head.replace(/^Flexibility\b/, "Flex") : head.replace(/\s+\d+$/, ""));
}
