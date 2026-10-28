import React from "react";
import { Text, View } from "react-native";
import { SESSION_COLORS, SESSION_LABELS, STAR_GOLD } from "@/lib/workoutSessions";
import { weekdayOf } from "@/lib/programSchedule";
import type { WorkoutSession } from "@/types/database";
import { themeBg, themeBorder, themedStyles } from "@/lib/theme";

// How one day's workout went (0076): the coloured result, the client's reason
// when they didn't finish, and each exercise they pushed up, highlighted gold.
export default function WorkoutSessionResult({ session }: { session: WorkoutSession }) {
  const color = SESSION_COLORS[session.status];
  return (
    <View style={[styles.box, { borderColor: themeBorder(color) }]}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: themeBg(color) }]} />
        <Text style={styles.title}>
          {SESSION_LABELS[session.status]}
          {session.status !== "missed" ? ` · ${session.sets_done}/${session.sets_planned} sets` : ""}
          {session.star ? "  ⭐" : ""}
        </Text>
      </View>
      {session.title ? <Text style={styles.meta}>{session.title}</Text> : null}
      {session.in_person ? <Text style={styles.meta}>🤝 In person, live session with the coach</Text> : null}
      {session.makeup_for ? <Text style={styles.meta}>🔁 Caught up {weekdayOf(session.makeup_for)}'s missed workout</Text> : null}
      {session.reason ? <Text style={styles.reason}>Why: {session.reason}</Text> : null}
      {session.improvements.map((i) => (
        <View key={i.exercise} style={styles.improvement}>
          <Text style={styles.improvementText}>
            ⭐ {i.exercise}: {i.before} → {i.after}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles({
  box: { borderWidth: 1.5, borderRadius: 10, padding: 10, marginTop: 8, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { color: "#fff", fontWeight: "700", fontSize: 14 },
  meta: { color: "#94A3B8", fontSize: 12 },
  reason: { color: "#E2E8F0", fontSize: 13 },
  improvement: { backgroundColor: "#3A3110", borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  improvementText: { color: STAR_GOLD, fontWeight: "700", fontSize: 13 },
});
