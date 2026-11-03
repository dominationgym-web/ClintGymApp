import React from "react";
import { Pressable, Text, View } from "react-native";
import { themedStyles } from "@/lib/theme";
import type { Units } from "@/types/database";

const OPTIONS: { value: Units; label: string; detail: string }[] = [
  { value: "metric", label: "Metric", detail: "kg and cm" },
  { value: "imperial", label: "Imperial", detail: "lb and inches" },
];

export const UNITS_HINT =
  "When you bring in a client's history from screenshots or a file that doesn't say kg or lb, the app reads the numbers in these units.";

// Metric or Imperial (GRIZZ, 2026-11-03, 0189). Picked at trainer signup and
// changed in Settings.
export default function UnitsPicker({ value, onChange }: { value: Units; onChange: (u: Units) => void }) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.label}, ${o.detail}`}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            <Text style={styles.detail}>{o.detail}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1E293B",
  },
  chipOn: { borderColor: "#D4AF37", backgroundColor: "#2A2410" },
  chipText: { color: "#CBD5E1", fontSize: 15, fontWeight: "700" },
  chipTextOn: { color: "#D4AF37" },
  detail: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
});
