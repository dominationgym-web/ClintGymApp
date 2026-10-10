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

// One supplement, broken down so the client can decide for themselves: a
// coloured label for how good the evidence is, then each question in its own box.
export default function SupplementCard({ supplement: s }: { supplement: Supplement }) {
  const colour = LEVEL_COLOURS[s.level];
  const meaning = SUPPLEMENT_LEVELS.find((l) => l.level === s.level)?.meaning;
  return (
    <View style={styles.wrap}>
      <View style={[styles.levelBar, { borderColor: colour, backgroundColor: colour + "1A" }]}>
        <Text style={[styles.levelName, { color: colour }]}>{s.level.toUpperCase()}</Text>
        <Text style={styles.levelMeaning}>{meaning}</Text>
      </View>
      <Block icon="🎯" label="What it does" text={s.what} />
      <Block icon="🙋" label="Who it suits" text={s.who} />
      <Block icon="🥄" label="How to take it" text={s.how} />
      <Block icon="⚠️" label="Good to know" text={s.careful} />
      {s.brain ? <Block icon="🧠" label="For your brain on exhausted days" text={s.brain} highlight="#A78BFA" /> : null}
      <View style={styles.ask}>
        <Text style={styles.askText}>💬 Not sure if it's right for you? Ask your trainer.</Text>
      </View>
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

function Block({ icon, label, text, highlight }: { icon: string; label: string; text: string; highlight?: string }) {
  return (
    <View style={[styles.block, highlight ? { borderColor: highlight, borderWidth: 1 } : null]}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockIcon}>{icon}</Text>
        <Text style={[styles.label, highlight ? { color: highlight } : null]}>{label.toUpperCase()}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  wrap: { marginBottom: 12 },
  levelBar: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  levelName: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  levelMeaning: { color: "#E2E8F0", fontSize: 14, marginTop: 2 },
  block: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 8 },
  blockHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  blockIcon: { fontSize: 16, marginRight: 8 },
  label: { color: BRAND_GOLD, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  text: { color: "#E2E8F0", fontSize: 15, lineHeight: 22 },
  ask: { backgroundColor: "rgba(212,175,55,0.1)", borderRadius: 12, padding: 12 },
  askText: { color: "#F1E3B0", fontSize: 14, fontWeight: "600" },
  keyRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  pill: { borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, fontSize: 12, fontWeight: "700", marginRight: 10, minWidth: 110, textAlign: "center" },
  keyText: { color: "#CBD5E1", fontSize: 14, flex: 1 },
});
