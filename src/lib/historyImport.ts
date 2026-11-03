// Bringing a client's history in from another app (0142, GRIZZ 2026-10-22).
// The import-history edge function does the reading (Claude) and the adding;
// this is the app's side: sending files and the words shown for each import.
import { supabase } from "@/lib/supabase";
import { suggestNext, type Suggestion } from "@/lib/progression";
import { importCounts, undatedSessions, type ImportResult } from "../../supabase/functions/import-history/shape";

export type ImportFile = { name: string; type: string; data: string };

export type ClientImport = {
  id: string;
  client_id: string;
  uploaded_role: "client" | "trainer";
  file_names: string[];
  status: "reading" | "ready" | "failed" | "added" | "dismissed";
  result: ImportResult | null;
  error: string | null;
  added_counts: { workouts: number; sets: number; body: number; skipped: number; skipped_body: number; undated?: number } | null;
  created_at: string;
};

const ERRORS: Record<string, string> = {
  no_key: "The AI reader isn't switched on yet. The app owner needs to add the Claude key first.",
  too_many: "Send up to 10 screenshots or files at a time.",
  too_big: "That's too much in one go. Try fewer screenshots or a smaller file.",
  bad_type: "Only screenshots, PDFs and CSV or text files can be read. Save Excel files as CSV first.",
  too_many_today: "That's 10 uploads today. Try again tomorrow.",
  "Already added": "This was already added.",
};

async function call(body: Record<string, unknown>): Promise<{ data: unknown; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("import-history", { method: "POST", body });
  if (!error) return { data, error: null };
  let code: string | null = null;
  try {
    const ctx = (error as { context?: Response }).context;
    code = ctx ? (await ctx.clone().json())?.error ?? null : null;
  } catch {
    // Not a JSON answer.
  }
  return { data: null, error: (code && ERRORS[code]) || "Something went wrong. Please try again." };
}

export async function sendForReading(clientId: string, today: string, files: ImportFile[]): Promise<string | null> {
  return (await call({ action: "read", client_id: clientId, today, files })).error;
}

export async function addImport(importId: string): Promise<string | null> {
  return (await call({ action: "add", import_id: importId })).error;
}

