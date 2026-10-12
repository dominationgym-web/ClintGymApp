import React, { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND_GOLD } from "@/lib/brand";
import { bodyPartLabel, filterExercises } from "@/lib/exerciseFilter";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import KeyboardSafe from "@/components/KeyboardSafe";
import type { Exercise } from "@/types/database";

// Change exercise (0047): pick another exercise for the same body part when
// the gym is busy. Used on the workout screen and on the client's calendar.
export default function ExerciseSwapModal({
  visible,
  exerciseName,
  category,
  choices,
  swapped,
  when = "just for today",
  onChoose,
  onClose,
}: {
  visible: boolean;
  exerciseName: string | null;
  category: string | null;
  /** Same-body-part exercises the client can use instead. */
  choices: Exercise[];
  /** A swap is already in place, so offer to go back. */
  swapped: boolean;
  when?: string;
  /** null goes back to the planned exercise. */
  onChoose: (exercise: Exercise | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setSearch("");
      setPreview(null);
    }
  }, [visible]);
  const shown = filterExercises(choices, search);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardSafe>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Change exercise</Text>
              <Text style={styles.category}>
                Gym busy? Swap {exerciseName} for another {bodyPartLabel(category)} exercise, {when}.
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            {swapped && (
              <Pressable style={styles.swapBack} onPress={() => onChoose(null)}>
                <Text style={styles.swapBackText}>↺ Back to {exerciseName}</Text>
              </Pressable>
            )}
            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              placeholderTextColor="#64748B"
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={shown}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            ListEmptyComponent={<Text style={styles.helper}>No other exercises for this body part.</Text>}
            renderItem={({ item }) => (
              <View style={styles.swapRow}>
                <View style={styles.swapRowTop}>
                  <Text style={[styles.name, { flex: 1 }]}>{item.name}</Text>
                  <Pressable hitSlop={6} onPress={() => setPreview((id) => (id === item.id ? null : item.id))}>
                    <Text style={styles.swapWatch}>{preview === item.id ? "Hide" : "▶ Watch"}</Text>
                  </Pressable>
                  <Pressable style={styles.swapUse} onPress={() => onChoose(item)}>
                    <Text style={styles.swapUseText}>Use this</Text>
                  </Pressable>
                </View>
                {preview === item.id && <ExerciseVideoPreview url={item.external_url} />}
              </View>
            )}
          />
        </SafeAreaView>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = StyleSheet.create({
  name: { color: "#fff", fontWeight: "600", flexShrink: 1 },
  category: { color: "#64748B", fontSize: 12, marginTop: 2 },
  helper: { color: "#94A3B8", fontSize: 13, marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: "#0F172A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20 },
  closeText: { color: "#22C55E", fontWeight: "600", fontSize: 15 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 15 },
  swapBack: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 10 },
  swapBackText: { color: BRAND_GOLD, fontWeight: "700" },
  swapRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  swapRowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  swapWatch: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  swapUse: { backgroundColor: "#22C55E", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  swapUseText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
});
