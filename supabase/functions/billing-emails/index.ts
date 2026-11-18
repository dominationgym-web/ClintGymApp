// Automatic "how to pay" emails for trainers (0226, GRIZZ 2026-11-17).
//
// The phone apps can't send trainers to the website to pay (Apple and Google
// don't allow it in South Africa), so this email does: it's sent outside the
// app, which both stores allow. billing_reminders and the approval trigger
// queue rows in billing_emails; this function sends them through Resend.
//
// Deployed with verify_jwt off because the hourly cron carries no Supabase
// token; the cron proves itself with the card-billing secret from Vault.
//
// Actions (POST, JSON body { action }):
//   send  (pg_cron, x-cron-secret) send everything queued in the last 3 days
//   test  (the owner, signed in) send a sample email to the owner's address
//
// Secrets: RESEND_API_KEY (required), EMAIL_FROM (optional, defaults to
// "Daily Evolution <billing@dailyevolution.co.za>"), SITE_URL (optional).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { billingEmail, type BillingEmailKind } from "./content.ts";

const SITE = Deno.env.get("SITE_URL") ?? "https://dailyevolution.co.za";
const FROM = Deno.env.get("EMAIL_FROM") ?? "Daily Evolution <billing@dailyevolution.co.za>";
// Rows older than this are never sent (a reminder that's days late would confuse).
const MAX_AGE_DAYS = 3;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sendEmail(to: string, email: { subject: string; html: string; text: string }): Promise<string | null> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return "Email isn't set up yet (no RESEND_API_KEY).";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: email.subject, html: email.html, text: email.text }),
  });
  if (res.ok) return null;
  const body = await res.text();
  return `Resend ${res.status}: ${body.slice(0, 300)}`;
}

async function sendQueued(admin: SupabaseClient) {
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await admin
    .from("billing_emails")
    .select("id, kind, details, trainer:trainers(name, business_name, email)")
    .is("sent_at", null)
    .is("error", null)
    .gte("created_at", since)
    .order("created_at")
    .limit(90);
  if (error) return { error: error.message };
  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const trainer = Array.isArray(row.trainer) ? row.trainer[0] : row.trainer;
    if (!trainer?.email) {
      await admin.from("billing_emails").update({ error: "No email address" }).eq("id", row.id);
      failed++;
      continue;
    }
    const email = billingEmail(row.kind as BillingEmailKind, row.details ?? {}, {
      name: trainer.name ?? trainer.business_name ?? "",
      site: SITE,
    });
    const problem = await sendEmail(trainer.email, email);
    await admin
      .from("billing_emails")
      .update(problem ? { error: problem } : { sent_at: new Date().toISOString() })
      .eq("id", row.id);
    if (problem) failed++;
    else sent++;
  }
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }

  if (body.action === "send") {
    const secret = req.headers.get("x-cron-secret") ?? "";
    const { data: okSecret } = await admin.rpc("card_billing_secret_ok", { p_secret: secret });
    if (!okSecret) return json(401, { error: "Not allowed" });
    const { data: settings } = await admin.from("billing_settings").select("billing_emails_enabled").eq("id", 1).single();
    if (!settings?.billing_emails_enabled) return json(200, { skipped: "switched off" });
    if (!Deno.env.get("RESEND_API_KEY")) return json(200, { skipped: "no RESEND_API_KEY" });
    return json(200, await sendQueued(admin));
  }

  if (body.action === "test") {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Not signed in" });
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return json(401, { error: "Not signed in" });
    const { data: owner } = await admin.from("trainers").select("name, email, is_owner").eq("id", userData.user.id).maybeSingle();
    if (!owner?.is_owner) return json(403, { error: "Only the app owner can send a test email." });
    const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const email = billingEmail("plan_due", { due_on: due, autopay: false }, { name: owner.name ?? "", site: SITE });
    const problem = await sendEmail(owner.email, { ...email, subject: `[Test] ${email.subject}` });
    return problem ? json(200, { error: problem }) : json(200, { sent: owner.email });
  }

  return json(400, { error: "Unknown action" });
});
