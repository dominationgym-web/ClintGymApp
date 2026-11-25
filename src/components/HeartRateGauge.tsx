import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import type { HrZone } from "@/lib/heartRateZones";
import { themeText, themedStyles } from "@/lib/theme";
import { reduceMotion } from "@/lib/motion";

// The speedometer for live heart rate (GRIZZ, 2026-11-25, picked from five
// designs): coloured zones round a half circle, the target zone marked with
// gold edges, a needle that glides with each reading, and the target zone
// glowing green once they're in it. Drawn with plain views (ticks round the
// arc), so it needs no drawing library.

const TICKS = 61;

const FULL = 330;
const FULL_HEIGHT = FULL / 2 + 18;

/** Smaller than full size, the whole dial is drawn full size and shrunk, so it keeps its look. */
export default function HeartRateGauge(props: {
  zones: HrZone[];
  target: HrZone;
  hr: number | null;
  size?: number;
  hideLabels?: boolean;
}) {
  const size = props.size ?? FULL;
  if (size >= FULL) return <Dial {...props} />;
  const k = size / FULL;
  return (
    <View style={{ width: FULL * k, height: FULL_HEIGHT * k }}>
      <View style={{ position: "absolute", width: FULL, height: FULL_HEIGHT, left: (FULL * k - FULL) / 2, top: (FULL_HEIGHT * k - FULL_HEIGHT) / 2, transform: [{ scale: k }] }}>
        <Dial {...props} size={FULL} hideLabels={props.hideLabels || k < 0.62} />
      </View>
    </View>
  );
}

function Dial({
  zones,
  target,
  hr,
  size = FULL,
  hideLabels = false,
}: {
  zones: HrZone[];
  target: HrZone;
  hr: number | null;
  size?: number;
  /** The mini floating window is too small for the zone names. */
  hideLabels?: boolean;
}) {
  const min = zones[0].low - 10;
  const max = zones[zones.length - 1].high;
  const radius = size / 2 - 34;
  const cx = size / 2;
  const cy = radius + 34;
  const inZone = hr != null && hr >= target.low && hr <= target.high;
  const angleOf = (bpm: number) => -90 + (180 * (Math.min(max, Math.max(min, bpm)) - min)) / (max - min);

  const needle = useRef(new Animated.Value(angleOf(hr ?? min))).current;
  useEffect(() => {
    const to = angleOf(hr ?? min);
    if (reduceMotion()) needle.setValue(to);
    else Animated.timing(needle, { toValue: to, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hr, min, max]);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICKS }, (_, i) => {
        const bpm = min + ((max - min) * i) / (TICKS - 1);
        const zone = zones.find((z) => bpm >= z.low && bpm <= z.high) ?? (bpm < zones[0].low ? null : zones[zones.length - 1]);
        const isTarget = zone?.key === target.key;
        return { i, deg: angleOf(bpm), colour: zone?.colour ?? "#334155", isTarget };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zones, target.key, min, max],
  );

  const box = { position: "absolute" as const, left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2 };
  const label = (z: HrZone) => {
    const deg = angleOf((z.low + z.high) / 2);
    const rad = ((deg - 90) * Math.PI) / 180;
    const r = radius + 22;
    return { left: cx + r * Math.cos(rad) - 40, top: cy + r * Math.sin(rad) - 8 };
  };

  return (
    <View style={{ width: size, height: cy + 18 }} accessibilityLabel={hr == null ? "Waiting for heart rate" : `Heart rate ${hr}`}>
      {ticks.map((t) => (
        <View key={t.i} style={[box, { transform: [{ rotate: `${t.deg}deg` }] }]} pointerEvents="none">
          <View
            style={[
              styles.tick,
              {
                height: t.isTarget ? 30 : 22,
                marginTop: t.isTarget ? -4 : 0,
                backgroundColor: t.colour,
                opacity: t.isTarget ? (inZone ? 1 : 0.6) : 0.75,
                width: t.isTarget ? 7 : 5,
              },
              t.isTarget && inZone && styles.glow,
            ]}
          />
        </View>
      ))}
      {[target.low, target.high].map((edge) => (
        <View key={edge} style={[box, { transform: [{ rotate: `${angleOf(edge)}deg` }] }]} pointerEvents="none">
          <View style={styles.edge} />
        </View>
      ))}
      {!hideLabels && zones.map((z) => (
        <Text key={z.key} maxFontSizeMultiplier={1} style={[styles.label, label(z), z.key === target.key && { color: themeText("#22C55E") }]} numberOfLines={1}>
          {z.short}
        </Text>
      ))}
      <Animated.View
        style={[box, { transform: [{ rotate: needle.interpolate({ inputRange: [-90, 90], outputRange: ["-90deg", "90deg"] }) }] }]}
        pointerEvents="none"
      >
        <View style={[styles.needle, { height: radius - 18, backgroundColor: inZone ? "#22C55E" : themeText("#F1F5F9") }]} />
      </Animated.View>
      <View style={[styles.hub, { left: cx - 13, top: cy - 13 }]} />
    </View>
  );
}

const styles = themedStyles({
  tick: { alignSelf: "center", borderRadius: 3 },
  glow: { shadowColor: "#22C55E", shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  edge: { alignSelf: "center", width: 3, height: 44, marginTop: -12, borderRadius: 2, backgroundColor: BRAND_GOLD },
  label: { position: "absolute", width: 80, textAlign: "center", color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  needle: { alignSelf: "center", width: 6, marginTop: 18, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  hub: { position: "absolute", width: 26, height: 26, borderRadius: 13, backgroundColor: BRAND_GOLD },
});
