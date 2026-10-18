// The trainer's daily summary of a client's energy and needs (0114, GRIZZ,
// 2026-10-18). The app works out the client's last 7 days as plain facts
// (src/lib/clientSummary.ts) and sends them here; Claude writes a short
// summary and suggestions for the trainer, kept in client_daily_summaries for
// the day. Asked again the same day with the same facts, the saved one comes
// back without calling Claude.
//
// Deployed with verify_jwt on. Only the client's own trainer can ask. Needs
// the ANTHROPIC_API_KEY secret; without it this answers "no_key" and the app
// shows its own rule-based summary instead.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const ENERGY = ["High", "Good", "Low", "Very low", "Not enough info"];

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SYSTEM = `You help a personal trainer in an online coaching app decide how to coach a client.
You get the facts of the client's last 7 days: daily check-ins (sleep, alcohol, water, pain, tiredness, stress), their
"How are you doing?" answers, workouts planned and done, how hard their sets were, exercise they did outside the program,
habits, open problems and injuries. The app's own rule-based reading is included as a starting point.

Write for the trainer, not the client: plain, friendly South African English, no jargon, no medical diagnosis.
- energy: one of ${ENERGY.map((e) => `"${e}"`).join(", ")}.
- summary: 2 or 3 short sentences on how the client's week is going and what their energy and body need right now.
- suggestions: 2 to 4 short, specific things the trainer could decide (keep, lighten or progress next week's training,
  swap exercises for pain, rest, sleep, check in personally). Each under 25 words. Never write a message for the
  trainer to send to the client.
Only use what the facts say. If there is little data, say so.
Answer with only a JSON object: {"energy": "...", "summary": "...", "suggestions": ["..."]}`;

// jsonb doesn't keep key order, so compare facts with sorted keys.
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

type Summary = { energy: string; summary: string; suggestions: string[] };

function parseSummary(text: string): Summary | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (typeof o.summary !== "string" || !Array.isArray(o.suggestions)) return null;
    return {
      energy: ENERGY.includes(o.energy) ? o.energy : "Not enough info",
      summary: o.summary.trim().slice(0, 800),
      suggestions: o.suggestions.filter((s: unknown) => typeof s === "string" && s.trim()).slice(0, 4).map((s: string) => s.trim().slice(0, 300)),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Not signed in" });

  let body: { client_id?: string; date?: string; facts?: Record<string, unknown>; rules?: unknown; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const { client_id, date, facts, rules } = body;
  if (!client_id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !facts || typeof facts !== "object") {
    return json(400, { error: "Bad request" });
  }

  const { data: client } = await admin.from("clients").select("id, name, trainer_id").eq("id", client_id).maybeSingle();
  if (!client || client.trainer_id !== userData.user.id) return json(403, { error: "Not your client" });

  const factsText = JSON.stringify(facts);
  const { data: saved } = await admin
    .from("client_daily_summaries")
    .select("*")
    .eq("client_id", client_id)
    .eq("summary_date", date)
    .maybeSingle();
  if (saved && !body.force && stable(saved.facts) === stable(facts)) return json(200, { summary: saved, cached: true });

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json(503, { error: "no_key" });

  const firstName = String(client.name ?? "The client").trim().split(/\s+/)[0];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Client: ${firstName}. Today: ${date}.\nFacts for the last 7 days:\n${factsText}\nThe app's rule-based reading:\n${JSON.stringify(rules ?? null)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error("Claude API", res.status, await res.text());
    return json(502, { error: "ai_failed" });
  }
  const out = await res.json();
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const summary = parseSummary(text);
  if (!summary) return json(502, { error: "ai_failed" });

  const { data: row, error } = await admin
    .from("client_daily_summaries")
    .upsert(
      { client_id, summary_date: date, energy: summary.energy, summary: summary.summary, suggestions: summary.suggestions, facts, created_at: new Date().toISOString() },
      { onConflict: "client_id,summary_date" },
    )
    .select("*")
    .single();
  if (error) return json(500, { error: error.message });
  return json(200, { summary: row, cached: false });
});
