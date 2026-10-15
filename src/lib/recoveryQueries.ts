import { supabase } from "@/lib/supabase";
import { loadClientProgram, type ActiveProgram } from "@/lib/programQueries";
import { findRecoveryClash, plannedRowsFor, setsByGroup, yesterdayOf, type RecoveryClash } from "@/lib/recovery";
import type { ProgramExercise } from "@/types/database";

export interface RecoveryCheck {
  active: ActiveProgram;
  planned: ProgramExercise[];
  clash: RecoveryClash;
}

let categoryCache: Map<string, string | null> | null = null;

async function exerciseCategories(): Promise<Map<string, string | null>> {
  if (categoryCache) return categoryCache;
  const { data } = await supabase.from("exercises").select("id, category");
  categoryCache = new Map((data ?? []).map((e) => [e.id as string, e.category as string | null]));
  return categoryCache;
}

/** Today's recovery clash for a client, or null when there's nothing to flag. */
export async function loadRecoveryCheck(clientId: string, today: string): Promise<RecoveryCheck | null> {
  const [active, { data: logs }, categories] = await Promise.all([
    loadClientProgram(clientId),
    supabase.from("workout_logs").select("exercise_id").eq("client_id", clientId).eq("log_date", yesterdayOf(today)),
    exerciseCategories(),
  ]);
  if (!active || !logs || logs.length === 0) return null;
  const categoryOf = (id: string | null) => (id ? categories.get(id) : null);
  const planned = plannedRowsFor(active, today);
  const clash = findRecoveryClash(planned, setsByGroup(logs, categoryOf), categoryOf);
  return clash ? { active, planned, clash } : null;
}

/** Which of these clients logged sets yesterday (the only ones a clash is possible for). */
export async function clientsWhoTrainedYesterday(clientIds: string[], today: string): Promise<string[]> {
  if (clientIds.length === 0) return [];
  const { data } = await supabase
    .from("workout_logs")
    .select("client_id")
    .in("client_id", clientIds)
    .eq("log_date", yesterdayOf(today));
  return [...new Set((data ?? []).map((r) => r.client_id as string))];
}
