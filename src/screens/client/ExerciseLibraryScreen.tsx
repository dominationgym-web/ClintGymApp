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
import {
  bodyPartLabel,
  clientBrowsable,
  exerciseCategories,
  filterExercises,
  forPlace,
  swapOptions,
  type ExercisePlace,
} from "@/lib/exerciseFilter";
import { getExerciseSwaps, saveExerciseSwaps, type ExerciseSwaps } from "@/lib/exerciseSwaps";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import GymHomeTabs from "@/components/GymHomeTabs";
import { todayIso } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { Exercise, ProgramExercise, SetEffort, WorkoutLog } from "@/types/database";
import RestTimer from "@/components/RestTimer";
import { loadClientProgram, type ActiveProgram } from "@/lib/programQueries";
import {
  dayTitle,
  DEFAULT_REST_SECONDS,
  displayProgramName,
  exercisesForDate,
  formatRest,
  needsWarmUp,
  supersetNext,
  nextUnfinished,
  warmUpReps,
} from "@/lib/programs";
import {
  currentSession,
  isDue,
  sessionAfterComplete,
  sessionMovedToTomorrow,
  sessionTitle,
  trainingDays,
  type ProgramSession,
} from "@/lib/programSchedule";
import { weekdayOf } from "@/lib/programSchedule";
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [place, setPlace] = useState<ExercisePlace>("gym");
  // Change exercise (0047): today's swaps, and the program line being swapped.
  const [swaps, setSwaps] = useState<ExerciseSwaps>({});
  const [swapping, setSwapping] = useState<ProgramExercise | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [swapPreview, setSwapPreview] = useState<string | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  // Keep the demo video (shown under the set log) compact so it fits on screen;
  // the client can tap to make it bigger.
  const compactVideoHeight = Math.min(screenHeight * 0.28, 240);

  useEffect(() => {
    const load = async () => {
      const [{ data, error }, active, { data: logged }, todaysSwaps] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        client ? loadClientProgram(client.id) : Promise.resolve(null),
        client
          ? supabase.from("workout_logs").select("*").eq("client_id", client.id).eq("log_date", todayIso())
          : Promise.resolve({ data: [] as WorkoutLog[] }),
        getExerciseSwaps(todayIso()),
      ]);
      setSwaps(todaysSwaps);
      if (!error && data) setExercises(data);
      setProgram(active);
      setAllTodaysSets(logged ?? []);
      setLoading(false);
    };
    load();
  }, [client?.id]);

  // Weekly programs are worked through in order (0037): the current session
  // shows from its day until it's completed or moved.
  const today = todayIso();
  const weekly = program?.program.kind === "weekly";
  const days = program && weekly ? trainingDays(program.exercises) : [];
  const session = program && weekly ? currentSession(program.assignment, days) : null;
  const sessionDue = session ? isDue(session, today) : false;
  const plannedWorkout = !program
    ? []
    : weekly
      ? session && sessionDue
        ? program.exercises.filter((e) => e.day_number === session.day).sort((a, b) => a.sort_order - b.sort_order)
        : []
      : exercisesForDate(program.program, program.exercises, new Date());
  // Today's workout with any swaps in place, so logging, ticking off and the
  // next-exercise prompt all follow the exercise the client actually does.
  const todaysWorkout = plannedWorkout.map((row) => {
    const swap = swaps[row.id];
    return swap ? { ...row, exercise_id: swap.id, exercise_name: swap.name } : row;
  });
  const plannedRow = (row: ProgramExercise) => plannedWorkout.find((r) => r.id === row.id) ?? row;
  const categoryOf = (row: ProgramExercise) =>
    exercises.find((e) => e.id === row.exercise_id)?.category ??
    exercises.find((e) => e.name === row.exercise_name)?.category ??
    null;
  const programExerciseIds = program ? program.exercises.map((e) => e.exercise_id) : [];
  // Without full library access the database also lets a client see other
  // exercises for their program's body parts (for Change exercise, 0047), but
  // the reference list still only shows their program's.
  const browsable =
    client?.library_access === false
      ? exercises.filter((e) => programExerciseIds.includes(e.id))
      : clientBrowsable(exercises, programExerciseIds);
  const shown = forPlace(browsable, place);
  const choosePlace = (next: ExercisePlace) => {
    setPlace(next);
    setCategory(null);
  };
  // The open exercise is the first half of a superset: no rest timer after it.
  const targetNext = target ? supersetNext(target, todaysWorkout) : null;
  const [savingProgress, setSavingProgress] = useState(false);

  const openSwap = (row: ProgramExercise) => {
    setSwapping(plannedRow(row));
    setSwapSearch("");
    setSwapPreview(null);
  };

  const chooseSwap = (exercise: Exercise | null) => {
    if (!swapping) return;
    const next = { ...swaps };
    if (exercise) next[swapping.id] = { id: exercise.id, name: exercise.name };
    else delete next[swapping.id];
    setSwaps(next);
    saveExerciseSwaps(todayIso(), next);
    setSwapping(null);
  };

  const swapCategory = swapping ? categoryOf(swapping) : null;
  const swapChoices = swapping
    ? filterExercises(swapOptions(exercises, swapCategory, [swapping.exercise_id, swaps[swapping.id]?.id ?? null]), swapSearch)
    : [];

  const saveProgress = async (next: ProgramSession, completed: boolean) => {
    if (!program) return;
    setSavingProgress(true);
    const { error } = await supabase.rpc("set_my_program_progress", {
      p_current_day: next.day,
      p_due_on: next.dueOn,
      p_completed: completed,
    });
    setSavingProgress(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    setProgram({ ...program, assignment: { ...program.assignment, current_day: next.day, due_on: next.dueOn } });
  };

  const completeSession = () => {
    if (!program || !session) return;
    const title = sessionTitle(program.program, session.day);
    Alert.alert(`Finished ${title}?`, "Your next workout unlocks on your next training day.", [
      { text: "Not yet", style: "cancel" },
      { text: "Complete", onPress: () => saveProgress(sessionAfterComplete(session, days, today), true) },
    ]);
  };

  const moveSession = () => {
    if (!session) return;
    Alert.alert("Move this workout to tomorrow?", "It stays your next workout until you complete it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Move it", onPress: () => saveProgress(sessionMovedToTomorrow(session, today), false) },
    ]);
  };
  const categoryById = new Map(exercises.map((e) => [e.id, e.category]));
  const categoriesLoggedToday = allTodaysSets.map((s) => (s.exercise_id ? categoryById.get(s.exercise_id) ?? null : null));
  const setsDoneFor = (row: ProgramExercise) =>
    allTodaysSets.filter((s) => (row.exercise_id ? s.exercise_id === row.exercise_id : s.exercise_name === row.exercise_name))
      .length;

  const openProgramExercise = (row: ProgramExercise) => {
    // Fall back to a name-only entry if the exercise was taken out of the library.
    const exercise = exercises.find((e) => e.id === row.exercise_id) ??
      exercises.find((e) => e.name === row.exercise_name) ?? {
      id: "",
      name: row.exercise_name,
      category: null,
      source: "own_library" as const,
      external_url: null,
      sort_order: 0,
      home_friendly: false,
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
    // Last set of a program exercise: offer to go straight to the next one.
    if (target && todaysSets.length + 1 >= target.sets) {
      const done = (row: ProgramExercise) => (row.id === target.id ? target.sets : setsDoneFor(row));
      const next = nextUnfinished(target, todaysWorkout, done);
      if (next) {
        Alert.alert(`${target.exercise_name} done ✓`, `Ready to move on to ${next.exercise_name}?`, [
          { text: "Not yet", style: "cancel" },
          { text: "Next exercise", onPress: () => openProgramExercise(next) },
        ]);
      } else {
        const finish = session && sessionDue ? " Tap Complete workout to unlock your next session." : " Great work.";
        Alert.alert("Workout done 💪", `That's every exercise.${finish}`, [{ text: "OK", onPress: () => setSelected(null) }]);
      }
    }
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
        data={filterExercises(shown, search, category)}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <>
            {program && (
              <View style={styles.programCard}>
                <Text style={styles.programKicker}>{displayProgramName(program.program).toUpperCase()}</Text>
                <Text style={styles.programTitle}>
                  {session ? (sessionDue ? sessionTitle(program.program, session.day) : "Rest day") : dayTitle(program.program, new Date())}
                </Text>
                {session && sessionDue && session.dueOn < today && (
                  <Text style={styles.carried}>Carried over from {weekdayOf(session.dueOn)}. Complete it to unlock your next workout.</Text>
                )}
                {program.program.description ? (
                  <View style={styles.howTo}>
                    <Text style={styles.howToTitle}>How to do it</Text>
                    <Text style={styles.howToText}>{program.program.description}</Text>
                  </View>
                ) : null}
                {todaysWorkout.length === 0 ? (
                  <Text style={styles.helper}>
                    Rest day. Recover well, you've earned it.
                    {session && !sessionDue
                      ? ` Next up: ${sessionTitle(program.program, session.day)} on ${weekdayOf(session.dueOn)}.`
                      : ""}
                  </Text>
                ) : (
                  todaysWorkout.map((row) => {
                    const done = setsDoneFor(row);
                    const next = supersetNext(row, todaysWorkout);
                    return (
                      <Pressable key={row.id} style={styles.programRow} onPress={() => openProgramExercise(row)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{row.exercise_name}</Text>
                          <Text style={styles.category}>
                            {row.sets} sets x {row.reps} ·{" "}
                            {next ? `superset: straight into ${next.exercise_name}` : `rest ${formatRest(row.rest_seconds)}`}
                          </Text>
                          {swaps[row.id] && <Text style={styles.swappedText}>Swapped from {plannedRow(row).exercise_name}</Text>}
                          <Pressable onPress={() => openSwap(row)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                            <Text style={styles.changeLink}>⇄ Change exercise</Text>
                          </Pressable>
                        </View>
                        <Text style={[styles.setsDone, done >= row.sets && { color: "#22C55E" }]}>
                          {done >= row.sets ? "Done ✓" : `${done}/${row.sets}`}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
                {session && sessionDue && (
                  <View style={styles.sessionButtons}>
                    <Pressable style={styles.completeButton} onPress={completeSession} disabled={savingProgress}>
                      <Text style={styles.completeText}>Complete workout</Text>
                    </Pressable>
                    <Pressable style={styles.moveButton} onPress={moveSession} disabled={savingProgress}>
                      <Text style={styles.moveText}>Move to tomorrow</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
            <Text style={styles.title}>Exercise reference</Text>
            {client?.library_access === false ? (
              <Text style={styles.helper}>
                These are the exercises in your program. Ask your coach if you'd like the full exercise library.
              </Text>
            ) : (
              <>
                <GymHomeTabs current={place} onChange={choosePlace} accent="#22C55E" />
                <TextInput
                  style={[styles.input, { marginBottom: 10 }]}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={`Search ${shown.length} exercises`}
                  placeholderTextColor="#64748B"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {[null, ...exerciseCategories(shown)].map((c) => (
                    <Pressable
                      key={c ?? "all"}
                      style={[styles.effortChip, styles.categoryChip, category === c && styles.effortChipSelected]}
                      onPress={() => setCategory(c)}
                    >
                      <Text style={[styles.effortChipText, category === c && styles.effortChipTextSelected]}>{c ?? "All"}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.helper}>
            {client?.library_access === false ? "Your coach hasn't set up your program yet." : "No exercises match that search."}
          </Text>
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

      <Modal visible={!!swapping} animationType="slide" onRequestClose={() => setSwapping(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Change exercise</Text>
              <Text style={styles.category}>
                Gym busy? Swap {swapping?.exercise_name} for another {bodyPartLabel(swapCategory)} exercise, just for today.
              </Text>
            </View>
            <Pressable onPress={() => setSwapping(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            {swapping && swaps[swapping.id] && (
              <Pressable style={styles.swapBack} onPress={() => chooseSwap(null)}>
                <Text style={styles.swapBackText}>↺ Back to {swapping.exercise_name}</Text>
              </Pressable>
            )}
            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              value={swapSearch}
              onChangeText={setSwapSearch}
              placeholder="Search"
              placeholderTextColor="#64748B"
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={swapChoices}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            ListEmptyComponent={<Text style={styles.helper}>No other exercises for this body part.</Text>}
            renderItem={({ item }) => (
              <View style={styles.swapRow}>
                <View style={styles.swapRowTop}>
                  <Text style={[styles.name, { flex: 1 }]}>{item.name}</Text>
                  <Pressable hitSlop={6} onPress={() => setSwapPreview((id) => (id === item.id ? null : item.id))}>
                    <Text style={styles.swapWatch}>{swapPreview === item.id ? "Hide" : "▶ Watch"}</Text>
                  </Pressable>
                  <Pressable style={styles.swapUse} onPress={() => chooseSwap(item)}>
                    <Text style={styles.swapUseText}>Use this</Text>
                  </Pressable>
                </View>
                {swapPreview === item.id && <ExerciseVideoPreview url={item.external_url} />}
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

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
                Target: {target.sets} sets x {target.reps} reps ·{" "}
                {targetNext ? `superset: straight into ${targetNext.exercise_name}` : `rest ${formatRest(target.rest_seconds)}`}
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

            {restRun > 0 && targetNext && (
              <View style={styles.warmUpBox}>
                <Text style={styles.warmUpTitle}>Superset: no rest</Text>
                <Text style={styles.warmUpText}>Go straight into {targetNext.exercise_name}, then rest.</Text>
              </View>
            )}
            {restRun > 0 && !targetNext && (
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
  categoryChip: { flex: 0, paddingHorizontal: 14, marginRight: 8 },
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
  swappedText: { color: BRAND_GOLD, fontSize: 12, marginTop: 2 },
  changeLink: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 6 },
  swapBack: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 10 },
  swapBackText: { color: BRAND_GOLD, fontWeight: "700" },
  swapRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  swapRowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  swapWatch: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  swapUse: { backgroundColor: "#22C55E", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  swapUseText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
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
  carried: { color: "#FBBF24", fontSize: 13, marginBottom: 8 },
  howTo: { backgroundColor: "#0F172A", borderRadius: 8, padding: 10, marginBottom: 10 },
  howToTitle: { color: BRAND_GOLD, fontWeight: "700", fontSize: 12, marginBottom: 4 },
  howToText: { color: "#E2E8F0", fontSize: 13 },
  sessionButtons: { flexDirection: "row", gap: 8, marginTop: 10 },
  completeButton: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  completeText: { color: "#0F172A", fontWeight: "800" },
  moveButton: { flex: 1, borderWidth: 1, borderColor: "#475569", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  moveText: { color: "#E2E8F0", fontWeight: "600" },
  setsDone: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  targetText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginBottom: 12 },
  warmUpBox: { backgroundColor: "#2A2114", borderColor: "#F59E0B", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  warmUpTitle: { color: "#FBBF24", fontWeight: "700", fontSize: 14 },
  warmUpText: { color: "#E2E8F0", fontSize: 13, marginTop: 4 },
});
