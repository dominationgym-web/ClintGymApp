import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { percentUp } from "@/lib/achievements";
import type { ClientAchievement } from "@/types/database";

const kg = (n: number) => `${Number(n)}kg`;

// The gold achievement badge that pops up when a set earns one (0085).
export default function AchievementBadge({ badge, onClose }: { badge: ClientAchievement | null; onClose: () => void }) {
  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {badge && (
          <View style={styles.card}>
            <View style={styles.medal}>
              <Text style={styles.medalText}>🏅</Text>
            </View>
            <Text style={styles.title}>Gold achievement!</Text>
            <Text style={styles.exercise}>{badge.exercise_name}</Text>
            <Text style={styles.line}>
              {kg(badge.from_weight)} → {kg(badge.weight)} for {badge.reps} reps
            </Text>
            <Text style={styles.percent}>+{percentUp(Number(badge.from_weight), Number(badge.weight))}% stronger</Text>
            <Text style={styles.note}>Your coach has been told. Keep it up!</Text>
            <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonText}>Keep going</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#0F172A", borderRadius: 18, borderWidth: 2, borderColor: BRAND_GOLD, padding: 24, alignItems: "center" },
  medal: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#2A2410",
    borderWidth: 3,
    borderColor: BRAND_GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  medalText: { fontSize: 52 },
  title: { color: BRAND_GOLD, fontSize: 24, fontWeight: "800" },
  exercise: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 6, textAlign: "center" },
  line: { color: "#E2E8F0", fontSize: 16, marginTop: 6 },
  percent: { color: BRAND_GOLD, fontSize: 18, fontWeight: "800", marginTop: 4 },
  note: { color: "#94A3B8", fontSize: 13, marginTop: 10, textAlign: "center" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32, marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
