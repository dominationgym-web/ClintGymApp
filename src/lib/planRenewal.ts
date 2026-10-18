import { parseIsoDate, toIsoDate } from "@/lib/dates";
import type { Client, PlanType } from "@/types/database";

/** How many days each plan the client picked at sign-up runs for. */
export function planDays(plan: PlanType): number {
  return plan === "intro_1mo" ? 30 : plan === "sub_6mo" ? 180 : 365;
}

export type PlanDates = { access_status: "active"; plan_started_at: string; plan_expires_at: string };

/**
 * The dates after the trainer confirms a payment. A client who pays before
 * their plan ends (active or expiring soon) keeps their start date and gets the
 * new plan added on from the current end date, so no paid days are lost. An
 * expired client, or one whose end date has already passed, starts again today.
 */
export function renewedPlanDates(
  client: Pick<Client, "access_status" | "plan_started_at" | "plan_expires_at" | "plan_type">,
  today: Date
): PlanDates | null {
  if (!client.plan_type) return null;
  const todayIsoDate = toIsoDate(today);
  const early =
    client.access_status !== "expired" &&
    !!client.plan_started_at &&
    !!client.plan_expires_at &&
    client.plan_expires_at >= todayIsoDate;
  const from = early ? parseIsoDate(client.plan_expires_at!) : today;
  const end = new Date(from);
  end.setDate(end.getDate() + planDays(client.plan_type));
  return {
    access_status: "active",
    plan_started_at: early ? client.plan_started_at! : todayIsoDate,
    plan_expires_at: toIsoDate(end),
  };
}
