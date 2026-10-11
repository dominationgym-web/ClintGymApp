import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { loadRecoveryCheck, type RecoveryCheck } from "@/lib/recoveryQueries";
import { groupList, lighterSets, recoveryHandled } from "@/lib/recovery";
import { currentSession, sessionMovedToTomorrow, sessionTitle, trainingDays } from "@/lib/programSchedule";
import { displayProgramName } from "@/lib/programs";
import { BRAND_GOLD } from "@/lib/brand";
import type { ClientProgram } from "@/types/database";

const AMBER = "#F59E0B";

// The recovery check on a client's Training tab: shows when today's session
// works muscles the client trained hard yesterday. The trainer can leave it,
// move the session to tomorrow (weekly programs), or use a suggested lighter
// session for today and tweak the sets first.
export default function RecoveryCheckCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const today = todayIso();
  const [check, setCheck] = useState<RecoveryCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    setCheck(await loadRecoveryCheck(clientId, today));
    setLoading(false);
  }, [clientId, today]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !check) return null;
  const { active, clash } = check;
  const assignment = active.assignment;
  const weekly = active.program.kind === "weekly";
  const firstName = clientName.split(" ")[0];
  const session = weekly ? currentSession(assignment, trainingDays(active.exercises)) : null;
  const title = session ? sessionTitle(active.program, session.day) : displayProgramName(active.program);

  const save = async (changes: Partial<ClientProgram>, done: string) => {
    setSaving(true);
    const { error } = await supabase.from("client_programs").update(changes).eq("client_id", clientId);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    setEditing(null);
    await load();
    Alert.alert("Done", done);
  };

  // Already dealt with today: a quiet line, with a way to undo.
  if (recoveryHandled(assignment, today)) {
    const lighter = assignment.recovery_adjustment?.date === today;
    return (
      <View style={[styles.card, styles.handled]}>
        <Text style={styles.handledText}>
          {lighter
            ? `✓ Recovery check: ${firstName} has a lighter session today.`
            : `✓ Recovery check: you left today's session as it is.`}
        </Text>
        <Pressable
          onPress={() => save({ recovery_ignored_on: null, recovery_adjustment: null }, "Today's session is back to normal.")}
          disabled={saving}
          hitSlop={8}
        >
          <Text style={styles.undo}>Undo</Text>
        </Pressable>
      </View>
    );
  }

  const leaveIt = () =>
    save({ recovery_ignored_on: today, recovery_adjustment: null }, `${firstName}'s session stays as it is.`);

  const moveToTomorrow = () => {
    if (!session) return;
    const next = sessionMovedToTomorrow(session, today);
    save(
      { current_day: next.day, due_on: next.dueOn },
      `${title} moved to tomorrow. ${firstName} gets a rest day today.`,
    );
  };

  const useLighter = () => {
    if (!editing) return;
    save(
      { recovery_adjustment: { date: today, sets: editing }, recovery_ignored_on: null },
      `${firstName} will see the lighter session today.`,
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>⚠️ RECOVERY CHECK</Text>
      <Text style={styles.message}>
        {firstName} trained {groupList(clash.groups).toLowerCase()} hard yesterday, and today's session ({title}) works{" "}
        {clash.groups.length === 1 ? "it" : "them"} again. Muscles usually need about 48 hours to recover.
      </Text>

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>Suggested lighter session</Text>
          <Text style={styles.editorHint}>About half the sets for these exercises. Adjust if you like.</Text>
          {clash.rows.map((row) => {
            const sets = editing[row.id] ?? row.sets;
            return (
              <View key={row.id} style={styles.editRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editName}>{row.exercise_name}</Text>
                  <Text style={styles.editDetail}>
                    was {row.sets} sets x {row.reps}
                  </Text>
                </View>
                <Pressable
                  style={styles.stepper}
                  onPress={() => setEditing({ ...editing, [row.id]: Math.max(0, sets - 1) })}
                  accessibilityLabel={`Fewer sets of ${row.exercise_name}`}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Text style={styles.setsValue}>{sets === 0 ? "Skip" : `${sets} sets`}</Text>
                <Pressable
                  style={styles.stepper}
                  onPress={() => setEditing({ ...editing, [row.id]: Math.min(row.sets, sets + 1) })}
                  accessibilityLabel={`More sets of ${row.exercise_name}`}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            );
          })}
          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.primary]} onPress={useLighter} disabled={saving}>
              {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>Use this session</Text>}
            </Pressable>
            <Pressable style={styles.button} onPress={() => setEditing(null)} disabled={saving}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.choices}>
          <Pressable style={[styles.button, styles.primary]} onPress={() => setEditing(lighterSets(clash))} disabled={saving}>
            <Text style={styles.primaryText}>Make today lighter</Text>
          </Pressable>
          {weekly && session ? (
            <Pressable style={styles.button} onPress={moveToTomorrow} disabled={saving}>
              <Text style={styles.buttonText}>Move to tomorrow</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.button} onPress={leaveIt} disabled={saving}>
            <Text style={styles.buttonText}>Leave it (light day or fine)</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: AMBER,
    padding: 14,
    marginTop: 12,
  },
  handled: { flexDirection: "row", alignItems: "center", borderLeftColor: "#22C55E" },
  handledText: { color: "#CBD5E1", fontSize: 14, flex: 1, marginRight: 10 },
  undo: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700" },
  kicker: { color: AMBER, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  message: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginBottom: 12 },
  choices: { gap: 8 },
  button: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    flexGrow: 1,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  primary: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  primaryText: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  editor: { gap: 8 },
  editorTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  editorHint: { color: "#94A3B8", fontSize: 13 },
  editRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#0F172A", borderRadius: 10, padding: 10 },
  editName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  editDetail: { color: "#94A3B8", fontSize: 12 },
  stepper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  setsValue: { color: "#fff", fontSize: 14, fontWeight: "700", width: 62, textAlign: "center" },
  buttons: { flexDirection: "row", gap: 8, marginTop: 4 },
});
