import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayIso } from "@/lib/dates";
import { parseWeight } from "@/lib/weightInput";
import { BRAND_GOLD } from "@/lib/brand";
import { formatRest } from "@/lib/programs";
import { suggestNext, type Suggestion } from "@/lib/progression";
import { techniqueFor } from "@/lib/exerciseTechnique";
import ExerciseGuideButton, { ExerciseGuideContent, MuscleNotWeight, WatchOnlineLink } from "@/components/ExerciseGuide";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import EveryRepTips from "@/components/EveryRepTips";
import RestTimer from "@/components/RestTimer";
import AchievementBadge from "@/components/AchievementBadge";
import { checkAchievement } from "@/lib/achievementQueries";
import type { ClientAchievement } from "@/types/database";
import type { SetEffort, WorkoutLog } from "@/types/database";
import KeyboardSafe from "@/components/KeyboardSafe";

export type LogExercise = { id: string | null; name: string; category: string | null; external_url: string | null };
export type LogTarget = { setsLabel: string; sets: number; reps: string; restSeconds: number };

const EFFORT_OPTIONS: { key: SetEffort; label: string }[] = [
  { key: "comfortable", label: "Comfortable" },
  { key: "close_to_failure", label: "Close to failure" },
  { key: "failure", label: "Failure" },
];
const EFFORT_LABEL: Record<SetEffort, string> = {
  comfortable: "Comfortable",
  close_to_failure: "Close to failure",
  failure: "Failure",
};

