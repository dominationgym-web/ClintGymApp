// Totals for the owner's tracker (0105): clients and money across every
// trainer, split South Africa (rand) and International (dollars). Kept free of
// Supabase and React Native imports so it can be unit tested.
import { PLAN_MONTHS } from "@/lib/billing";
import type { BillingCurrency, OwnerTrackerRow } from "@/types/database";

export type MoneyTotals = {
  /** Client fees due for this month (0 while trials and free months run). */
  clientFeesNow: number;
  /** Client fees a month once every trial and free period is over. */
  clientFeesFull: number;
  /** Trainers whose plan is paid up today. */
  paidSubs: number;
  /** What those plans bring in a month (6 months and yearly spread out). */
  subsMonthly: number;
  /** Plan and client-fee payments recorded since the 1st. */
  paidThisMonth: number;
};

export type TrackerTotals = {
  trainers: number;
  onTrial: number;
  freeUse: number;
  noRegion: number;
  clients: { active: number; total: number; sa: number; international: number; ownActive: number };
  money: Record<BillingCurrency, MoneyTotals>;
};

const empty = (): MoneyTotals => ({ clientFeesNow: 0, clientFeesFull: 0, paidSubs: 0, subsMonthly: 0, paidThisMonth: 0 });

export function trackerTotals(rows: OwnerTrackerRow[], today: string): TrackerTotals {
  const totals: TrackerTotals = {
    trainers: 0,
    onTrial: 0,
    freeUse: 0,
    noRegion: 0,
    clients: { active: 0, total: 0, sa: 0, international: 0, ownActive: 0 },
    money: { ZAR: empty(), USD: empty() },
  };
  for (const r of rows) {
    const active = Number(r.clients_active);
    totals.clients.active += active;
    totals.clients.total += Number(r.clients_total);
    if (r.region === "SA") totals.clients.sa += active;
    if (r.region === "International") totals.clients.international += active;
    if (r.is_owner) {
      totals.clients.ownActive += active;
      continue;
    }
    totals.trainers += 1;
    if (!r.region) totals.noRegion += 1;
    if (r.free_use) totals.freeUse += 1;
    else if (r.trial_ends_at && r.trial_ends_at >= today) totals.onTrial += 1;

    const m = totals.money[r.currency ?? "USD"];
    m.clientFeesNow += Number(r.client_fee_now);
    m.clientFeesFull += Number(r.client_fee_full);
    m.paidThisMonth += Number(r.paid_subs_month) + Number(r.paid_fees_month);
    const price = Number(r.plan_price);
    if (r.billing_plan && price > 0 && r.paid_until && r.paid_until >= today) {
      m.paidSubs += 1;
      m.subsMonthly += price / PLAN_MONTHS[r.billing_plan];
    }
  }
  return totals;
}

/** "Trial to 31 Oct", "Free use", "Monthly, paid to 12 Nov", "No plan yet". */
export function trainerPlanLine(r: OwnerTrackerRow, today: string): string {
  if (r.is_owner) return "Your own clients";
  if (r.free_use) return "Free use";
  if (r.trial_ends_at && r.trial_ends_at >= today) return `Trial to ${r.trial_ends_at.slice(8, 10).replace(/^0/, "")} ${monthShort(r.trial_ends_at)}`;
  if (r.billing_plan && r.paid_until && r.paid_until >= today) return "Paid";
  if (r.billing_plan) return "Payment due";
  return "No plan yet";
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthShort(iso: string): string {
  return SHORT[Number(iso.slice(5, 7)) - 1];
}

export type ClientIncomeRow = { trainer_id: string; currency: BillingCurrency; income: number; priced: number; unpriced: number };

/** What clients pay their trainers a month (0106), added up by currency. */
export function clientIncomeTotals(rows: ClientIncomeRow[]) {
  const totals = { ZAR: { income: 0, priced: 0 }, USD: { income: 0, priced: 0 }, unpriced: 0 };
  for (const r of rows) {
    const side = totals[r.currency === "USD" ? "USD" : "ZAR"];
    side.income += Number(r.income);
    side.priced += Number(r.priced);
    totals.unpriced += Number(r.unpriced);
  }
  return totals;
}
