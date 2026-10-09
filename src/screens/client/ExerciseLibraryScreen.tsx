import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { Exercise, ProgramExercise, SetEffort, WorkoutLog } from "@/types/database";
import RestTimer from "@/components/RestTimer";
import { loadClientProgram, type ActiveProgram } from "@/lib/programQueries";
import { dayTitle, DEFAULT_REST_SECONDS, exercisesForDate, formatRest, needsWarmUp, warmUpReps } from "@/lib/programs";
import { BRAND_GOLD } from "@/lib/brand";

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

export default function ExerciseLibraryScreen() {
  const { client } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [todaysSets, setTodaysSets] = useState<WorkoutLog[]>([]);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [effort, setEffort] = useState<SetEffort | null>(null);
  const [logging, setLogging] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [program, setProgram] = useState<ActiveProgram | null>(null);
  // Every set logged today, to tick off the program and spot warm-ups.
  const [allTodaysSets, setAllTodaysSets] = useState<WorkoutLog[]>([]);
  // The program line for the exercise that's open, if it came from the program.
  const [target, setTarget] = useState<ProgramExercise | null>(null);
  // Bumped after each logged set to (re)start the rest timer.
  const [restRun, setRestRun] = useState(0);
  const { height: screenHeight } = useWindowDimensions();
  // Keep the demo video (shown under the set log) compact so it fits on screen;
  // the client can tap to make it bigger.
  const compactVideoHeight = Math.min(screenHeight * 0.28, 240);

  useEffect(() => {
    const load = async () => {
      const [{ data, error }, active, { data: logged }] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        client ? loadClientProgram(client.id) : Promise.resolve(null),
        client
          ? supabase.from("workout_logs").select("*").eq("client_id", client.id).eq("log_date", todayIso())
          : Promise.resolve({ data: [] as WorkoutLog[] }),
      ]);
      if (!error && data) setExercises(data);
      setProgram(active);
      setAllTodaysSets(logged ?? []);
      setLoading(false);
    };
    load();
  }, [client?.id]);

  const todaysWorkout = program ? exercisesForDate(program.program, program.exercises, new Date()) : [];
  const categoryById = new Map(exercises.map((e) => [e.id, e.category]));
  const categoriesLoggedToday = allTodaysSets.map((s) => (s.exercise_id ? categoryById.get(s.exercise_id) ?? null : null));
  const setsDoneFor = (row: ProgramExercise) =>
    allTodaysSets.filter((s) => (row.exercise_id ? s.exercise_id === row.exercise_id : s.exercise_name === row.exercise_name))
      .length;

  const openProgramExercise = (row: ProgramExercise) => {
    // Fall back to a name-only entry if the exercise was taken out of the library.
    const exercise = exercises.find((e) => e.id === row.exercise_id) ?? {
      id: "",
      name: row.exercise_name,
      category: null,
      source: "own_library" as const,
      external_url: null,
      sort_order: 0,
    };
    openExercise(exercise, row);
  };

  const player = useVideoPlayer(selected?.external_url ?? null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (selected) player.play();
    return () => {
      // useVideoPlayer recreates/releases the native player whenever the
      // source changes or this screen unmounts, which can race with this
      // cleanup - pausing an already-released player throws, but there's
      // nothing to pause in that case anyway, so it's safe to ignore.
      try {
        player.pause();
      } catch {
        // Already released - nothing to do.
      }
    };
  }, [selected, player]);

  const openExercise = async (exercise: Exercise, programRow: ProgramExercise | null = null) => {
    setSelected(exercise);
    setTarget(programRow);
    setRestRun(0);
    setVideoExpanded(false);
    setWeight("");
    setReps("");
    setEffort(null);
    if (!client) return;
    const query = supabase.from("workout_logs").select("*").eq("client_id", client.id).eq("log_date", todayIso());
    const { data } = await (exercise.id ? query.eq("exercise_id", exercise.id) : query.eq("exercise_name", exercise.name))
      .order("set_number", { ascending: true });
    setTodaysSets(data ?? []);
  };

  const logSet = async () => {
    if (!client || !selected) return;
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
        exercise_id: selected.id || null,
        exercise_name: selected.name,
        log_date: todayIso(),
        set_number: todaysSets.length + 1,
        weight_kg: weight ? Number(weight) : null,
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
    setTodaysSets((prev) => [...prev, data]);
    setAllTodaysSets((prev) => [...prev, data]);
    setRestRun((n) => n + 1);
    setWeight("");
    setReps("");
    setEffort(null);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={exercises}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <>
            {program && (
              <View style={styles.programCard}>
                <Text style={styles.programKicker}>{program.program.name.toUpperCase()}</Text>
                <Text style={styles.programTitle}>{dayTitle(program.program, new Date())}</Text>
                {todaysWorkout.length === 0 ? (
                  <Text style={styles.helper}>Rest day. Recover well, you've earned it.</Text>
                ) : (
                  todaysWorkout.map((row) => {
                    const done = setsDoneFor(row);
                    return (
                      <Pressable key={row.id} style={styles.programRow} onPress={() => openProgramExercise(row)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{row.exercise_name}</Text>
                          <Text style={styles.category}>
                            {row.sets} sets x {row.reps} · rest {formatRest(row.rest_seconds)}
                          </Text>
                        </View>
                        <Text style={[styles.setsDone, done >= row.sets && { color: "#22C55E" }]}>
                          {done >= row.sets ? "Done ✓" : `${done}/${row.sets}`}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
            <Text style={styles.title}>Exercise reference</Text>
          </>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openExercise(item)}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              {item.category && <Text style={styles.category}>{item.category}</Text>}
            </View>
            <Text style={styles.link}>{"Log a set >"}</Text>
          </Pressable>
        )}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.name}>{selected?.name}</Text>
              {selected?.category && <Text style={styles.category}>{selected.category}</Text>}
            </View>
            <Pressable onPress={() => setSelected(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {target && (
              <Text style={styles.targetText}>
                Target: {target.sets} sets x {target.reps} reps · rest {formatRest(target.rest_seconds)}
              </Text>
            )}
            {todaysSets.length === 0 &&
              needsWarmUp(selected?.category ?? null, categoriesLoggedToday) &&
              (() => {
                const warmUp = target ? warmUpReps(target.reps) : null;
                return (
                  <View style={styles.warmUpBox}>
                    <Text style={styles.warmUpTitle}>Warm-up set first</Text>
                    <Text style={styles.warmUpText}>
                      First {selected?.category?.toLowerCase()} exercise today: do 1 set with a lighter weight for
                      double the reps{warmUp ? ` (${warmUp})` : ""}. Then start your working sets.
                    </Text>
                  </View>
                );
              })()}
            <Text style={[styles.sectionHeading, { marginTop: 0 }]}>Log a set</Text>
            <View style={styles.setRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Weight (kg)</Text>
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
                <Text style={styles.fieldLabel}>Reps</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="e.g. 8"
                  placeholderTextColor="#64748B"
                  value={reps}
                  onChangeText={setReps}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>How did it feel?</Text>
            <View style={styles.effortRow}>
              {EFFORT_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  style={[styles.effortChip, effort === o.key && styles.effortChipSelected]}
                  onPress={() => setEffort(o.key)}
                >
                  <Text style={[styles.effortChipText, effort === o.key && styles.effortChipTextSelected]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.button} onPress={logSet} disabled={logging}>
              {logging ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Log set</Text>}
            </Pressable>

            {restRun > 0 && (
              <RestTimer
                key={restRun}
                seconds={target?.rest_seconds || DEFAULT_REST_SECONDS}
                onClose={() => setRestRun(0)}
              />
            )}

            {todaysSets.length > 0 && (
              <>
                <Text style={styles.sectionHeading}>Today's sets</Text>
                {todaysSets.map((s) => (
                  <View key={s.id} style={styles.loggedSetRow}>
                    <Text style={styles.loggedSetText}>
                      Set {s.set_number}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
                      {s.reps} reps
                    </Text>
                    <Text style={styles.loggedSetEffort}>{EFFORT_LABEL[s.effort]}</Text>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionHeading}>Demo video</Text>
            {selected?.external_url ? (
              <>
                <VideoView
                  style={[styles.video, videoExpanded ? styles.videoExpanded : { height: compactVideoHeight }]}
                  player={player}
                  contentFit="contain"
                  nativeControls
                />
                <Pressable onPress={() => setVideoExpanded((v) => !v)} hitSlop={8}>
                  <Text style={styles.expandText}>{videoExpanded ? "Make video smaller" : "Make video bigger"}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.helper}>No demo video yet - ask your trainer.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  name: { color: "#fff", fontWeight: "600" },
  category: { color: "#64748B", fontSize: 12, marginTop: 2 },
  link: { color: "#22C55E", fontSize: 13 },
  helper: { color: "#94A3B8", fontSize: 13, marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: "#0F172A" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
  },
  closeText: { color: "#22C55E", fontWeight: "600", fontSize: 15 },
  video: { width: "100%", backgroundColor: "#000", borderRadius: 10, marginBottom: 8 },
  videoExpanded: { aspectRatio: 9 / 16 },
  expandText: { color: "#22C55E", fontSize: 13, fontWeight: "600", textAlign: "center" },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 20, marginBottom: 10 },
  setRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  fieldLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 15 },
  effortRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  effortChip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  effortChipSelected: { backgroundColor: "#22C55E" },
  effortChipText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  effortChipTextSelected: { color: "#0F172A" },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  loggedSetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  loggedSetText: { color: "#fff", fontSize: 14 },
  loggedSetEffort: { color: "#64748B", fontSize: 12 },
  programCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
  },
  programKicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  programTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2, marginBottom: 10 },
  programRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  setsDone: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  targetText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginBottom: 12 },
  warmUpBox: { backgroundColor: "#2A2114", borderColor: "#F59E0B", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  warmUpTitle: { color: "#FBBF24", fontWeight: "700", fontSize: 14 },
  warmUpText: { color: "#E2E8F0", fontSize: 13, marginTop: 4 },
});
