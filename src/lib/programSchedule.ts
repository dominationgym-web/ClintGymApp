import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { programDayNumber, slotOf, WEEKDAY_NAMES } from "@/lib/programs";

export { slotOf };
import type { ClientProgram, Program } from "@/types/database";

// Working through a weekly program in order (0037). Each training day's
// session waits for the client: it shows from its day until they complete
// it, and only then does the next one unlock on the next training day. They
// can also move it to tomorrow. Dates are local calendar dates (YYYY-MM-DD).

// Multi-week programs (0065): a session is identified by its "slot",
// (week - 1) * 7 + weekday, so week 1 Monday = 1 and week 2 Monday = 8.
// One-week programs only have slots 1-7, the weekday itself.

export interface ProgramSession {
  /** Which of the program's sessions this is: its slot (1 = week 1 Monday, 8 = week 2 Monday). */
  day: number;
  /** The first date it shows to the client. */
  dueOn: string;
}

/** 1 = Monday ... 7 = Sunday, for a slot. */
export function weekdayOfSlot(slot: number): number {
  return ((slot - 1) % 7) + 1;
}

export function weekOfSlot(slot: number): number {
  return Math.floor((slot - 1) / 7) + 1;
}

/** The week and weekday to save for a slot. */
export function slotParts(slot: number): { week: number; day: number } {
  return { week: weekOfSlot(slot), day: weekdayOfSlot(slot) };
}

/** The program's sessions (slots), in order. */
export function trainingDays(exercises: { day_number: number; week_number?: number | null }[]): number[] {
  return [...new Set(exercises.map(slotOf))].sort((a, b) => a - b);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** The first date on or after `iso` that falls on the weekday of one of `days`. */
export function firstTrainingDateFrom(iso: string, days: number[]): string {
  const weekdays = days.map(weekdayOfSlot);
  for (let i = 0; i < 7; i++) {
    const candidate = addDays(iso, i);
    if (weekdays.includes(programDayNumber(parseIsoDate(candidate)))) return candidate;
  }
  return iso;
}

/** The session after `day` in the program's order, wrapping to the start of the week. */
export function nextDayInCycle(day: number, days: number[]): number {
  return days.find((d) => d > day) ?? days[0];
}

/** Where the client is up to. Before they first complete or move anything, it's the first session from the day they started. */
export function currentSession(
  assignment: Pick<ClientProgram, "started_on" | "current_day" | "due_on"> & { current_week?: number | null },
  days: number[],
): ProgramSession | null {
  if (days.length === 0) return null;
  if (assignment.current_day && assignment.due_on) {
    const slot = slotOf({ day_number: assignment.current_day, week_number: assignment.current_week });
    if (days.includes(slot)) return { day: slot, dueOn: assignment.due_on };
  }
  const dueOn = firstTrainingDateFrom(assignment.started_on, days);
  const weekday = programDayNumber(parseIsoDate(dueOn));
  return { day: days.find((d) => weekdayOfSlot(d) === weekday) ?? days[0], dueOn };
}

/** After "Complete workout" today: the next session, on the next training day after today. */
export function sessionAfterComplete(current: ProgramSession, days: number[], today: string): ProgramSession {
  return { day: nextDayInCycle(current.day, days), dueOn: firstTrainingDateFrom(addDays(today, 1), days) };
}

/** After "Move to tomorrow": the same session, tomorrow. */
export function sessionMovedToTomorrow(current: ProgramSession, today: string): ProgramSession {
  return { day: current.day, dueOn: addDays(today, 1) };
}

export function isDue(session: ProgramSession, today: string): boolean {
  return session.dueOn <= today;
}

/** "Workout A" for a weekly program's session, or the weekday name if it has no title; "Week 2: Upper A" in multi-week programs. */
export function sessionTitle(program: Pick<Program, "day_titles"> & { weeks?: number | null }, day: number): string {
  const title = program.day_titles[day - 1] || WEEKDAY_NAMES[weekdayOfSlot(day) - 1];
  return (program.weeks ?? 1) > 1 ? `Week ${weekOfSlot(day)}: ${title}` : title;
}

/** "Wednesday" for "2026-10-07". */
export function weekdayOf(iso: string): string {
  return WEEKDAY_NAMES[programDayNumber(parseIsoDate(iso)) - 1];
}
