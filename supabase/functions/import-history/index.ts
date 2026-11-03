// Bring in a client's history from another app (0142, GRIZZ 2026-10-22).
//
// action "read": the client or their own trainer sends screenshots, PDFs or
//   CSV/text files. A client_imports row is made at once ("reading") and
//   Claude reads the files in the background into workouts and body stats
//   ("ready", or "failed" with a reason). The trainer gets a push.
// action "add": the trainer adds a ready import to workout_logs and
//   client_body_stats. Days and exercises the client already has are skipped,
//   so adding twice never doubles anything. Workouts with no date go into
//   client_undated_sets as "before the app" sessions (0189).
//
// Numbers with no unit shown are read in the trainer's units (trainers.units,
// 0189) and stored in kg and cm.
// action "dismiss": the trainer throws a ready or failed import away.
//
// Deployed with verify_jwt on. Needs the ANTHROPIC_API_KEY secret; without
// it "read" answers "no_key" and nothing is saved.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { cleanResult, importCounts, nameKey, undatedSessions, type ImportResult, type Units } from "./shape.ts";

const MODEL = "claude-opus-5-5";
const MAX_FILES = 10;
const MAX_TOTAL_BASE64 = 25_000_000;
const MAX_TEXT_CHARS = 300_000;
const READS_PER_DAY = 10;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SYSTEM = `You read a fitness client's history exported from another training or fitness app
(screenshots, PDFs, CSV or text files, including spreadsheet logs) so it can be moved into a new coaching app.
Pull out:
- workouts: each exercise done, with its sets (weight and reps). One entry per exercise per date or per session.
  Give numbers exactly as shown: do not convert units. Put the unit in "unit" ("kg" or "lb") only if the files
  show it for that exercise (or set weight_unit once for the whole file); otherwise leave it null and the app uses
  the trainer's units. Half values like 22.5 or 7,5 are real weights: keep them.
  Leave weight null for body-weight exercises. Skip empty boxes and sets with no reps (timed or distance work).
  Leave out exercises with nothing filled in. Warm-up rows are fine to include.
- Dates: yyyy-mm-dd. Today is given. If a date has no year, use the most recent such date that is not after today.
  If the files show no date, still save the workouts: set date to null and set session to the label the files
  give (like "Week 1" or "Day A"), keeping sessions in the order shown, oldest first. Never make up a date.
- body: body weight and measurements by date (weight, body_fat_pct, waist, hips, chest, arm, thigh) as shown,
  with weight_unit ("kg"/"lb") and length_unit ("cm"/"in") only when the files show them. Only entries with a date.
Never invent numbers: only what the files clearly show. If something can't be read (cut off, blurry), leave it out.
note: one or two short plain sentences for the trainer on anything left out. Don't list the numbers you saved.
Give app_name if you can tell which app it came from.
Call the save_history tool once with everything you found.`;

const MASS_UNIT = { type: ["string", "null"], description: "kg or lb, or null when not shown." };
const LENGTH_UNIT = { type: ["string", "null"], description: "cm or in, or null when not shown." };
const TOOL = {
  name: "save_history",
  description: "Save the client's workouts and body stats read from the files.",
  input_schema: {
    type: "object",
    properties: {
      app_name: { type: ["string", "null"] },
      weight_unit: { ...MASS_UNIT, description: "Weight unit for the whole file, only if the files show it." },
      workouts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: ["string", "null"], description: "yyyy-mm-dd, or null when the files show no date." },
            session: { type: ["string", "null"], description: "The files' label for the session, like Week 1, when there is no date." },
            exercise: { type: "string" },
            unit: MASS_UNIT,
            sets: {
              type: "array",
              items: {
                type: "object",
                properties: { weight: { type: ["number", "null"] }, reps: { type: "number" } },
                required: ["reps"],
              },
            },
          },
          required: ["date", "exercise", "sets"],
        },
      },
      body: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            weight_unit: MASS_UNIT,
            length_unit: LENGTH_UNIT,
            weight: { type: "number" },
            body_fat_pct: { type: "number" },
            waist: { type: "number" },
            hips: { type: "number" },
            chest: { type: "number" },
            arm: { type: "number" },
            thigh: { type: "number" },
          },
          required: ["date"],
        },
      },
      note: { type: ["string", "null"], description: "One or two short plain sentences for the trainer on anything left out or unclear." },
    },
    required: ["workouts", "body"],
  },
};

