import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExercisePlace } from "@/lib/exerciseFilter";

const TABS: { key: ExercisePlace; label: string }[] = [
  { key: "gym", label: "Gym exercises" },
  { key: "home", label: "Home training" },
];

// Switches an exercise list between the whole library (Gym) and only the
// exercises that need no gym machine (Home).
export default function GymHomeTabs({
  current,
  onChange,
  accent,
}: {
  current: ExercisePlace;
  onChange: (place: ExercisePlace) => void;
  accent: string;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const on = t.key === current;
        return (
          <Pressable key={t.key} style={[styles.tab, on && { backgroundColor: accent }]} onPress={() => onChange(t.key)}>
            <Text style={[styles.text, on && styles.textOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 10, padding: 3, marginBottom: 10 },
  tab: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  text: { color: "#94A3B8", fontWeight: "700", fontSize: 14 },
  textOn: { color: "#0F172A" },
});
