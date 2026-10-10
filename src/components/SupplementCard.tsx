import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { SUPPLEMENT_LEVELS, type Supplement, type SupplementLevel } from "@/lib/supplements";

export const LEVEL_COLOURS: Record<SupplementLevel, string> = {
  Proven: "#22C55E",
  "Training days": BRAND_GOLD,
  "Might help": "#60A5FA",
  "Save your money": "#F87171",
};

// One supplement, broken down so the client can decide for themselves.
export default function SupplementCard({ supplement: s }: { supplement: Supplement }) {
  return (
    <View style={styles.card}>
      <Block label="What it does" text={s.what} />
      <Block label="Who it suits" text={s.who} />
      <Block label="How to take it" text={s.how} />
      <Block label="Good to know" text={s.careful} />
      {s.brain ? <Block label="For your brain on exhausted days" text={s.brain} /> : null}
      <Text style={styles.ask}>Not sure if it's right for you? Ask your trainer.</Text>
    </View>
  );
}

// What the coloured labels on the supplement headings mean.
export function SupplementLevelsKey() {
  return (
    <View style={styles.card}>
      {SUPPLEMENT_LEVELS.map((l) => (
        <View key={l.level} style={styles.keyRow}>
          <Text style={[styles.pill, { color: LEVEL_COLOURS[l.level], borderColor: LEVEL_COLOURS[l.level] }]}>{l.level}</Text>
          <Text style={styles.keyText}>{l.meaning}</Text>
        </View>
      ))}
    </View>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  block: { marginBottom: 12 },
  label: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  text: { color: "#E2E8F0", fontSize: 15, lineHeight: 22 },
  ask: { color: "#94A3B8", fontSize: 13, fontStyle: "italic" },
  keyRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  pill: { borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, fontSize: 12, fontWeight: "700", marginRight: 10, minWidth: 110, textAlign: "center" },
  keyText: { color: "#CBD5E1", fontSize: 14, flex: 1 },
});
