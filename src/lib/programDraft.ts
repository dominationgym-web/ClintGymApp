// Programs saved as drafts while a trainer builds them (0230, GRIZZ
// 2026-11-19). The builder saves what's on screen as the trainer goes, under
// the name they gave it, to the database, so it's there on any phone or
// laptop. A copy is also kept on this phone in case there's no signal, and
// sent up the next time the Programs tab opens. A draft with programId holds
// unsaved changes to one of the trainer's saved programs.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import { DEFAULT_WARM_UP, type DraftSession } from "@/lib/programs";

export type AbsChoice = { on: boolean; reps: number; exercise: string | null };

export type ProgramDraft = {
  name: string;
  howTo: string;
  warmUp: string;
  sessions: DraftSession[];
  activeDay: number;
  place: ExercisePlace;
  abs?: AbsChoice;
};

/** A draft as the Programs tab lists it. */
export type ProgramDraftSummary = {
  id: string;
  program_id: string | null;
  name: string;
  updated_at: string;
};

// The copy kept on this phone: the draft being worked on, and whether the
// database has it yet.
type LocalCopy = ProgramDraft & { id?: string; programId?: string | null; savedAt?: string; synced?: boolean };

const key = (trainerId: string) => `programDraft:${trainerId}`;

/** A new draft's id, made on the phone so saving it twice never makes two. */
export function newDraftId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** True when nothing has been typed or picked yet, so there's nothing to keep. */
export function isEmptyDraft(draft: ProgramDraft): boolean {
  return (
    !draft.name.trim() &&
    !draft.howTo.trim() &&
    (draft.warmUp.trim() === "" || draft.warmUp === DEFAULT_WARM_UP) &&
    draft.sessions.every((s) => !s.title.trim() && s.exercises.every((e) => e.kind === "cardio" || !e.exerciseId))
  );
}

/** The name a draft shows under on the Programs tab. */
export function draftLabel(name: string): string {
  return name.trim() || "Program with no name yet";
}

function toData(draft: ProgramDraft) {
  const { name: _name, ...data } = draft;
  return data;
}

function fromRow(row: { name: string; data: unknown }): ProgramDraft | null {
  const data = row.data as Partial<ProgramDraft> | null;
  if (!data || !Array.isArray(data.sessions)) return null;
  return {
    name: row.name ?? "",
    howTo: data.howTo ?? "",
    warmUp: data.warmUp ?? DEFAULT_WARM_UP,
    sessions: data.sessions,
    activeDay: data.activeDay ?? data.sessions[0]?.day ?? 1,
    place: data.place ?? "gym",
    abs: data.abs,
  };
}

/** The trainer's drafts, newest first. */
export async function listProgramDrafts(trainerId: string): Promise<ProgramDraftSummary[]> {
  const { data } = await supabase
    .from("program_drafts")
    .select("id, program_id, name, updated_at")
    .eq("trainer_id", trainerId)
    .order("updated_at", { ascending: false });
  return (data as ProgramDraftSummary[] | null) ?? [];
}

/** One draft by id, or the unsaved changes to a saved program. */
export async function loadProgramDraft(
  by: { id: string } | { programId: string },
): Promise<{ id: string; programId: string | null; draft: ProgramDraft } | null> {
  const query = supabase.from("program_drafts").select("id, program_id, name, data");
  const { data } = await ("id" in by ? query.eq("id", by.id) : query.eq("program_id", by.programId)).maybeSingle();
  if (!data) return null;
  const draft = fromRow(data);
  return draft ? { id: data.id, programId: data.program_id, draft } : null;
}

async function upsert(trainerId: string, id: string, programId: string | null, draft: ProgramDraft): Promise<boolean> {
  const { error } = await supabase.from("program_drafts").upsert(
    { id, trainer_id: trainerId, program_id: programId, name: draft.name.trim(), data: toData(draft), updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) console.warn("Couldn't save the program draft", error.message);
  return !error;
}

// The save still going when the builder closes, so the Programs tab waits for
// it before listing drafts.
let inFlight: Promise<unknown> = Promise.resolve();

/** Resolves once any draft save under way has finished. */
export function draftSavesDone(): Promise<void> {
  return inFlight.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Saves the draft: on this phone first, then to the database. Returns false
 * when only the phone has it (no signal); it goes up later.
 */
export function saveProgramDraft(trainerId: string, id: string, programId: string | null, draft: ProgramDraft): Promise<boolean> {
  const run = inFlight.then(
    () => writeDraft(trainerId, id, programId, draft),
    () => writeDraft(trainerId, id, programId, draft),
  );
  inFlight = run;
  return run;
}

async function writeDraft(trainerId: string, id: string, programId: string | null, draft: ProgramDraft): Promise<boolean> {
  const local: LocalCopy = { ...draft, id, programId, savedAt: new Date().toISOString(), synced: false };
  try {
    await AsyncStorage.setItem(key(trainerId), JSON.stringify(local));
  } catch (e) {
    console.warn("Couldn't keep the program draft on the phone", e);
  }
  const ok = await upsert(trainerId, id, programId, draft);
  if (ok) {
    try {
      await AsyncStorage.setItem(key(trainerId), JSON.stringify({ ...local, synced: true }));
    } catch {
      // The database has it; the phone copy doesn't matter.
    }
  }
  return ok;
}

/** Throws a draft away (after the program is saved, or Delete draft). */
export async function deleteProgramDraft(trainerId: string, id: string): Promise<boolean> {
  await draftSavesDone();
  try {
    const raw = await AsyncStorage.getItem(key(trainerId));
    if (raw && (JSON.parse(raw) as LocalCopy).id === id) await AsyncStorage.removeItem(key(trainerId));
  } catch {
    // Nothing to clear.
  }
  const { error } = await supabase.from("program_drafts").delete().eq("id", id);
  return !error;
}

/**
 * Sends up a draft that only this phone has: one saved with no signal, or one
 * from before drafts were kept in the database (the builder used to keep a
 * single draft on the phone only).
 */
export async function syncPhoneDraft(trainerId: string): Promise<void> {
  let local: LocalCopy | null = null;
  try {
    const raw = await AsyncStorage.getItem(key(trainerId));
    local = raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return;
  }
  if (!local || local.synced || !Array.isArray(local.sessions)) return;
  if (isEmptyDraft(local)) {
    await AsyncStorage.removeItem(key(trainerId)).catch(() => undefined);
    return;
  }
  const id = local.id ?? newDraftId();
  const draft: ProgramDraft = {
    name: local.name ?? "",
    howTo: local.howTo ?? "",
    warmUp: local.warmUp ?? DEFAULT_WARM_UP,
    sessions: local.sessions,
    activeDay: local.activeDay ?? 1,
    place: local.place ?? "gym",
    abs: local.abs,
  };
  if (await upsert(trainerId, id, local.programId ?? null, draft)) {
    await AsyncStorage.setItem(key(trainerId), JSON.stringify({ ...local, id, synced: true })).catch(() => undefined);
  }
}
