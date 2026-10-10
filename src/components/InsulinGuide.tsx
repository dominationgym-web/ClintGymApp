import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { UNDERSTANDING_INSULIN as G } from "@/lib/nutrition";

// "Understanding Insulin" on the Nutrition page: GRIZZ's talk on carbs,
// insulin and fat burning, laid out as a chain of steps, side-by-side
// comparisons and a closing line so it reads at a glance.
export default function InsulinGuide() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{G.title}</Text>
      <Text style={styles.subtitle}>{G.subtitle}</Text>

      <View style={styles.hook}>
        <Text style={styles.hookText}>{G.hook}</Text>
      </View>
      <Text style={styles.body}>{G.intro}</Text>

      <Text style={styles.sectionLabel}>WHAT HAPPENS</Text>
      {G.steps.map((step, i) => (
        <View key={step.title}>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepEmoji}>{step.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.small}>{step.text}</Text>
            </View>
          </View>
          {i < G.steps.length - 1 && <Text style={styles.arrow}>↓</Text>}
        </View>
      ))}

      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>{G.oneSweet.title}</Text>
        {G.oneSweet.points.map((p) => (
          <Text key={p} style={styles.body}>
            {p}
          </Text>
        ))}
      </View>

      <Text style={styles.sectionLabel}>SAME SWEET, DIFFERENT BODY</Text>
      <View style={styles.pair}>
        {G.whoFor.map((w) => (
          <View key={w.title} style={styles.tile}>
            <Text style={styles.tileEmoji}>{w.emoji}</Text>
            <Text style={styles.tileTitle}>{w.title}</Text>
            <Text style={styles.small}>{w.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{G.order.title.toUpperCase()}</Text>
      <View style={[styles.orderBox, styles.wrong]}>
        <Text style={[styles.orderLabel, { color: "#F87171" }]}>✗ {G.order.wrong.label}</Text>
        <Text style={styles.small}>{G.order.wrong.text}</Text>
      </View>
      <View style={[styles.orderBox, styles.right]}>
        <Text style={[styles.orderLabel, { color: "#4ADE80" }]}>✓ {G.order.right.label}</Text>
        <Text style={styles.small}>{G.order.right.text}</Text>
      </View>
      <Text style={styles.note}>{G.order.note}</Text>

      <Text style={styles.sectionLabel}>HORSES FOR COURSES</Text>
      <View style={styles.goals}>
        {G.goals.map((g) => (
          <View key={g.goal} style={styles.goal}>
            <Text style={styles.goalEmoji}>{g.emoji}</Text>
            <Text style={styles.goalText}>{g.goal}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.body}>{G.goalsLine}</Text>
      <Text style={styles.body}>{G.warning}</Text>

      <View style={styles.closing}>
        <Text style={styles.closingText}>{G.closing}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { color: BRAND_GOLD, fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#94A3B8", fontSize: 14, marginTop: 2, marginBottom: 14 },
  hook: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, marginBottom: 12 },
  hookText: { color: "#0F172A", fontSize: 19, fontWeight: "800", lineHeight: 25 },
  body: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginBottom: 8 },
  small: { color: "#CBD5E1", fontSize: 13, lineHeight: 19 },
  sectionLabel: { color: BRAND_GOLD, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginTop: 16, marginBottom: 8 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F172A", borderRadius: 10, padding: 12 },
  stepIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" },
  stepEmoji: { fontSize: 22 },
  stepTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  arrow: { color: BRAND_GOLD, fontSize: 18, fontWeight: "800", textAlign: "center", marginVertical: 2 },
  callout: { borderLeftWidth: 4, borderLeftColor: "#F97316", backgroundColor: "#2A1F14", borderRadius: 8, padding: 12, marginTop: 16 },
  calloutTitle: { color: "#FDBA74", fontSize: 17, fontWeight: "800", marginBottom: 6 },
  pair: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, backgroundColor: "#0F172A", borderRadius: 10, padding: 12 },
  tileEmoji: { fontSize: 26, marginBottom: 6 },
  tileTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  orderBox: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  wrong: { backgroundColor: "#2A1416", borderColor: "#7F1D1D" },
  right: { backgroundColor: "#13261B", borderColor: "#166534" },
  orderLabel: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  note: { color: "#94A3B8", fontSize: 13, fontStyle: "italic", marginBottom: 4 },
  goals: { flexDirection: "row", gap: 8, marginBottom: 10 },
  goal: { flex: 1, alignItems: "center", backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 6 },
  goalEmoji: { fontSize: 24, marginBottom: 4 },
  goalText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  closing: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: BRAND_GOLD, paddingVertical: 14, marginTop: 8 },
  closingText: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", lineHeight: 25 },
});
