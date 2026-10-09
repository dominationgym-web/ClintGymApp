import { supabase } from "@/lib/supabase";
import type { ClientProgram, Program, ProgramExercise } from "@/types/database";

export interface ActiveProgram {
  assignment: ClientProgram;
  program: Program;
  exercises: ProgramExercise[];
}

/** The program a client is on (0035), with all of its exercises, or null. */
export async function loadClientProgram(clientId: string): Promise<ActiveProgram | null> {
  const { data: assignment } = await supabase
    .from("client_programs")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!assignment) return null;
  const [{ data: program }, { data: exercises }] = await Promise.all([
    supabase.from("programs").select("*").eq("id", assignment.program_id).maybeSingle(),
    loadProgramExercises(assignment.program_id),
  ]);
  if (!program) return null;
  return { assignment, program, exercises: exercises ?? [] };
}

export function loadProgramExercises(programId: string) {
  return supabase
    .from("program_exercises")
    .select("*")
    .eq("program_id", programId)
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
