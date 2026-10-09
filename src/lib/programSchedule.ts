import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { programDayNumber, WEEKDAY_NAMES } from "@/lib/programs";
import type { ClientProgram, Program, ProgramExercise } from "@/types/database";

// Working through a weekly program in order (0037). Each training day's
// session waits for the client: it shows from its day until they complete
// it, and only then does the next one unlock on the next training day. They
// can also move it to tomorrow. Dates are local calendar dates (YYYY-MM-DD).

export interface ProgramSession {
  /** Which of the program's days this session is, 1 = Monday ... 7 = Sunday. */
  day: number;
  /** The first date it shows to the client. */
  dueOn: string;
}

/** The program's training days, 1 = Monday ... 7 = Sunday, in order. */
export function trainingDays(exercises: Pick<ProgramExercise, "day_number">[]): number[] {
  return [...new Set(exercises.map((e) => e.day_number))].sort((a, b) => a - b);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** The first date on or after `iso` that falls on one of `days`. */
export function firstTrainingDateFrom(iso: string, days: number[]): string {
  for (let i = 0; i < 7; i++) {
    const candidate = addDays(iso, i);
    if (days.includes(programDayNumber(parseIsoDate(candidate)))) return candidate;
  }
  return iso;
}

/** The session after `day` in the program's order, wrapping to the start of the week. */
export function nextDayInCycle(day: number, days: number[]): number {
  return days.find((d) => d > day) ?? days[0];
}

/** Where the client is up to. Before they first complete or move anything, it's the first session from the day they started. */
export function currentSession(
  assignment: Pick<ClientProgram, "started_on" | "current_day" | "due_on">,
  days: number[],
): ProgramSession | null {
  if (days.length === 0) return null;
  if (assignment.current_day && assignment.due_on && days.includes(assignment.current_day)) {
    return { day: assignment.current_day, dueOn: assignment.due_on };
  }
  const dueOn = firstTrainingDateFrom(assignment.started_on, days);
  return { day: programDayNumber(parseIsoDate(dueOn)), dueOn };
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

/** "Workout A" for a weekly program's day, or the weekday name if it has no title. */
export function sessionTitle(program: Pick<Program, "day_titles">, day: number): string {
  return program.day_titles[day - 1] || WEEKDAY_NAMES[day - 1];
}

/** "Wednesday" for "2026-10-07". */
export function weekdayOf(iso: string): string {
  return WEEKDAY_NAMES[programDayNumber(parseIsoDate(iso)) - 1];
}
