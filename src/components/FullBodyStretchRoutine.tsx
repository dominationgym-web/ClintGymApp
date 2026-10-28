import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import WatchOnlineLink from "@/components/WatchOnlineLink";
import { FULL_BODY_STRETCH, FULL_BODY_STRETCH_MINUTES } from "@/lib/fullBodyStretch";
import { themedStyles } from "@/lib/theme";

const GREEN = "#4ADE80";

// The full body stretch routine (src/lib/fullBodyStretch.ts), one stretch per
// page so there's no scrolling: what it's for, how, how long, and a video.
// Shown in Recovery when stretching is suggested or picked. onFinished logs it.
export default function FullBodyStretchRoutine({ onFinished, onClose }: { onFinished: (minutes: number) => void; onClose: () => void }) {
  const [i, setI] = useState(-1);
  const total = FULL_BODY_STRETCH.length;

  if (i < 0) {
    return (
      <View>
        <Text style={styles.title}>🧘 Full body stretch</Text>
        <Text style={styles.body}>
          {total} easy stretches from your neck down to your calves, about {FULL_BODY_STRETCH_MINUTES} minutes. Do it after training,
          on a rest day or before bed.
        </Text>
        <Text style={styles.body}>Stretch to a mild pull, never pain, and breathe out slowly into each one. Warm up with a few minutes of walking first.</Text>
        <Pressable style={styles.primary} onPress={() => setI(0)}>
          <Text style={styles.primaryText}>Start ›</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={onClose}>
          <Text style={styles.linkText}>‹ Back</Text>
        </Pressable>
      </View>
    );
  }

  const s = FULL_BODY_STRETCH[i];
  const last = i === total - 1;
  return (
    <View>
      <Text style={styles.count}>
        Stretch {i + 1} of {total}
      </Text>
      <Text style={styles.title}>{s.name}</Text>
      <Text style={styles.hold}>⏱ {s.hold}</Text>
      <Text style={styles.for}>Loosens: {s.for}</Text>
      {s.how.map((step) => (
        <Text key={step} style={styles.step}>
          • {step}
        </Text>
      ))}
      <WatchOnlineLink name={s.name} search={s.search} />
      <View style={styles.row}>
        <Pressable style={[styles.secondary, { flex: 1 }]} onPress={() => setI(i - 1)}>
          <Text style={styles.secondaryText}>‹ Back</Text>
        </Pressable>
        <Pressable style={[styles.primary, { flex: 2, marginTop: 0 }]} onPress={() => (last ? onFinished(FULL_BODY_STRETCH_MINUTES) : setI(i + 1))}>
          <Text style={styles.primaryText}>{last ? "✓ Done, log it" : "Next ›"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles({
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 4 },
  body: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 8 },
  count: { color: GREEN, fontSize: 12, fontWeight: "700" },
  hold: { color: GREEN, fontSize: 14, fontWeight: "700", marginTop: 6 },
  for: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  step: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginTop: 6 },
  row: { flexDirection: "row", gap: 8, marginTop: 14 },
  primary: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: "#334155", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: "#E2E8F0", fontWeight: "600", fontSize: 15 },
  link: { alignItems: "center", paddingVertical: 12 },
  linkText: { color: "#94A3B8", fontSize: 14 },
});
