// The "your plan ends soon" banner on Check-in (app-flow review C8,
// 2026-10-18). The server also sends a push 7 days before (0058); this keeps
// the reminder in view every day of that last week.
import { parseIsoDate, toIsoDate } from "@/lib/dates";

export const PLAN_ENDING_DAYS = 7;

export type PlanEnding = { endsOn: string; daysLeft: number };

/** When the plan ends within the next 7 days (today counts), else null. */
export function planEndingSoon(planExpiresAt: string | null | undefined, today: string): PlanEnding | null {
  if (!planExpiresAt) return null;
  const endsOn = toIsoDate(new Date(planExpiresAt));
  const daysLeft = Math.round((parseIsoDate(endsOn).getTime() - parseIsoDate(today).getTime()) / 86_400_000);
  if (daysLeft < 0 || daysLeft > PLAN_ENDING_DAYS) return null;
  return { endsOn, daysLeft };
}

/** "today", "tomorrow" or "on Friday 24 October". */
export function planEndingWhen(p: PlanEnding): string {
  if (p.daysLeft === 0) return "today";
  if (p.daysLeft === 1) return "tomorrow";
  return `on ${parseIsoDate(p.endsOn).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}`;
}
