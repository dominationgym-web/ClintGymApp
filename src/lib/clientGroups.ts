import type { Client } from "@/types/database";

// The trainer's Clients tab is split into four tabs, worked out from fields the
// app already keeps, so nothing new has to be stored.

export type ClientGroup = "active" | "approval" | "payment" | "dormant";

export const CLIENT_GROUPS: { key: ClientGroup; label: string; helper: string; empty: string }[] = [
  {
    key: "active",
    label: "Active",
    helper: "Orange: plan ends soon.",
    empty: "No active clients.",
  },
  {
    key: "approval",
    label: "New",
    helper: "Check their intake, then Activate once paid.",
    empty: "Nobody is waiting.",
  },
  {
    key: "payment",
    label: "Unpaid",
    helper: "Plan ended in the last 30 days.",
    empty: "Nobody owes a renewal.",
  },
  {
    key: "dormant",
    label: "Dormant",
    helper: "Archived or ended over 30 days ago. Data is kept.",
    empty: "No dormant clients.",
  },
];

/** Days after a plan ends before an unpaid client counts as dormant. */
export const DORMANT_AFTER_DAYS = 30;

type GroupFields = Pick<Client, "access_status" | "archived_at" | "plan_started_at" | "plan_expires_at" | "returned_at">;

export function clientGroup(c: GroupFields, todayIso: string): ClientGroup {
  if (c.archived_at) return "dormant";
  if (c.access_status !== "expired") return "active";
  // Never switched on, or brought back from the archive and not switched on since.
  if (!c.plan_started_at) return "approval";
  if (c.returned_at && c.plan_started_at < c.returned_at.slice(0, 10)) return "approval";
  if (c.plan_expires_at && daysSince(c.plan_expires_at, todayIso) > DORMANT_AFTER_DAYS) return "dormant";
  return "payment";
}

function daysSince(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / 86_400_000);
}
