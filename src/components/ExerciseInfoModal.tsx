import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { techniqueFor } from "@/lib/exerciseTechnique";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import { ExerciseGuideContent, WatchOnlineLink } from "@/components/ExerciseGuide";
import type { Exercise } from "@/types/database";

// An exercise's demo video and How to do it, for the trainer checking a
// program (GRIZZ, 2026-10-14). Looks the exercise up when it opens.
export default function ExerciseInfoModal({
  exercise,
  onClose,
}: {
  exercise: { exercise_id: string | null; exercise_name: string } | null;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<Pick<Exercise, "external_url" | "category"> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!exercise) return;
    let live = true;
    setInfo(null);
    setLoading(true);
    const query = supabase.from("exercises").select("external_url, category");
    (exercise.exercise_id ? query.eq("id", exercise.exercise_id) : query.eq("name", exercise.exercise_name))
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        setInfo(data ?? null);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [exercise]);

  const technique = exercise ? techniqueFor(exercise.exercise_name, info?.category) : null;

  return (
    <Modal visible={!!exercise} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{exercise?.exercise_name}</Text>
            {technique ? <Text style={styles.subtitle}>{technique.pattern}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
          {loading ? (
            <ActivityIndicator color="#D4AF37" style={{ marginVertical: 20 }} />
          ) : (
            <>
              {info?.external_url || !exercise ? (
                <ExerciseVideoPreview url={info?.external_url ?? null} />
              ) : (
                <WatchOnlineLink name={exercise.exercise_name} />
              )}
              {technique ? <ExerciseGuideContent technique={technique} /> : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#94A3B8", fontSize: 14, marginTop: 2 },
  close: { color: "#D4AF37", fontWeight: "700", fontSize: 16 },
});
