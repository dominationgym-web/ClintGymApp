// Trainers pay Daily Evolution by card on the website (0136, GRIZZ
// 2026-10-19: website-first billing). Paystack takes the card on its own
// secure page; this function works out what's owed, starts the payment, and
// records each successful charge as a trainer_payments row (the same rows the
// owner records for EFT, so paid_until and client fees move on as before).
//
// Deployed with verify_jwt off because Paystack's webhook and the daily cron
// carry no Supabase token. Every other action checks the caller's token here
// and only ever acts on the caller's own trainer row.
//
// Actions (POST, JSON body { action, ... }):
//   quote     what the signed-in trainer owes now, and their saved card
//   checkout  start a card payment for what's owed; returns Paystack's page
//   save_card start a R5 charge to save a new card; refunded once it goes through
//   cancel    stop automatic payments and remove the saved card
//   verify    record a payment when the trainer comes back from Paystack
//   daily     (pg_cron, x-cron-secret) charge saved cards for anything owed
// Banked referral credit (each counted referral = 25% of a month's plan,
// 0166) comes off automatically: off the plan payment, or off client fees for
// free-use trainers, the same way the owner's Record payment uses it.
// Paystack's webhook (x-paystack-signature) records charges too.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const PAYSTACK = "https://api.paystack.co";
const SITE = Deno.env.get("SITE_URL") ?? "https://consistent-change.expo.app";
const PLAN_MONTHS: Record<string, number> = { monthly: 1, six_months: 6, yearly: 12 };
// Saving a new card charges this much and refunds it.
const CARD_CHECK_CENTS = 500;
// A saved card that failed isn't tried again for this many days.
const RETRY_DAYS = 3;
// Each counted referral is this much of a month's plan (src/lib/trainers.ts).
const REFERRAL_DISCOUNT_PERCENT = 25;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Admin = SupabaseClient;

type Quote = {
  currency: "USD" | "ZAR";
  plan_amount: number;
  plan_months: number | null;
  plan_label: string | null;
  fees_amount: number;
  // Banked referral credits used and what they take off.
  referral_credits: number;
  credit_amount: number;
  total: number;
  charged_currency: string;
  charged_cents: number;
};

function secretKey(): string | null {
  return Deno.env.get("PAYSTACK_SECRET_KEY") ?? null;
}

/** Whether the key is Paystack's test key (pretend cards) or the live one. */
function keyMode(): "test" | "live" | null {
  const key = secretKey();
  return key ? (key.startsWith("sk_test_") ? "test" : "live") : null;
}

async function paystack(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${PAYSTACK}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.status !== false, body };
}

