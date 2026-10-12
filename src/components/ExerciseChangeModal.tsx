import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { changesFor, planChangeWrites } from "@/lib/exerciseChanges";
import { forPlace, swapGroup, type ExercisePlace } from "@/lib/exerciseFilter";
import { loadExerciseChanges, saveExerciseChanges } from "@/lib/programQueries";
import GymHomeTabs from "@/components/GymHomeTabs";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import type { ClientExerciseChange, Exercise, ProgramExercise } from "@/types/database";
import KeyboardSafe from "@/components/KeyboardSafe";

const SETS = [1, 2, 3, 4, 5, 6];

// The trainer taps an exercise in a client's program or calendar workout and
// changes it for that client only (0070): another exercise, other sets or
// reps. The preset program stays as it is for everyone else.
export default function ExerciseChangeModal({
  row,
  clientId,
  clientName,
  trainingPlace,
  onClose,
  onSaved,
}: {
  /** The row as the client sees it, with changed_from when already changed. */
  row: ProgramExercise | null;
  clientId: string;
  clientName: string;
  trainingPlace: ExercisePlace;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [changes, setChanges] = useState<ClientExerciseChange[]>([]);
  const [exercise, setExercise] = useState<{ id: string; name: string } | null>(null);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState("");
  const [everywhere, setEverywhere] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState("");
  const [allParts, setAllParts] = useState(false);
  const [place, setPlace] = useState<ExercisePlace>(trainingPlace);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // What the workout itself says for this row.
  const original = row ? { id: row.id, ...(row.changed_from ?? row) } : null;

  useEffect(() => {
    if (!row) return;
    setExercise(row.exercise_id ? { id: row.exercise_id, name: row.exercise_name } : null);
    setSets(row.sets);
    setReps(row.reps);
    setChoosing(false);
    setSearch("");
    setAllParts(false);
    setPlace(trainingPlace);
    loadExerciseChanges(clientId).then((list) => {
      setChanges(list);
      const { own } = changesFor({ id: row.id, exercise_id: row.changed_from?.exercise_id ?? row.exercise_id }, list);
      // A swap made for just this workout reopens as "just this workout".
      setEverywhere(!own?.exercise_id);
    });
    if (library.length === 0) {
      supabase
        .from("exercises")
        .select("*")
        .order("sort_order")
        .then(({ data }) => setLibrary(data ?? []));
    }
  }, [row?.id, clientId]);

  if (!row || !original) return null;

  const originalCategory = library.find((e) => e.id === original.exercise_id)?.category ?? null;
  const term = search.trim().toLowerCase();
  const options = forPlace(library, place).filter(
    (e) =>
      (allParts || term || !originalCategory || swapGroup(e.category) === swapGroup(originalCategory)) &&
      (!term || e.name.toLowerCase().includes(term) || (e.category ?? "").toLowerCase().includes(term)),
  );
  const { own, everywhere: everyChange } = changesFor({ id: row.id, exercise_id: original.exercise_id }, changes);
  const isChanged = !!own || !!everyChange;
  const swapped = exercise && exercise.id !== original.exercise_id;

  const save = async () => {
    if (!exercise) return;
    if (!reps.trim()) {
      Alert.alert("Add the reps", "For example 10-12, or 30 sec.");
      return;
    }
    setSaving(true);
    const error = await saveExerciseChanges(
      planChangeWrites(clientId, { ...original, exercise_id: original.exercise_id }, changes, {
        exercise,
        sets,
        reps,
        everywhere,
      }),
    );
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error);
      return;
    }
    onSaved();
  };

  const putBack = () => {
    const ids = [own?.id, everyChange?.id].filter((id): id is string => !!id);
    Alert.alert(
      `Put back ${original.exercise_name}?`,
      everyChange
        ? `${original.exercise_name} comes back in every workout for ${clientName}, as ${original.sets} x ${original.reps}.`
        : `This workout goes back to ${original.exercise_name}, ${original.sets} x ${original.reps}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Put back",
          onPress: async () => {
            setSaving(true);
            const error = await saveExerciseChanges({ upserts: [], removes: ids });
            setSaving(false);
            if (error) Alert.alert("Couldn't put it back", error);
            else onSaved();
          },
        },
      ],
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={choosing ? () => setChoosing(false) : onClose}>
      <KeyboardSafe>
      <SafeAreaView style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>{choosing ? "Pick an exercise" : `Change for ${clientName}`}</Text>
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
                    {previewId === item.id && <ExerciseVideoPreview url={item.external_url} />}
                  </View>
                )}
              />
            )}
          </>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.helper}>
              In the workout: {original.exercise_name}, {original.sets} x {original.reps}
            </Text>

            <Text style={styles.label}>Exercise</Text>
            <View style={styles.exerciseBox}>
              <Text style={styles.chosen}>{exercise?.name ?? original.exercise_name}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => setChoosing(true)}>
                <Text style={styles.secondaryText}>Change exercise</Text>
              </Pressable>
            </View>

            {swapped && original.exercise_id ? (
              <>
                <Text style={styles.label}>Where</Text>
                <View style={styles.chips}>
                  <Chip label="Every workout" on={everywhere} onPress={() => setEverywhere(true)} />
                  <Chip label="Just this workout" on={!everywhere} onPress={() => setEverywhere(false)} />
                </View>
                <Text style={styles.helper}>
                  {everywhere
                    ? `${clientName} gets ${exercise?.name} instead of ${original.exercise_name} in every program and calendar workout from now on.`
                    : `Only this workout changes. ${original.exercise_name} stays in ${clientName}'s other workouts.`}
                </Text>
              </>
            ) : null}

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
            <Text style={styles.helper}>Sets and reps change in this workout only.</Text>

            <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>Save for {clientName}</Text>}
            </Pressable>
            {isChanged ? (
              <Pressable style={styles.putBack} onPress={putBack} disabled={saving}>
                <Text style={styles.putBackText}>Put back the original</Text>
              </Pressable>
            ) : null}
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
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  putBack: { alignItems: "center", paddingVertical: 14 },
  putBackText: { color: "#F87171", fontWeight: "700", fontSize: 14 },
  libraryRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  libraryTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  exerciseName: { color: "#fff", fontWeight: "600", fontSize: 14 },
  watch: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  useButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  useText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
});