type InFile = { name?: string; type?: string; data?: string };

function decodeText(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes).slice(0, MAX_TEXT_CHARS);
}

function isText(f: InFile): boolean {
  const n = (f.name ?? "").toLowerCase();
  return (f.type ?? "").startsWith("text/") || /\.(csv|tsv|txt|json)$/.test(n);
}

function contentFor(f: InFile): Record<string, unknown> | null {
  const type = (f.type ?? "").toLowerCase();
  if (IMAGE_TYPES.includes(type)) return { type: "image", source: { type: "base64", media_type: type, data: f.data } };
  if (type === "application/pdf" || (f.name ?? "").toLowerCase().endsWith(".pdf")) {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } };
  }
  if (isText(f)) return { type: "text", text: `File "${f.name ?? "file"}":\n${decodeText(f.data!)}` };
  return null;
}

async function readWithClaude(key: string, today: string, units: Units, files: InFile[]): Promise<ImportResult> {
  const content = files.map(contentFor).filter(Boolean) as Record<string, unknown>[];
  content.push({
    type: "text",
    text: `Today is ${today}. The trainer works in ${units === "imperial" ? "pounds and inches" : "kg and cm"}. Read everything above and call save_history.`,
  });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM,
      tools: [TOOL],
      // claude-opus-5-5 refuses a forced tool_choice (400), so let it choose
      // and say in the prompt to call the tool.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Claude API", res.status, text);
    throw new Error(res.status === 413 || /too large|too long/i.test(text) ? "too_big" : "ai_failed");
  }
  const out = await res.json();
  const call = (out.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  if (!call) throw new Error("ai_failed");
  if (out.stop_reason === "max_tokens") throw new Error("too_big");
  return cleanResult(call.input, today, units);
}

async function push(admin: SupabaseClient, userId: string, title: string, body: string, clientId: string) {
  const { error } = await admin.rpc("push_to_user", {
    p_user: userId,
    p_title: title,
    p_body: body,
    p_data: { type: "history_import", client_id: clientId },
  });
  if (error) console.error("push", error.message);
}

const FAIL_TEXT: Record<string, string> = {
  too_big: "There was too much in one go. Try fewer screenshots or a smaller file at a time.",
  ai_failed: "The files couldn't be read. Try clearer screenshots, or save the export as CSV.",
};

async function runRead(
  admin: SupabaseClient,
  key: string,
  importId: string,
  today: string,
  files: InFile[],
  client: { id: string; name: string; trainer_id: string },
  byClient: boolean,
  units: Units,
) {
  let status = "failed";
  let result: ImportResult | null = null;
  let error: string | null = null;
  try {
    result = await readWithClaude(key, today, units, files);
    if (!result.workouts.length && !result.body.length) error = result.note ?? "No workouts or body stats were found in these files.";
    else status = "ready";
  } catch (e) {
    error = FAIL_TEXT[(e as Error).message] ?? FAIL_TEXT.ai_failed;
  }
  await admin.from("client_imports").update({ status, result, error }).eq("id", importId);
  if (byClient && status === "ready") {
    const c = importCounts(result!);
    await push(
      admin,
      client.trainer_id,
      `${client.name} sent their history`,
      `${c.days + c.undated} workouts and ${c.body} body stats from another app. Open their Training tab to check and add them.`,
      client.id,
    );
  }
}

