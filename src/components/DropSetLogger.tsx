import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import ModalSafeArea from "./ModalSafeArea";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { parseWeight } from "@/lib/weightInput";
import { BRAND_GOLD } from "@/lib/brand";
import RestTimer from "@/components/RestTimer";
import KeyboardSafe from "@/components/KeyboardSafe";
import {
  clockSeconds,
  compareRound,
  DROP_SET_REST_SECONDS,
  dropPlanText,
  dropRange,
  formatRoundTime,
  needsLevelNote,
  newClock,
  pauseClock,
  startClock,
  type RoundClock,
} from "@/lib/dropSets";
import type { Client, DropSetRound, ProgramExercise, WorkoutLog } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

type Entry = { weight: number | null; reps: number };

// Drop set logger (GRIZZ, 2026-10-16). One round at a time: type the start
// weight and reps, tap Log and the round clock starts. Typing the next weight
// pauses it, tapping Log runs it again. Finish round saves every set (to
// failure) and the round time, compares it with last time, and starts the
// 6-minute recovery before the next round. Kept short so there's no scrolling.
export default function DropSetLogger({
  visible,
  row,
  client,
  programId,
  rounds,
  roundsDone,
  onSaved,
  onClose,
}: {
  visible: boolean;
  row: ProgramExercise | null;
  client: Client;
  programId: string;
  rounds: number;
  roundsDone: number;
  onSaved: (logs: WorkoutLog[]) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [clock, setClock] = useState<RoundClock>(newClock());
  const [now, setNow] = useState(Date.now());
  const [last, setLast] = useState<DropSetRound[]>([]);
  const [today, setToday] = useState<DropSetRound[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [resting, setResting] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !row) return;
    setEntries([]);
    setWeight("");
    setReps("");
    setClock(newClock());
    setResult(null);
    setResting(0);
    const q = supabase.from("drop_set_rounds").select("*").eq("client_id", client.id);
    (row.exercise_id ? q.eq("exercise_id", row.exercise_id) : q.eq("exercise_name", row.exercise_name))
      .order("log_date", { ascending: false })
      .order("round_number", { ascending: true })
      .limit(30)
      .then(({ data }) => {
        const all = (data as DropSetRound[]) ?? [];
        const t = todayIso();
        setToday(all.filter((r) => r.log_date === t));
        const lastDate = all.find((r) => r.log_date < t)?.log_date;
        setLast(lastDate ? all.filter((r) => r.log_date === lastDate) : []);
      });
  }, [visible, row?.id]);

  useEffect(() => {
    if (clock.since == null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [clock.since]);

  if (!row) return null;
  const range = dropRange(row.exercise_name);
  const roundNumber = Math.max(roundsDone, today.length) + 1;
  const allDone = roundNumber > rounds;
  const drops = Math.max(0, entries.length - 1);
  const lastRound = last.find((r) => r.round_number === roundNumber);

  const typeWeight = (v: string) => {
    // Pause the round clock while they change the weight.
    if (entries.length > 0) setClock((c) => pauseClock(c, Date.now()));
    setWeight(v);
  };

  const log = () => {
    const r = parseInt(reps, 10);
    if (!r || r < 0) {
      Alert.alert("Reps", "Put in how many reps you did.");
      return;
    }
    setEntries((e) => [...e, { weight: parseWeight(weight), reps: r }]);
    setClock((c) => startClock(c, Date.now()));
    setNow(Date.now());
    setReps("");
    setWeight("");
    setResult(null);
  };

  const finish = async () => {
    if (entries.length === 0) return;
    const stopped = pauseClock(clock, Date.now());
    const seconds = clockSeconds(stopped, Date.now());
    const totalReps = entries.reduce((t, e) => t + e.reps, 0);
    setSaving(true);
    const logRows = entries.map((e, i) => ({
      client_id: client.id,
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      log_date: todayIso(),
      set_number: i + 1,
      weight_kg: e.weight,
      reps: e.reps,
      // Every drop stops short; only the last may go to failure.
      effort: range.toFailure && i === entries.length - 1 ? ("failure" as const) : ("close_to_failure" as const),
      warm_up: false,
    }));
    const { data: logs, error } = await supabase.from("workout_logs").insert(logRows).select();
    if (error) {
      setSaving(false);
      Alert.alert("Couldn't save", error.message);
      return;
    }
    const { data: saved, error: roundError } = await supabase
      .from("drop_set_rounds")
      .insert({
        client_id: client.id,
        program_id: programId,
        exercise_id: row.exercise_id,
        exercise_name: row.exercise_name,
        log_date: todayIso(),
        round_number: roundNumber,
        seconds,
        drops,
        total_reps: totalReps,
      })
      .select()
      .single();
    setSaving(false);
    if (roundError) Alert.alert("Couldn't save the round time", roundError.message);
    if (saved) setToday((t) => [...t, saved as DropSetRound]);
    onSaved((logs as WorkoutLog[]) ?? []);
    setResult(`Round ${roundNumber}: ${totalReps} reps, ${drops} drops (${formatRoundTime(seconds)}). ${compareRound({ seconds, totalReps }, lastRound && { seconds: lastRound.seconds, totalReps: lastRound.total_reps })}`);
    setEntries([]);
    setClock(newClock());
    if (roundNumber < rounds) setResting((n) => n + 1);
  };

  const running = clock.since != null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={styles.screen}>
        <KeyboardSafe>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.title}>{row.exercise_name}</Text>
              <Pressable onPress={onClose} accessibilityRole="button">
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.sub}>
              {dropPlanText(rounds, range)}
            </Text>
            {needsLevelNote(client.training_level) && (
              <Text style={styles.note}>Drop sets are for intermediate and advanced lifters. Go carefully and stop if your form breaks.</Text>
            )}
            {result && <Text style={styles.result}>{result}</Text>}
            {resting > 0 && <RestTimer key={resting} seconds={DROP_SET_REST_SECONDS} onClose={() => setResting(0)} />}
            {allDone ? (
              <Text style={styles.done}>All {rounds} rounds done. Great work. 💪</Text>
            ) : (
              <>
                <View style={styles.roundRow}>
                  <Text style={styles.round}>Round {roundNumber} of {rounds}</Text>
                  <Text style={[styles.clock, running && { color: themeText(BRAND_GOLD) }]}>
                    ⏱ {formatRoundTime(clockSeconds(clock, now))}
                    {entries.length > 0 && !running ? " paused" : ""}
                  </Text>
                </View>
                {lastRound && (
                  <Text style={styles.last}>
                    Last time: {lastRound.total_reps} reps, {lastRound.drops} drops ({formatRoundTime(lastRound.seconds)})
                  </Text>
                )}
                {entries.length > 0 && (
                  <Text style={styles.sets}>
                    {entries.map((e, i) => `${i === 0 ? "Start" : `D${i}`} ${e.weight ?? "-"}kg x${e.reps}`).join(" · ")}
                  </Text>
                )}
                <View style={styles.inputs}>
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={typeWeight}
                    placeholder={entries.length ? "Next kg" : "Start kg"}
                    placeholderTextColor="#64748B"
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={styles.input}
                    value={reps}
                    onChangeText={setReps}
                    placeholder="Reps"
                    placeholderTextColor="#64748B"
                    keyboardType="number-pad"
                  />
                  <Pressable style={styles.logButton} onPress={log} accessibilityRole="button">
                    <Text style={styles.logText}>Log</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.finish, (entries.length === 0 || saving) && { opacity: 0.5 }]}
                  onPress={finish}
                  disabled={entries.length === 0 || saving}
                  accessibilityRole="button"
                >
                  {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.finishText}>Finish round</Text>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardSafe>
      </ModalSafeArea>
    </Modal>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  body: { padding: 16, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#F8FAFC", fontSize: 20, fontWeight: "700", flex: 1 },
  close: { color: BRAND_GOLD, fontWeight: "600", padding: 6 },
  sub: { color: "#94A3B8", fontSize: 13 },
  note: { color: "#FBBF24", fontSize: 13 },
  result: { color: "#22C55E", fontSize: 14, fontWeight: "600" },
  done: { color: "#22C55E", fontSize: 16, fontWeight: "700", marginTop: 8 },
  roundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  round: { color: "#F8FAFC", fontSize: 16, fontWeight: "700" },
  clock: { color: "#CBD5E1", fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  last: { color: "#94A3B8", fontSize: 13 },
  sets: { color: "#E2E8F0", fontSize: 13 },
  inputs: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: "#1E293B", color: "#F8FAFC", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  logButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 },
  logText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  finish: { backgroundColor: "#22C55E", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  finishText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
});
