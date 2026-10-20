import { supabase } from "@/lib/supabase";
import { parseIsoDate, toIsoDate, todayIso } from "@/lib/dates";

// "Don't allow the trainer to leave without confirming if they want to send
// the client that workout or exit without sending" (GRIZZ, 2026-10-20).
// Workout changes are saved as they're made, in several places (calendar,
// planner, exercise changes, stability days), so instead of tracking every
// button the client screen takes a snapshot of the client's training when it
// opens and compares it when the trainer leaves. Anything different and not
// yet sent with Save and tell asks first.

type Rows = Record<string, unknown>[] | null;

/** One string that changes whenever any of the client's training changes. */
export function fingerprintOf(parts: Record<string, Rows | Record<string, unknown>>): string {
  const sorted = (rows: Rows | Record<string, unknown>) =>
    Array.isArray(rows) ? [...rows].map((r) => JSON.stringify(r)).sort() : JSON.stringify(rows ?? null);
  return JSON.stringify(
    Object.keys(parts)
      .sort()
      .map((k) => [k, sorted(parts[k])]),
  );
}

/** The client's training from a week ago on: what Save and tell is about. */
export async function workoutFingerprint(clientId: string): Promise<string> {
  const from = new Date(parseIsoDate(todayIso()));
  from.setDate(from.getDate() - 7);
  const since = toIsoDate(from);
  const [calendar, blocks, changes, program, plans, stability] = await Promise.all([
    supabase.from("client_calendar_workouts").select("id, workout_date, program_id, day_slot, deload").eq("client_id", clientId).gte("workout_date", since),
    supabase
      .from("client_calendar_blocks")
      .select("id, workout_date, program_id, day_slot, position, removed_at")
      .eq("client_id", clientId)
      .gte("workout_date", since),
    supabase.from("client_exercise_changes").select("*").eq("client_id", clientId),
    supabase.from("client_programs").select("program_id, assigned_at").eq("client_id", clientId).maybeSingle(),
    supabase.from("client_program_plans").select("id, ended_at").eq("client_id", clientId),
    supabase.from("client_stability_days").select("id, removed_at").eq("client_id", clientId),
  ]);
  return fingerprintOf({
    calendar: calendar.data,
    blocks: blocks.data,
    changes: changes.data,
    program: program.data ?? {},
    plans: plans.data,
    stability: stability.data,
  });
}
