import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/programSchedule";
import {
  RECOVERY_ACTIVITIES,
  RECOVERY_PROGRAMS,
  WHY_RECOVERY,
  dayLabel,
  durationText,
  findRecoveryActivity,
  findRecoveryProgram,
  type RecoveryActivityKey,
  type RecoveryProgramKey,
} from "@/lib/recoveryActivities";
import { loadRecoveryActivities } from "@/lib/recoveryPlanQueries";
import RecoveryActivityModal, { RECOVERY_GREEN } from "@/components/RecoveryActivityModal";
import RecoverySuggestionCard from "@/components/RecoverySuggestionCard";
import type { RecoveryActivityRow } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// The client's Recovery section (GRIZZ, 2026-10-17, 0107/0108): the app's
// suggestion for today, their ready-made recovery program, eight activities
// to read and log or plan, the Daily Log (planned, done, skipped) and why
// recovery matters. Planned ones show on their calendar in bright green, and
// their coach sees all of it.
export default function RecoveryScreen() {
  const { client, refreshProfile } = useAuth();
  const today = todayIso();
  const [rows, setRows] = useState<RecoveryActivityRow[]>([]);
  const [open, setOpen] = useState<RecoveryActivityKey | null>(null);
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState<RecoveryActivityRow | null>(null);
  const [programOpen, setProgramOpen] = useState<RecoveryProgramKey | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(programOpen !== null, () => setProgramOpen(null));
  useStepBack(whyOpen, () => setWhyOpen(false));
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
  const planned = rows.filter((r) => !r.done_on && !r.skipped && r.planned_on >= today);
  const overdue = rows.filter((r) => !r.done_on && !r.skipped && r.planned_on < today);
  const thisWeek = rows.filter((r) => (r.done_on ?? (r.skipped ? r.planned_on : null)) && (r.done_on ?? r.planned_on) >= addDays(today, -6));
  const program = findRecoveryProgram(client.recovery_program);

  const skip = async (row: RecoveryActivityRow) => {
    const { error } = await supabase.from("recovery_activities").update({ skipped: true }).eq("id", row.id);
    if (error) return Alert.alert("Couldn't save", error.message);
    changed();
  };
  const chooseProgram = async (key: RecoveryProgramKey | null) => {
    const { error } = await supabase.from("clients").update({ recovery_program: key }).eq("id", client.id);
    if (error) return Alert.alert("Couldn't save", error.message);
    setProgramOpen(null);
    await refreshProfile();
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
        <Ionicons name={info?.icon ?? "leaf"} size={18} color={themeText(late ? "#F59E0B" : RECOVERY_GREEN)} />
        <View style={{ flex: 1 }}>
          <Text style={styles.planTitle}>{info?.title ?? r.activity}</Text>
          <Text style={[styles.planDay, late && { color: themeText("#F59E0B") }]}>{late ? `Planned ${dayLabel(r.planned_on, today)}` : dayLabel(r.planned_on, today)}</Text>
        </View>
        <Pressable style={styles.tick} onPress={() => setCompleting(r)} hitSlop={6} accessibilityLabel="Mark done">
          <Text style={styles.tickText}>✓ Done</Text>
        </Pressable>
        <Pressable style={styles.skip} onPress={() => skip(r)} hitSlop={6} accessibilityLabel="Skipped">
          <Text style={styles.skipText}>Skip</Text>
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
          <Ionicons name="leaf-outline" size={18} color={themeText(RECOVERY_GREEN)} />
          <Text style={styles.tagline}>Recover better. Perform better.</Text>
        </View>
        <Text style={styles.intro}>Choose an activity to support your recovery, improve wellbeing and maintain consistency.</Text>
      </View>

      <RecoverySuggestionCard clientId={client.id} limit={2} refreshKey={version} onChanged={changed} showLink={false} />

      <Text style={styles.heading}>{program ? "Your recovery program" : "Pick a recovery program"}</Text>
      {program ? (
        <View style={styles.programCard}>
          <Text style={styles.programTitle}>{program.title}</Text>
          {program.steps.map((step) => (
            <Text key={step} style={styles.programStep}>
              • {step}
            </Text>
          ))}
          <Text style={styles.programFocus}>Focus: {program.focus}</Text>
          <Pressable onPress={() => chooseProgram(null)} hitSlop={8}>
            <Text style={styles.change}>Change program</Text>
          </Pressable>
        </View>
      ) : (
        RECOVERY_PROGRAMS.map((p) => (
          <View key={p.key} style={styles.programCard}>
            <Pressable onPress={() => setProgramOpen(programOpen === p.key ? null : p.key)} accessibilityRole="button">
              <Text style={styles.programTitle}>
                {programOpen === p.key ? "▾" : "▸"} {p.title}
              </Text>
              <Text style={styles.programWho}>{p.who}</Text>
            </Pressable>
            {programOpen === p.key && (
              <>
                {p.steps.map((step) => (
                  <Text key={step} style={styles.programStep}>
                    • {step}
                  </Text>
                ))}
                <Text style={styles.programFocus}>Focus: {p.focus}</Text>
                <Pressable style={styles.chooseButton} onPress={() => chooseProgram(p.key)}>
                  <Text style={styles.chooseText}>Choose this program</Text>
                </Pressable>
              </>
            )}
          </View>
        ))
      )}

      <Text style={styles.heading}>Recovery activities</Text>

      <View style={styles.grid}>
        {RECOVERY_ACTIVITIES.map((a) => (
          <Pressable key={a.key} style={styles.tile} onPress={() => setOpen(a.key)} accessibilityRole="button">
            <Ionicons name={a.icon} size={20} color={themeText("#15803D")} />
            <Text style={styles.tileTitle}>{a.title}</Text>
            <Text style={styles.tileTag}>{a.tagline}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
        <Text style={styles.addText}>+ Add recovery activity</Text>
      </Pressable>
      <View style={styles.noteRow}>
        <Ionicons name="calendar-outline" size={16} color={themeText(RECOVERY_GREEN)} />
        <Text style={styles.note}>Planned activities appear in your calendar in bright green.</Text>
      </View>

      <Text style={styles.heading}>Daily Log</Text>
      {overdue.map((r) => planRow(r, true))}
      {planned.map((r) => planRow(r, false))}
      {thisWeek.length === 0 && planned.length === 0 && overdue.length === 0 ? (
        <Text style={styles.empty}>Nothing yet. Tap an activity above to log it or plan it.</Text>
      ) : (
        thisWeek.map((r) => (
          <View key={r.id} style={styles.logRow}>
            <Text style={[styles.logMark, r.skipped && { color: themeText("#94A3B8") }]}>{r.skipped ? "–" : "✓"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.logTitle}>
                {findRecoveryActivity(r.activity)?.title ?? r.activity} · {dayLabel(r.done_on ?? r.planned_on, today)}
                {r.skipped ? " · skipped" : r.minutes ? ` · ${durationText(r.minutes)}` : ""}
              </Text>
              {r.notes ? <Text style={styles.logNote}>“{r.notes}”</Text> : null}
            </View>
          </View>
        ))
      )}

      <Pressable style={styles.whyHead} onPress={() => setWhyOpen(!whyOpen)} accessibilityRole="button">
        <Text style={styles.whyTitle}>{whyOpen ? "▾" : "▸"} Why recovery matters</Text>
      </Pressable>
      {whyOpen &&
        WHY_RECOVERY.map((line) => (
          <Text key={line} style={styles.whyText}>
            {line}
          </Text>
        ))}
      <Text style={styles.footer}>Your coach can see what you plan and do.</Text>

      <RecoveryActivityModal visible={!!open} clientId={client.id} activity={open} onClose={() => setOpen(null)} onSaved={changed} />
      <RecoveryActivityModal visible={adding} clientId={client.id} activity={null} onClose={() => setAdding(false)} onSaved={changed} />
      <RecoveryActivityModal
        visible={!!completing}
        clientId={client.id}
        activity={null}
        completing={completing}
        onClose={() => setCompleting(null)}
        onSaved={changed}
      />
    </ScrollView>
  );
}

const styles = themedStyles({
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
  skip: { borderWidth: 1, borderColor: "#475569", borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
  skipText: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  empty: { color: "#64748B", fontSize: 13 },
  logRow: { flexDirection: "row", gap: 8, paddingVertical: 6 },
  logMark: { color: RECOVERY_GREEN, fontWeight: "800", width: 16, textAlign: "center" },
  logTitle: { color: "#E2E8F0", fontSize: 14 },
  logNote: { color: "#94A3B8", fontSize: 12, fontStyle: "italic", marginTop: 1 },
  programCard: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8 },
  programTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  programWho: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  programStep: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginTop: 4 },
  programFocus: { color: RECOVERY_GREEN, fontSize: 13, marginTop: 8 },
  change: { color: "#64748B", fontSize: 12, marginTop: 8, textAlign: "right" },
  chooseButton: { backgroundColor: RECOVERY_GREEN, borderRadius: 10, padding: 10, alignItems: "center", marginTop: 10 },
  chooseText: { color: "#0F172A", fontWeight: "800" },
  whyHead: { marginTop: 18, paddingVertical: 8 },
  whyTitle: { color: RECOVERY_GREEN, fontWeight: "700", fontSize: 15 },
  whyText: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginTop: 6 },
  footer: { color: "#64748B", fontSize: 12, marginTop: 16 },
});
