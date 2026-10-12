import { supabase } from "@/lib/supabase";
import { withExtraCardio } from "@/lib/programs";
import { applyExerciseChanges, type ChangeWrites } from "@/lib/exerciseChanges";
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

export function loadProgramExercises(programId: string) {
  return supabase
    .from("program_exercises")
    .select("*")
    .eq("program_id", programId)
    .order("week_number", { ascending: true })
    .order("day_number", { ascending: true })
    .order("sort_order", { ascending: true });
}

/** Built-in programs first (quick, then weekly), then the trainer's own. */
export async function loadAvailablePrograms(): Promise<Program[]> {
  const { data } = await supabase
    .from("programs")
    .select("*")
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
}

/** The workout on a client's calendar for `date` (0069), with its exercises, or null. */
export async function loadCalendarWorkoutFor(clientId: string, date: string): Promise<CalendarDayWorkout | null> {
  const { data: entry } = await supabase
    .from("client_calendar_workouts")
    .select("*")
    .eq("client_id", clientId)
    .eq("workout_date", date)
    .maybeSingle();
  if (!entry) return null;
  const [{ data: program }, { data: exercises }, changes] = await Promise.all([
    supabase.from("programs").select("*").eq("id", entry.program_id).maybeSingle(),
    loadProgramExercises(entry.program_id),
    loadExerciseChanges(clientId),
  ]);
  return program ? { program, exercises: applyExerciseChanges(exercises ?? [], changes) } : null;
}
