import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { filterExercises } from "@/lib/exerciseFilter";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import {
  defaultSessionTitle,
  EXERCISE_COUNTS,
  formatRest,
  REST_OPTIONS,
  WEEKDAY_NAMES,
  weeklyDraftProblem,
  type DraftExercise,
  type DraftSession,
} from "@/lib/programs";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import type { Exercise } from "@/types/database";
import type { TrainerStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<TrainerStackParamList, "ProgramBuilder">;

const blankSlot = (): DraftExercise => ({ exerciseId: null, exerciseName: "", sets: 3, reps: "8-12", restSeconds: 120 });
const blankSession = (day: number): DraftSession => ({ day, title: "", exercises: Array.from({ length: 6 }, blankSlot) });
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Design a weekly program: tick the training days, then for each day pick 4,
// 6 or 8 exercises from the library (with a demo video to check) and tap in
// sets, reps and rest. A "how to do it" note covers technique and safety.
// The client works through the sessions in order (0037).
export default function ProgramBuilderScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [howTo, setHowTo] = useState("");
  // Monday, Wednesday and Friday to start with.
  const [sessions, setSessions] = useState<DraftSession[]>(() => [1, 3, 5].map(blankSession));
  const [activeDay, setActiveDay] = useState(1);
  const [picking, setPicking] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("exercises")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setLibrary(data ?? []));
  }, []);

  const session = sessions.find((s) => s.day === activeDay) ?? sessions[0];
  const sessionIndex = (day: number) => sessions.findIndex((s) => s.day === day);
  const titleFor = (s: DraftSession) => s.title.trim() || defaultSessionTitle(sessionIndex(s.day));

  const toggleDay = (day: number) => {
    if (sessions.some((s) => s.day === day)) {
      const next = sessions.filter((s) => s.day !== day);
      setSessions(next);
      if (activeDay === day && next.length > 0) setActiveDay(next[0].day);
      return;
    }
    setSessions([...sessions, blankSession(day)].sort((a, b) => a.day - b.day));
    setActiveDay(day);
  };

  const updateSession = (change: Partial<DraftSession>) =>
    setSessions((prev) => prev.map((s) => (s.day === session?.day ? { ...s, ...change } : s)));

  const setCount = (count: number) => {
    if (!session) return;
    const slots = session.exercises;
    updateSession({
      exercises: count <= slots.length ? slots.slice(0, count) : [...slots, ...Array.from({ length: count - slots.length }, blankSlot)],
    });
  };

  const update = (index: number, change: Partial<DraftExercise>) => {
    if (!session) return;
    updateSession({ exercises: session.exercises.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  };

  const closePicker = () => {
    setPicking(null);
    setPreviewId(null);
    setSearch("");
  };

  const filtered = filterExercises(library, search);

  const save = async () => {
    if (!trainer) return;
    const problem = weeklyDraftProblem(name, sessions);
    if (problem) {
      Alert.alert("Not quite ready", problem);
      return;
    }
    setSaving(true);
    const dayTitles = WEEKDAY_NAMES.map((_, i) => {
      const s = sessions.find((x) => x.day === i + 1);
      return s ? titleFor(s) : "";
    });
    const { data: program, error } = await supabase
      .from("programs")
      .insert({ trainer_id: trainer.id, name: name.trim(), kind: "weekly", description: howTo.trim() || null, day_titles: dayTitles })
      .select()
      .single();
    if (error || !program) {
      setSaving(false);
      Alert.alert("Couldn't save", error?.message ?? "Unknown error");
      return;
    }
    const { error: rowsError } = await supabase.from("program_exercises").insert(
      sessions.flatMap((s) =>
        s.exercises.map((e, i) => ({
          program_id: program.id,
          day_number: s.day,
          sort_order: i + 1,
          exercise_id: e.exerciseId,
          exercise_name: e.exerciseName,
          sets: e.sets,
          reps: e.reps.trim(),
          rest_seconds: e.restSeconds,
        }))
      )
    );
    if (rowsError) {
      // Don't leave an empty program behind.
      await supabase.from("programs").delete().eq("id", program.id);
      setSaving(false);
      Alert.alert("Couldn't save", rowsError.message);
      return;
    }
    setSaving(false);
    Alert.alert("Program saved", "Open a client and go to their Training tab to put them on it.");
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Text style={styles.label}>Program name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 3-day strength"
        placeholderTextColor="#64748B"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>How to do it (movement specifics and safety)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        placeholder="e.g. Control the lowering for 3 seconds. Brace your core before each rep. Stop if you feel sharp pain."
        placeholderTextColor="#64748B"
        value={howTo}
        onChangeText={setHowTo}
      />

      <Text style={styles.label}>Training days</Text>
      <View style={styles.chipRow}>
        {SHORT_DAYS.map((d, i) => {
          const on = sessions.some((s) => s.day === i + 1);
          return (
            <Pressable key={d} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleDay(i + 1)}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      {sessions.length > 0 && session && (
        <>
          <View style={styles.dayTabs}>
            {sessions.map((s) => (
              <Pressable key={s.day} style={[styles.dayTab, s.day === session.day && styles.dayTabOn]} onPress={() => setActiveDay(s.day)}>
                <Text style={[styles.dayTabText, s.day === session.day && styles.chipTextOn]}>{SHORT_DAYS[s.day - 1]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{WEEKDAY_NAMES[session.day - 1]} session name</Text>
          <TextInput
            style={styles.input}
            placeholder={defaultSessionTitle(sessionIndex(session.day))}
            placeholderTextColor="#64748B"
            value={session.title}
            onChangeText={(title) => updateSession({ title })}
          />

          <Text style={styles.label}>Number of exercises</Text>
          <View style={styles.chipRow}>
            {EXERCISE_COUNTS.map((n) => (
              <Pressable key={n} style={[styles.chip, session.exercises.length === n && styles.chipOn]} onPress={() => setCount(n)}>
                <Text style={[styles.chipText, session.exercises.length === n && styles.chipTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          {session.exercises.map((slot, i) => (
            <View key={`${session.day}-${i}`} style={styles.slot}>
              <Text style={styles.slotNumber}>Exercise {i + 1}</Text>
              <Pressable style={styles.picker} onPress={() => setPicking(i)}>
                <Text style={slot.exerciseName ? styles.pickerText : styles.pickerPlaceholder}>
                  {slot.exerciseName || "Tap to pick from the exercise videos"}
                </Text>
              </Pressable>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Sets</Text>
                  <View style={styles.stepperRow}>
                    <Pressable style={styles.stepper} onPress={() => update(i, { sets: Math.max(1, slot.sets - 1) })}>
                      <Text style={styles.stepperText}>-</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>{slot.sets}</Text>
                    <Pressable style={styles.stepper} onPress={() => update(i, { sets: Math.min(10, slot.sets + 1) })}>
                      <Text style={styles.stepperText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Reps</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 8-12"
                    placeholderTextColor="#64748B"
                    value={slot.reps}
                    onChangeText={(reps) => update(i, { reps })}
                  />
                </View>
              </View>

              <Text style={styles.label}>Rest between sets</Text>
              <View style={styles.chipRow}>
                {REST_OPTIONS.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.chip, slot.restSeconds === r && styles.chipOn]}
                    onPress={() => update(i, { restSeconds: r })}
                  >
                    <Text style={[styles.chipText, slot.restSeconds === r && styles.chipTextOn]}>{formatRest(r)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>Complete and save program</Text>}
      </Pressable>

      <Modal visible={picking !== null} animationType="slide" onRequestClose={closePicker}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick an exercise</Text>
            <Pressable onPress={closePicker}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, { marginHorizontal: 20, marginBottom: 10 }]}
            placeholder="Search, e.g. squat or Legs"
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.libraryRow}>
                <View style={styles.libraryTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerText}>{item.name}</Text>
                    {item.category && <Text style={styles.category}>{item.category}</Text>}
                  </View>
                  <Pressable hitSlop={6} onPress={() => setPreviewId((id) => (id === item.id ? null : item.id))}>
                    <Text style={styles.watch}>{previewId === item.id ? "Hide" : "▶ Watch"}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.useButton}
                    onPress={() => {
                      if (picking !== null) update(picking, { exerciseId: item.id, exerciseName: item.name });
                      closePicker();
                    }}
                  >
                    <Text style={styles.useText}>Use</Text>
                  </Pressable>
                </View>
                {previewId === item.id && <ExerciseVideoPreview url={item.external_url} />}
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  label: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  slot: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 14 },
  slotNumber: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13, marginBottom: 8 },
  picker: { backgroundColor: "#0F172A", borderRadius: 8, padding: 12 },
  pickerText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  pickerPlaceholder: { color: "#64748B", fontSize: 14 },
  row: { flexDirection: "row", gap: 12 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepper: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  stepperText: { color: BRAND_GOLD, fontSize: 18, fontWeight: "700" },
  stepperValue: { color: "#fff", fontSize: 16, fontWeight: "700", minWidth: 20, textAlign: "center" },
  saveButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  close: { color: BRAND_GOLD, fontWeight: "600", fontSize: 15 },
  libraryRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 8 },
  libraryTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  watch: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  useButton: { backgroundColor: BRAND_GOLD, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  useText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  dayTabs: { flexDirection: "row", gap: 6, marginTop: 16, flexWrap: "wrap" },
  dayTab: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  dayTabOn: { backgroundColor: BRAND_GOLD },
  dayTabText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  category: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
