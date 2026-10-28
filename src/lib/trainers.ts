// Plain helpers for multi-trainer support (see migration 0029). Kept free of
// Supabase and React Native imports so they can be unit tested.
import { imageExtension } from "@/lib/avatars";
import type { EftDetails } from "@/types/database";

export const TRAINER_LOGO_BUCKET = "trainer-logos";

// The order and wording the payment screen uses, and the trainer edits.
export const EFT_FIELDS: { key: keyof EftDetails; label: string }[] = [
  { key: "account_holder", label: "Account holder" },
  { key: "bank", label: "Bank" },
  { key: "account_type", label: "Account type" },
  { key: "branch_code", label: "Branch code" },
  { key: "account_number", label: "Account number" },
];

// Only the fields the trainer actually filled in, ready to show.
export function eftRows(details: EftDetails | null | undefined): { label: string; value: string }[] {
  return EFT_FIELDS.map(({ key, label }) => ({ label, value: (details?.[key] ?? "").trim() })).filter(
    (row) => row.value.length > 0
  );
}

// Codes are stored upper case without spaces; people type them however.
export function normalizeJoinCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function trainerDisplayName(trainer: { name: string; business_name?: string | null }): string {
  const business = trainer.business_name?.trim();
  return business ? business : trainer.name;
}

// A fresh name per upload, so phones that cached the old logo don't keep it.
export function logoStoragePath(trainerId: string, mimeType: string | null | undefined, now = Date.now()): string {
  return `${trainerId}/logo-${now}.${imageExtension(mimeType)}`;
}

// Free trial and referral rewards (0060).
export const TRIAL_DAYS = 30;
export const REFERRAL_DISCOUNT_PERCENT = 25;
export const REFERRALS_PER_FREE_MONTH = 100 / REFERRAL_DISCOUNT_PERCENT;
// A referral only counts once the referred trainer has stayed this long after
// their free trial (0166, GRIZZ 2026-10-28).
export const REFERRAL_WAIT_MONTHS = 3;

/** Days left in a trial (0 on the last day), or null with no trial. Negative once it's over. */
export function trialDaysLeft(trialEndsAt: string | null | undefined, today: string): number | null {
  if (!trialEndsAt) return null;
  const end = Date.UTC(+trialEndsAt.slice(0, 4), +trialEndsAt.slice(5, 7) - 1, +trialEndsAt.slice(8, 10));
  const now = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round((end - now) / 86_400_000);
}

/** "Free trial: 5 days left", "Free trial ends today", "Free trial ended". */
export function trialLabel(trialEndsAt: string | null | undefined, today: string): string | null {
  const left = trialDaysLeft(trialEndsAt, today);
  if (left === null) return null;
  if (left < 0) return "Free trial ended";
  if (left === 0) return "Free trial ends today";
  return `Free trial: ${left} day${left === 1 ? "" : "s"} left`;
}

/**
 * Referral rewards: each referral that counts (stayed 3 months after their
 * trial, see referral_counted_at) is 25% off a month; 4 make a free month.
 */
export function referralRewards(countedReferrals: number, creditsUsed: number) {
  const unused = Math.max(0, countedReferrals - creditsUsed);
  return {
    earned: countedReferrals,
    unused,
    unusedPercent: unused * REFERRAL_DISCOUNT_PERCENT,
    freeMonths: Math.floor(unused / REFERRALS_PER_FREE_MONTH),
    toNextFreeMonth: REFERRALS_PER_FREE_MONTH - (unused % REFERRALS_PER_FREE_MONTH),
  };
}

/** How many of the trainers someone referred count for the 25% (stamped by referral_rewards()). */
export function countedReferrals(everyone: { referred_by: string | null; referral_counted_at?: string | null }[], trainerId: string): number {
  return everyone.filter((t) => t.referred_by === trainerId && !!t.referral_counted_at).length;
}

/** One of a trainer's referrals, from my_referral_progress() (0166). */
export type ReferralProgress = { name: string; approved: boolean; counts_from: string | null; counted: boolean };

/** "Counts from 30 Apr 2027", "+25%" or "Waiting for approval" for a referral row. */
export function referralStatusLabel(r: Pick<ReferralProgress, "approved" | "counts_from" | "counted">): string {
  if (r.counted) return `+${REFERRAL_DISCOUNT_PERCENT}%`;
  if (!r.approved) return "Waiting for approval";
  if (!r.counts_from) return `Counts after ${REFERRAL_WAIT_MONTHS} months`;
  const [y, m, d] = r.counts_from.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `Counts from ${d} ${month} ${y}`;
}

// A trainer must sign the current agreement before using the app. The app
// owner runs the app and is the other party to it, so never needs to.
export function needsAgreement(
  trainer: { is_owner: boolean; agreement_version: string | null },
  currentVersion: string
): boolean {
  return !trainer.is_owner && trainer.agreement_version !== currentVersion;
}

// A typed signature must look like a real name: at least two characters.
export function isValidSignature(name: string): boolean {
  return name.trim().length > 1;
}
