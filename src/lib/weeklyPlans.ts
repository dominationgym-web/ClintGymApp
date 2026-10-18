import { addDays } from "@/lib/programSchedule";
import { planProgramDates } from "@/lib/trainingSplits";

// Programs go on the calendar one week at a time (GRIZZ, 2026-10-18, 0113).
// A plan's weeks run 7 days at a time from its start day; the trainer adds
// each next week with Go ahead once the client has 2 or fewer workouts left.

export type WeeklyPlan = {
  start_date: string;
  split_days: number[];
  weeks: number;
  placed_until: string;
};

/** The plan's last day. */
export function planEnd(plan: Pick<WeeklyPlan, "start_date" | "weeks">): string {
  return addDays(plan.start_date, plan.weeks * 7 - 1);
}

/** Which week of the plan a day is in, from 1. */
export function planWeekOf(plan: Pick<WeeklyPlan, "start_date">, date: string): number {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${plan.start_date}T12:00:00Z`)) / 86400000);
  return Math.floor(days / 7) + 1;
}

/** The first week's last day: a week on, or the plan's end if that's sooner. */
export function firstWeekEnd(plan: Pick<WeeklyPlan, "start_date" | "weeks">): string {
  const end = addDays(plan.start_date, 6);
  const last = planEnd(plan);
  return end < last ? end : last;
}

/** The next week to add after what's placed, or null when every week is on the calendar. */
export function nextPlanWeek(plan: WeeklyPlan): { from: string; to: string; week: number } | null {
  const last = planEnd(plan);
  if (plan.placed_until >= last) return null;
  const from = addDays(plan.placed_until, 1);
  const to = addDays(plan.placed_until, 7);
  return { from, to: to < last ? to : last, week: planWeekOf(plan, from) };
}

/** The plan's sessions between two days, from the program's session slots. */
export function planSessionsBetween(plan: WeeklyPlan, slots: number[], from: string, to: string) {
  return planProgramDates(plan.start_date, plan.split_days, slots, plan.weeks).filter((p) => p.date >= from && p.date <= to);
}
