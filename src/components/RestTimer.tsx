import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Vibration } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { formatClock } from "@/lib/programs";

interface Props {
  // Length of the rest the timer starts with, in seconds.
  seconds: number;
  onClose: () => void;
}

const QUICK_PICKS = [120, 180];

// Counts down the rest between sets after the client logs one. Works from an
// end time rather than counting ticks, so it stays right if the phone lags.
export default function RestTimer({ seconds, onClose }: Props) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const left = (endsAt - now) / 1000;
  const done = left <= 0;

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (done) Vibration.vibrate([0, 400, 200, 400]);
  }, [done]);

  const restart = (s: number) => {
    const start = Date.now();
    setNow(start);
    setEndsAt(start + s * 1000);
  };

  return (
    <View style={[styles.box, done && styles.boxDone]}>
      <Text style={styles.label}>{done ? "Rest done - hit your next set!" : "Rest"}</Text>
      <Text style={[styles.clock, done && { color: "#22C55E" }]}>{formatClock(left)}</Text>
      <View style={styles.row}>
        {QUICK_PICKS.map((s) => (
          <Pressable key={s} style={styles.chip} onPress={() => restart(s)}>
            <Text style={styles.chipText}>{s / 60} min</Text>
          </Pressable>
        ))}
        <Pressable style={styles.chip} onPress={onClose}>
          <Text style={styles.chipText}>{done ? "Close" : "Skip"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: BRAND_GOLD,
  },
  boxDone: { borderColor: "#22C55E" },
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  clock: { color: BRAND_GOLD, fontSize: 48, fontWeight: "800", fontVariant: ["tabular-nums"], marginVertical: 4 },
  row: { flexDirection: "row", gap: 8 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: "#E2E8F0", fontSize: 13, fontWeight: "600" },
});
