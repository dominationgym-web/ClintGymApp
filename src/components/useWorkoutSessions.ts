import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SESSION_COLORS } from "@/lib/workoutSessions";
import type { WorkoutSession } from "@/types/database";

/**
 * How the client's workouts went between two dates (0076), by date, plus the
 * dots and stars for a TrainingCalendar. Bump `refreshKey` to load again.
 */
export function useWorkoutSessions(clientId: string, from: string, to: string, refreshKey = 0) {
  const [byDate, setByDate] = useState<Record<string, WorkoutSession>>({});
  useEffect(() => {
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("client_id", clientId)
      .gte("session_date", from)
      .lte("session_date", to)
      .then(({ data }) => setByDate(Object.fromEntries((data ?? []).map((s) => [s.session_date, s]))));
  }, [clientId, from, to, refreshKey]);
  const marks = Object.fromEntries(
    Object.values(byDate).map((s) => [s.session_date, { color: SESSION_COLORS[s.status], star: s.star }]),
  );
  return { byDate, marks };
}
