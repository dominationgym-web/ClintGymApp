// Adapts a client's meal plan to what they like (GRIZZ, 2026-11-02: "use AI
// to adapt the diet to their preferred foods as they choose and eliminate
// foods. Get a feel for what they like and make changes over time"). The app
// sends what the client has swapped in, left out, put back and eaten as their
// own meals (src/lib/mealWeek.ts), and the foods that fit their diet. Claude
// reads their tastes and answers which foods to use more, which to leave out
// and a short note for the trainer. The app then makes the week's meals with
// its own maths, so calories and macros always add up.
//
// Deployed with verify_jwt on. Only the client or their own trainer can ask.
// Needs the ANTHROPIC_API_KEY secret; without it this answers "no_key" and
// the app uses its own reading of the scores instead.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SYSTEM = `You help a personal trainer's meal plan app learn what one client likes to eat.
You get scores the app keeps from the client's own choices: "liked" goes up when they swap a food in, put it back or eat it
in their own meal; "disliked" goes up when they swap a food out or leave it out (leaving out counts double). You also get
the foods that fit their diet, grouped, with the foods the plan uses now.

Decide:
- likes: up to 12 foods (exact names from the food list) the plan should use more. Start with the foods they clearly
  choose. You may add up to 3 foods they haven't tried that fit the same taste (for example similar proteins or carbs), but
  never oats or oat porridge unless they chose oats themselves.
- leave_out: foods (exact names) they clearly don't want, only from foods they swapped out or left out at least twice and
  never chose.
- note: 1 or 2 short sentences for the trainer on the client's tastes and what the new plan changes. Plain, friendly
  South African English. Never a message for the trainer to send.
Answer with only a JSON object: {"likes": ["..."], "leave_out": ["..."], "note": "..."}`;

type Body = {
  client_id?: string;
  taste?: { liked?: Record<string, number>; disliked?: Record<string, number> };
  foods?: Record<string, string[]>;
  current?: string[];
};

const OATS = /\boat/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Not signed in" });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const { client_id, taste, foods } = body;
  if (!client_id || !taste || !foods || typeof foods !== "object") return json(400, { error: "Bad request" });

  const { data: client } = await admin.from("clients").select("id, name, trainer_id").eq("id", client_id).maybeSingle();
  if (!client || (client.id !== userData.user.id && client.trainer_id !== userData.user.id)) return json(403, { error: "Not allowed" });

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json(503, { error: "no_key" });

  const allowed = new Set(Object.values(foods).flat().filter((f) => typeof f === "string").slice(0, 400));
  const liked = taste.liked ?? {};
  const disliked = taste.disliked ?? {};
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
          content: `Client: ${firstName}.\nLiked scores: ${JSON.stringify(liked)}\nDisliked scores: ${JSON.stringify(disliked)}\nFoods the plan uses now: ${JSON.stringify(body.current ?? [])}\nFoods that fit their diet:\n${JSON.stringify(foods)}`,
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
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return json(502, { error: "ai_failed" });
  try {
    const o = JSON.parse(m[0]);
    const choseOats = Object.keys(liked).some((f) => OATS.test(f));
    const names = (v: unknown) => (Array.isArray(v) ? v.filter((f): f is string => typeof f === "string" && allowed.has(f)) : []);
    const likes = names(o.likes)
      .filter((f) => choseOats || !OATS.test(f))
      .slice(0, 12);
    // Only foods they really pushed away, never ones they chose.
    const leaveOut = names(o.leave_out).filter((f) => (disliked[f] ?? 0) >= 2 && !(liked[f] > 0) && !likes.includes(f));
    const note = typeof o.note === "string" ? o.note.trim().slice(0, 500) : "";
    return json(200, { likes, leave_out: leaveOut, note });
  } catch {
    return json(502, { error: "ai_failed" });
  }
});