// Log weight, reps and effort for one exercise, with the rest timer, the
// weight suggestion from last time and the how-to guide. Used by the Women's
// Health Reset workouts; sets go in workout_logs like every other workout, so
// the trainer sees them in the client's training log.
export default function LogSetModal({
  exercise,
  target,
  note,
  onClose,
}: {
  exercise: LogExercise | null;
  target: LogTarget | null;
  note?: string;
  onClose: (setsLogged: number) => void;
}) {
  const { client } = useAuth();
  const [todaysSets, setTodaysSets] = useState<WorkoutLog[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [effort, setEffort] = useState<SetEffort | null>(null);
  const [logging, setLogging] = useState(false);
  const [restRun, setRestRun] = useState(0);
  // Gold achievement badge (0085) earned by the set just logged.
  const [badge, setBadge] = useState<ClientAchievement | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setTodaysSets([]);
    setSuggestion(null);
    setWeight("");
    setReps("");
    setEffort(null);
    setRestRun(0);
    setShowGuide(false);
    if (!client || !exercise) return;
    let live = true;
    const forExercise = <T extends { eq: (col: string, v: string) => T }>(q: T) =>
      exercise.id ? q.eq("exercise_id", exercise.id) : q.eq("exercise_name", exercise.name);
    (async () => {
      const { data } = await forExercise(
        supabase.from("workout_logs").select("*").eq("client_id", client.id).eq("log_date", todayIso()),
      ).order("set_number", { ascending: true });
      const { data: earlier } = await forExercise(
        supabase.from("workout_logs").select("*").eq("client_id", client.id).lt("log_date", todayIso()),
      )
        .order("log_date", { ascending: false })
        .limit(20);
      if (!live) return;
      const today = data ?? [];
      setTodaysSets(today);
      const lastDate = earlier?.[0]?.log_date;
      const next = lastDate ? suggestNext(earlier.filter((s) => s.log_date === lastDate), target?.reps, exercise) : null;
      setSuggestion(next);
      const lastToday = today[today.length - 1]?.weight_kg;
      if (lastToday) setWeight(String(lastToday));
      else if (next?.weight) setWeight(String(next.weight));
    })();
    return () => {
      live = false;
    };
  }, [client, exercise, target?.reps]);

  const logSet = async () => {
    if (!client || !exercise) return;
    const repsNum = Number(reps);
    if (!reps || Number.isNaN(repsNum) || repsNum <= 0) {
      Alert.alert("Missing reps", "Enter how many reps you did.");
      return;
    }
    if (!effort) {
      Alert.alert("Missing effort", "Pick how the set felt.");
      return;
    }
    setLogging(true);
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        client_id: client.id,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        log_date: todayIso(),
        set_number: todaysSets.filter((s) => !s.warm_up).length + 1,
        weight_kg: parseWeight(weight),
        reps: repsNum,
        effort,
      })
      .select()
      .single();
    setLogging(false);
    if (error || !data) {
      Alert.alert("Couldn't save set", error?.message ?? "Unknown error");
      return;
    }
    const count = todaysSets.length + 1;
    setTodaysSets((prev) => [...prev, data]);
    checkAchievement(client.id, data).then((b) => b && setBadge(b));
    setWeight(data.weight_kg !== null ? String(data.weight_kg) : "");
    setReps("");
    setEffort(null);
    setRestRun((n) => n + 1);
    if (target && count === target.sets) {
      Alert.alert(`${exercise.name} done ✓`, "That's all your sets. Close this and move on to the next exercise after your rest.");
    }
  };

  const technique = exercise ? techniqueFor(exercise.name, exercise.category) : null;

  return (
    <Modal visible={!!exercise} animationType="slide" onRequestClose={() => onClose(todaysSets.length)}>
      <KeyboardSafe>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{exercise?.name}</Text>
            {note ? <Text style={styles.note}>{note}</Text> : null}
          </View>
          <Pressable onPress={() => onClose(todaysSets.length)} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {/* GRIZZ 2026-10-13: the video first, then how to do it, and last time's
              weights and reps just above Log a set. */}
          {exercise?.external_url ? (
            <View style={{ marginBottom: 8 }}>
              <ExerciseVideoPreview url={exercise.external_url} />
            </View>
          ) : (
            exercise && <WatchOnlineLink name={exercise.name} />
          )}
          {exercise && <ExerciseGuideButton name={exercise.name} category={exercise.category} variant="bar" onDoSet={() => {}} />}
          <View style={{ height: 8 }} />
          {technique && (
            <View style={styles.box}>
              <Pressable onPress={() => setShowGuide((o) => !o)} hitSlop={6}>
                <Text style={styles.boxTitle}>📋 How to do it properly {showGuide ? "▲" : "▼"}</Text>
              </Pressable>
              {showGuide && (
                <View style={{ marginTop: 8 }}>
                  <ExerciseGuideContent technique={technique} />
                </View>
              )}
            </View>
          )}
          {target && (
            <Text style={styles.target}>
              Target: {target.setsLabel} sets x {target.reps} reps · rest {formatRest(target.restSeconds)}
            </Text>
          )}
          {suggestion && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>📈 {suggestion.last}</Text>
              <Text style={styles.boxText}>{suggestion.advice}</Text>
            </View>
          )}

          <Text style={styles.heading}>Log a set</Text>
          {!technique?.noWeightRule && <MuscleNotWeight />}
          <View style={styles.setRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Optional"
                placeholderTextColor="#64748B"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Reps</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder={target ? `e.g. ${target.reps.split("-")[0]}` : "e.g. 10"}
                placeholderTextColor="#64748B"
                value={reps}
                onChangeText={setReps}
              />
            </View>
          </View>
          <Text style={styles.label}>How did it feel?</Text>
          <View style={styles.effortRow}>
            {EFFORT_OPTIONS.map((o) => (
              <Pressable key={o.key} style={[styles.chip, effort === o.key && styles.chipOn]} onPress={() => setEffort(o.key)}>
                <Text style={[styles.chipText, effort === o.key && styles.chipTextOn]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.button} onPress={logSet} disabled={logging}>
            {logging ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Log set</Text>}
          </Pressable>

          {restRun > 0 && <RestTimer key={restRun} seconds={target?.restSeconds ?? 90} onClose={() => setRestRun(0)} />}

          {todaysSets.length > 0 && (
            <>
              <Text style={styles.heading}>Today's sets</Text>
              {todaysSets.map((s) => (
                <View key={s.id} style={styles.loggedRow}>
                  <Text style={styles.loggedText}>
                    Set {s.set_number}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
                    {s.reps} reps
                  </Text>
                  <Text style={styles.loggedEffort}>{EFFORT_LABEL[s.effort]}</Text>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 16 }} />
          <EveryRepTips />
        </ScrollView>
      </SafeAreaView>
      </KeyboardSafe>
      <AchievementBadge badge={badge} onClose={() => setBadge(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, gap: 10 },
  name: { color: "#fff", fontWeight: "700", fontSize: 17, flexShrink: 1 },
  note: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  close: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  target: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginBottom: 12 },
  box: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 12 },
  boxTitle: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  boxText: { color: "#CBD5E1", fontSize: 13, lineHeight: 19, marginTop: 4 },
  heading: { color: "#94A3B8", fontWeight: "600", marginTop: 8, marginBottom: 10 },
  setRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  label: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 15 },
  effortRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: { flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: "#334155", paddingVertical: 10, alignItems: "center" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 12.5 },
  chipTextOn: { color: "#0F172A" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 12 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  loggedRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  loggedText: { color: "#fff", fontSize: 14 },
  loggedEffort: { color: "#94A3B8", fontSize: 13 },
});
