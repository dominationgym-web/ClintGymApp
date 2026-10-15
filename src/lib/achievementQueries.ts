import { supabase } from "@/lib/supabase";
import { achievementBaseline, earnsAchievement } from "@/lib/achievements";
import type { ClientAchievement, WorkoutLog } from "@/types/database";

// After a set is logged: works out whether it earns a gold badge (0085) and,
// if so, records it (which also tells the trainer). Returns the new badge.
export async function checkAchievement(clientId: string, logged: WorkoutLog): Promise<ClientAchievement | null> {
  if (logged.warm_up || logged.weight_kg === null || Number(logged.weight_kg) <= 0) return null;
  const forExercise = <T extends { eq: (col: string, v: string) => T }>(q: T) =>
    logged.exercise_id ? q.eq("exercise_id", logged.exercise_id) : q.eq("exercise_name", logged.exercise_name);
  const [{ data: last }, { data: first }] = await Promise.all([
    forExercise(supabase.from("client_achievements").select("*").eq("client_id", clientId))
      .order("created_at", { ascending: false })
      .limit(1),
    forExercise(supabase.from("workout_logs").select("*").eq("client_id", clientId))
      .order("log_date", { ascending: true })
      .limit(30),
  ]);
  const firstDay = (first ?? []).filter((s) => s.log_date === first?.[0]?.log_date);
  const lastBadge = last?.[0] ?? null;
  const baseline = achievementBaseline(firstDay, lastBadge);
  if (!baseline || !earnsAchievement(logged, baseline)) return null;
  const { data, error } = await supabase
    .from("client_achievements")
    .insert({
      client_id: clientId,
      exercise_id: logged.exercise_id,
      exercise_name: logged.exercise_name,
      from_weight: baseline.weight,
      from_reps: baseline.reps,
      weight: Number(logged.weight_kg),
      reps: logged.reps,
      achieved_on: logged.log_date,
    })
    .select()
    .single();
  return error ? null : data;
}
