import { supabase } from "@/lib/supabase";
import type { BillingCurrency } from "@/types/database";

// Trainers pay Daily Evolution by card on the website (0136, GRIZZ
// 2026-10-19). The card-billing Edge Function works out what's owed and
// talks to Paystack; the app only asks it and opens Paystack's page.

export type CardQuote = {
  currency: BillingCurrency;
  plan_amount: number;
  plan_months: number | null;
  plan_label: string | null;
  fees_amount: number;
  total: number;
  charged_currency: string;
  charged_cents: number;
};

export type SavedCard = {
  card_type: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  bank: string | null;
  autopay: boolean;
};

// mode is only sent to the owner: which Paystack key is set, if any.
export type CardBillingInfo = { enabled: boolean; mode?: "test" | "live" | null; quote: CardQuote | null; card: SavedCard | null };

export type CardCharge = {
  reference: string;
  trainer_id: string;
  kind: "checkout" | "auto" | "card_check";
  status: "pending" | "success" | "failed";
  charged_currency: string;
  charged_cents: number;
  message: string | null;
  created_at: string;
};

async function call<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("card-billing", { body });
  if (error) {
    // The function's own message, when it sent one.
    const message = await (error as { context?: Response }).context
      ?.json()
      .then((b: { error?: string }) => b.error)
      .catch(() => null);
    return { data: null, error: message ?? error.message };
  }
  return { data: data as T, error: null };
}

export const loadCardBilling = () => call<CardBillingInfo>({ action: "quote" });
export const startCardCheckout = (autopay: boolean) => call<{ url: string }>({ action: "checkout", autopay });
export const startSaveCard = (autopay = true) => call<{ url: string }>({ action: "save_card", autopay });
export const cancelCard = () => call<{ cancelled: boolean }>({ action: "cancel" });
export const verifyCardPayment = (reference: string) => call<{ status: string }>({ action: "verify", reference });

/** "Visa ending 4242, expires 12/28". */
export function cardLabel(card: SavedCard): string {
  const type = card.card_type ? card.card_type.trim().replace(/^\w/, (c) => c.toUpperCase()) : "Card";
  const expiry = card.exp_month && card.exp_year ? `, expires ${card.exp_month.padStart(2, "0")}/${card.exp_year.slice(-2)}` : "";
  return `${type} ending ${card.last4 ?? "????"}${expiry}`;
}

/** Whether a saved card has run out by the given month (YYYY-MM-DD). */
export function cardExpired(card: SavedCard, todayIso: string): boolean {
  if (!card.exp_month || !card.exp_year) return false;
  const year = Number(card.exp_year.length === 2 ? `20${card.exp_year}` : card.exp_year);
  const month = Number(card.exp_month);
  const nowYear = Number(todayIso.slice(0, 4));
  const nowMonth = Number(todayIso.slice(5, 7));
  return year < nowYear || (year === nowYear && month < nowMonth);
}

/** "R1 234.50" from Paystack cents, for a dollar bill charged in rand. */
export function chargedLabel(quote: CardQuote): string | null {
  if (quote.charged_currency === quote.currency) return null;
  const rand = (quote.charged_cents / 100).toFixed(2).replace(/\.00$/, "");
  return `R${rand.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}
