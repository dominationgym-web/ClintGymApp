import React from "react";
import { Pressable, Text, View } from "react-native";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import { themeBg, themedStyles } from "@/lib/theme";

const TABS: { key: ExercisePlace; label: string }[] = [
  { key: "gym", label: "Gym exercises" },
  { key: "home", label: "Home training" },
];

// Switches a list between Gym and Home: exercises (the whole library or only
// those needing no gym machine) or, with other labels, programs.
export const PROGRAM_PLACE_LABELS: Record<ExercisePlace, string> = { gym: "🏋️ Gym programs", home: "🏠 Home programs" };

export default function GymHomeTabs({
  current,
  onChange,
  accent,
  labels,
}: {
  current: ExercisePlace;
  onChange: (place: ExercisePlace) => void;
  accent: string;
  labels?: Record<ExercisePlace, string>;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const on = t.key === current;
        return (
          <Pressable key={t.key} style={[styles.tab, on && { backgroundColor: themeBg(accent) }]} onPress={() => onChange(t.key)}>
            <Text style={[styles.text, on && styles.textOn]}>{labels?.[t.key] ?? t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
  bar: { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 10, padding: 3, marginBottom: 10 },
  tab: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  text: { color: "#94A3B8", fontWeight: "700", fontSize: 14 },
  textOn: { color: "#0F172A" },
});
