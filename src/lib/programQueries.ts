import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { deloadExercises } from "@/lib/deload";
import { withExtraCardio } from "@/lib/programs";
import { withClientCardio } from "@/lib/clientExtras";
import { applyExerciseChanges, type ChangeWrites } from "@/lib/exerciseChanges";
import { exercisesForSlot } from "@/lib/trainingCalendar";
import { withTemporarySwaps } from "@/lib/programSwaps";
import { withoutSkippedCardio, type CardioSkip } from "@/lib/cardioSkips";
import type { ClientExerciseChange, ClientProgram, Program, ProgramExercise } from "@/types/database";

export interface ActiveProgram {
  assignment: ClientProgram;
  program: Program;
  exercises: ProgramExercise[];
}

/**
 * The program a client is on (0035), with all of its exercises and any cardio
 * the trainer added just for them (0054), or null.
 */
export async function loadClientProgram(clientId: string): Promise<ActiveProgram | null> {
  const { data: assignment } = await supabase
    .from("client_programs")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!assignment) return null;
  const [{ data: program }, { data: exercises }, changes] = await Promise.all([
    supabase.from("programs").select("*").eq("id", assignment.program_id).maybeSingle(),
    loadProgramExercises(assignment.program_id),
    loadExerciseChanges(clientId),
  ]);
  if (!program) return null;
  return {
    assignment,
    program,
    exercises: withExtraCardio(applyExerciseChanges(exercises ?? [], changes), assignment.extra_cardio),
  };
}

/** Cardio the trainer took off this client's workouts (0140). */
export async function loadCardioSkips(clientId: string): Promise<CardioSkip[]> {
  const { data } = await supabase.from("client_cardio_skips").select("*").eq("client_id", clientId);
  return (data as CardioSkip[] | null) ?? [];
}

/** The exercises, sets and reps a client's trainer changed for them (0070). */
export async function loadExerciseChanges(clientId: string): Promise<ClientExerciseChange[]> {
  const { data } = await supabase.from("client_exercise_changes").select("*").eq("client_id", clientId);
  return data ?? [];
}

/** Saves a trainer's change to one exercise for a client. Returns an error message, or null. */
export async function saveExerciseChanges({ upserts, removes }: ChangeWrites): Promise<string | null> {
  const ownRows = upserts.filter((u) => u.program_exercise_id);
  const everyRows = upserts.filter((u) => u.original_exercise_id);
  const results = await Promise.all([
    ownRows.length ? supabase.from("client_exercise_changes").upsert(ownRows, { onConflict: "client_id,program_exercise_id" }) : null,
    everyRows.length ? supabase.from("client_exercise_changes").upsert(everyRows, { onConflict: "client_id,original_exercise_id" }) : null,
    removes.length ? supabase.from("client_exercise_changes").delete().in("id", removes) : null,
  ]);
  return results.find((r) => r?.error)?.error?.message ?? null;
}

/**
 * Every row of these programs in week, day and exercise order, a page at a
 * time: Supabase returns at most 1000 rows, and the 52-week Muscle Year
 * programs (0150) have up to about 1700.
 */
