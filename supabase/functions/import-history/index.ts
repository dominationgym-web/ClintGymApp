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
// actions "read_bulk", "add_bulk", "dismiss_bulk" (0190): one file with many
//   clients. See trainer_bulk_imports and bulk.ts.
//
// Deployed with verify_jwt on. Needs the ANTHROPIC_API_KEY secret; without
// it "read" answers "no_key" and nothing is saved.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { cleanResult, importCounts, nameKey, undatedSessions, type ImportResult, type Units } from "./shape.ts";
import { applyColumnMap, cleanColumnMap, matchClient, mergePeople, parseCsv, sampleForMapping, type RawPerson } from "./bulk.ts";

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
const WORKOUT_ITEM = {
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
};
const BODY_ITEM = {
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
};
const NOTE = { type: ["string", "null"], description: "One or two short plain sentences for the trainer on anything left out or unclear." };
const TOOL = {
  name: "save_history",
  description: "Save the client's workouts and body stats read from the files.",
  input_schema: {
    type: "object",
    properties: {
      app_name: { type: ["string", "null"] },
      weight_unit: { ...MASS_UNIT, description: "Weight unit for the whole file, only if the files show it." },
      workouts: { type: "array", items: WORKOUT_ITEM },
      body: { type: "array", items: BODY_ITEM },
      note: NOTE,
    },
    required: ["workouts", "body"],
  },
};

// One file with many clients (0190).
const PEOPLE_SYSTEM = `${SYSTEM.replace("Call the save_history tool once with everything you found.", "")}
These files hold MANY clients of one trainer. Split everything by person: one entry in people per client,
named exactly as the files name them. Call the save_people tool once with everything you found.`;
const PEOPLE_TOOL = {
  name: "save_people",
  description: "Save each client's workouts and body stats read from the files.",
  input_schema: {
    type: "object",
    properties: {
      weight_unit: { ...MASS_UNIT, description: "Weight unit for the whole file, only if the files show it." },
      people: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, workouts: { type: "array", items: WORKOUT_ITEM }, body: { type: "array", items: BODY_ITEM } },
          required: ["name", "workouts", "body"],
        },
      },
      note: NOTE,
    },
    required: ["people"],
  },
};

