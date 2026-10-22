// Bringing a client's history in from another app (0142, GRIZZ 2026-10-22).
// The import-history edge function does the reading (Claude) and the adding;
// this is the app's side: sending files and the words shown for each import.
import { supabase } from "@/lib/supabase";
import { importCounts, type ImportResult } from "../../supabase/functions/import-history/shape";

export type ImportFile = { name: string; type: string; data: string };

export type ClientImport = {
  id: string;
  client_id: string;
  uploaded_role: "client" | "trainer";
  file_names: string[];
  status: "reading" | "ready" | "failed" | "added" | "dismissed";
  result: ImportResult | null;
  error: string | null;
  added_counts: { workouts: number; sets: number; body: number; skipped: number; skipped_body: number } | null;
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

/** "12 training days (40 exercises, 120 sets) and 5 body weights, 3 Mar 2026 to 20 Oct 2026". */
export function importSummary(r: ImportResult): string {
  const c = importCounts(r);
  const parts: string[] = [];
  if (c.days) parts.push(`${plural(c.days, "training day")} (${plural(c.workouts, "exercise")}, ${plural(c.sets, "set")})`);
  if (c.body) parts.push(plural(c.body, "body stat entry", "body stat entries"));
  const range = c.from && c.to ? (c.from === c.to ? `, on ${c.from}` : `, ${c.from} to ${c.to}`) : "";
  return `${parts.join(" and ") || "Nothing"}${range}`;
}

/** A few lines so the trainer can check it read things right. */
export function importSample(r: ImportResult, max = 4): string[] {
  const lines = r.workouts.slice(-max).map((w) => {
    const sets = w.sets.map((s) => (s.weight_kg ? `${s.weight_kg}kg×${s.reps}` : `${s.reps}`)).join(", ");
    return `${w.date} · ${w.exercise}: ${sets}`;
  });
  const lastBody = r.body[r.body.length - 1];
  if (lastBody?.weight_kg) lines.push(`${lastBody.date} · Body weight ${lastBody.weight_kg} kg`);
  return lines;
}

export function addedSummary(c: NonNullable<ClientImport["added_counts"]>): string {
  const parts = [`${plural(c.workouts, "exercise")} (${plural(c.sets, "set")})`, plural(c.body, "body stat entry", "body stat entries")];
  const skipped = c.skipped + c.skipped_body;
  return `Added ${parts.join(" and ")}.${skipped ? ` ${skipped} already in the app, so left out.` : ""}`;
}
