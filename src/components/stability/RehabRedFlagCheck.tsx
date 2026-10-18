import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { findArea, rehabRedFlags, type StabilityArea } from "@/lib/stability";

// Before a Rehab program starts (review 2026-10-18): the trainer reads the
// area's red flags and confirms none apply. Any of them, and the client is
// assessed first. Trainers can't diagnose or treat injuries.
export default function RehabRedFlagCheck({
  area,
  clientName,
  onClear,
  onRefer,
}: {
  area: StabilityArea;
  clientName: string;
  onClear: () => void;
  onRefer: () => void;
}) {
  const refer = () =>
    Alert.alert(
      "Refer first",
      `Don't start the Rehab program yet. ${clientName} should see a physio, biokineticist or doctor first. Once they've been assessed and cleared to train, come back and start it.`,
      [{ text: "OK", onPress: onRefer }],
    );
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Before you start: red flags ({findArea(area).title})</Text>
      <Text style={styles.text}>Ask {clientName}. Do any of these apply?</Text>
      {rehabRedFlags(area).map((f) => (
        <Text key={f} style={styles.flag}>
          • {f}
        </Text>
      ))}
      <View style={styles.buttons}>
        <Pressable style={styles.refer} onPress={refer} accessibilityRole="button">
          <Text style={styles.referText}>One applies: refer first</Text>
        </Pressable>
        <Pressable style={styles.clear} onPress={onClear} accessibilityRole="button">
          <Text style={styles.clearText}>✓ No red flags</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginTop: 8, borderLeftWidth: 3, borderLeftColor: "#EF4444" },
  title: { color: "#fff", fontWeight: "800", fontSize: 15 },
  text: { color: "#CBD5E1", fontSize: 13, marginTop: 4, marginBottom: 4 },
  flag: { color: "#E2E8F0", fontSize: 13, lineHeight: 18, marginTop: 4 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 12 },
  refer: { flex: 1, borderWidth: 1, borderColor: "#EF4444", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  referText: { color: "#F87171", fontWeight: "800", fontSize: 13 },
  clear: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  clearText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
});
