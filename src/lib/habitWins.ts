// Habit wins (0080): a client kept a habit on 5 of 7 days this week (or every
// day it's set for, if fewer). The trainer is alerted and writes the client a
// personal message (GRIZZ: no ready-made text).
import { toIsoDate } from "@/lib/dates";
import type { HabitWinRow } from "@/types/database";

export type HabitWin = HabitWinRow;
export type HabitWinHabit = HabitWinRow["habits"][number];

/** Monday of the week before `today`'s week: wins from then on still show. */
export function winsShownFrom(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday - 7);
  return toIsoDate(d);
}

/** "This week" or "Last week" for a win's week. */
export function winWeekLabel(weekStart: string, today: string): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return weekStart >= toIsoDate(d) ? "This week" : "Last week";
}

/** "Water 6/7 · Steps 5/7" */
export function habitsLine(habits: HabitWinHabit[]): string {
  return habits.map((h) => `${h.name} ${h.days}/7`).join(" · ");
}

/** A message counts once it says something; the trainer writes it themselves. */
export function isPersonalMessage(text: string): boolean {
  return text.trim().length >= 2;
}
