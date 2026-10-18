// Loading what the Recovery section needs (0107): the client's recovery
// activities, and the last week of training and check-ins the suggestions
// are worked out from. Used by the client's Recovery screen and Check-in, and
// by the coach's view of the client.
import { supabase } from "@/lib/supabase";
import { addDays } from "@/lib/programSchedule";
import { muscleGroupsFor } from "@/lib/recovery";
import { activityTitle, isBigActivity } from "@/lib/otherActivities";
import { suggestRecovery, type RecoveryInputs, type RecoverySuggestion } from "@/lib/recoverySuggest";
import type { RecoveryActivityRow, SetEffort } from "@/types/database";

export async function loadRecoveryActivities(clientId: string, from: string, to: string): Promise<RecoveryActivityRow[]> {
  const { data } = await supabase
    .from("recovery_activities")
    .select("*")
    .eq("client_id", clientId)
    .gte("planned_on", from)
    .lte("planned_on", to)
    .order("planned_on", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as RecoveryActivityRow[] | null) ?? [];
}

/** The client's last week of training, check-ins and recovery, ready for suggestRecovery(). */
export async function loadRecoveryInputs(clientId: string, today: string): Promise<RecoveryInputs> {
  const weekStart = addDays(today, -6);
  const [logs, checkins, recovery, activities, client] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("exercise_id, exercise_name, log_date, effort, warm_up")
      .eq("client_id", clientId)
      .gte("log_date", weekStart)
      .lte("log_date", today),
    supabase
      .from("checkins")
      .select("checkin_date, sleep_quality, pain_status, pain_area, fatigue_status, mental_status")
      .eq("client_id", clientId)
      .gte("checkin_date", addDays(today, -1))
      .lte("checkin_date", today),
    loadRecoveryActivities(clientId, weekStart, today),
    supabase
      .from("client_activities")
      .select("activity_date, kind, name, minutes, effort")
      .eq("client_id", clientId)
      .gte("activity_date", weekStart)
      .lte("activity_date", today),
    supabase.from("clients").select("recovery_program").eq("id", clientId).maybeSingle(),
  ]);
  const rows = ((logs.data ?? []) as {
    exercise_id: string | null;
    exercise_name: string;
    log_date: string;
    effort: SetEffort;
    warm_up: boolean | null;
  }[]).filter((r) => !r.warm_up);
  const ids = [...new Set(rows.map((r) => r.exercise_id).filter((id): id is string => !!id))];
  const { data: exercises } = ids.length
    ? await supabase.from("exercises").select("id, category").in("id", ids)
    : { data: [] as { id: string; category: string | null }[] };
  const categoryOf = new Map((exercises ?? []).map((e) => [e.id, e.category]));
  return {
    sets: rows.map((r) => ({
      date: r.log_date,
      effort: r.effort,
      groups: muscleGroupsFor(r.exercise_id ? categoryOf.get(r.exercise_id) : null),
    })),
    checkins: ((checkins.data ?? []) as {
      checkin_date: string;
      sleep_quality: number | null;
      pain_status: string | null;
      pain_area: string | null;
      fatigue_status: string | null;
      mental_status: string | null;
    }[]).map((c) => ({
      date: c.checkin_date,
      sleepQuality: c.sleep_quality,
      pain: c.pain_status === "reported",
      painArea: c.pain_area,
      fatigue: c.fatigue_status === "reported",
      mental: c.mental_status === "reported",
    })),
    recovery,
    activities: (activities.data ?? []).map((a) => ({
      date: a.activity_date,
      what: activityTitle(a),
      minutes: a.minutes,
      big: isBigActivity(a),
    })),
    recoveryProgram: (client.data as { recovery_program: string | null } | null)?.recovery_program ?? null,
  };
}

export async function loadRecoverySuggestions(clientId: string, today: string, limit = 2): Promise<RecoverySuggestion[]> {
  return suggestRecovery(await loadRecoveryInputs(clientId, today), today, limit);
}

/** Plans an activity (done straight away when `done` is set). */
export async function planRecovery(
  clientId: string,
  activity: string,
  plannedOn: string,
  opts: { done?: boolean; minutes?: number; reason?: string | null; notes?: string | null } = {},
) {
  return supabase.from("recovery_activities").insert({
    client_id: clientId,
    activity,
    planned_on: plannedOn,
    done_on: opts.done ? plannedOn : null,
    minutes: opts.minutes ?? null,
    suggested_reason: opts.reason ?? null,
    notes: opts.notes ?? null,
  });
}
