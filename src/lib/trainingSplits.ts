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
