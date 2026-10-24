// Plain helpers for trainer billing (0064). Kept free of Supabase and React
// Native imports so they can be unit tested.
import { REFERRAL_DISCOUNT_PERCENT, trialDaysLeft } from "@/lib/trainers";
import type { BillingCurrency, BillingPlan, BillingPrices, ClientActivation, ClientTier, TrainerBillingMonth, TrainerPayment } from "@/types/database";

export const PLANS: BillingPlan[] = ["monthly", "six_months", "yearly"];
export const CURRENCIES: BillingCurrency[] = ["USD", "ZAR"];

export const PLAN_LABEL: Record<BillingPlan, string> = {
  monthly: "Monthly",
  six_months: "6 months upfront",
  yearly: "1 year upfront",
};

export const PLAN_MONTHS: Record<BillingPlan, 1 | 6 | 12> = { monthly: 1, six_months: 6, yearly: 12 };

export const CURRENCY_LABEL: Record<BillingCurrency, string> = {
  USD: "US dollars (international)",
  ZAR: "Rand (South Africa)",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "$50", "$12.50", "R2 500". */
export function money(amount: number, currency: BillingCurrency | null | undefined): string {
  const rounded = Math.round(amount * 100) / 100;
  const [whole, cents] = rounded.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, currency === "ZAR" ? " " : ",");
  const text = cents === "00" ? grouped : `${grouped}.${cents}`;
  return currency === "ZAR" ? `R${text}` : `$${text}`;
}

export function planPrice(prices: BillingPrices, currency: BillingCurrency, plan: BillingPlan): number {
  return Number(prices[currency]?.[plan] ?? 0);
}

/**
 * Client fees for `active` clients when the first `included` are free
 * (free-use trainers pass 0). Same sum as client_fee_total() in 0141.
 */
export function clientFeeTotal(tiers: ClientTier[], currency: BillingCurrency, active: number, included: number): number {
  let total = 0;
  let prev = 0;
  for (const tier of tiers) {
    total += Math.max(0, Math.min(active, tier.upto) - Math.max(included, prev)) * Number(tier[currency] ?? 0);
    prev = tier.upto;
  }
  return total;
}

/** "Clients 6-15: R50 each", one line per tier, then "66+ free". */
export function clientTierLines(tiers: ClientTier[], currency: BillingCurrency, included: number): string[] {
  const lines: string[] = [];
  let prev = 0;
  for (const tier of tiers) {
    const from = Math.max(prev, included) + 1;
    if (from <= tier.upto) lines.push(`Clients ${from}-${tier.upto}: ${money(Number(tier[currency] ?? 0), currency)} each`);
    prev = tier.upto;
  }
  if (tiers.length > 0) lines.push(`Clients ${prev + 1}+: free`);
  return lines;
}

/** Each unused referral is 25% off one month of the trainer's plan. */
export function referralCreditValue(prices: BillingPrices, currency: BillingCurrency, credits: number): number {
  return (credits * REFERRAL_DISCOUNT_PERCENT * planPrice(prices, currency, "monthly")) / 100;
}

/** What a plan payment comes to after using referral credit, never below 0. */
export function planAmountDue(prices: BillingPrices, currency: BillingCurrency, plan: BillingPlan, creditsToUse: number): number {
  return Math.max(0, planPrice(prices, currency, plan) - referralCreditValue(prices, currency, creditsToUse));
}

/** How many credits it takes to cover a plan payment (so none are wasted). */
export function creditsUsable(prices: BillingPrices, currency: BillingCurrency, plan: BillingPlan, unused: number): number {
  const perCredit = referralCreditValue(prices, currency, 1);
  if (perCredit <= 0) return 0;
  return Math.min(unused, Math.ceil(planPrice(prices, currency, plan) / perCredit));
}

/**
 * Referral credits that can come off client fees (free-use trainers pay no
 * plan, GRIZZ 2026-10-14): whole credits, each worth 25% of a month's plan,
 * never more than what's owed.
 */
export function feeCreditsUsable(prices: BillingPrices, currency: BillingCurrency, owed: number, unused: number): number {
  const perCredit = referralCreditValue(prices, currency, 1);
  if (perCredit <= 0 || owed <= 0) return 0;
  return Math.min(unused, Math.floor(owed / perCredit));
}

