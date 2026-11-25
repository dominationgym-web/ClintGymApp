import React from "react";
import { Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import type { HrZone } from "@/lib/heartRateZones";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

// The five heart rate zones in a list (0237): the trainer's chart shows the
// calories and fat for 30 minutes in each; the client's card shows what each
// zone does in plain words. The zone they're aiming for is outlined.
// With onPick, each zone is a button: tap it to start the speedometer aiming
// for that zone (GRIZZ 2026-11-25: "click on the zone itself to activate").
export default function HrZoneList({
  zones,
  target,
  mode,
  onPick,
}: {
  zones: HrZone[];
  target: HrZone;
  mode: "estimates" | "about";
  onPick?: (z: HrZone) => void;
}) {
  const maxKcal = Math.max(...zones.map((z) => z.kcal30 ?? 0), 1);
  const maxFat = Math.max(...zones.map((z) => z.fat30 ?? 0), 1);
  return (
    <View>
      {zones.map((z) => {
        const on = z.key === target.key;
        return (
          <Pressable
            key={z.key}
            disabled={!onPick}
            onPress={() => onPick?.(z)}
            accessibilityRole={onPick ? "button" : undefined}
            accessibilityLabel={onPick ? `Start the speedometer in ${z.name}` : undefined}
            style={[styles.row, { borderLeftColor: z.colour }, on && { borderColor: z.colour, borderWidth: 2, borderLeftWidth: 5, backgroundColor: themeBg(`${z.colour}1F`) }]}
          >
            <View style={styles.top}>
              <Text style={[styles.name, { color: themeText(z.key === "recover" ? "#CBD5E1" : z.colour) }]}>{z.name}</Text>
              <Text style={styles.bpm}>
                {z.low}–{z.high}
              </Text>
              {onPick && <Text style={[styles.go, { color: themeText(z.key === "recover" ? "#CBD5E1" : z.colour) }]}>▶</Text>}
            </View>
            {mode === "about" ? (
              <Text style={styles.about}>{z.about}</Text>
            ) : z.kcal30 == null ? (
              <Text style={styles.about}>Short bursts only, so no 30-minute numbers.</Text>
            ) : (
              <View style={styles.estimates}>
                <View style={styles.bars}>
                  <View style={[styles.bar, styles.kcalBar, { width: `${(z.kcal30 / maxKcal) * 100}%` }]} />
                  <View style={[styles.bar, styles.fatBar, { width: `${((z.fat30 ?? 0) / maxFat) * 100}%` }]} />
                </View>
                <Text style={styles.numbers}>
                  ~{z.kcal30} kcal · <Text style={styles.fatText}>~{z.fat30} g fat</Text>
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
  row: { backgroundColor: "#1E293B", borderRadius: 12, borderWidth: 1, borderColor: "#334155", borderLeftWidth: 5, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 14, fontWeight: "800", flex: 1 },
  bpm: { color: "#F1F5F9", fontSize: 14, fontWeight: "800" },
  go: { fontSize: 14, fontWeight: "900", marginLeft: 10 },
  about: { color: "#CBD5E1", fontSize: 13, marginTop: 2, lineHeight: 18 },
  estimates: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 10 },
  bars: { flex: 1, gap: 3 },
  bar: { height: 7, borderRadius: 4 },
  kcalBar: { backgroundColor: "#CBD5E1" },
  fatBar: { backgroundColor: "#22C55E" },
  numbers: { color: "#F1F5F9", fontSize: 12, fontWeight: "700", width: 130, textAlign: "right" },
  fatText: { color: "#22C55E" },
});
