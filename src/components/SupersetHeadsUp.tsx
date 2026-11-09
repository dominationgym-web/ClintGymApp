import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { BRAND_GOLD } from "@/lib/brand";
import { formatRest } from "@/lib/programs";
import { setupFor, stationsSummary, type SupersetGroup } from "@/lib/superset";
import { themedStyles } from "@/lib/theme";

// Superset heads-up (GRIZZ, 2026-11-09): "before they start, the program
// needs to let the client know that this session is a superset session with
// two stations or three stations, and that way the client can prep themselves."
// Opens when the client taps Start on a workout with supersets. One page per
// superset (no scrolling): the stations in order, what to set up at each, and
// how the rounds go. Tap Next, then I'm set up.

const seenKey = (date: string, title: string) => `superset-heads-up:${date}:${title}`;

/** Whether the heads-up for this workout was already shown today (it opens by itself once). */
export async function headsUpSeen(date: string, title: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(seenKey(date, title))) === "1";
  } catch {
    return false;
  }
}

export async function markHeadsUpSeen(date: string, title: string): Promise<void> {
  try {
    await AsyncStorage.setItem(seenKey(date, title), "1");
  } catch {
    // Not saved: it just shows again next time.
  }
}

export default function SupersetHeadsUp({
  visible,
  title,
  groups,
  onDone,
}: {
  visible: boolean;
  title: string;
  groups: SupersetGroup[];
  onDone: () => void;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (visible) setPage(0);
  }, [visible]);
  if (groups.length === 0) return null;
  const group = groups[Math.min(page, groups.length - 1)];
  const last = page >= groups.length - 1;
  const stations = group.rows.length;
  const kind = stations === 2 ? "Superset" : stations === 3 ? "Tri-set" : "Giant set";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ScrollView>
            <Text style={styles.badge}>⚡ SUPERSET SESSION</Text>
            <Text style={styles.title}>{title}</Text>
            {page === 0 && (
              <Text style={styles.text}>
                Today has {groups.length === 1 ? "1 superset" : `${groups.length} supersets`} ({stationsSummary(groups)}). Set up every station
                before you start, so you can go straight from one to the next.
              </Text>
            )}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {groups.length > 1 ? `${kind} ${page + 1} of ${groups.length}` : kind} · {stations} stations
              </Text>
              {group.rows.map((row, i) => {
                const kit = setupFor(row.exercise_name);
                return (
                  <View key={row.id} style={styles.station}>
                    <Text style={styles.stationNumber}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stationName}>{row.exercise_name}</Text>
                      <Text style={styles.stationReps}>
                        {row.sets} sets x {row.reps}
                      </Text>
                      <Text style={styles.kit}>Set up: {kit.length > 0 ? kit.join(", ") : "nothing, it's bodyweight"}</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={styles.how}>
                Do one set at each station, 1 to {stations}, with no rest in between. Then rest {formatRest(group.restAfter || 90)} and go again
                {group.rounds > 1 ? `: ${group.rounds} rounds` : ""}.
              </Text>
            </View>
            {page === 0 && <Text style={styles.tip}>In a busy gym, keep your stations close together and pick your weights before round 1.</Text>}
            <Pressable
              style={styles.primary}
              onPress={() => (last ? onDone() : setPage((p) => p + 1))}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{last ? "I'm set up, let's go" : "Next superset ›"}</Text>
            </Pressable>
            {page > 0 && (
              <Pressable style={styles.back} onPress={() => setPage((p) => p - 1)} hitSlop={8}>
                <Text style={styles.backText}>‹ Back</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#1E293B", borderRadius: 16, padding: 18, width: "100%", maxWidth: 420, maxHeight: "90%" },
  badge: { color: BRAND_GOLD, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 4 },
  text: { color: "#CBD5E1", fontSize: 14, marginTop: 8, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 12, padding: 12, marginTop: 12 },
  cardTitle: { color: BRAND_GOLD, fontSize: 15, fontWeight: "800" },
  station: { flexDirection: "row", gap: 10, marginTop: 10 },
  stationNumber: {
    color: "#0F172A",
    backgroundColor: BRAND_GOLD,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "800",
    overflow: "hidden",
  },
  stationName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  stationReps: { color: "#94A3B8", fontSize: 13, marginTop: 1 },
  kit: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  how: { color: "#fff", fontSize: 14, lineHeight: 20, marginTop: 12 },
  tip: { color: "#94A3B8", fontSize: 13, marginTop: 10, lineHeight: 18 },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  back: { alignSelf: "center", marginTop: 12 },
  backText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
