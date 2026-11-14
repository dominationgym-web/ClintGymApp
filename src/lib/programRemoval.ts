import { supabase } from "@/lib/supabase";
import { programGoal } from "@/lib/programGoals";
import type { Program } from "@/types/database";

// One training program at a time (GRIZZ, 2026-11-14: two programs on one
// client "will confuse the trainer and client and makes the page look too
// busy"). Mobility and flexibility programs are the exception: they go on top
// of training, so they never count as the client's program.
export function isMainProgram(program: Pick<Program, "name" | "trainer_id">): boolean {
  return programGoal(program) !== "mobility";
}

/**
 * Takes a program off a client's calendar from a day on: its workouts and
 * extra blocks from that day go, and its week-by-week plan stops. Days before
 * it stay as the client's history.
 */
export async function removeProgramFrom(clientId: string, programId: string, from: string) {
  const now = new Date().toISOString();
  const results = await Promise.all([
    supabase.from("client_calendar_workouts").delete().eq("client_id", clientId).eq("program_id", programId).gte("workout_date", from),
    // Taking a block off keeps its row, marked removed (0098).
    supabase
      .from("client_calendar_blocks")
      .update({ removed_at: now })
      .eq("client_id", clientId)
      .eq("program_id", programId)
      .gte("workout_date", from)
      .is("removed_at", null),
    supabase.from("client_program_plans").update({ ended_at: now }).eq("client_id", clientId).eq("program_id", programId).is("ended_at", null),
  ]);
  return results.find((r) => r.error)?.error ?? null;
}