/** Today's date in South Africa (UTC+2, no daylight saving). */
function saToday(): string {
  return new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const PLAN_LABEL: Record<string, string> = { monthly: "Monthly plan", six_months: "6-month plan", yearly: "1-year plan" };

/**
 * What a trainer owes now: their plan when it's due within `planWindow` days
 * (or overdue), plus client fees owed, less banked referral credit. Charged in
 * rand unless Paystack takes the trainer's currency.
 */
async function quote(admin: Admin, trainerId: string, planWindow: number): Promise<Quote | null> {
  const [{ data: settings }, { data: trainer }, { data: status }, { count: counted }] = await Promise.all([
    admin.from("billing_settings").select("*").eq("id", 1).single(),
    admin
      .from("trainers")
      .select("billing_plan, billing_currency, billing_started_on, paid_until, free_use_from, is_owner, signup_country, referral_credits_used")
      .eq("id", trainerId)
      .maybeSingle(),
    admin.rpc("billing_status_for", { p_trainer: trainerId }),
    admin.from("trainers").select("id", { count: "exact", head: true }).eq("referred_by", trainerId).not("referral_counted_at", "is", null),
  ]);
  if (!settings || !trainer || trainer.is_owner) return null;
  const currency: "USD" | "ZAR" = trainer.billing_currency ?? (trainer.signup_country === "ZA" ? "ZAR" : "USD");
  const today = saToday();
  const paidThrough = trainer.paid_until ?? (trainer.billing_started_on ? addDays(trainer.billing_started_on, -1) : null);
  const planDue =
    !trainer.free_use_from &&
    !!trainer.billing_plan &&
    !!trainer.billing_started_on &&
    trainer.billing_started_on <= addDays(today, planWindow) &&
    !!paidThrough &&
    paidThrough < addDays(today, planWindow);
  const plan_amount = planDue ? Number(settings.prices?.[currency]?.[trainer.billing_plan] ?? 0) : 0;
  const fees_amount = Math.max(0, Number(status?.[0]?.client_fees_owed ?? 0));
  // Referral credit: enough whole credits to cover the plan (as creditsUsable
  // in src/lib/billing.ts), or for free use whole credits within the fees.
  const unused = Math.max(0, (counted ?? 0) - Number(trainer.referral_credits_used ?? 0));
  const perCredit = (REFERRAL_DISCOUNT_PERCENT * Number(settings.prices?.[currency]?.monthly ?? 0)) / 100;
  let referral_credits = 0;
  let credit_amount = 0;
  if (unused > 0 && perCredit > 0) {
    if (plan_amount > 0) {
      referral_credits = Math.min(unused, Math.ceil(plan_amount / perCredit));
      credit_amount = Math.min(plan_amount, referral_credits * perCredit);
    } else if (trainer.free_use_from && fees_amount > 0) {
      referral_credits = Math.min(unused, Math.floor(fees_amount / perCredit));
      credit_amount = referral_credits * perCredit;
    }
  }
  credit_amount = Math.round(credit_amount * 100) / 100;
  const total = Math.max(0, Math.round((plan_amount + fees_amount - credit_amount) * 100) / 100);
  const direct = (settings.card_currencies ?? ["ZAR"]).includes(currency);
  return {
    currency,
    plan_amount,
    plan_months: planDue ? PLAN_MONTHS[trainer.billing_plan] ?? null : null,
    plan_label: planDue ? PLAN_LABEL[trainer.billing_plan] ?? null : null,
    fees_amount,
    referral_credits,
    credit_amount,
    total,
    charged_currency: direct ? currency : "ZAR",
    charged_cents: Math.round(total * (direct ? 1 : Number(settings.usd_zar_rate)) * 100),
  };
}

function newReference(kind: string): string {
  return `de-${kind}-${crypto.randomUUID()}`;
}

/**
 * Records a charge once Paystack confirms it: marks it paid (only once, so
 * the webhook and the trainer's return can't both record it), adds the
 * trainer_payments rows, saves the card, and refunds a card check.
 */
async function settle(admin: Admin, reference: string): Promise<"paid" | "failed" | "pending" | "unknown"> {
  const { data: charge } = await admin.from("card_charges").select("*").eq("reference", reference).maybeSingle();
  if (!charge) return "unknown";
  if (charge.status !== "pending") return charge.status;

  const { ok, body } = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  const tx = body?.data;
  if (!ok || !tx) return "pending";
  if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
    await admin
      .from("card_charges")
      .update({ status: "failed", message: tx.gateway_response ?? tx.status, settled_at: new Date().toISOString() })
      .eq("reference", reference)
      .eq("status", "pending");
    return "failed";
  }
  if (tx.status !== "success") return "pending";
  if (Number(tx.amount) !== charge.charged_cents || String(tx.currency).toUpperCase() !== charge.charged_currency) {
    await admin
      .from("card_charges")
      .update({ status: "failed", message: `Amount mismatch: ${tx.currency} ${tx.amount}`, settled_at: new Date().toISOString() })
      .eq("reference", reference)
      .eq("status", "pending");
    return "failed";
  }

  const { data: won } = await admin
    .from("card_charges")
    .update({ status: "success", settled_at: new Date().toISOString(), message: null })
    .eq("reference", reference)
    .eq("status", "pending")
    .select("reference");
  if (!won?.length) return "paid";

  const auth = tx.authorization;
  if (auth?.reusable && auth.authorization_code) {
    const autopay = charge.kind === "auto" ? undefined : tx.metadata?.autopay !== false;
    await admin.from("trainer_cards").upsert({
      trainer_id: charge.trainer_id,
      authorization_code: auth.authorization_code,
      customer_code: tx.customer?.customer_code ?? null,
      email: tx.customer?.email ?? null,
      card_type: auth.card_type ?? auth.brand ?? null,
      last4: auth.last4 ?? null,
      exp_month: auth.exp_month ?? null,
      exp_year: auth.exp_year ?? null,
      bank: auth.bank ?? null,
      ...(autopay === undefined ? {} : { autopay }),
      updated_at: new Date().toISOString(),
    });
  }

  if (charge.kind === "card_check") {
    const refund = await paystack("/refund", { method: "POST", body: { transaction: reference } });
    await admin
      .from("card_charges")
      .update({ message: refund.ok ? "Refunded" : `Refund failed: ${refund.body?.message ?? "unknown"}` })
      .eq("reference", reference);
    return "paid";
  }

  const card = auth?.last4 ? `card ending ${auth.last4}` : "card";
  const error = await recordPayment(admin, charge, `Paid by ${card} (Paystack ${reference})`);
  if (error) {
    // Paid but not recorded: leave it for the owner to see on the charge.
    await admin.from("card_charges").update({ message: `Paid, but not recorded: ${error}` }).eq("reference", reference);
  }
  return "paid";
}

