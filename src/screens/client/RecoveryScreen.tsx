import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/programSchedule";
import { RECOVERY_ACTIVITIES, dayLabel, findRecoveryActivity, type RecoveryActivityKey } from "@/lib/recoveryActivities";
import { loadRecoveryActivities } from "@/lib/recoveryPlanQueries";
import RecoveryActivityModal, { RECOVERY_GREEN } from "@/components/RecoveryActivityModal";
import RecoverySuggestionCard from "@/components/RecoverySuggestionCard";
import type { RecoveryActivityRow } from "@/types/database";

// The client's Recovery section (GRIZZ, 2026-10-17, 0107): the app's
// suggestion for today, eight recovery activities to read and do or plan,
// and what's planned this week. Planned ones also show on their calendar in
// bright green, and their coach sees them.
export default function RecoveryScreen() {
  const { client } = useAuth();
  const today = todayIso();
  const [rows, setRows] = useState<RecoveryActivityRow[]>([]);
  const [open, setOpen] = useState<RecoveryActivityKey | null>(null);
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    if (!client) return;
    loadRecoveryActivities(client.id, addDays(today, -6), addDays(today, 13)).then(setRows);
  }, [client?.id, today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!client) return null;

  const changed = () => {
    load();
    setVersion((v) => v + 1);
  };
  const planned = rows.filter((r) => !r.done_on && r.planned_on >= today);
  const overdue = rows.filter((r) => !r.done_on && r.planned_on < today);
  const doneThisWeek = rows.filter((r) => r.done_on && r.done_on >= addDays(today, -6));

  const markDone = async (row: RecoveryActivityRow) => {
    const info = findRecoveryActivity(row.activity);
    const { error } = await supabase
      .from("recovery_activities")
      .update({ done_on: today, minutes: row.minutes ?? info?.minutes ?? null })
      .eq("id", row.id);
    if (error) return Alert.alert("Couldn't save", error.message);
    changed();
  };
  const remove = (row: RecoveryActivityRow) =>
    Alert.alert("Remove this?", `${findRecoveryActivity(row.activity)?.title ?? "This activity"} on ${dayLabel(row.planned_on, today)}`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("recovery_activities").delete().eq("id", row.id);
          if (error) return Alert.alert("Couldn't remove", error.message);
          changed();
        },
      },
    ]);

  const planRow = (r: RecoveryActivityRow, late: boolean) => {
    const info = findRecoveryActivity(r.activity);
    return (
      <View key={r.id} style={styles.planRow}>
        <Ionicons name={info?.icon ?? "leaf"} size={18} color={late ? "#F59E0B" : RECOVERY_GREEN} />
        <View style={{ flex: 1 }}>
          <Text style={styles.planTitle}>{info?.title ?? r.activity}</Text>
          <Text style={[styles.planDay, late && { color: "#F59E0B" }]}>{late ? `Planned ${dayLabel(r.planned_on, today)}` : dayLabel(r.planned_on, today)}</Text>
        </View>
        <Pressable style={styles.tick} onPress={() => markDone(r)} hitSlop={6} accessibilityLabel="Mark done">
          <Text style={styles.tickText}>✓ Done</Text>
        </Pressable>
        <Pressable onPress={() => remove(r)} hitSlop={8} accessibilityLabel="Remove">
          <Text style={styles.remove}>✕</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Recovery</Text>
        <View style={styles.taglineRow}>
          <Ionicons name="leaf-outline" size={18} color={RECOVERY_GREEN} />
          <Text style={styles.tagline}>Recover better. Perform better.</Text>
        </View>
        <Text style={styles.intro}>Choose an activity to support your recovery, improve wellbeing and maintain consistency.</Text>
      </View>

      <RecoverySuggestionCard clientId={client.id} limit={2} refreshKey={version} onChanged={changed} showLink={false} />

      <View style={styles.grid}>
        {RECOVERY_ACTIVITIES.map((a) => (
          <Pressable key={a.key} style={styles.tile} onPress={() => setOpen(a.key)} accessibilityRole="button">
            <Ionicons name={a.icon} size={20} color="#15803D" />
            <Text style={styles.tileTitle}>{a.title}</Text>
            <Text style={styles.tileTag}>{a.tagline}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
        <Text style={styles.addText}>+ Add recovery activity</Text>
      </Pressable>
      <View style={styles.noteRow}>
        <Ionicons name="calendar-outline" size={16} color={RECOVERY_GREEN} />
        <Text style={styles.note}>Planned activities appear in your calendar in bright green.</Text>
      </View>

      {(planned.length > 0 || overdue.length > 0) && <Text style={styles.heading}>Planned</Text>}
      {overdue.map((r) => planRow(r, true))}
      {planned.map((r) => planRow(r, false))}

      <Text style={styles.heading}>Done this week: {doneThisWeek.length}</Text>
      {doneThisWeek.length === 0 ? (
        <Text style={styles.empty}>Nothing yet. Pick one above and tap "Done it today".</Text>
      ) : (
        <View style={styles.doneWrap}>
          {doneThisWeek.map((r) => (
            <View key={r.id} style={styles.donePill}>
              <Text style={styles.donePillText}>
                ✓ {findRecoveryActivity(r.activity)?.title ?? r.activity} · {dayLabel(r.done_on!, today)}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.footer}>Your coach can see what you plan and do.</Text>

      <RecoveryActivityModal visible={!!open} clientId={client.id} activity={open} onClose={() => setOpen(null)} onSaved={changed} />
      <RecoveryActivityModal visible={adding} clientId={client.id} activity={null} onClose={() => setAdding(false)} onSaved={changed} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  hero: { backgroundColor: "#0F2A1C", borderRadius: 16, padding: 16, marginBottom: 14 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800" },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  tagline: { color: "#BBF7D0", fontSize: 15 },
  intro: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  tile: { width: "48.5%", backgroundColor: "#fff", borderRadius: 12, padding: 12, minHeight: 104 },
  tileTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800", marginTop: 6 },
  tileTag: { color: "#475569", fontSize: 13, marginTop: 2 },
  addButton: { backgroundColor: RECOVERY_GREEN, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 14 },
  addText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  note: { color: "#BBF7D0", fontSize: 13, flex: 1 },
  heading: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 18, marginBottom: 6 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#1E293B", borderRadius: 10, padding: 10, marginBottom: 6 },
  planTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  planDay: { color: RECOVERY_GREEN, fontSize: 12, marginTop: 1 },
  tick: { borderWidth: 1, borderColor: RECOVERY_GREEN, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
  tickText: { color: RECOVERY_GREEN, fontWeight: "700", fontSize: 13 },
  remove: { color: "#64748B", fontSize: 16, paddingHorizontal: 4 },
  empty: { color: "#64748B", fontSize: 13 },
  doneWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  donePill: { backgroundColor: "#14532D", borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
  donePillText: { color: "#BBF7D0", fontSize: 12, fontWeight: "600" },
  footer: { color: "#64748B", fontSize: 12, marginTop: 16 },
});
