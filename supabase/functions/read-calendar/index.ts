// Reads a trainer's calendar screenshots (Google, Samsung, Apple or any
// other) into sessions for Live sessions (GRIZZ, 2026-10-31). Nothing is
// saved here: the app shows the list for the trainer to check, then books
// the ticked ones with import_live_sessions (0172).
//
// Deployed with verify_jwt on. Needs the ANTHROPIC_API_KEY secret; without
// it the answer is "no_key".
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { cleanSessions } from "./shape.ts";

const MODEL = "claude-opus-5-5";
const MAX_FILES = 6;
const MAX_TOTAL_BASE64 = 15_000_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SYSTEM = `You read screenshots of a personal trainer's calendar (Google Calendar, Samsung Calendar,
Apple Calendar, Outlook or any other app, in day, week, month or list view) so their in-person
training sessions can be moved into their coaching app's diary. Every booked slot matters.
List every timed block in every day column, one by one, top to bottom:
- date (yyyy-mm-dd): from the column headers (e.g. "Nov" with Mon 2 ... Sun 8). If the year isn't
  shown, use the year that puts the date closest to today.
- time (HH:MM, 24-hour): where the block's top edge sits against the hour lines on the left. Blocks
  stacked back to back follow on directly: each starts where the one above ends. A gap between
  blocks means a later start. Check each column's times add up.
- minutes: the block's length from its height against the hour lines (often the trainer's usual length).
- seen_name: the text in the block exactly as written ("Rob V", "Sharde &", "???", "B G B").
  A block with no name or only question marks is still a booked slot: give seen_name "???".
- client_id: the id of the matching client from the list given, only when the name clearly matches
  one client (first name, surname, nickname, initials, or a name the trainer matched before).
  Otherwise null: the trainer picks or keeps the name.
A block with two people ("J & C", "Mike and Sarah") is two sessions at the same time, one for each
person, each with their own seen_name ("J", "C"). If a name is cut off ("Sharde &"), give the part
you can read as one session and say in note that the other person was cut off.
Leave out all-day events at the top (e.g. "Local Gov"), and blocks that are clearly not a session
(e.g. "Away", "Leave", "Holiday", birthdays, reminders); say in note what you left out.
Never invent names or times. Call the save_sessions tool once with everything you found.`;

const TOOL = {
  name: "save_sessions",
  description: "Save the client sessions read from the calendar screenshots.",
  input_schema: {
    type: "object",
    properties: {
      sessions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            time: { type: "string" },
            minutes: { type: ["number", "null"] },
            seen_name: { type: "string" },
            client_id: { type: ["string", "null"] },
          },
          required: ["date", "time", "seen_name", "client_id"],
        },
      },
      note: { type: ["string", "null"], description: "Short plain note for the trainer on anything left out or unclear." },
    },
    required: ["sessions"],
  },
};

type InFile = { name?: string; type?: string; data?: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Not signed in" });
  const me = userData.user.id;

  const { data: trainer } = await admin.from("trainers").select("id, approved").eq("id", me).maybeSingle();
  if (!trainer?.approved) return json(403, { error: "Trainers only" });

  let body: { today?: string; files?: InFile[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return json(400, { error: "Bad request" });
  if (files.length > MAX_FILES) return json(400, { error: "too_many" });
  if (files.some((f) => !IMAGE_TYPES.includes((f.type ?? "").toLowerCase()) || typeof f.data !== "string")) return json(400, { error: "bad_type" });
  if (files.reduce((t, f) => t + (f.data?.length ?? 0), 0) > MAX_TOTAL_BASE64) return json(413, { error: "too_big" });

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json(503, { error: "no_key" });

  // The trainer's own clients, from the database (never from the app).
  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("trainer_id", me)
    .neq("id", me)
    .is("archived_at", null);
  const list = (clients ?? []).map((c) => `${c.id}: ${c.name}`).join("\n") || "(none)";
  // Names this trainer matched before ("Q" is Quraish), and their usual session length and first time.
  const [{ data: links }, { data: settings }] = await Promise.all([
    admin.from("diary_name_links").select("name_key, client_id").eq("trainer_id", me),
    admin.from("session_settings").select("minutes, day_start").eq("trainer_id", me).maybeSingle(),
  ]);
  const ids = new Set((clients ?? []).map((c) => c.id));
  const linked = (links ?? []).filter((l) => ids.has(l.client_id));
  const known = linked.map((l) => `"${l.name_key}" is ${l.client_id}`).join("\n");
  const usual = settings?.minutes ? `Sessions are usually ${settings.minutes} minutes${settings.day_start ? `, the first one of the day often at ${String(settings.day_start).slice(0, 5)}` : ""}.` : "";

  const content: Record<string, unknown>[] = files.map((f) => ({
    type: "image",
    source: { type: "base64", media_type: (f.type ?? "").toLowerCase(), data: f.data },
  }));
  content.push({
    type: "text",
    text: `Today is ${today}.\n${usual}\nThe trainer's clients (id: name):\n${list}\n${known ? `\nNames matched before:\n${known}\n` : ""}\nRead the screenshots above and call save_sessions.`,
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools: [TOOL],
      // claude-opus-5-5 refuses a forced tool_choice (400), so let it choose
      // and say in the prompt to call the tool.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    console.error("Claude API", res.status, await res.text());
    return json(502, { error: "ai_failed" });
  }
  const out = await res.json();
  const call = (out.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  if (!call) return json(502, { error: "ai_failed" });
  const read = cleanSessions(call.input, [...ids], today);
  // A name matched before goes to that client even if the reader missed it.
  const byName = new Map(linked.map((l) => [l.name_key, l.client_id]));
  for (const s of read.sessions) s.client_id ??= byName.get(s.seen_name.trim().toLowerCase().replace(/\s+/g, " ")) ?? null;
  return json(200, read);
});
