import React from "react";
import { Pressable, Text, View } from "react-native";
import { setThemePreference, themedStyles, useThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "light", label: "Light", icon: "☀️" },
  { value: "system", label: "Match phone", icon: "📱" },
];

export const THEME_PICKER_HINT = "Dark navy or a light look. Match phone follows your phone's setting each time the app opens.";

// Light / Dark / Match phone (GRIZZ, 2026-10-28). Saved on this phone or laptop only.
export default function ThemePicker({ showTitle = true }: { showTitle?: boolean }) {
  const preference = useThemePreference();
  return (
    <View style={styles.card}>
      {showTitle ? <Text style={styles.title}>🌗 Light or dark</Text> : null}
      <Text style={styles.hint}>{THEME_PICKER_HINT}</Text>
      <View style={styles.row}>
        {OPTIONS.map((o) => {
          const on = preference === o.value;
          return (
            <Pressable
              key={o.value}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setThemePreference(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
            >
              <Text style={styles.chipIcon}>{o.icon}</Text>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  hint: { color: "#94A3B8", fontSize: 12, marginBottom: 10 },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },
  chipOn: { borderColor: "#D4AF37", backgroundColor: "#2A2410" },
  chipIcon: { fontSize: 18, marginBottom: 2 },
  chipText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#D4AF37" },
});
