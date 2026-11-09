// Log-in help for someone who forgot their password or signed up with a
// mistyped email (GRIZZ, 2026-11-09). The app has no email sending set up, so
// a trainer does it for their own client from the client's page, and the app
// owner can do it for anyone except another owner.
//
//   { action: "get",      userId }          -> { email }
//   { action: "password", userId }          -> { email, password }  (a new easy-to-read password)
//   { action: "email",    userId, email }   -> { email }            (fixes the log-in email)
//
// Deployed with verify_jwt on. Who's asking always comes from their token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-client",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Easy to read out on a call or type from a WhatsApp: no 0/O or 1/l/I.
const WORDS = ["Gold", "Tiger", "Lion", "Eagle", "River", "Storm", "Power", "Strong", "Rocket", "Summit", "Bolt", "Rhino"];
function newPassword(): string {
  const n = new Uint32Array(3);
  crypto.getRandomValues(n);
  const a = WORDS[n[0] % WORDS.length];
  let b = WORDS[n[1] % WORDS.length];
  if (b === a) b = WORDS[(n[1] + 1) % WORDS.length];
  const digits = String(2000 + (n[2] % 7000)).replace(/[01]/g, "7");
  return `${a}-${b}-${digits}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Not signed in" });
  const callerId = userData.user.id;

  let body: { action?: string; userId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const { action, userId } = body;
  if (!userId || !["get", "password", "email"].includes(action ?? "")) return json(400, { error: "Bad request" });
  if (userId === callerId) return json(400, { error: "Change your own password under Account." });

  const [{ data: caller }, { data: client }, { data: targetTrainer }] = await Promise.all([
    admin.from("trainers").select("id, is_owner").eq("id", callerId).maybeSingle(),
    admin.from("clients").select("id, trainer_id").eq("id", userId).maybeSingle(),
    admin.from("trainers").select("id, is_owner").eq("id", userId).maybeSingle(),
  ]);
  if (!caller) return json(403, { error: "Only trainers can do this." });
  const ownClient = !!client && client.trainer_id === callerId && !targetTrainer;
  const ownerMayHelp = caller.is_owner === true && !targetTrainer?.is_owner;
  if (!ownClient && !ownerMayHelp) return json(403, { error: "You can only help your own clients log in." });

  const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
  if (targetError || !target.user) return json(404, { error: "Couldn't find their log-in." });

  if (action === "get") return json(200, { email: target.user.email ?? null });

  if (action === "password") {
    const password = newPassword();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json(500, { error: error.message });
    return json(200, { email: target.user.email ?? null, password });
  }

  // action === "email"
  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json(400, { error: "That doesn't look like an email address." });
  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return json(taken ? 409 : 500, { error: taken ? "Someone already logs in with that email." : error.message });
  }
  // Keep the email on their client or trainer details the same as the log-in.
  if (client) await admin.from("clients").update({ email }).eq("id", userId);
  if (targetTrainer) await admin.from("trainers").update({ email }).eq("id", userId);
  return json(200, { email });
});
