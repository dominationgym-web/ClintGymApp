import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import type { CheckinFeedback } from "@/lib/checkinFeedback";

// The app's feedback on the last week of check-ins: a win, then up to three
// things to work on. Each tip opens to show what to do and what it will do,
// so the card stays short.
export default function CheckinFeedbackCard({
  feedback,
  forTrainer = false,
}: {
  feedback: CheckinFeedback;
  forTrainer?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (feedback.days === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{forTrainer ? "📈 What the app suggested this week" : "📈 Your tips for this week"}</Text>
      <Text style={styles.sub}>
        Based on {forTrainer ? "their" : "your"} last {feedback.days} check-in{feedback.days === 1 ? "" : "s"}.
        {feedback.tips.length > 0 ? " Tap a tip to see what to do." : ""}
      </Text>
      {feedback.win && <Text style={styles.win}>🏆 {feedback.win}</Text>}
      {feedback.tips.length === 0 && (
        <Text style={styles.text}>Everything looks on track. Keep doing what {forTrainer ? "they're" : "you're"} doing.</Text>
      )}
      {feedback.tips.map((tip) => {
        const isOpen = open === tip.key;
        return (
          <Pressable
            key={tip.key}
            style={[styles.tip, isOpen && styles.tipOpen]}
            onPress={() => setOpen(isOpen ? null : tip.key)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
          >
            <View style={styles.tipHeader}>
              <Text style={styles.tipTitle}>
                {tip.icon} {tip.title}
              </Text>
              <Text style={styles.arrow}>{isOpen ? "▲" : "▼"}</Text>
            </View>
            <Text style={styles.because}>{tip.because}</Text>
            {isOpen && (
              <>
                <Text style={styles.label}>Do this</Text>
                <Text style={styles.text}>{tip.doThis}</Text>
                <Text style={styles.label}>It will</Text>
                <Text style={styles.text}>{tip.itWill}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 14, borderTopWidth: 3, borderTopColor: BRAND_GOLD },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  sub: { color: "#94A3B8", fontSize: 12, marginTop: 2, marginBottom: 8 },
  win: { color: "#86EFAC", fontSize: 14, lineHeight: 20, marginBottom: 8 },
  tip: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 8 },
  tipOpen: { borderWidth: 1, borderColor: BRAND_GOLD },
  tipHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tipTitle: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  arrow: { color: BRAND_GOLD, fontSize: 12 },
  because: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  label: { color: BRAND_GOLD, fontSize: 12, fontWeight: "800", marginTop: 10, textTransform: "uppercase" },
  text: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginTop: 2 },
});
