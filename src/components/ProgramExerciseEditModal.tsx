import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { forPlace, swapGroup, type ExercisePlace } from "@/lib/exerciseFilter";
import { SWAP_LENGTHS, swapActive, swapUntil, swapUntilLabel, type SwapLength } from "@/lib/programSwaps";
import GymHomeTabs from "@/components/GymHomeTabs";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import KeyboardSafe from "@/components/KeyboardSafe";
import type { Exercise, ProgramExercise } from "@/types/database";

const AMBER = "#F59E0B";
const SETS = [1, 2, 3, 4, 5, 6];

// The trainer taps an exercise in a workout they built and changes it for
// every client on it (GRIZZ, 2026-10-21): just for now (this week, 2 or 4
// weeks, or until they put it back), or for good, with its sets and reps.
// A swap for now keeps the original, which comes back by itself (0139).
export default function ProgramExerciseEditModal({
  row,
  place: startPlace,
  onClose,
  onSaved,
}: {
  /** The row as clients do it today, with swapped_from while a stand-in is in. */
  row: ProgramExercise | null;
  place: ExercisePlace;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [exercise, setExercise] = useState<{ id: string; name: string } | null>(null);
  const [forGood, setForGood] = useState(false);
  const [length, setLength] = useState<SwapLength>("week");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState("");
  const [allParts, setAllParts] = useState(false);
  const [place, setPlace] = useState<ExercisePlace>(startPlace);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The row's own exercise, under any stand-in.
  const original = row ? { id: row.swapped_from?.exercise_id ?? row.exercise_id, name: row.swapped_from?.exercise_name ?? row.exercise_name } : null;
  const today = todayIso();
  const standIn = row && row.swapped_from && swapActive(row, today) ? row : null;

  useEffect(() => {
    if (!row) return;
    // While a stand-in is in, it's the one shown: save for now to change how
    // long it runs, or for good to keep it.
    setExercise(row.swapped_from && row.exercise_id ? { id: row.exercise_id, name: row.exercise_name } : null);
    setForGood(false);
    setLength("week");
    setSets(row.sets);
    setReps(row.reps);
    setChoosing(false);
    setSearch("");
    setAllParts(false);
    setPlace(startPlace);
    if (library.length === 0) {
      supabase
        .from("exercises")
        .select("*")
        .order("sort_order")
        .then(({ data }) => setLibrary(data ?? []));
    }
  }, [row?.id]);

  if (!row || !original) return null;

  const originalCategory = library.find((e) => e.id === original.id)?.category ?? null;
  const term = search.trim().toLowerCase();
  const options = forPlace(library, place).filter(
    (e) =>
      (allParts || term || !originalCategory || swapGroup(e.category) === swapGroup(originalCategory)) &&
      (!term || e.name.toLowerCase().includes(term) || (e.category ?? "").toLowerCase().includes(term)),
  );
  const newExercise = exercise && exercise.id !== original.id ? exercise : null;
  const setsChanged = sets !== row.sets || reps.trim() !== row.reps;
  // Sets and reps only change for good, so a swap for now needs a new exercise.
  const canSave = forGood ? !!newExercise || setsChanged : !!newExercise;

  const finish = (error: { message: string } | null, title: string) => {
    setSaving(false);
    if (error) Alert.alert(title, error.message);
    else onSaved();
  };

  const save = () => {
    if (forGood && !reps.trim()) {
      Alert.alert("Add the reps", "For example 10-12, or 30 sec.");
      return;
    }
    if (!forGood) {
      if (!newExercise) return;
      const until = swapUntil(length, today);
      Alert.alert(
        `${newExercise.name} for now?`,
        `Every client on this workout does ${newExercise.name} instead of ${original.name} ${swapUntilLabel(until)}. Then ${original.name} comes back by itself.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save for now",
            onPress: async () => {
              setSaving(true);
              const { error } = await supabase
                .from("program_exercises")
                .update({ swap_exercise_id: newExercise.id, swap_exercise_name: newExercise.name, swap_until: until })
                .eq("id", row.id);
              finish(error, "Couldn't save");
            },
          },
        ],
      );
      return;
    }
    const name = newExercise?.name ?? original.name;
    Alert.alert(
      "Change it for good?",
      `Every client on this workout does ${name}, ${sets} x ${reps.trim()}, from now on. Their past workouts stay as they were.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save for good",
          onPress: async () => {
            setSaving(true);
            const { error } = await supabase
              .from("program_exercises")
              .update({
                exercise_id: newExercise?.id ?? original.id,
                exercise_name: name,
                sets,
                reps: reps.trim(),
                swap_exercise_id: null,
                swap_exercise_name: null,
                swap_until: null,
              })
              .eq("id", row.id);
            finish(error, "Couldn't save");
          },
        },
      ],
    );
  };

  const putBack = () =>
    Alert.alert(`Put ${original.name} back now?`, `Every client on this workout does ${original.name} again from today.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Put back",
        onPress: async () => {
          setSaving(true);
          const { error } = await supabase
            .from("program_exercises")
            .update({ swap_exercise_id: null, swap_exercise_name: null, swap_until: null })
            .eq("id", row.id);
          finish(error, "Couldn't put it back");
        },
      },
    ]);

  return (
    <Modal visible animationType="slide" onRequestClose={choosing ? () => setChoosing(false) : onClose}>
      <KeyboardSafe>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{choosing ? "Pick an exercise" : "Change in your workout"}</Text>
            <Pressable onPress={choosing ? () => setChoosing(false) : onClose} hitSlop={8}>
              <Text style={styles.close}>{choosing ? "Back" : "Close"}</Text>
            </Pressable>
          </View>

          {choosing ? (
            <>
              <View style={{ marginHorizontal: 20 }}>
                <GymHomeTabs current={place} onChange={setPlace} accent={BRAND_GOLD} />
              </View>
              <TextInput
                style={[styles.input, { marginHorizontal: 20, marginBottom: 8 }]}
                placeholder="Search, e.g. press or Legs"
                placeholderTextColor="#64748B"
                value={search}
                onChangeText={setSearch}
              />
              {originalCategory && !term ? (
                <View style={[styles.chips, { marginHorizontal: 20, marginBottom: 8 }]}>
                  <Chip label={`Same body part (${originalCategory})`} on={!allParts} onPress={() => setAllParts(false)} />
                  <Chip label="All exercises" on={allParts} onPress={() => setAllParts(true)} />
                </View>
              ) : null}
              {library.length === 0 ? (
                <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={options}
                  keyExtractor={(e) => e.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                  ListEmptyComponent={<Text style={styles.helper}>No exercises match.</Text>}
                  renderItem={({ item }) => (
                    <View style={styles.libraryRow}>
                      <View style={styles.libraryTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.exerciseName}>{item.name}</Text>
                          {item.category ? <Text style={styles.helper}>{item.category}</Text> : null}
                        </View>
                        <Pressable hitSlop={6} onPress={() => setPreviewId((id) => (id === item.id ? null : item.id))}>
                          <Text style={styles.watch}>{previewId === item.id ? "Hide" : "▶ Watch"}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.useButton}
                          onPress={() => {
                            setExercise({ id: item.id, name: item.name });
                            setChoosing(false);
                          }}
                        >
                          <Text style={styles.useText}>Use</Text>
                        </Pressable>
                      </View>
                      {previewId === item.id && <ExerciseVideoPreview url={item.external_url} name={item.name} />}
                    </View>
                  )}
                />
              )}
            </>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.helper}>
                In your workout: {original.name}, {row.sets} x {row.reps}. Changes here are for every client on this workout.
              </Text>
              {standIn ? (
                <View style={styles.standIn}>
                  <Text style={styles.standInText}>
                    ⇄ For now: {standIn.exercise_name} instead of {original.name}, {swapUntilLabel(standIn.swap_until as string)}.
                  </Text>
                  <Pressable style={styles.putBackButton} onPress={putBack} disabled={saving}>
                    <Text style={styles.putBackText}>Put {original.name} back now</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.label}>Exercise</Text>
              <View style={styles.exerciseBox}>
                <Text style={styles.chosen}>{newExercise?.name ?? original.name}</Text>
                <Pressable style={styles.secondaryButton} onPress={() => setChoosing(true)}>
                  <Text style={styles.secondaryText}>Pick a different exercise</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>How long</Text>
              <View style={styles.chips}>
                <Chip label="Just for now" on={!forGood} onPress={() => setForGood(false)} />
                <Chip label="For good" on={forGood} onPress={() => setForGood(true)} />
              </View>

              {!forGood ? (
                <>
                  <View style={[styles.chips, { marginTop: 10 }]}>
                    {SWAP_LENGTHS.map((l) => (
                      <Chip key={l.key} label={l.label} on={length === l.key} onPress={() => setLength(l.key)} />
                    ))}
                  </View>
                  <Text style={styles.helper}>
                    {newExercise
                      ? `${newExercise.name} ${swapUntilLabel(swapUntil(length, today))}, then ${original.name} comes back by itself.`
                      : "Pick the exercise to use for now. Sets and reps stay the same; change those under For good."}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Sets</Text>
                  <View style={styles.chips}>
                    {SETS.map((n) => (
                      <Chip key={n} label={String(n)} on={sets === n} onPress={() => setSets(n)} />
                    ))}
                  </View>
                  <Text style={styles.label}>Reps</Text>
                  <TextInput
                    style={styles.input}
                    value={reps}
                    onChangeText={setReps}
                    placeholder="e.g. 10-12"
                    placeholderTextColor="#64748B"
                    maxLength={40}
                  />
                  <Text style={styles.helper}>
                    {standIn ? `Saving for good also ends the swap for now. ` : ""}
                    Past workouts stay as they were.
                  </Text>
                </>
              )}

              <Pressable style={[styles.saveButton, !canSave && styles.saveOff]} onPress={save} disabled={saving || !canSave}>
                {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>{forGood ? "Save for good" : "Save for now"}</Text>}
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardSafe>
    </Modal>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  close: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 6 },
  label: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 16 },
  exerciseBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, gap: 10 },
  chosen: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  secondaryText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14 },
  saveButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  saveOff: { opacity: 0.4 },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  standIn: { borderWidth: 1.5, borderColor: AMBER, borderRadius: 10, padding: 10, marginTop: 12, backgroundColor: "#111C33" },
  standInText: { color: "#FCD34D", fontSize: 14, fontWeight: "700" },
  putBackButton: { alignSelf: "flex-start", marginTop: 8, borderWidth: 1, borderColor: AMBER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  putBackText: { color: AMBER, fontWeight: "700", fontSize: 13 },
  libraryRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  libraryTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  exerciseName: { color: "#fff", fontWeight: "600", fontSize: 14 },
  watch: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  useButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  useText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
});
