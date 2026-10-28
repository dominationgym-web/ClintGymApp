import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { trainingLogStart } from "@/lib/trainingLog";
import TrainerTrainingLog from "@/components/TrainerTrainingLog";
import ProgressCard from "@/components/ProgressCard";
import type { TrainerStackParamList } from "@/navigation/types";
import type { WorkoutLog, WorkoutSession } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// Makes sure the trainer's own training row exists (0146), then opens their
// live workout. Also used by "My workout" on the trainer menu (GRIZZ, 2026-10-27).
export async function startMyWorkout(
  trainer: { id: string; name: string },
  navigation: NativeStackNavigationProp<TrainerStackParamList>,
): Promise<boolean> {
  const { error } = await supabase.rpc("start_my_training");
  if (error) {
    Alert.alert("Couldn't start", error.message);
    return false;
  }
  navigation.navigate("LiveWorkout", { clientId: trainer.id, name: trainer.name, self: true });
  return true;
}

// The trainer's own training (0146, GRIZZ 2026-10-23). Start my workout opens
// the live workout screen for themselves; their last two weeks and progress
// graphs sit underneath, the same as on a client's profile.
export default function MyTraining() {
  const { trainer } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [started, setStarted] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [sessions, setSessions] = useState<Record<string, WorkoutSession>>({});
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    if (!trainer) return;
    const from = trainingLogStart(todayIso());
    const [{ data: row }, { data: logRows }, { data: sessionRows }] = await Promise.all([
      supabase.from("clients").select("id").eq("id", trainer.id).maybeSingle(),
      supabase
        .from("workout_logs")
        .select("*")
        .eq("client_id", trainer.id)
        .gte("log_date", from)
        .order("log_date", { ascending: false })
        .order("set_number", { ascending: true })
        .limit(1000),
      supabase.from("workout_sessions").select("*").eq("client_id", trainer.id).gte("session_date", from),
    ]);
    setStarted(!!row);
    setLogs(logRows ?? []);
    setSessions(Object.fromEntries((sessionRows ?? []).map((s) => [s.session_date, s])));
  }, [trainer?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!trainer) return null;

  const start = async () => {
    setOpening(true);
    const ok = await startMyWorkout(trainer, navigation);
    setOpening(false);
    if (ok) setStarted(true);
  };

  return (
    <>
      <Pressable style={styles.start} onPress={start} disabled={opening}>
        {opening ? (
          <ActivityIndicator color={themeText("#0F172A")} />
        ) : (
          <>
            <Text style={styles.startText}>▶ Start my workout</Text>
            <Text style={styles.startSub}>Log your own sets, weights and supersets as you train</Text>
          </>
        )}
      </Pressable>
      {started === null ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 20 }} />
      ) : started ? (
        <>
          <Text style={styles.heading}>📅 My last two weeks</Text>
          <Text style={styles.hint}>Tap a day to see what you lifted.</Text>
          <TrainerTrainingLog logs={logs} sessions={sessions} />
          <View style={{ marginTop: 16 }}>
            <ProgressCard clientId={trainer.id} role="client" />
          </View>
        </>
      ) : (
        <Text style={styles.hint}>Your training log and progress graphs show here after your first workout.</Text>
      )}
    </>
  );
}

const styles = themedStyles({
  start: { backgroundColor: BRAND_GOLD, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 18 },
  startText: { color: "#0F172A", fontWeight: "800", fontSize: 18 },
  startSub: { color: "#0F172A", fontSize: 13, marginTop: 4 },
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 4 },
  hint: { color: "#64748B", fontSize: 12, marginBottom: 10 },
});
