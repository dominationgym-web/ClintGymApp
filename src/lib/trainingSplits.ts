import { parseIsoDate } from "@/lib/dates";
import { addDays } from "@/lib/programSchedule";

// Planning a whole program onto a client's calendar (GRIZZ, 2026-10-17): the
// trainer taps the start day, picks a program, then a split, and the
// program's sessions are laid in order over those weekdays. Sunday is always
// a rest day, so no split uses it.

export type SplitKey = "tue_thu" | "mon_wed_fri" | "mon_tue_thu_fri" | "mon_fri" | "mon_sat";

/** Weekdays are 1 = Monday … 6 = Saturday. */
export const TRAINING_SPLITS: { key: SplitKey; label: string; days: number[] }[] = [
  { key: "tue_thu", label: "Tue · Thu", days: [2, 4] },
  { key: "mon_wed_fri", label: "Mon · Wed · Fri", days: [1, 3, 5] },
  { key: "mon_tue_thu_fri", label: "Mon · Tue · Thu · Fri", days: [1, 2, 4, 5] },
  { key: "mon_fri", label: "Mon to Fri", days: [1, 2, 3, 4, 5] },
  { key: "mon_sat", label: "Mon to Sat", days: [1, 2, 3, 4, 5, 6] },
];

export const WEEK_CHOICES = [4, 6, 8, 12];

export function findSplit(key: SplitKey) {
  return TRAINING_SPLITS.find((s) => s.key === key)!;
}

/** 1 = Monday … 7 = Sunday. */
export function weekdayOfIso(iso: string): number {
  return ((parseIsoDate(iso).getDay() + 6) % 7) + 1;
}

/** How many sessions a program has in its first week (slots are (week - 1) * 7 + weekday). */
export function sessionsPerWeek(slots: number[]): number {
  return slots.filter((s) => s <= 7).length || Math.min(slots.length, 3);
}

/** The split that matches a program's own number of days a week. */
export function suggestedSplit(perWeek: number): SplitKey {
  if (perWeek <= 2) return "tue_thu";
  if (perWeek === 3) return "mon_wed_fri";
  if (perWeek === 4) return "mon_tue_thu_fri";
  if (perWeek === 5) return "mon_fri";
  return "mon_sat";
}

/** A sensible length: the program's own weeks when it has several, else 4. */
export function defaultWeeks(programWeeks: number | null | undefined): number {
  return programWeeks && programWeeks > 1 ? programWeeks : 4;
}

/** Weeks to get through every session of the program once on `daysPerWeek` days. */
export function weeksToFinish(sessions: number, daysPerWeek: number): number {
  return daysPerWeek > 0 ? Math.ceil(sessions / daysPerWeek) : 0;
}

/**
 * A program on a split with a different number of days (review 2026-10-18):
 * the sessions still go in order, so its easy weeks come after the same
 * training as written, just in a different calendar week. The trainer sees
 * how long it takes and where the easy weeks land, and the length defaults
 * to the whole program. Null when the split matches.
 */
export function splitNote(
  plan: { date: string; slot: number }[],
  perWeek: number,
  daysPerWeek: number,
  sessions: number,
  easyWeeks: number[],
): string | null {
  if (perWeek === daysPerWeek || plan.length === 0) return null;
  const weeks = weeksToFinish(sessions, daysPerWeek);
  const start = plan[0].date;
  const calendarWeek = (date: string) => Math.floor((parseIsoDate(date).getTime() - parseIsoDate(start).getTime()) / (7 * 86_400_000)) + 1;
  const landed = easyWeeks
    .map((w) => {
      const first = plan.find((p) => Math.floor((p.slot - 1) / 7) + 1 === w);
      return first ? `program week ${w} from calendar week ${calendarWeek(first.date)}` : null;
    })
    .filter((x): x is string => !!x);
  const pace =
    daysPerWeek < perWeek
      ? `This program has ${perWeek} sessions a week. On ${daysPerWeek} days it takes ${weeks} weeks to finish.`
      : `This program has ${perWeek} sessions a week. On ${daysPerWeek} days it finishes in ${weeks} weeks, with less rest between sessions for the same muscles. Leave a day between hard sessions for the same body parts where you can.`;
  const easy = landed.length ? ` Its easy weeks stay after the same training: ${landed.join(", ")}.` : "";
  return pace + easy;
}

/**
 * Each training date from `start` for `weeks` weeks on the split's weekdays,
 * with the program session (slot) it gets. Sessions go in order and start
 * again from the first when the program runs out.
 */
export function planProgramDates(start: string, days: number[], slots: number[], weeks: number): { date: string; slot: number }[] {
  if (slots.length === 0 || days.length === 0) return [];
  const out: { date: string; slot: number }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    const weekday = weekdayOfIso(date);
    if (weekday === 7 || !days.includes(weekday)) continue;
    out.push({ date, slot: slots[out.length % slots.length] });
  }
  return out;
}

/**
 * Adding a program alongside what's already planned (GRIZZ, 2026-10-18:
 * "Clients should be able to do more than 1 thing a day"): days with nothing
 * on them get it as their workout, days that already have a workout keep it
 * and get the new session as an extra block under it.
 */
export function splitAlongside<T extends { date: string }>(plan: T[], takenDates: Iterable<string>): { mains: T[]; extras: T[] } {
  const taken = new Set(takenDates);
  return { mains: plan.filter((p) => !taken.has(p.date)), extras: plan.filter((p) => taken.has(p.date)) };
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Picked days as a label, e.g. "Tue · Fri". */
export function daysLabel(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d - 1]).join(" · ");
}

/** Taps a weekday on or off in the trainer's own pick (Monday to Saturday). */
export function toggleDay(days: number[], day: number): number[] {
  if (day < 1 || day > 6) return days;
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/**
 * Days that change every week (GRIZZ, 2026-10-19: a client who trains twice
 * a week on different days): the next week's picked days from `from` to `to`
 * get the program's sessions in order, carrying on after the `done` sessions
 * already placed.
 */
export function planWeekDates(from: string, to: string, days: number[], slots: number[], done: number): { date: string; slot: number }[] {
  if (slots.length === 0 || days.length === 0) return [];
  const out: { date: string; slot: number }[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOfIso(date);
    if (weekday === 7 || !days.includes(weekday)) continue;
    out.push({ date, slot: slots[(done + out.length) % slots.length] });
  }
  return out;
}
