import React from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { EFFORT_LABEL } from "@/lib/progression";
import type { WorkoutLog } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// A day's logged sets, exercise by exercise, each one a button to fix it
// (GRIZZ 2026-11-10: back into a live session to change the reps of a set).
export function LoggedSetsByExercise({ sets, onPick }: { sets: WorkoutLog[]; onPick: (set: WorkoutLog) => void }) {
  const groups: { name: string; sets: WorkoutLog[] }[] = [];
  for (const s of sets) {
    const group = groups.find((g) => g.name === s.exercise_name);
    if (group) group.sets.push(s);
    else groups.push({ name: s.exercise_name, sets: [s] });
  }
  for (const g of groups) g.sets.sort((a, b) => Number(!a.warm_up) - Number(!b.warm_up) || a.set_number - b.set_number);
  return (
    <View>
      {groups.map((g) => (
        <View key={g.name} style={styles.group}>
          <Text style={styles.name}>{g.name}</Text>
          {g.sets.map((s) => (
            <Pressable key={s.id} style={styles.row} onPress={() => onPick(s)} accessibilityRole="button" accessibilityLabel={`Fix ${g.name} set ${s.set_number}`}>
              <Text style={styles.text}>
                {s.warm_up ? "Warm-up" : s.gauge ? "Gauge set" : `Set ${s.set_number}`}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
                {s.reps} reps
              </Text>
              <Text style={styles.effort}>
                {s.warm_up ? "" : `${(EFFORT_LABEL as Record<string, string>)[s.effort] ?? ""} `}✏️
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles({
  group: { marginBottom: 8 },
  name: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  text: { color: "#fff", fontSize: 14 },
  effort: { color: "#94A3B8", fontSize: 12 },
});