async function loadProgramRows(programIds: string[]) {
  const rows: ProgramExercise[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("program_exercises")
      .select("*")
      .in("program_id", programIds)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) return { data: null, error };
    rows.push(...((data ?? []) as ProgramExercise[]));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

/** A program's rows as clients do them today, with any stand-in the trainer put in for now (0139). */
export async function loadProgramExercises(programId: string) {
  const { data, error } = await loadProgramRows([programId]);
  return { data: data ? withTemporarySwaps(data, todayIso()) : data, error };
}

// Holds the exercises taken out of the built-in workouts (0073). Never listed.
export const RETIRED_PROGRAM_NAME = "Retired workout exercises";

/** Built-in programs first (quick, then weekly), then the trainer's own. */
export async function loadAvailablePrograms(): Promise<Program[]> {
  const { data } = await supabase
    .from("programs")
    .select("*")
    .neq("name", RETIRED_PROGRAM_NAME)
    .order("created_at", { ascending: true })
    .order("name", { ascending: true });
  const rank = (p: Program) => (p.trainer_id ? 2 : p.kind === "quick" ? 0 : 1);
  return (data ?? []).slice().sort((a, b) => rank(a) - rank(b));
}

/** A client's calendar workouts between two dates (0069), oldest first. */
export async function loadCalendarWorkouts(clientId: string, from: string, to: string) {
  const { data } = await supabase
    .from("client_calendar_workouts")
    .select("*")
    .eq("client_id", clientId)
    .gte("workout_date", from)
    .lte("workout_date", to)
    .order("workout_date", { ascending: true });
  return data ?? [];
}

export interface CalendarDayWorkout {
  program: Program;
  exercises: ProgramExercise[];
  /** The program's session on this day (0098), null for the whole workout. */
  daySlot: number | null;
  /** A deload week's workout (0115): sets already halved here. */
  deload?: boolean;
  /** For an extra block (0123): its row id, and the client's Done / Couldn't do it. */
  blockId?: string;
  result?: "done" | "skipped" | null;
}

export interface CalendarDay {
  /** The day's main workout, or null when there are only extra blocks. */
  main: CalendarDayWorkout | null;
  /** Extra blocks for the day (0098, GRIZZ, 2026-10-16), e.g. mobility or fight, in order. */
  extras: CalendarDayWorkout[];
}

/** A client's extra calendar blocks between two dates (0098), leaving out ones taken off. */
export async function loadCalendarBlocks(clientId: string, from: string, to: string) {
  const { data } = await supabase
    .from("client_calendar_blocks")
    .select("*")
    .eq("client_id", clientId)
    .gte("workout_date", from)
    .lte("workout_date", to)
    .is("removed_at", null)
    .order("workout_date", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * What's on a client's calendar for `date` (0069): the main workout and any
 * extra blocks (0098), each with its exercises (just its session for a day
 * from a weekly program) and the client's exercise changes. Null when nothing
 * is planned.
 */
export async function loadCalendarWorkoutFor(clientId: string, date: string): Promise<CalendarDay | null> {
  const [{ data: entry }, blocks] = await Promise.all([
    supabase.from("client_calendar_workouts").select("*").eq("client_id", clientId).eq("workout_date", date).maybeSingle(),
    loadCalendarBlocks(clientId, date, date),
  ]);
  const picks = [...(entry ? [entry] : []), ...blocks];
  if (picks.length === 0) return null;
  const ids = [...new Set(picks.map((p) => p.program_id))];
  const [{ data: programs }, { data: rows }, changes, { data: client }] = await Promise.all([
    supabase.from("programs").select("*").in("id", ids),
    loadProgramRows(ids),
    loadExerciseChanges(clientId),
    // The trainer's extra cardio for this client (0136), on the main workout.
    supabase.from("clients").select("extra_cardio").eq("id", clientId).maybeSingle(),
  ]);
  const skips = await loadCardioSkips(clientId);
  const build = (pick: { program_id: string; day_slot: number | null; deload?: boolean }): CalendarDayWorkout | null => {
    const program = (programs ?? []).find((p) => p.id === pick.program_id);
    if (!program) return null;
    const own = (rows ?? []).filter((r) => r.program_id === pick.program_id);
    const exercises = applyExerciseChanges(withTemporarySwaps(exercisesForSlot(own, pick.day_slot), date), changes);
    const kept = withoutSkippedCardio(exercises, skips, date);
    return { program, exercises: pick.deload ? deloadExercises(kept) : kept, daySlot: pick.day_slot, deload: !!pick.deload };
  };
  const built = entry ? build(entry) : null;
  const main = built
    ? { ...built, exercises: withoutSkippedCardio(withClientCardio(built.program, built.exercises, client?.extra_cardio), skips, date) }
    : null;
  const extras = blocks
    .map((b): CalendarDayWorkout | null => {
      const built = build(b);
      return built ? { ...built, blockId: b.id, result: b.result ?? null } : null;
    })
    .filter((b): b is CalendarDayWorkout => !!b);
  return main || extras.length > 0 ? { main, extras } : null;
}
