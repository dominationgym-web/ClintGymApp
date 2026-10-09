import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { loadAvailablePrograms, loadClientProgram, type ActiveProgram } from "@/lib/programQueries";
import ProgramSummary from "@/components/ProgramSummary";
import { currentSession, sessionTitle, trainingDays, weekdayOf } from "@/lib/programSchedule";
import type { Program } from "@/types/database";

// For a weekly program: which session the client is on, and when they last finished one.
function progressLine(active: ActiveProgram): string | null {
  if (active.program.kind !== "weekly") return null;
  const session = currentSession(active.assignment, trainingDays(active.exercises));
  if (!session) return null;
  const next = `Up next: ${sessionTitle(active.program, session.day)}, due ${weekdayOf(session.dueOn)} ${session.dueOn}`;
  const last = active.assignment.last_completed_at
    ? ` · last workout completed ${new Date(active.assignment.last_completed_at).toLocaleDateString()}`
    : " · no workouts completed yet";
  return next + last;
}

// On the trainer's view of a client: the program they're on, and one tap to
// switch them onto another (0035). The client sees it on their Exercises tab.
export default function ClientProgramPicker({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [active, setActive] = useState<ActiveProgram | null>(null);
  const [choices, setChoices] = useState<Program[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [current, available] = await Promise.all([loadClientProgram(clientId), loadAvailablePrograms()]);
    setActive(current);
    setChoices(available);
  }, [clientId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const activate = async (program: Program) => {
    setBusy(true);
    const { error } = await supabase
      .from("client_programs")
      .upsert({
        client_id: clientId,
        program_id: program.id,
        started_on: todayIso(),
        assigned_at: new Date().toISOString(),
        // A new program starts from its first session (0037).
        current_day: null,
        due_on: null,
        last_completed_at: null,
      });
    if (error) Alert.alert("Couldn't switch program", error.message);
    setChoosing(false);
    await load();
    setBusy(false);
  };

  const stop = () =>
    Alert.alert(`Take ${clientName} off this program?`, "Their training log stays as it is.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Take off",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const { error } = await supabase.from("client_programs").delete().eq("client_id", clientId);
          if (error) Alert.alert("Couldn't update", error.message);
          await load();
          setBusy(false);
        },
      },
    ]);

  if (loading) return <ActivityIndicator color="#22C55E" style={{ marginVertical: 12 }} />;

  return (
    <View>
      <Text style={styles.heading}>Program</Text>
      {active ? (
        <View style={styles.card}>
          <Text style={styles.name}>{active.program.name}</Text>
          <Text style={styles.helper}>Since {active.assignment.started_on}</Text>
          {progressLine(active) && <Text style={styles.progress}>{progressLine(active)}</Text>}
          <ProgramSummary program={active.program} exercises={active.exercises} />
        </View>
      ) : (
        <Text style={styles.helper}>Not on a program yet.</Text>
      )}

      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={() => setChoosing((c) => !c)} disabled={busy}>
          <Text style={styles.buttonText}>{choosing ? "Cancel" : active ? "Change program" : "Choose a program"}</Text>
        </Pressable>
        {active && !choosing && (
          <Pressable style={styles.secondaryButton} onPress={stop} disabled={busy}>
            <Text style={styles.secondaryText}>Take off</Text>
          </Pressable>
        )}
      </View>

      {choosing &&
        choices.map((p) => {
          const current = p.id === active?.program.id;
          return (
            <Pressable
              key={p.id}
              style={[styles.choice, current && { borderColor: BRAND_GOLD }]}
              onPress={() => !current && activate(p)}
              disabled={busy || current}
            >
              <Text style={styles.name}>
                {p.name}
                {current ? "  (current)" : ""}
              </Text>
              {p.description && <Text style={styles.helper}>{p.description}</Text>}
              {!current && <Text style={styles.activate}>Tap to switch on</Text>}
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: "#94A3B8", fontWeight: "600", marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: BRAND_GOLD },
  name: { color: "#fff", fontWeight: "700", fontSize: 15 },
  helper: { color: "#64748B", fontSize: 13, marginTop: 2 },
  progress: { color: BRAND_GOLD, fontSize: 13, marginTop: 4, fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  button: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "800" },
  secondaryButton: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, paddingHorizontal: 16, alignItems: "center" },
  secondaryText: { color: "#F87171", fontWeight: "700" },
  choice: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1.5, borderColor: "transparent" },
  activate: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginTop: 6 },
});
