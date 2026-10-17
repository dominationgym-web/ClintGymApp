import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/programSchedule";
import { dayLabel, findRecoveryActivity } from "@/lib/recoveryActivities";
import { loadRecoveryActivities, loadRecoverySuggestions } from "@/lib/recoveryPlanQueries";
import type { RecoverySuggestion } from "@/lib/recoverySuggest";
import type { RecoveryActivityRow } from "@/types/database";

const GREEN = "#4ADE80";

// The coach's view of a client's recovery (0107), on their Training tab: what
// they did in the last two weeks, what's planned, anything planned but not
// done, and what the app is suggesting to them today.
export default function RecoveryCoachCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const today = todayIso();
  const [rows, setRows] = useState<RecoveryActivityRow[] | null>(null);
  const [suggestions, setSuggestions] = useState<RecoverySuggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadRecoveryActivities(clientId, addDays(today, -13), addDays(today, 13)).then(setRows);
    loadRecoverySuggestions(clientId, today, 3).then(setSuggestions);
  }, [clientId, today]);

  if (!rows) return null;
  const first = clientName.split(" ")[0];
  const done = rows.filter((r) => r.done_on);
  const ahead = rows.filter((r) => !r.done_on && r.planned_on >= today);
  const skipped = rows.filter((r) => !r.done_on && r.planned_on < today);
  const list = [...skipped, ...ahead, ...done.slice().reverse()].slice(0, 8);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>🌿 Recovery</Text>
          <Text style={styles.summary}>
            {done.length} done in 2 weeks · {ahead.length} planned{skipped.length ? ` · ${skipped.length} not done` : ""}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <>
          {suggestions.length > 0 && (
            <View style={styles.suggestBox}>
              <Text style={styles.suggestHead}>The app is suggesting to {first} today</Text>
              {suggestions.map((s) => (
                <Text key={s.activity} style={styles.suggest}>
                  • {findRecoveryActivity(s.activity)?.title}: {s.reason}
                </Text>
              ))}
            </View>
          )}
          {list.length === 0 ? (
            <Text style={styles.empty}>
              Nothing planned or done yet. {first} finds Recovery in their menu (☰).
            </Text>
          ) : (
            list.map((r) => {
              const info = findRecoveryActivity(r.activity);
              const missed = !r.done_on && r.planned_on < today;
              return (
                <View key={r.id} style={styles.row}>
                  <Text style={[styles.rowMark, { color: r.done_on ? GREEN : missed ? "#F59E0B" : "#94A3B8" }]}>
                    {r.done_on ? "✓" : missed ? "!" : "📅"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {info?.title ?? r.activity} · {dayLabel(r.done_on ?? r.planned_on, today)}
                      {missed ? " (not done)" : ""}
                    </Text>
                    {r.suggested_reason ? <Text style={styles.rowReason}>Suggested: {r.suggested_reason}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center" },
  title: { color: "#fff", fontWeight: "700", fontSize: 16 },
  summary: { color: GREEN, fontSize: 13, marginTop: 2 },
  chevron: { color: "#94A3B8", fontSize: 14 },
  suggestBox: { backgroundColor: "#0F2A1C", borderRadius: 10, padding: 10, marginTop: 10 },
  suggestHead: { color: GREEN, fontWeight: "700", fontSize: 13, marginBottom: 4 },
  suggest: { color: "#E2E8F0", fontSize: 13, lineHeight: 18, marginTop: 2 },
  empty: { color: "#64748B", fontSize: 13, marginTop: 10 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  rowMark: { width: 18, fontWeight: "800", fontSize: 14, textAlign: "center" },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowReason: { color: "#94A3B8", fontSize: 12, marginTop: 1 },
});
