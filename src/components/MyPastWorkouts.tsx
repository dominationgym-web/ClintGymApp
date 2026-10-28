import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { trainingLogStart } from "@/lib/trainingLog";
import TrainerTrainingLog from "@/components/TrainerTrainingLog";
import type { WorkoutLog, WorkoutSession } from "@/types/database";

// The client's last two weeks, the same list the coach sees on their profile:
// tap a day to see every exercise and set, 🤝 for live sessions with the
// coach (GRIZZ, 2026-10-27). Loads when the fold opens.
export default function MyPastWorkouts({ clientId }: { clientId: string }) {
  const [logs, setLogs] = useState<WorkoutLog[] | null>(null);
  const [sessions, setSessions] = useState<Record<string, WorkoutSession>>({});

  useEffect(() => {
    const from = trainingLogStart(todayIso());
    Promise.all([
      supabase
        .from("workout_logs")
        .select("*")
        .eq("client_id", clientId)
        .gte("log_date", from)
        .order("log_date", { ascending: false })
        .order("set_number", { ascending: true })
        .limit(1000),
      supabase.from("workout_sessions").select("*").eq("client_id", clientId).gte("session_date", from),
    ]).then(([{ data: logRows }, { data: sessionRows }]) => {
      setLogs(logRows ?? []);
      setSessions(Object.fromEntries((sessionRows ?? []).map((s) => [s.session_date, s])));
    });
  }, [clientId]);

  if (!logs) return <Text style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</Text>;
  return <TrainerTrainingLog logs={logs} sessions={sessions} client />;
}
