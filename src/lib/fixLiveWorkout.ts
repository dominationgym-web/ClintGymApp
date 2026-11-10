import { supabase } from "@/lib/supabase";
import type { WorkoutLog } from "@/types/database";

// Fix or remove a live session afterwards (GRIZZ 2026-11-10, 0210). A trainer
// removes only the sets they logged themselves; the client's own sets stay.

/** True when this trainer logged the set in a live session, so they may remove it. */
export const trainerCanRemove = (set: WorkoutLog, trainerId: string | null | undefined) =>
  !!trainerId && set.logged_by === trainerId;

/** Remove one set. Returns an error message, or null when it worked. */
export async function removeLiveSet(set: WorkoutLog): Promise<string | null> {
  const { data, error } = await supabase.from("workout_logs").delete().eq("id", set.id).select("id");
  if (error) return error.message;
  if (!data?.length) return "Only sets you logged in a live session can be removed.";
  // Set numbers close up again and the 🤝 result counts what's left.
  const { data: left } = await supabase.rpc("resync_live_day", { p_client: set.client_id, p_date: set.log_date });
  if (left === 0) await removeLiveResult(set.client_id, set.log_date);
  return null;
}

/** Remove the whole live workout of a day: the trainer's sets and the 🤝 result. */
export async function removeLiveDay(clientId: string, date: string, trainerId: string): Promise<string | null> {
  const { error } = await supabase
    .from("workout_logs")
    .delete()
    .eq("client_id", clientId)
    .eq("log_date", date)
    .eq("logged_by", trainerId);
  if (error) return error.message;
  const { data: left, error: syncError } = await supabase.rpc("resync_live_day", { p_client: clientId, p_date: date });
  if (syncError) return syncError.message;
  // Sets the client logged themselves stay, and so does the result they count towards.
  if (!left) await removeLiveResult(clientId, date);
  return null;
}

async function removeLiveResult(clientId: string, date: string) {
  await supabase.from("workout_sessions").delete().eq("client_id", clientId).eq("session_date", date).eq("in_person", true);
}