type Payable = {
  trainer_id: string;
  currency: string;
  plan_amount: number | string;
  plan_months: number | null;
  fees_amount: number | string;
  referral_credits?: number | null;
  credit_amount?: number | string | null;
};

/**
 * Adds the trainer_payments rows for a paid charge and marks any referral
 * credit used. Credit on a plan lowers the plan row; credit on client fees is
 * its own client-fee row, as Record payment does. Returns an error message.
 */
async function recordPayment(admin: Admin, charge: Payable, note: string): Promise<string | null> {
  const credits = Number(charge.referral_credits ?? 0);
  const credit = Number(charge.credit_amount ?? 0);
  const creditNote = `Referral credit: ${credits} × ${REFERRAL_DISCOUNT_PERCENT}%`;
  const rows = [];
  if (Number(charge.plan_amount) > 0) {
    rows.push({
      trainer_id: charge.trainer_id,
      kind: "subscription",
      amount: Math.max(0, Number(charge.plan_amount) - credit),
      currency: charge.currency,
      months: charge.plan_months,
      note: credits > 0 ? `${note}, ${creditNote}` : note,
    });
  } else if (credits > 0) {
    rows.push({ trainer_id: charge.trainer_id, kind: "client_fees", amount: credit, currency: charge.currency, note: creditNote });
  }
  const feesPaid = Number(charge.fees_amount) - (Number(charge.plan_amount) > 0 ? 0 : credit);
  if (feesPaid > 0) {
    rows.push({ trainer_id: charge.trainer_id, kind: "client_fees", amount: feesPaid, currency: charge.currency, note });
  }
  if (!rows.length) return null;
  const { error } = await admin.from("trainer_payments").insert(rows);
  if (error) return error.message;
  if (credits > 0) {
    const used = await admin.rpc("add_referral_credits_used", { p_trainer: charge.trainer_id, p_credits: credits });
    if (used.error) return `referral credit not marked used: ${used.error.message}`;
  }
  return null;
}

/** When referral credit covers everything owed: nothing to charge, just record it. */
async function recordCovered(admin: Admin, trainerId: string, q: Quote): Promise<string | null> {
  return recordPayment(admin, { trainer_id: trainerId, ...q }, "Covered by referral credit");
}

