import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND_GOLD } from "@/lib/brand";

// GRIZZ's self-training option (2026-10-11), on hold until he switches it on.
// Shown on the login screen so people know it's coming.
export const SELF_TRAINING_INCLUDES = [
  "A choice of training programs to follow on your own",
  "All the nutrition guidance, including the calorie calculator",
  "Workout tracking: log your sets and see your progress",
  "Sleep and recovery guidance",
  "Message Coach Grizz for help up to twice a week",
];

export const SELF_TRAINING_NOT_INCLUDED = "Programs aren't written for you personally. For a program built around you, sign up with a coach.";

export default function SelfTrainingComingSoon() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.link}>
          Want to train on your own? <Text style={styles.soon}>Self-training: coming soon</Text>
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <Text style={styles.badge}>COMING SOON</Text>
            <Text style={styles.title}>Self-training</Text>
            <Text style={styles.body}>For people who want to train on their own, with the app and a coach to ask when they need help.</Text>
            <Text style={styles.heading}>What you'll get</Text>
            {SELF_TRAINING_INCLUDES.map((line) => (
              <View key={line} style={styles.row}>
                <Text style={styles.tick}>✓</Text>
                <Text style={styles.item}>{line}</Text>
              </View>
            ))}
            <Text style={styles.note}>{SELF_TRAINING_NOT_INCLUDED}</Text>
            <Pressable style={styles.button} onPress={() => setOpen(false)}>
              <Text style={styles.buttonText}>Got it</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  link: { color: "#94A3B8", textAlign: "center", marginTop: 20 },
  soon: { color: BRAND_GOLD, fontWeight: "700" },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  badge: { color: BRAND_GOLD, fontWeight: "800", fontSize: 12, letterSpacing: 1.5 },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 6 },
  body: { color: "#CBD5E1", fontSize: 15, lineHeight: 22, marginTop: 10 },
  heading: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 22, marginBottom: 10 },
  row: { flexDirection: "row", marginBottom: 10 },
  tick: { color: BRAND_GOLD, fontWeight: "800", width: 24, fontSize: 15 },
  item: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, flex: 1 },
  note: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 14, fontStyle: "italic" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 28 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
