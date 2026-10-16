import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import WatchOnlineLink from "@/components/WatchOnlineLink";
import { BRAND_GOLD } from "@/lib/brand";
import type { StabilityExercise } from "@/lib/stability";

// How to do a stability exercise: its video (or a link to examples online when
// there's no clip), the steps, when to stop, the load and how to make it easier
// or harder. Used on the client's running program and in the trainer's browse
// view (GRIZZ, 2026-10-16: trainers need the videos for 1-on-1 clients too).
export default function StabilityHowTo({ exercise, videoUrl }: { exercise: StabilityExercise; videoUrl: string | null }) {
  return (
    <View>
      {videoUrl ? <ExerciseVideoPreview url={videoUrl} /> : <WatchOnlineLink name={exercise.name} search={exercise.search} />}
      <Text style={styles.label}>How to do it</Text>
      {exercise.steps.map((step, i) => (
        <Text key={i} style={styles.text}>
          {i + 1}. {step}
        </Text>
      ))}
      <Text style={styles.label}>⛔ Stop {exercise.measure === "hold" ? "the clock" : "counting"} when</Text>
      <Text style={styles.text}>{exercise.lossOfControl}</Text>
      <Text style={styles.label}>🏋️ Resistance</Text>
      <Text style={styles.text}>{exercise.resistance}</Text>
      <Text style={styles.label}>⬇ Easier</Text>
      <Text style={styles.text}>{exercise.easier}</Text>
      <Text style={styles.label}>⬆ Harder (once you hit the target two sessions running)</Text>
      <Text style={styles.text}>{exercise.harder}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 10, marginBottom: 2 },
  text: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginBottom: 2 },
});
