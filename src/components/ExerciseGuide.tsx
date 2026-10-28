import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import ModalSafeArea from "./ModalSafeArea";
import { MUSCLE_NOT_WEIGHT, SAFETY_NOTE, techniqueFor, type ExerciseTechnique } from "@/lib/exerciseTechnique";
import { BRAND_GOLD } from "@/lib/brand";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import WatchOnlineLink from "@/components/WatchOnlineLink";

// The "how to do it properly" guide for one exercise: where to feel it, the
// steps, how to get the most from it and how to make it fit your body.
export function ExerciseGuideContent({ technique }: { technique: ExerciseTechnique }) {
  return (
    <View>
      {!technique.noWeightRule && <MuscleNotWeight />}
      <Text style={styles.feel}>
        <Text style={styles.feelLabel}>Works and feel it in: </Text>
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

// GRIZZ's reminder for every set.
export function MuscleNotWeight() {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleText}>🎯 {MUSCLE_NOT_WEIGHT}</Text>
    </View>
  );
}

export { WatchOnlineLink };

// Opens the guide: a small ? button, or (variant "bar", GRIZZ 2026-10-12) a
// full-width "How to do it" button that also says what the exercise works,
// so it's easy to spot on a workout. Shows nothing when there's no guide for
// the exercise (a trainer's own exercise with no body part). With onDoSet, a
// green "Do set" button at the bottom of the guide closes it and goes to the
// set log (GRIZZ 2026-10-13).
export default function ExerciseGuideButton({
  name,
  category,
  variant = "icon",
  onDoSet,
  videoUrl,
}: {
  name: string;
  category?: string | null;
  variant?: "icon" | "bar";
  onDoSet?: () => void;
  // The exercise's demo clip, played at the top of the guide (2026-10-14),
  // so the steps and the movement are in one place. Null means the exercise
  // has no clip, so the guide links to examples online instead.
  videoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const technique = techniqueFor(name, category);
  if (!technique) return null;
  return (
    <>
      {variant === "bar" ? (
        <Pressable
          style={styles.bar}
          onPress={() => setOpen(true)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`How to do ${name}`}
        >
          <Text style={styles.barTitle}>📖 How to do it ›</Text>
          <Text style={styles.barWorks}>
            <Text style={styles.barWorksLabel}>Works: </Text>
            {technique.feel}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.button}
          onPress={() => setOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`How to do ${name}`}
        >
          <Text style={styles.buttonText}>?</Text>
        </Pressable>
      )}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ModalSafeArea style={styles.modal}>
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
            {open && videoUrl ? <ExerciseVideoPreview url={videoUrl} /> : null}
            {videoUrl === null && <WatchOnlineLink name={name} />}
            <ExerciseGuideContent technique={technique} />
            {onDoSet && (
              <Pressable
                style={[doSetStyles.button, doSetStyles.big]}
                onPress={() => {
                  // Close the guide first: iOS can't open the set log while it's still closing.
                  setOpen(false);
                  setTimeout(onDoSet, 400);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Do a set of ${name}`}
              >
                <Text style={[doSetStyles.text, doSetStyles.bigText]}>Do set ›</Text>
              </Pressable>
            )}
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    </>
  );
}

// The green "Do set" button, beside an exercise name on a workout and at the
// bottom of the guide.
export function DoSetButton({ onPress, name }: { onPress: () => void; name: string }) {
  return (
    <Pressable
      style={doSetStyles.button}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Do a set of ${name}`}
    >
      <Text style={doSetStyles.text}>Do set</Text>
    </Pressable>
  );
}

const doSetStyles = StyleSheet.create({
  button: {
    backgroundColor: "#16A34A",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "800" },
  big: { marginTop: 22, paddingVertical: 14, borderRadius: 12 },
  bigText: { fontSize: 17 },
});

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
  bar: {
    borderWidth: 1.5,
    borderColor: BRAND_GOLD,
    backgroundColor: "#2A2414",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignSelf: "stretch",
  },
  barTitle: { color: BRAND_GOLD, fontSize: 14, fontWeight: "800" },
  barWorks: { color: "#E2E8F0", fontSize: 13, marginTop: 2 },
  barWorksLabel: { color: "#94A3B8", fontWeight: "700" },
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
  rule: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  ruleText: { color: "#F1F5F9", fontSize: 14, lineHeight: 20, fontWeight: "600" },
  safety: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginTop: 18, fontStyle: "italic" },
});
