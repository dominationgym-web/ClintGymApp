import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SAFETY_NOTE, techniqueFor, type ExerciseTechnique } from "@/lib/exerciseTechnique";
import { BRAND_GOLD } from "@/lib/brand";

// The "how to do it properly" guide for one exercise: where to feel it, the
// steps, how to get the most from it and how to make it fit your body.
export function ExerciseGuideContent({ technique }: { technique: ExerciseTechnique }) {
  return (
    <View>
      <Text style={styles.feel}>
        <Text style={styles.feelLabel}>Feel it in: </Text>
        {technique.feel}
      </Text>
      <Text style={styles.heading}>How to do it</Text>
      {technique.steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{i + 1}</Text>
          <Text style={styles.text}>{step}</Text>
        </View>
      ))}
      <Text style={styles.heading}>Get the most from it</Text>
      {technique.tips.map((tip, i) => (
        <Text key={i} style={styles.bullet}>
          💪 {tip}
        </Text>
      ))}
      <Text style={styles.heading}>Make it work for you</Text>
      {technique.adapt.map((line, i) => (
        <Text key={i} style={styles.bullet}>
          🩹 {line}
        </Text>
      ))}
      <Text style={styles.safety}>{SAFETY_NOTE}</Text>
    </View>
  );
}

// A small ? button that opens the guide. Shows nothing when there's no guide
// for the exercise (a trainer's own exercise with no body part).
export default function ExerciseGuideButton({ name, category }: { name: string; category?: string | null }) {
  const [open, setOpen] = useState(false);
  const technique = techniqueFor(name, category);
  if (!technique) return null;
  return (
    <>
      <Pressable
        style={styles.button}
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`How to do ${name}`}
      >
        <Text style={styles.buttonText}>?</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{name}</Text>
              <Text style={styles.subtitle}>{technique.pattern}</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
            <ExerciseGuideContent technique={technique} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: BRAND_GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  buttonText: { color: BRAND_GOLD, fontSize: 15, fontWeight: "800" },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, paddingBottom: 8 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  subtitle: { color: BRAND_GOLD, fontSize: 13, fontWeight: "600", marginTop: 2 },
  close: { color: BRAND_GOLD, fontSize: 16, fontWeight: "600" },
  feel: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginTop: 8 },
  feelLabel: { color: BRAND_GOLD, fontWeight: "700" },
  heading: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  stepRow: { flexDirection: "row", marginBottom: 8 },
  stepNumber: {
    color: "#0F172A",
    backgroundColor: BRAND_GOLD,
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 22,
    marginRight: 10,
    overflow: "hidden",
  },
  text: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, flex: 1 },
  bullet: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginBottom: 6 },
  safety: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginTop: 18, fontStyle: "italic" },
});
