import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import type { Point } from "@/lib/progress";

// A line graph drawn with plain Views (no chart library, so no new app build
// needed). Tap a dot to see that day's value.
const HEIGHT = 150;
const DOT = 8;
const PAD = 10;

export default function ProgressChart({ points, unit, color = BRAND_GOLD }: { points: Point[]; unit: string; color?: string }) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  if (points.length === 0) return <Text style={styles.empty}>Nothing logged yet.</Text>;

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const span = t1 - t0 || 1;
  const innerW = Math.max(0, width - PAD * 2);
  const innerH = HEIGHT - PAD * 2;
  const xy = points.map((p) => ({
    x: PAD + (points.length === 1 ? innerW / 2 : ((Date.parse(p.date) - t0) / span) * innerW),
    y: PAD + innerH - ((p.value - min) / (max - min)) * innerH,
  }));
  const shown = picked !== null ? points[picked] : points[points.length - 1];

  return (
    <View>
      <Text style={styles.readout}>
        {fmt(shown.value)} {unit}
        <Text style={styles.readoutDate}>  {shown.date}{shown.note ? ` · ${shown.note}` : ""}</Text>
      </Text>
      <View style={styles.chartRow}>
        <View style={styles.axis}>
          <Text style={styles.axisText}>{fmt(max)}</Text>
          <Text style={styles.axisText}>{fmt(min)}</Text>
        </View>
        <View style={styles.plot} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.grid, { top: PAD }]} />
          <View style={[styles.grid, { top: PAD + innerH / 2 }]} />
          <View style={[styles.grid, { top: PAD + innerH }]} />
          {width > 0 &&
            xy.slice(1).map((b, i) => {
              const a = xy[i];
              const len = Math.hypot(b.x - a.x, b.y - a.y);
              const angle = Math.atan2(b.y - a.y, b.x - a.x);
              return (
                <View
                  key={`l${i}`}
                  style={[
                    styles.line,
                    { backgroundColor: color, width: len, left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - 1, transform: [{ rotate: `${angle}rad` }] },
                  ]}
                />
              );
            })}
          {width > 0 &&
            xy.map((p, i) => (
              <Pressable
                key={`d${i}`}
                hitSlop={8}
                onPress={() => setPicked(i)}
                style={[
                  styles.dot,
                  { left: p.x - DOT / 2, top: p.y - DOT / 2, borderColor: color, backgroundColor: picked === i ? "#fff" : color },
                ]}
              />
            ))}
        </View>
      </View>
      <View style={styles.dates}>
        <Text style={styles.axisText}>{points[0].date}</Text>
        {points.length > 1 && <Text style={styles.axisText}>{points[points.length - 1].date}</Text>}
      </View>
    </View>
  );
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

const styles = StyleSheet.create({
  empty: { color: "#94A3B8", fontSize: 13, marginVertical: 12 },
  readout: { color: "#fff", fontSize: 20, fontWeight: "800" },
  readoutDate: { color: "#94A3B8", fontSize: 12, fontWeight: "400" },
  chartRow: { flexDirection: "row", marginTop: 8 },
  axis: { width: 40, height: HEIGHT, justifyContent: "space-between", paddingVertical: PAD - 6 },
  axisText: { color: "#64748B", fontSize: 11 },
  plot: { flex: 1, height: HEIGHT, overflow: "hidden" },
  grid: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#1E293B" },
  line: { position: "absolute", height: 2, borderRadius: 1 },
  dot: { position: "absolute", width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
  dates: { flexDirection: "row", justifyContent: "space-between", marginLeft: 40, marginTop: 4 },
});
