import React from "react";
import { Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { AWARD_PITCH } from "@/lib/award";
import { themedStyles } from "@/lib/theme";

// Tells a new trainer about Trainer of the Half-Year (GRIZZ, 2026-11-08), on
// the "Thanks for applying" screen straight after they sign up.
export default function AwardPitchCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏆 {AWARD_PITCH.title}</Text>
      {AWARD_PITCH.paragraphs.map((p) => (
        <Text key={p} style={styles.text}>
          {p}
        </Text>
      ))}
      <Text style={styles.note}>{AWARD_PITCH.storeNote}</Text>
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderWidth: 2, borderColor: BRAND_GOLD, borderRadius: 14, padding: 16, gap: 8, marginTop: 20, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { color: BRAND_GOLD, fontWeight: "800", fontSize: 18 },
  text: { color: "#E2E8F0", lineHeight: 21 },
  note: { color: "#64748B", fontSize: 12, lineHeight: 16, marginTop: 2 },
});
