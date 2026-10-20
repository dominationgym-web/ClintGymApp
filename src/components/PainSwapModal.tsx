import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND_GOLD } from "@/lib/brand";
import { likelyPainArea, painAreaLabel, painSuggestions, PAIN_AREAS } from "@/lib/painSwap";
import type { StabilityArea } from "@/lib/stability";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import type { Exercise } from "@/types/database";

// "This hurts" (GRIZZ, 2026-10-20): the client says where an exercise hurts
// and gets the same movement at a kinder angle or grip to try, just for today
// (src/lib/painSwap.ts). Their coach is told either way.
export default function PainSwapModal({
  exercise,
  library,
  hurtIds,
  onPick,
  onClose,
}: {
  /** The exercise that hurts (as done today, so a swap that hurts too can be reported). */
  exercise: { exercise_id: string | null; exercise_name: string; category: string | null } | null;
  /** Exercises the client can do here (home or gym). */
  library: Exercise[];
  /** Exercises they already said hurt, never offered again. */
  hurtIds: (string | null)[];
  /** null leaves the exercise out today. */
  onPick: (area: StabilityArea, instead: Exercise | null) => void;
  onClose: () => void;
}) {
  const [area, setArea] = useState<StabilityArea | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (exercise) {
      setArea(likelyPainArea(exercise.exercise_name, exercise.category));
      setPreview(null);
    }
  }, [exercise]);

  const result =
    exercise && area
      ? painSuggestions({ id: exercise.exercise_id, name: exercise.exercise_name, category: exercise.category }, area, library, hurtIds)
      : null;

  return (
    <Modal visible={!!exercise} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>😣 {exercise?.exercise_name} hurts</Text>
            <Text style={styles.helper}>Tell us where, and try a kinder version instead. Your coach will see it.</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
          <Text style={styles.label}>Where does it hurt?</Text>
          <View style={styles.chips}>
            {PAIN_AREAS.map((a) => (
              <Pressable
                key={a}
                onPress={() => setArea(a)}
                style={[styles.chip, area === a && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: area === a }}
              >
                <Text style={[styles.chipText, area === a && styles.chipTextOn]}>{painAreaLabel(a)}</Text>
              </Pressable>
            ))}
          </View>

          {result && (
            <>
              <Text style={styles.label}>Try one of these instead</Text>
              {result.suggestions.length === 0 && (
                <Text style={styles.helper}>There's nothing else to try for this today. Leave it out and your coach will look at it.</Text>
              )}
              {result.suggestions.map(({ exercise: e, why }) => (
                <View key={e.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{e.name}</Text>
                      <Text style={styles.why}>{why}</Text>
                    </View>
                    <Pressable hitSlop={6} onPress={() => setPreview((id) => (id === e.id ? null : e.id))}>
                      <Text style={styles.watch}>{preview === e.id ? "Hide" : "▶ Watch"}</Text>
                    </Pressable>
                    <Pressable style={styles.use} onPress={() => onPick(area!, e)}>
                      <Text style={styles.useText}>Try this</Text>
                    </Pressable>
                  </View>
                  {preview === e.id && <ExerciseVideoPreview url={e.external_url} name={e.name} />}
                </View>
              ))}
              {result.suggestions.length > 0 && <Text style={styles.tip}>💡 {result.tip}</Text>}
              <Pressable style={styles.skip} onPress={() => onPick(area!, null)}>
                <Text style={styles.skipText}>Leave it out today</Text>
              </Pressable>
              <Text style={styles.small}>
                Sharp pain, pins and needles, or pain that stays after you stop: stop training today and tell your coach.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, gap: 12 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 4, marginBottom: 8 },
  close: { color: "#22C55E", fontWeight: "600", fontSize: 15 },
  label: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14, marginTop: 8, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { borderColor: BRAND_GOLD, backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700" },
  chipTextOn: { color: "#0F172A" },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: "#fff", fontWeight: "700" },
  why: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  watch: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  use: { backgroundColor: "#22C55E", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  useText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  tip: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  skip: { borderWidth: 1, borderColor: "#475569", borderRadius: 8, padding: 12, alignItems: "center", marginTop: 14 },
  skipText: { color: "#CBD5E1", fontWeight: "700" },
  small: { color: "#64748B", fontSize: 12, marginTop: 10 },
});