async function hmacSha512Hex(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Charges every saved card with automatic payments on for anything owed today. */
async function daily(admin: Admin) {
  const { data: settings } = await admin.from("billing_settings").select("card_billing_enabled").eq("id", 1).single();
  if (!settings?.card_billing_enabled) return { skipped: "card billing is off" };
  const { data: cards } = await admin.from("trainer_cards").select("*").eq("autopay", true);
  const since = new Date(Date.now() - RETRY_DAYS * 86400_000).toISOString();
  const results: Record<string, string> = {};
  for (const card of cards ?? []) {
    const { data: recent } = await admin
      .from("card_charges")
      .select("reference")
      .eq("trainer_id", card.trainer_id)
      .eq("kind", "auto")
      .in("status", ["failed", "pending"])
      .gte("created_at", since)
      .limit(1);
    if (recent?.length) {
      results[card.trainer_id] = "waiting to retry";
      continue;
    }
    const q = await quote(admin, card.trainer_id, 1);
    if (!q) continue;
    if (q.total <= 0) {
      if (q.referral_credits > 0) results[card.trainer_id] = (await recordCovered(admin, card.trainer_id, q)) ?? "covered by referral credit";
      continue;
    }
    const reference = newReference("auto");
    const { error } = await admin.from("card_charges").insert({
      reference,
      trainer_id: card.trainer_id,
      kind: "auto",
      currency: q.currency,
      plan_amount: q.plan_amount,
      plan_months: q.plan_months,
      fees_amount: q.fees_amount,
      referral_credits: q.referral_credits,
      credit_amount: q.credit_amount,
      charged_currency: q.charged_currency,
      charged_cents: q.charged_cents,
    });
    if (error) {
      results[card.trainer_id] = error.message;
      continue;
    }
    const { ok, body } = await paystack("/transaction/charge_authorization", {
      method: "POST",
      body: {
        authorization_code: card.authorization_code,
        email: card.email,
        amount: q.charged_cents,
        currency: q.charged_currency,
        reference,
        metadata: { trainer_id: card.trainer_id, kind: "auto" },
      },
    });
    if (!ok) {
      await admin
        .from("card_charges")
        .update({ status: "failed", message: body?.message ?? "Charge refused", settled_at: new Date().toISOString() })
        .eq("reference", reference);
      results[card.trainer_id] = "failed";
      continue;
    }
    results[card.trainer_id] = await settle(admin, reference);
  }
  return { results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const raw = await req.text();

  // Paystack's webhook: only trusted when signed with our secret key.
  const signature = req.headers.get("x-paystack-signature");
  if (signature) {
    const key = secretKey();
    if (!key || (await hmacSha512Hex(key, raw)) !== signature) return json(401, { error: "Bad signature" });
    const event = JSON.parse(raw);
    if (event?.event === "charge.success" && event.data?.reference) await settle(admin, String(event.data.reference));
    return json(200, { received: true });
  }

  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json(400, { error: "Bad request" });
  }

  if (body.action === "daily") {
    const secret = req.headers.get("x-cron-secret") ?? "";
    const { data: okSecret } = await admin.rpc("card_billing_secret_ok", { p_secret: secret });
    if (!okSecret) return json(401, { error: "Not allowed" });
    if (!secretKey()) return json(200, { skipped: "no Paystack key" });
    return json(200, await daily(admin));
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in" });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Not signed in" });
  const userId = userData.user.id;

  const [{ data: trainer }, { data: settings }] = await Promise.all([
    admin.from("trainers").select("id, is_owner, approved").eq("id", userId).maybeSingle(),
    admin.from("billing_settings").select("card_billing_enabled").eq("id", 1).single(),
  ]);
  if (!trainer) return json(403, { error: "Only trainers pay by card" });
  // Before launch only the owner can try it (with a test key).
  const allowed = !!settings?.card_billing_enabled || trainer.is_owner;
  const configured = !!secretKey();

  if (body.action === "quote") {
    const [q, { data: card }] = await Promise.all([
      quote(admin, userId, 7),
      admin.from("trainer_cards").select("card_type, last4, exp_month, exp_year, bank, autopay").eq("trainer_id", userId).maybeSingle(),
    ]);
    return json(200, { enabled: allowed && configured, mode: trainer.is_owner ? keyMode() : null, quote: q, card });
  }

  if (!allowed) return json(403, { error: "Card payments aren't switched on yet." });
  if (!configured) return json(503, { error: "Card payments aren't set up yet." });

  if (body.action === "verify") {
    const reference = String(body.reference ?? "");
    const { data: mine } = await admin.from("card_charges").select("trainer_id").eq("reference", reference).maybeSingle();
    if (!mine || mine.trainer_id !== userId) return json(404, { error: "Payment not found" });
    return json(200, { status: await settle(admin, reference) });
  }

  if (body.action === "cancel") {
    const { data: card } = await admin.from("trainer_cards").select("authorization_code").eq("trainer_id", userId).maybeSingle();
    if (card) {
      await paystack("/customer/deactivate_authorization", { method: "POST", body: { authorization_code: card.authorization_code } });
      await admin.from("trainer_cards").delete().eq("trainer_id", userId);
    }
    return json(200, { cancelled: true });
  }

  if (body.action === "checkout" || body.action === "save_card") {
    const email = userData.user.email;
    if (!email) return json(400, { error: "Your account has no email address." });
    const autopay = body.autopay !== false;
    let row;
    if (body.action === "checkout") {
      const q = await quote(admin, userId, 7);
      if (q && q.total <= 0 && q.referral_credits > 0) {
        const error = await recordCovered(admin, userId, q);
        return error ? json(500, { error }) : json(200, { covered: true });
      }
      if (!q || q.total <= 0) return json(400, { error: "Nothing to pay right now." });
      row = {
        kind: "checkout",
        currency: q.currency,
        plan_amount: q.plan_amount,
        plan_months: q.plan_months,
        fees_amount: q.fees_amount,
        referral_credits: q.referral_credits,
        credit_amount: q.credit_amount,
        charged_currency: q.charged_currency,
        charged_cents: q.charged_cents,
      };
    } else {
      row = { kind: "card_check", currency: "ZAR", charged_currency: "ZAR", charged_cents: CARD_CHECK_CENTS };
    }
    const reference = newReference(row.kind === "checkout" ? "pay" : "card");
    const { error } = await admin.from("card_charges").insert({ reference, trainer_id: userId, ...row });
    if (error) return json(500, { error: error.message });
    const { ok, body: started } = await paystack("/transaction/initialize", {
      method: "POST",
      body: {
        email,
        amount: row.charged_cents,
        currency: row.charged_currency,
        reference,
        channels: ["card"],
        callback_url: `${SITE}/app/`,
        metadata: { trainer_id: userId, kind: row.kind, autopay },
      },
    });
    if (!ok || !started?.data?.authorization_url) {
      await admin.from("card_charges").update({ status: "failed", message: started?.message ?? "Couldn't start" }).eq("reference", reference);
      return json(502, { error: started?.message ?? "Couldn't start the card payment." });
    }
    return json(200, { url: started.data.authorization_url, reference });
  }

  return json(400, { error: "Unknown action" });
});
