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
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { draftProblem, EXERCISE_COUNTS, formatRest, REST_OPTIONS, type DraftExercise } from "@/lib/programs";
import type { Exercise } from "@/types/database";
import type { TrainerStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<TrainerStackParamList, "ProgramBuilder">;

const blankSlot = (): DraftExercise => ({ exerciseId: null, exerciseName: "", sets: 3, reps: "8-12", restSeconds: 120 });

// Build a one-session program: pick 4, 6 or 8 exercises, then sets, reps and
// rest for each. It's saved as the trainer's own program (0035).
export default function ProgramBuilderScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<DraftExercise[]>(() => Array.from({ length: 6 }, blankSlot));
  const [picking, setPicking] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("exercises")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setLibrary(data ?? []));
  }, []);

  const setCount = (count: number) =>
    setSlots((prev) => (count <= prev.length ? prev.slice(0, count) : [...prev, ...Array.from({ length: count - prev.length }, blankSlot)]));

  const update = (index: number, change: Partial<DraftExercise>) =>
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...change } : s)));

  const save = async () => {
    if (!trainer) return;
    const problem = draftProblem(name, slots);
    if (problem) {
      Alert.alert("Not quite ready", problem);
      return;
    }
    setSaving(true);
    const { data: program, error } = await supabase
      .from("programs")
      .insert({ trainer_id: trainer.id, name: name.trim(), kind: "custom" })
      .select()
      .single();
    if (error || !program) {
      setSaving(false);
      Alert.alert("Couldn't save", error?.message ?? "Unknown error");
      return;
    }
    const { error: rowsError } = await supabase.from("program_exercises").insert(
      slots.map((s, i) => ({
        program_id: program.id,
        day_number: 1,
        sort_order: i + 1,
        exercise_id: s.exerciseId,
        exercise_name: s.exerciseName,
        sets: s.sets,
        reps: s.reps.trim(),
        rest_seconds: s.restSeconds,
      }))
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
        placeholder="e.g. Push day"
        placeholderTextColor="#64748B"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Number of exercises</Text>
      <View style={styles.chipRow}>
        {EXERCISE_COUNTS.map((n) => (
          <Pressable key={n} style={[styles.chip, slots.length === n && styles.chipOn]} onPress={() => setCount(n)}>
            <Text style={[styles.chipText, slots.length === n && styles.chipTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>

      {slots.map((slot, i) => (
        <View key={i} style={styles.slot}>
          <Text style={styles.slotNumber}>Exercise {i + 1}</Text>
          <Pressable style={styles.picker} onPress={() => setPicking(i)}>
            <Text style={slot.exerciseName ? styles.pickerText : styles.pickerPlaceholder}>
              {slot.exerciseName || "Tap to pick an exercise"}
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

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>Save program</Text>}
      </Pressable>

      <Modal visible={picking !== null} animationType="slide" onRequestClose={() => setPicking(null)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick an exercise</Text>
            <Pressable onPress={() => setPicking(null)}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={library}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.libraryRow}
                onPress={() => {
                  if (picking !== null) update(picking, { exerciseId: item.id, exerciseName: item.name });
                  setPicking(null);
                }}
              >
                <Text style={styles.pickerText}>{item.name}</Text>
                {item.category && <Text style={styles.category}>{item.category}</Text>}
              </Pressable>
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
  category: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