/** All rows of a query, 1000 at a time (Supabase's limit per call). */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function addImport(admin: SupabaseClient, imp: { id: string; client_id: string; result: ImportResult }, trainerId: string) {
  const r = imp.result;
  const clientId = imp.client_id;
  const c = importCounts(r);

  const exercises = await allRows<{ id: string; name: string }>((a, b) => admin.from("exercises").select("id, name").order("id").range(a, b));
  const byName = new Map(exercises.map((e) => [nameKey(e.name), e.id]));

  const have = new Set<string>();
  if (c.from && c.to) {
    const logs = await allRows<{ log_date: string; exercise_name: string }>((a, b) =>
      admin
        .from("workout_logs")
        .select("log_date, exercise_name")
        .eq("client_id", clientId)
        .gte("log_date", c.from)
        .lte("log_date", c.to)
        .order("id")
        .range(a, b),
    );
    for (const l of logs) have.add(`${l.log_date}|${nameKey(l.exercise_name)}`);
  }

  const logRows: Record<string, unknown>[] = [];
  let workouts = 0;
  let skipped = 0;
  for (const w of r.workouts) {
    if (!w.date) continue;
    const k = `${w.date}|${nameKey(w.exercise)}`;
    if (have.has(k)) {
      skipped++;
      continue;
    }
    have.add(k);
    workouts++;
    w.sets.forEach((s, i) =>
      logRows.push({
        client_id: clientId,
        exercise_id: byName.get(nameKey(w.exercise)) ?? null,
        exercise_name: w.exercise,
        log_date: w.date,
        set_number: i + 1,
        weight_kg: s.weight_kg,
        reps: s.reps,
        effort: "comfortable",
        logged_by: trainerId,
        import_id: imp.id,
      }),
    );
  }
  for (let i = 0; i < logRows.length; i += 500) {
    const { error } = await admin.from("workout_logs").insert(logRows.slice(i, i + 500));
    if (error) throw error;
  }

  const bodyHave = new Set(
    (await allRows<{ measured_on: string }>((a, b) => admin.from("client_body_stats").select("measured_on").eq("client_id", clientId).order("id").range(a, b))).map(
      (x) => x.measured_on,
    ),
  );
  const bodyRows = r.body
    .filter((b) => !bodyHave.has(b.date))
    .map((b) => {
      const { date, ...rest } = b;
      return { client_id: clientId, measured_on: date, import_id: imp.id, ...rest };
    });
  if (bodyRows.length) {
    const { error } = await admin.from("client_body_stats").insert(bodyRows);
    if (error) throw error;
  }

  // No date (0189): "before the app" sessions. The same session sent twice
  // (same label, exercise and sets) is only kept once.
  const setsKey = (label: string | null, exercise: string, sets: { weight_kg: number | null; reps: number }[]) =>
    `${label ?? ""}|${nameKey(exercise)}|${sets.map((x) => `${x.weight_kg === null ? "" : Number(x.weight_kg)}x${x.reps}`).join(",")}`;
  const sessions = undatedSessions(r);
  const undatedRows: Record<string, unknown>[] = [];
  let undated = 0;
  if (sessions.length) {
    const old = await allRows<{ session_label: string | null; exercise_name: string; set_number: number; weight_kg: number | null; reps: number; import_id: string | null; session_order: number }>(
      (a, b) =>
        admin
          .from("client_undated_sets")
          .select("session_label, exercise_name, set_number, weight_kg, reps, import_id, session_order")
          .eq("client_id", clientId)
          .order("id")
          .range(a, b),
    );
    const grouped = new Map<string, { label: string | null; exercise: string; sets: { set_number: number; weight_kg: number | null; reps: number }[] }>();
    for (const x of old) {
      const g = `${x.import_id}|${x.session_order}|${nameKey(x.exercise_name)}`;
      if (!grouped.has(g)) grouped.set(g, { label: x.session_label, exercise: x.exercise_name, sets: [] });
      grouped.get(g)!.sets.push(x);
    }
    const haveUndated = new Set(
      [...grouped.values()].map((g) => setsKey(g.label, g.exercise, g.sets.sort((a, b) => a.set_number - b.set_number))),
    );
    sessions.forEach((session, order) => {
      for (const w of session.workouts) {
        const k = setsKey(session.label, w.exercise, w.sets);
        if (haveUndated.has(k)) {
          skipped++;
          continue;
        }
        haveUndated.add(k);
        undated++;
        w.sets.forEach((s, i) =>
          undatedRows.push({
            client_id: clientId,
            import_id: imp.id,
            session_label: session.label,
            session_order: order,
            exercise_id: byName.get(nameKey(w.exercise)) ?? null,
            exercise_name: w.exercise,
            set_number: i + 1,
            weight_kg: s.weight_kg,
            reps: s.reps,
          }),
        );
      }
    });
    for (let i = 0; i < undatedRows.length; i += 500) {
      const { error } = await admin.from("client_undated_sets").insert(undatedRows.slice(i, i + 500));
      if (error) throw error;
    }
  }
  return {
    workouts: workouts + undated,
    sets: logRows.length + undatedRows.length,
    body: bodyRows.length,
    skipped,
    skipped_body: r.body.length - bodyRows.length,
    undated,
  };
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
  const me = userData.user.id;

  let body: { action?: string; client_id?: string; import_id?: string; today?: string; files?: InFile[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }

  if (body.action === "add" || body.action === "dismiss") {
    if (!body.import_id) return json(400, { error: "Bad request" });
    const { data: imp } = await admin.from("client_imports").select("*").eq("id", body.import_id).maybeSingle();
    if (!imp) return json(404, { error: "Not found" });
    // The trainer it was made for must still be the client's trainer.
    const { data: client } = await admin.from("clients").select("trainer_id").eq("id", imp.client_id).maybeSingle();
    if (!client || client.trainer_id !== me) return json(403, { error: "Not your client" });

    if (body.action === "dismiss") {
      if (imp.status === "added") return json(409, { error: "Already added" });
      await admin.from("client_imports").update({ status: "dismissed" }).eq("id", imp.id);
      return json(200, { ok: true });
    }
    if (imp.status !== "ready") return json(409, { error: imp.status === "added" ? "Already added" : "Not ready" });
    // Claim it first so two taps can't add it twice.
    const { data: claimed } = await admin
      .from("client_imports")
      .update({ status: "added", added_at: new Date().toISOString(), added_by: me })
      .eq("id", imp.id)
      .eq("status", "ready")
      .select("id");
    if (!claimed?.length) return json(409, { error: "Already added" });
    try {
      const counts = await addImport(admin, imp, me);
      await admin.from("client_imports").update({ added_counts: counts }).eq("id", imp.id);
      return json(200, { counts });
    } catch (e) {
      console.error("add", e);
      await admin.from("client_imports").update({ status: "ready", added_at: null, added_by: null }).eq("id", imp.id);
      return json(500, { error: "add_failed" });
    }
  }

  if (body.action !== "read") return json(400, { error: "Bad request" });
  const { client_id, today, files } = body;
  if (!client_id || !today || !/^\d{4}-\d{2}-\d{2}$/.test(today) || !Array.isArray(files) || !files.length) {
    return json(400, { error: "Bad request" });
  }
  if (files.length > MAX_FILES) return json(400, { error: "too_many" });
  if (files.some((f) => typeof f?.data !== "string" || !f.data)) return json(400, { error: "Bad request" });
  if (files.reduce((n, f) => n + f.data!.length, 0) > MAX_TOTAL_BASE64) return json(400, { error: "too_big" });
  if (files.some((f) => !contentFor({ ...f, data: "" }))) return json(400, { error: "bad_type" });

  const { data: client } = await admin.from("clients").select("id, name, trainer_id").eq("id", client_id).maybeSingle();
  if (!client) return json(404, { error: "Not found" });
  const byClient = me === client.id;
  if (!byClient && client.trainer_id !== me) return json(403, { error: "Not your client" });

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json(503, { error: "no_key" });

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("client_imports")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .gte("created_at", since);
  if ((count ?? 0) >= READS_PER_DAY) return json(429, { error: "too_many_today" });

  const { data: row, error } = await admin
    .from("client_imports")
    .insert({
      client_id: client.id,
      trainer_id: client.trainer_id,
      uploaded_by: me,
      uploaded_role: byClient ? "client" : "trainer",
      file_names: files.map((f) => String(f.name ?? "file").slice(0, 120)),
    })
    .select("*")
    .single();
  if (error) return json(500, { error: error.message });

  // Numbers with no unit shown are read in the trainer's units (0189).
  const { data: trainer } = await admin.from("trainers").select("units").eq("id", client.trainer_id).maybeSingle();
  const units: Units = trainer?.units === "imperial" ? "imperial" : "metric";

  EdgeRuntime.waitUntil(runRead(admin, key, row.id, today, files, client, byClient, units));
  return json(200, { import: row });
});
