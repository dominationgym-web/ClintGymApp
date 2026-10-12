import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import {
  CARDIO_MINUTES,
  CARDIO_SECONDS,
  MAX_CARDIO_MINUTES,
  cardioDuration,
  cardioMinutes,
  minutesOf,
} from "@/lib/programs";

// How long a cardio block runs: short bursts in seconds, longer blocks in
// minutes, or the trainer types their own number of minutes.
export default function CardioDurationPicker({ value, onChange }: { value: string; onChange: (reps: string) => void }) {
  const minutes = minutesOf(value);
  const own = minutes != null && !CARDIO_MINUTES.includes(minutes);
  const [typed, setTyped] = useState(own ? String(minutes) : "");

  // Picking a chip clears the typed minutes.
  useEffect(() => {
    if (!own) setTyped("");
  }, [own]);

  const chip = (label: string, reps: string) => (
    <Pressable key={reps} style={[styles.chip, value === reps && styles.chipOn]} onPress={() => onChange(reps)}>
      <Text style={[styles.chipText, value === reps && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={styles.label}>Seconds</Text>
      <View style={styles.chips}>{CARDIO_SECONDS.map((sec) => chip(`${sec}s`, cardioDuration(sec)))}</View>
      <Text style={styles.label}>Minutes</Text>
      <View style={styles.chips}>{CARDIO_MINUTES.map((min) => chip(`${min} min`, cardioMinutes(min)))}</View>
      <View style={styles.ownRow}>
        <Text style={styles.ownLabel}>Or your own:</Text>
        <TextInput
          style={[styles.input, own && styles.inputOn]}
          value={typed}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9]/g, "").slice(0, 3);
            setTyped(digits);
            const n = Number(digits);
            if (n >= 1 && n <= MAX_CARDIO_MINUTES) onChange(cardioMinutes(n));
          }}
          keyboardType="number-pad"
          placeholder="25"
          placeholderTextColor="#64748B"
          maxLength={3}
          accessibilityLabel="Cardio minutes"
        />
        <Text style={styles.ownLabel}>min</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  ownRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  ownLabel: { color: "#94A3B8", fontSize: 13 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 64, fontSize: 14, borderWidth: 1, borderColor: "transparent" },
  inputOn: { borderColor: BRAND_GOLD },
});