const MAP_SYSTEM = `You look at the first rows of a spreadsheet (CSV) export from a training app or a trainer's own log,
holding the workouts of MANY clients, and say which column holds what so a program can read every row.
Columns are numbered from 0 as shown. Call map_columns once.
- tabular: true only if each row is one set or one exercise of one person, with the person's name in a column.
  Layouts like one block per exercise, one sheet per client, or names only in titles are not tabular: say false.
- header_rows: how many rows at the top are headings, not data.
- name: the column(s) with the person's name (two if first name and surname are separate).
- date and date_format ("ymd", "dmy" or "mdy"; for dates like 03/04/2024 decide from the rows, SA files are usually dmy).
- session: a workout or week label column, if any. exercise: the exercise name column.
- set_number: the set number column when each row is one set.
- weights and reps: matching lists. One row per set: one weight and one reps column. One row per exercise with
  sets across: the weight and reps column of set 1, set 2 and so on, in the same order.
- unit_column (a column saying kg or lb) or unit (if the headings say kg or lb for all weights), else null.
- body_weight and body_fat: columns with body weight or body fat %, if any.`;
const COL = { type: ["integer", "null"] };
const COLS = { type: "array", items: { type: "integer" } };
const MAP_TOOL = {
  name: "map_columns",
  description: "Say which column holds what.",
  input_schema: {
    type: "object",
    properties: {
      tabular: { type: "boolean" },
      header_rows: { type: "integer" },
      name: COLS,
      date: COL,
      date_format: { type: ["string", "null"] },
      session: COL,
      exercise: COL,
      set_number: COL,
      weights: COLS,
      reps: COLS,
      unit_column: COL,
      unit: { type: ["string", "null"] },
      body_weight: COL,
      body_fat: COL,
    },
    required: ["tabular"],
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

/** One Claude call that must answer with the named tool; gives the tool's input. */
async function callClaude(key: string, system: string, tool: { name: string }, content: Record<string, unknown>[], maxTokens: number): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      tools: [tool],
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
  const call = (out.content ?? []).find((c: { type: string; name?: string }) => c.type === "tool_use" && c.name === tool.name);
  if (!call) throw new Error("ai_failed");
  if (out.stop_reason === "max_tokens") throw new Error("too_big");
  return call.input;
}

async function readWithClaude(key: string, today: string, units: Units, files: InFile[]): Promise<ImportResult> {
  const content = files.map(contentFor).filter(Boolean) as Record<string, unknown>[];
  content.push({
    type: "text",
    text: `Today is ${today}. The trainer works in ${units === "imperial" ? "pounds and inches" : "kg and cm"}. Read everything above and call save_history.`,
  });
  return cleanResult(await callClaude(key, SYSTEM, TOOL, content, 32000), today, units);
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

async function exerciseIds(admin: SupabaseClient): Promise<Map<string, string>> {
  const exercises = await allRows<{ id: string; name: string }>((a, b) => admin.from("exercises").select("id, name").order("id").range(a, b));
  return new Map(exercises.map((e) => [nameKey(e.name), e.id]));
}

async function addImport(
  admin: SupabaseClient,
  imp: { id: string; client_id: string; result: ImportResult },
  trainerId: string,
  byNameIn?: Map<string, string>,
) {
  const r = imp.result;
  const clientId = imp.client_id;
  const c = importCounts(r);

  const byName = byNameIn ?? (await exerciseIds(admin));

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

// ---------------------------------------------------------------------------
// One file with many clients (0190).

const BULK_READS_PER_DAY = 5;
const MAX_PEOPLE = 500;
const MAX_BULK_TEXT = 20_000_000;

type BulkPerson = {
  name: string;
  client_id: string | null;
  result: ImportResult;
  added_import_id?: string | null;
  added_counts?: Record<string, number> | null;
};

/** A CSV-like file read in code with Claude's column map; null when it isn't tabular. */
async function readTabular(key: string, f: InFile, units: Units): Promise<RawPerson[] | null> {
  const bin = atob(f.data!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const text = new TextDecoder().decode(bytes).slice(0, MAX_BULK_TEXT);
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const raw = await callClaude(
    key,
    MAP_SYSTEM,
    MAP_TOOL,
    [{ type: "text", text: `File "${f.name ?? "file"}", ${rows.length} rows. The first rows:\n${sampleForMapping(rows)}` }],
    2000,
  );
  const map = cleanColumnMap(raw);
  return map ? applyColumnMap(rows, map, units) : null;
}

async function runBulkRead(admin: SupabaseClient, key: string, bulkId: string, today: string, files: InFile[], trainerId: string, units: Units) {
  let status = "failed";
  let people: BulkPerson[] = [];
  let note: string | null = null;
  let error: string | null = null;
  try {
    const lists: RawPerson[][] = [];
    const forClaude: InFile[] = [];
    for (const f of files) {
      const tab = isText(f) ? await readTabular(key, f, units) : null;
      if (tab) lists.push(tab);
      else forClaude.push(f);
    }
    if (forClaude.length) {
      const content = forClaude.map(contentFor).filter(Boolean) as Record<string, unknown>[];
      content.push({
        type: "text",
        text: `Today is ${today}. The trainer works in ${units === "imperial" ? "pounds and inches" : "kg and cm"}. Read everything above and call save_people.`,
      });
      const out = (await callClaude(key, PEOPLE_SYSTEM, PEOPLE_TOOL, content, 32000)) as { people?: unknown; weight_unit?: unknown; note?: unknown };
      const fileUnit = out?.weight_unit;
      if (Array.isArray(out?.people))
        lists.push(
          (out.people as RawPerson[])
            .filter((p) => p && typeof p.name === "string")
            .map((p) => ({
              name: p.name,
              workouts: (Array.isArray(p.workouts) ? p.workouts : []).map((w) => ({ ...w, unit: w?.unit ?? fileUnit ?? null })),
              body: Array.isArray(p.body) ? p.body : [],
            })),
        );
      if (typeof out?.note === "string" && out.note.trim()) note = out.note.trim().slice(0, 600);
    }
    const { data: clients } = await admin.from("clients").select("id, name").eq("trainer_id", trainerId);
    people = mergePeople(lists)
      .slice(0, MAX_PEOPLE)
      .map((p) => ({ name: p.name.trim().slice(0, 80), client_id: matchClient(p.name, clients ?? []), result: cleanResult(p, today, units) }))
      .filter((p) => p.result.workouts.length || p.result.body.length);
    if (people.length) status = "ready";
    else error = note ?? "No clients' workouts or body stats were found in these files.";
  } catch (e) {
    error = FAIL_TEXT[(e as Error).message] ?? FAIL_TEXT.ai_failed;
  }
  await admin.from("trainer_bulk_imports").update({ status, people, note, error }).eq("id", bulkId);
}

/** Adds each linked person's history to their client (a normal client_imports row each). */
async function addBulk(admin: SupabaseClient, bulk: { id: string; trainer_id: string; file_names: string[]; people: BulkPerson[] }, links: Record<string, unknown>, me: string) {
  const { data: clients } = await admin.from("clients").select("id").eq("trainer_id", me);
  const mine = new Set((clients ?? []).map((c) => c.id));
  const byName = await exerciseIds(admin);
  const people = bulk.people;
  let added = 0;
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    if (p.added_import_id) continue;
    const link = Object.prototype.hasOwnProperty.call(links, String(i)) ? links[String(i)] : p.client_id;
    if (typeof link !== "string" || !mine.has(link)) {
      p.client_id = null;
      continue;
    }
    p.client_id = link;
    const { data: imp, error } = await admin
      .from("client_imports")
      .insert({
        client_id: link,
        trainer_id: me,
        uploaded_by: me,
        uploaded_role: "trainer",
        file_names: bulk.file_names,
        status: "added",
        result: p.result,
        added_at: new Date().toISOString(),
        added_by: me,
      })
      .select("id")
      .single();
    if (error || !imp) throw error ?? new Error("insert failed");
    p.added_import_id = imp.id;
    // Saved straight away, so a second tap can't add this person twice.
    await admin.from("trainer_bulk_imports").update({ people }).eq("id", bulk.id);
    const counts = await addImport(admin, { id: imp.id, client_id: link, result: p.result }, me, byName);
    p.added_counts = counts;
    await admin.from("client_imports").update({ added_counts: counts }).eq("id", imp.id);
    added++;
  }
  await admin.from("trainer_bulk_imports").update({ people }).eq("id", bulk.id);
  return { added, waiting: people.filter((p) => !p.added_import_id).length };
}

async function handleBulk(admin: SupabaseClient, me: string, body: Record<string, unknown>): Promise<Response> {
  const { data: trainer } = await admin.from("trainers").select("id, units").eq("id", me).maybeSingle();
  if (!trainer) return json(403, { error: "Trainers only" });

  if (body.action === "add_bulk" || body.action === "dismiss_bulk") {
    if (typeof body.bulk_id !== "string") return json(400, { error: "Bad request" });
    const { data: bulk } = await admin.from("trainer_bulk_imports").select("*").eq("id", body.bulk_id).maybeSingle();
    if (!bulk || bulk.trainer_id !== me) return json(404, { error: "Not found" });
    if (body.action === "dismiss_bulk") {
      await admin.from("trainer_bulk_imports").update({ status: "dismissed" }).eq("id", bulk.id);
      return json(200, { ok: true });
    }
    if (bulk.status !== "ready") return json(409, { error: "Not ready" });
    const links = body.links && typeof body.links === "object" ? (body.links as Record<string, unknown>) : {};
    try {
      return json(200, await addBulk(admin, bulk, links, me));
    } catch (e) {
      console.error("add_bulk", e);
      return json(500, { error: "add_failed" });
    }
  }

  // read_bulk
  const { today, files } = body as { today?: string; files?: InFile[] };
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today) || !Array.isArray(files) || !files.length) return json(400, { error: "Bad request" });
  if (files.length > MAX_FILES) return json(400, { error: "too_many" });
  if (files.some((f) => typeof f?.data !== "string" || !f.data)) return json(400, { error: "Bad request" });
  if (files.reduce((n, f) => n + f.data!.length, 0) > MAX_TOTAL_BASE64) return json(400, { error: "too_big" });
  if (files.some((f) => !contentFor({ ...f, data: "" }))) return json(400, { error: "bad_type" });
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json(503, { error: "no_key" });
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("trainer_bulk_imports").select("id", { count: "exact", head: true }).eq("trainer_id", me).gte("created_at", since);
  if ((count ?? 0) >= BULK_READS_PER_DAY) return json(429, { error: "too_many_bulk_today" });
  const { data: row, error } = await admin
    .from("trainer_bulk_imports")
    .insert({ trainer_id: me, file_names: files.map((f) => String(f.name ?? "file").slice(0, 120)) })
    .select("*")
    .single();
  if (error) return json(500, { error: error.message });
  const units: Units = trainer.units === "imperial" ? "imperial" : "metric";
  EdgeRuntime.waitUntil(runBulkRead(admin, key, row.id, today, files, me, units));
  return json(200, { bulk: row });
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

  let body: { action?: string; client_id?: string; import_id?: string; today?: string; files?: InFile[]; bulk_id?: string; links?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  if (body.action === "read_bulk" || body.action === "add_bulk" || body.action === "dismiss_bulk") return handleBulk(admin, me, body);

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