export async function dismissImport(importId: string): Promise<string | null> {
  return (await call({ action: "dismiss", import_id: importId })).error;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 training days (40 exercises, 120 sets), 2 sessions with no date (9 exercises) and 5 body stat entries, 3 Mar 2026 to 20 Oct 2026". */
export function importSummary(r: ImportResult): string {
  const c = importCounts(r);
  const parts: string[] = [];
  if (c.days) parts.push(`${plural(c.days, "training day")} (${plural(c.workouts, "exercise")}, ${plural(c.sets, "set")})`);
  if (c.undated) parts.push(`${plural(c.undated, "session")} with no date (${plural(c.undated_workouts, "exercise")})`);
  if (c.body) parts.push(plural(c.body, "body stat entry", "body stat entries"));
  const range = c.from && c.to ? (c.from === c.to ? `, on ${c.from}` : `, ${c.from} to ${c.to}`) : "";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `${list || "Nothing"}${range}`;
}

/** "22.5kg×8" or just "8" for body weight. */
export function setsLine(sets: { weight_kg: number | null; reps: number }[]): string {
  return sets.map((s) => (s.weight_kg ? `${Number(s.weight_kg)}kg×${s.reps}` : `${s.reps}`)).join(", ");
}

/** A few lines so the trainer can check it read things right. */
export function importSample(r: ImportResult, max = 4): string[] {
  const sessions = undatedSessions(r);
  const lines = r.workouts.slice(-max).map((w) => {
    const label = w.date ?? (w.session || `Session ${sessions.findIndex((s) => s.workouts.includes(w)) + 1}`);
    return `${label} · ${w.exercise}: ${setsLine(w.sets)}`;
  });
  const lastBody = r.body[r.body.length - 1];
  if (lastBody?.weight_kg) lines.push(`${lastBody.date} · Body weight ${lastBody.weight_kg} kg`);
  return lines;
}

/** Tells the trainer which units numbers with no kg or lb were read in. */
export function unitsLine(r: ImportResult): string | null {
  if (!r.units_assumed) return null;
  return r.units === "imperial"
    ? "No kg or lb on these, so they were read as pounds (your setting) and changed to kg."
    : "No kg or lb on these, so they were read as kg (your setting).";
}

export function addedSummary(c: NonNullable<ClientImport["added_counts"]>): string {
  const parts = [`${plural(c.workouts, "exercise")} (${plural(c.sets, "set")})`, plural(c.body, "body stat entry", "body stat entries")];
  const skipped = c.skipped + c.skipped_body;
  const undated = c.undated ? ` ${plural(c.undated, "exercise")} had no date, so they're in "Before the app".` : "";
  return `Added ${parts.join(" and ")}.${undated}${skipped ? ` ${skipped} already in the app, so left out.` : ""}`;
}

export type UndatedSet = {
  import_id: string | null;
  session_label: string | null;
  session_order: number;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number;
  created_at: string;
};

export type UndatedSession = { key: string; label: string; exercises: { name: string; sets: UndatedSet[] }[] };

/** Saved undated sets grouped into sessions, oldest first ("Week 1", or "Session 2" with no label). */
export function groupUndated(rows: UndatedSet[]): UndatedSession[] {
  const sorted = [...rows].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.session_order - b.session_order || a.set_number - b.set_number,
  );
  const out: UndatedSession[] = [];
  const byKey = new Map<string, UndatedSession>();
  for (const r of sorted) {
    const key = `${r.import_id ?? ""}|${r.session_order}`;
    let s = byKey.get(key);
    if (!s) {
      s = { key, label: r.session_label ?? "", exercises: [] };
      byKey.set(key, s);
      out.push(s);
    }
    let ex = s.exercises.find((e) => e.name === r.exercise_name);
    if (!ex) s.exercises.push((ex = { name: r.exercise_name, sets: [] }));
    ex.sets.push(r);
  }
  out.forEach((s, i) => {
    if (!s.label) s.label = `Session ${i + 1}`;
  });
  return out;
}

/** The sets of the last undated session with this exercise, for "start here" weights. */
export async function lastUndatedSets(clientId: string, exercise: { id?: string | null; name: string }): Promise<UndatedSet[]> {
  const fetch = async (col: "exercise_id" | "exercise_name", value: string) => {
    const { data } = await supabase
      .from("client_undated_sets")
      .select("*")
      .eq("client_id", clientId)
      .eq(col, value)
      .order("created_at", { ascending: false })
      .order("session_order", { ascending: false })
      .limit(60);
    return (data as UndatedSet[] | null) ?? [];
  };
  let rows = exercise.id ? await fetch("exercise_id", exercise.id) : [];
  if (!rows.length) rows = await fetch("exercise_name", exercise.name);
  const first = rows[0];
  if (!first) return [];
  return rows
    .filter((r) => r.import_id === first.import_id && r.session_order === first.session_order && r.exercise_name === first.exercise_name)
    .sort((a, b) => a.set_number - b.set_number);
}

/** "Before the app: 10kg × 12, 11, 11" and what to try, when the client hasn't
 *  logged this exercise in the app yet but brought in undated history (0189). */
export async function beforeTheAppSuggestion(
  clientId: string,
  exercise: { id?: string | null; name: string; category: string | null },
  reps: string | null | undefined,
  repsInReserve = 1,
): Promise<Suggestion | null> {
  const sets = await lastUndatedSets(clientId, exercise);
  if (!sets.length) return null;
  const s = suggestNext(
    sets.map((x) => ({ weight_kg: x.weight_kg === null ? null : Number(x.weight_kg), reps: x.reps, effort: "comfortable" as const })),
    reps,
    exercise,
    repsInReserve,
  );
  return s ? { ...s, last: s.last.replace(/^Last time/, "Before the app") } : null;
}
