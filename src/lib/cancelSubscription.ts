import { shortDate } from "@/lib/billing";

// Trainer cancels their own subscription (GRIZZ, 2026-11-18; migration 0220).
export const CANCEL_REASONS = [
  "Too expensive",
  "Not using it enough",
  "Stopped training clients",
  "Moving to another app",
  "Something else",
] as const;

/** What the cancel page says will happen, in order. */
export function cancelSummary(endsOn: string, freeMonths: number): string[] {
  return [
    `You keep full use until ${shortDate(endsOn)}${freeMonths > 0 ? ` (including ${freeMonths} free month${freeMonths === 1 ? "" : "s"} from your referrals)` : ""}. Nothing renews after that.`,
    "There's no refund for time already paid for.",
    "Your saved card is removed straight away, so nothing more is charged to it.",
    "We remind you a week before the end to tell your clients.",
    "After the end date your account and your clients' access are paused. Nothing is deleted for 90 days, so you can come back and find everything as it was.",
  ];
}
