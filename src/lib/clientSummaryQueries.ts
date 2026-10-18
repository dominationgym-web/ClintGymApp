// Loading the last 7 days for the trainer's daily summary (src/lib/clientSummary.ts),
// and asking the client-daily-summary edge function for Claude's version.
import { supabase } from "@/lib/supabase";
import { addDays } from "@/lib/programSchedule";
import { habitDays, ruleSummary, weekFacts, type DailySummary, type SummaryInputs, type WeekFacts } from "@/lib/clientSummary";
import { toIsoDate } from "@/lib/dates";
import type { ClientDailySummary } from "@/types/database";

const TOPIC: Record<string, string> = { pain: "Pain", fatigue: "Tiredness", mental: "Stress", flag: "Asked for help" };

export async function loadWeekFacts(clientId: string, today: string): Promise<WeekFacts> {
  const from = addDays(today, -6);
  // A flag set late on the day before `from` in UTC is still in range, so read a day early and filter by local date.
  const flagsFrom = `${addDays(from, -1)}T00:00:00Z`;
  const [checkins, flags, planned, sessions, sets, activities, habits, problems, injuries] = await Promise.all([
    supabase
      .from("checkins")
      .select(
        "checkin_date, sleep_bed_time, sleep_wake_time, sleep_quality, alcohol_units, water_litres, pain_status, pain_area, fatigue_status, fatigue_cause, mental_status, mental_cause",
      )
      .eq("client_id", clientId)
      .gte("checkin_date", from)
      .lte("checkin_date", today),
    supabase
      .from("client_status_flag_events")
      .select("flag, note, created_at, set_by_role")
      .eq("client_id", clientId)
      .eq("set_by_role", "client")
      .gte("created_at", flagsFrom),
    supabase.from("client_calendar_workouts").select("workout_date").eq("client_id", clientId).gte("workout_date", from).lte("workout_date", today),
    supabase
      .from("workout_sessions")
      .select("session_date, status, reason, star, makeup_for, improvements")
      .eq("client_id", clientId)
      .gte("session_date", from)
      .lte("session_date", today),
    supabase
      .from("workout_logs")
      .select("log_date, effort, gauge, warm_up")
      .eq("client_id", clientId)
      .gte("log_date", from)
      .lte("log_date", today)
      .range(0, 999),
    supabase
      .from("client_activities")
      .select("activity_date, kind, name, minutes, distance_km, avg_hr, effort")
      .eq("client_id", clientId)
      .gte("activity_date", from)
      .lte("activity_date", today),
    supabase.from("habits").select("id, active_days, reps_target, start_date, end_date").eq("client_id", clientId),
    supabase.from("client_problems").select("topic, status").eq("client_id", clientId).neq("status", "fixed"),
    supabase.from("client_injuries").select("area, healed_on").eq("client_id", clientId).is("healed_on", null),
  ]);
  const habitRows = habits.data ?? [];
  const { data: logs } = habitRows.length
    ? await supabase
        .from("habit_logs")
        .select("habit_id, log_date, reps_completed")
        .in("habit_id", habitRows.map((h) => h.id))
        .gte("log_date", from)
        .lte("log_date", today)
    : { data: [] };

  const inputs: SummaryInputs = {
    checkins: (checkins.data ?? []) as SummaryInputs["checkins"],
    flags: (flags.data ?? []).map((f) => ({ date: toIsoDate(new Date(f.created_at)), flag: f.flag, note: f.note })),
    planned: (planned.data ?? []).map((w) => w.workout_date),
    sessions: (sessions.data ?? []) as SummaryInputs["sessions"],
    sets: ((sets.data ?? []) as { log_date: string; effort: SummaryInputs["sets"][number]["effort"]; gauge: boolean | null; warm_up: boolean | null }[]).filter(
      (s) => !s.warm_up,
    ),
    activities: (activities.data ?? []) as SummaryInputs["activities"],
    habits: habitDays(habitRows, logs ?? [], from, today),
    openProblems: [...new Set((problems.data ?? []).map((p) => TOPIC[p.topic] ?? p.topic))],
    injuries: [...new Set((injuries.data ?? []).map((i) => i.area as string))],
  };
  return weekFacts(inputs, today);
}

export type SummaryResult = { summary: DailySummary; byAi: boolean; at: string | null; noKey?: boolean };

/** Claude's summary for today when it can be had, else the app's rule-based one. */
export async function loadDailySummary(clientId: string, today: string, facts: WeekFacts, force = false): Promise<SummaryResult> {
  const rules = ruleSummary(facts);
  const { data, error } = await supabase.functions.invoke("client-daily-summary", {
    method: "POST",
    body: { client_id: clientId, date: today, facts, rules, force },
  });
  const row = (data as { summary?: ClientDailySummary } | null)?.summary;
  if (error || !row) {
    let noKey = false;
    try {
      const ctx = (error as { context?: Response } | null)?.context;
      noKey = !!ctx && (await ctx.clone().json())?.error === "no_key";
    } catch {
      // Not a JSON answer: treat as any other failure.
    }
    return { summary: rules, byAi: false, at: null, noKey };
  }
  return {
    summary: { energy: row.energy as DailySummary["energy"], summary: row.summary, suggestions: row.suggestions ?? [] },
    byAi: true,
    at: row.created_at,
  };
}