/** "12 Nov 2026" */
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${SHORT_MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** "October 2026" for any date in that month. */
export function monthLabel(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** First day of the month, as YYYY-MM-01. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Half-years run Jan-Jun and Jul-Dec: "2026-H2". */
export function halfYearKey(iso: string): string {
  return `${iso.slice(0, 4)}-H${Number(iso.slice(5, 7)) <= 6 ? 1 : 2}`;
}

/** "Jul - Dec 2026" */
export function halfYearLabel(key: string): string {
  const [year, half] = key.split("-H");
  return half === "1" ? `Jan - Jun ${year}` : `Jul - Dec ${year}`;
}

/**
 * The day a free-use trainer's per-client fees begin (0096): the 1st of the
 * month on or after 6 months from the start, because fees are worked out per
 * calendar month. 14 Oct -> 1 May, 1 Oct -> 1 Apr. Same as free_use_fees_start.
 */
export function freeUseFeesStart(fromIso: string): string {
  const y = +fromIso.slice(0, 4);
  const m = +fromIso.slice(5, 7) - 1 + 6;
  const d = +fromIso.slice(8, 10);
  const start = new Date(Date.UTC(y, m, 1));
  if (d > 1) start.setUTCMonth(start.getUTCMonth() + 1);
  return start.toISOString().slice(0, 10);
}

export type PlanState =
  | { kind: "none" }
  | { kind: "freeUse"; feesFrom: string }
  | { kind: "trial"; until: string }
  | { kind: "paid"; until: string; daysLeft: number }
  | { kind: "overdue"; since: string };

/** Where a trainer's plan stands today. */
export function planState(
  t: { billing_started_on: string | null; paid_until: string | null; trial_ends_at?: string | null; free_use_from?: string | null },
  today: string,
): PlanState {
  if (t.free_use_from) return { kind: "freeUse", feesFrom: freeUseFeesStart(t.free_use_from) };
  if (!t.billing_started_on) {
    const left = trialDaysLeft(t.trial_ends_at ?? null, today);
    return left !== null && left >= 0 ? { kind: "trial", until: t.trial_ends_at! } : { kind: "none" };
  }
  if (t.billing_started_on > today) return { kind: "trial", until: t.billing_started_on };
  const until = t.paid_until;
  if (!until || until < today) {
    // Overdue from the day after it was paid up to (or from the start).
    return { kind: "overdue", since: until ? addDay(until) : t.billing_started_on };
  }
  return { kind: "paid", until, daysLeft: trialDaysLeft(until, today) ?? 0 };
}

export function planStateLabel(state: PlanState): string {
  switch (state.kind) {
    case "none":
      return "No plan set";
    case "freeUse":
      return `🎁 Free use: no subscription. Per-client fees from ${shortDate(state.feesFrom)}`;
    case "trial":
      return `Free until ${shortDate(state.until)}`;
    case "paid":
      return state.daysLeft <= 3
        ? `Due ${state.daysLeft === 0 ? "today" : `in ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"}`}`
        : `Paid until ${shortDate(state.until)}`;
    case "overdue":
      return `Overdue since ${shortDate(state.since)}`;
  }
}

function addDay(iso: string): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1));
  return d.toISOString().slice(0, 10);
}

type Amounts = Partial<Record<BillingCurrency, number>>;

export type HalfYearTotals = {
  key: string;
  label: string;
  activations: number;
  clientFees: Amounts;
  planPayments: Amounts;
  feePayments: Amounts;
  referrals: number;
};

function add(target: Amounts, currency: BillingCurrency | null, amount: number) {
  const c = currency ?? "USD";
  target[c] = (target[c] ?? 0) + Number(amount);
}

/** "$120 + R1 800", or "-" when there's nothing. */
export function amountsLabel(amounts: Amounts): string {
  const parts = CURRENCIES.filter((c) => (amounts[c] ?? 0) > 0).map((c) => money(amounts[c]!, c));
  return parts.length ? parts.join(" + ") : "-";
}

/**
 * Six-monthly totals, newest first: client sign-up activations, client fees
 * billed, payments received and trainer referrals approved.
 */
export function halfYearTotals(input: {
  months: Pick<TrainerBillingMonth, "month" | "client_fee" | "currency">[];
  payments: (Pick<TrainerPayment, "paid_on" | "amount" | "currency" | "kind"> & { note?: string | null })[];
  activations: Pick<ClientActivation, "activated_on">[];
  referralApprovals: string[];
}): HalfYearTotals[] {
  const byKey = new Map<string, HalfYearTotals>();
  const get = (iso: string) => {
    const key = halfYearKey(iso);
    let row = byKey.get(key);
    if (!row) {
      row = { key, label: halfYearLabel(key), activations: 0, clientFees: {}, planPayments: {}, feePayments: {}, referrals: 0 };
      byKey.set(key, row);
    }
    return row;
  };
  for (const m of input.months) add(get(m.month).clientFees, m.currency, m.client_fee);
  // Referral credit rows lower what's owed but aren't money received.
  for (const p of input.payments.filter((x) => !isReferralCredit(x.note))) add(p.kind === "subscription" ? get(p.paid_on).planPayments : get(p.paid_on).feePayments, p.currency, p.amount);
  for (const a of input.activations) get(a.activated_on).activations += 1;
  for (const r of input.referralApprovals) get(r).referrals += 1;
  return [...byKey.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** The currency a trainer is billed in: their set one, else from the country their phone was in at signup (0096). */
export function trainerCurrency(trainer: { billing_currency: BillingCurrency | null; signup_country?: string | null }): BillingCurrency {
  return trainer.billing_currency ?? (trainer.signup_country === "ZA" ? "ZAR" : "USD");
}

/** Where banked referral credit comes off: the plan payment, or client fees on free use. */
export function referralCreditUseLine(freeUse: boolean): string {
  return freeUse
    ? "You're on free use, so your banked referrals come off your monthly client fees."
    : "Your banked referrals come off your next plan payment.";
}

/** Whether the weekly referral pop-up is due: never shown, or shown 7 or more days ago. */
export function referralPopupDue(lastShownIso: string | null, todayIso: string): boolean {
  if (!lastShownIso) return true;
  const days = (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${lastShownIso}T00:00:00Z`)) / 86400000;
  return !(days < 7);
}

/** A client-fee row that is referral credit, not money received (see RecordPaymentModal). */
export function isReferralCredit(note: string | null | undefined): boolean {
  return !!note?.startsWith("Referral credit");
}
