// One file with all of a trainer's clients (0190, GRIZZ 2026-11-03). The
// import-history edge function reads it (read_bulk), splits it by person and
// matches names to clients; the trainer checks and adds (add_bulk).
import { callImportHistory, type ImportFile } from "@/lib/historyImport";
import type { ImportResult } from "../../supabase/functions/import-history/shape";

export type BulkPerson = {
  name: string;
  client_id: string | null;
  result: ImportResult;
  added_import_id?: string | null;
  added_counts?: { workouts: number; sets: number; body: number; skipped: number; skipped_body: number; undated?: number } | null;
};

export type BulkImport = {
  id: string;
  trainer_id: string;
  file_names: string[];
  status: "reading" | "ready" | "failed" | "dismissed";
  people: BulkPerson[];
  note: string | null;
  error: string | null;
  created_at: string;
};

export async function sendBulk(today: string, files: ImportFile[]): Promise<string | null> {
  return (await callImportHistory({ action: "read_bulk", today, files })).error;
}

/** links: person number → client id (or null to leave them for later). */
export async function addBulk(bulkId: string, links: Record<number, string | null>): Promise<{ error: string | null; added?: number; waiting?: number }> {
  const { data, error } = await callImportHistory({ action: "add_bulk", bulk_id: bulkId, links });
  const d = (data ?? {}) as { added?: number; waiting?: number };
  return { error, added: d.added, waiting: d.waiting };
}

export async function dismissBulk(bulkId: string): Promise<string | null> {
  return (await callImportHistory({ action: "dismiss_bulk", bulk_id: bulkId })).error;
}

/** Which client each person goes to: the trainer's pick, else the name match. Added people keep theirs. */
export function chosenClient(p: BulkPerson, index: number, picks: Record<number, string | null>): string | null {
  if (p.added_import_id) return p.client_id;
  return Object.prototype.hasOwnProperty.call(picks, index) ? picks[index] : p.client_id;
}

/** "12 people: 9 matched to your clients, 3 to check". */
export function bulkSummary(b: BulkImport, picks: Record<number, string | null>): string {
  const n = b.people.length;
  const added = b.people.filter((p) => p.added_import_id).length;
  const ready = b.people.filter((p, i) => !p.added_import_id && chosenClient(p, i, picks)).length;
  const left = n - added - ready;
  const parts = [added && `${added} added`, ready && `${ready} ready to add`, left && `${left} not linked to a client yet`].filter(Boolean);
  return `${n} ${n === 1 ? "person" : "people"}: ${parts.join(", ")}.`;
}
