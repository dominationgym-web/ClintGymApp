import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { WEIGH_IN_OPTIONS, type WeighInEvery } from "@/lib/progress";

// Asked when a trainer activates a client who has no weigh-in schedule yet:
// how often should they weigh and measure? The client gets a reminder on their
// Today screen until it's done (WeighInReminder). Skipping leaves it unset; it
// can be changed any time under Progress graphs > Body.
export default function WeighInPicker({
  name,
  visible,
  onPick,
}: {
  name: string;
  visible: boolean;
  onPick: (key: WeighInEvery | null) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onPick(null)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>⚖️ How often should {name} weigh and measure?</Text>
          <Text style={styles.text}>They'll get a reminder on their Today screen until it's done. You can change this any time under Progress graphs, Body.</Text>
          {WEIGH_IN_OPTIONS.map((o) => (
            <Pressable key={o.key} style={styles.option} onPress={() => onPick(o.key)} accessibilityRole="button">
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.skip} onPress={() => onPick(null)} accessibilityRole="button">
            <Text style={styles.skipText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#111C33", borderRadius: 14, padding: 18, borderWidth: 1.5, borderColor: BRAND_GOLD },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  text: { color: "#CBD5E1", fontSize: 13, marginTop: 6, marginBottom: 6 },
  option: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  optionText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  skip: { padding: 12, alignItems: "center", marginTop: 4 },
  skipText: { color: "#94A3B8", fontWeight: "700" },
});
