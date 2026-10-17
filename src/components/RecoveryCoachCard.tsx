import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/programSchedule";
import { RECOVERY_PROGRAMS, dayLabel, durationText, findRecoveryActivity, type RecoveryProgramKey } from "@/lib/recoveryActivities";
import { loadRecoveryActivities, loadRecoverySuggestions } from "@/lib/recoveryPlanQueries";
import type { RecoverySuggestion } from "@/lib/recoverySuggest";
import type { RecoveryActivityRow } from "@/types/database";

const GREEN = "#4ADE80";

// The coach's view of a client's recovery (0107/0108), on their Training tab:
// their recovery program (the coach can pick it), what they did in the last
// two weeks with how long and their notes, what's planned, what they skipped,
// and what the app is suggesting to them today.
export default function RecoveryCoachCard({
  clientId,
  clientName,
  program,
  onProgramChanged,
}: {
  clientId: string;
  clientName: string;
  program: RecoveryProgramKey | null | undefined;
  onProgramChanged: (next: RecoveryProgramKey | null) => void;
}) {
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
  const ahead = rows.filter((r) => !r.done_on && !r.skipped && r.planned_on >= today);
  const skipped = rows.filter((r) => !r.done_on && (r.skipped || r.planned_on < today));
  const pickProgram = async (next: RecoveryProgramKey) => {
    const value = next === program ? null : next;
    const { error } = await supabase.from("clients").update({ recovery_program: value }).eq("id", clientId);
    if (error) return Alert.alert("Couldn't save", error.message);
    onProgramChanged(value);
  };
  const list = [...skipped, ...ahead, ...done.slice().reverse()].slice(0, 8);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>🌿 Recovery</Text>
          <Text style={styles.summary}>
            {done.length} done in 2 weeks · {ahead.length} planned{skipped.length ? ` · ${skipped.length} skipped` : ""}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={styles.label}>Recovery program</Text>
          <View style={styles.chips}>
            {RECOVERY_PROGRAMS.map((p) => (
              <Pressable key={p.key} style={[styles.chip, program === p.key && styles.chipOn]} onPress={() => pickProgram(p.key)}>
                <Text style={[styles.chipText, program === p.key && styles.chipTextOn]}>{p.title.replace(" Recovery", "")}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            {program ? `${first} sees this program on their Recovery page.` : `${first} hasn't picked one yet. Tap one to choose it for them.`}
          </Text>
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
              const missed = !r.done_on && (r.skipped || r.planned_on < today);
              return (
                <View key={r.id} style={styles.row}>
                  <Text style={[styles.rowMark, { color: r.done_on ? GREEN : missed ? "#F59E0B" : "#94A3B8" }]}>
                    {r.done_on ? "✓" : missed ? "!" : "📅"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {info?.title ?? r.activity} · {dayLabel(r.done_on ?? r.planned_on, today)}
                      {r.done_on && r.minutes ? ` · ${durationText(r.minutes)}` : ""}
                      {missed ? (r.skipped ? " (skipped)" : " (not done)") : ""}
                    </Text>
                    {r.notes ? <Text style={styles.rowNote}>“{r.notes}”</Text> : null}
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
  rowNote: { color: "#CBD5E1", fontSize: 12, fontStyle: "italic", marginTop: 1 },
  label: { color: "#94A3B8", fontWeight: "600", fontSize: 13, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: "row", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10 },
  chipOn: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  hint: { color: "#64748B", fontSize: 12, marginTop: 6 },
});
