import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import HeartRateGauge from "@/components/HeartRateGauge";
import { useHrMini } from "@/lib/heartRateMini";
import { miniWindowSupported, useInMiniWindow } from "@/lib/miniWindow";
import { zoneHint } from "@/lib/heartRateZones";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";

// The small floating speedometer (Android picture-in-picture, GRIZZ
// 2026-11-25): drawn over the whole app while it is the mini window, so the
// header and everything else stay hidden. Big bpm, the dial, and one line:
// HOLD THIS ZONE (green), Speed up (gold) or Ease off (orange).

const GAUGE_W = 330;
const GAUGE_H = 183;

export default function HeartRateMiniWindow() {
  if (!miniWindowSupported()) return null;
  return <MiniWhenShrunk />;
}

function MiniWhenShrunk() {
  const inMini = useInMiniWindow();
  const s = useHrMini();
  const { width, height } = useWindowDimensions();
  if (!inMini || !s) return null;

  const hint = s.hr == null || s.lost ? null : zoneHint(s.target, s.hr);
  const inZone = hint?.kind === "in";
  const colour = hint == null ? "#F1F5F9" : inZone ? "#22C55E" : hint.kind === "below" ? BRAND_GOLD : "#F97316";
  const bg = hint == null ? "#0F172A" : inZone ? "#14532D" : hint.kind === "below" ? "#2A230C" : "#3A1606";
  const k = Math.max(0.2, Math.min((width * 0.94) / GAUGE_W, (height * 0.5) / GAUGE_H));
  const line =
    hint == null
      ? s.lost
        ? "Reconnecting…"
        : "Waiting…"
      : inZone
        ? "HOLD THIS ZONE"
        : hint.kind === "below"
          ? `▲ Speed up · ${hint.beats}`
          : `▼ Ease off · ${hint.beats}`;
  const font = Math.max(12, Math.min(height * 0.13, width * 0.1));

  return (
    <View style={[styles.fill, { backgroundColor: bg }]} pointerEvents="none">
      <HeartRateGauge zones={s.zones} target={s.target} hr={s.lost ? null : s.hr} size={GAUGE_W * k} hideLabels />
      <Text allowFontScaling={false} style={[styles.hr, { color: colour, fontSize: font * 2.1 }]} numberOfLines={1}>
        {s.hr == null || s.lost ? "–" : s.hr}
        <Text allowFontScaling={false} style={[styles.bpm, { fontSize: font * 0.8, color: "#CBD5E1" }]}> bpm</Text>
      </Text>
      <View style={[styles.pill, inZone ? styles.pillIn : { borderColor: colour }]}>
        <Text allowFontScaling={false} style={[styles.line, { fontSize: font, color: inZone ? "#0F172A" : colour }]} numberOfLines={1} adjustsFontSizeToFit>
          {line}
        </Text>
      </View>
    </View>
  );
}

const styles = themedStyles({
  fill: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 10000, elevation: 50, alignItems: "center", justifyContent: "center", padding: 4 },
  hr: { fontWeight: "900", letterSpacing: -1, marginTop: -4 },
  bpm: { fontWeight: "700", letterSpacing: 0 },
  pill: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, maxWidth: "96%" },
  pillIn: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  line: { fontWeight: "900" },
});
