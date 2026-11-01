import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { loadClientProgram, type ActiveProgram } from "@/lib/programQueries";
import ProgramSummary from "@/components/ProgramSummary";
import { currentSession, sessionTitle, slotOf, trainingDays, weekdayOf } from "@/lib/programSchedule";
import type { ExtraCardio, ProgramExercise } from "@/types/database";
import { CARDIO_ALL, CARDIO_OPTIONS, cardioDuration, cardioLabel } from "@/lib/programs";
import CardioDurationPicker from "@/components/CardioDurationPicker";
import ExerciseChangeModal from "@/components/ExerciseChangeModal";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { StabilityArea } from "@/lib/stability";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

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

// On the trainer's view of a client: an old-style program they're still on
// (0035), with its extra cardio. New programs go on the calendar only (review
// 2026-10-18: one way to give a program), so there's no picker here any more:
// tapping a day on the calendar takes them off this one.
export default function ClientProgramPicker({
  clientId,
  clientName,
  trainingPlace,
  injuries = [],
}: {
  clientId: string;
  clientName: string;
  trainingPlace: ExercisePlace;
  injuries?: StabilityArea[];
}) {
  const [active, setActive] = useState<ActiveProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showWorkouts, setShowWorkouts] = useState(false);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(showWorkouts, () => setShowWorkouts(false));
  const [changing, setChanging] = useState<ProgramExercise | null>(null);

  const load = useCallback(async () => {
    setActive(await loadClientProgram(clientId));
  }, [clientId]);

  // Reload on coming back, so a program just built shows up in the popup.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  // Cardio the trainer adds for this client on top of any program (0054),
  // ready-made ones included. Positions count exercises, so they fit every day.
  const extras: ExtraCardio[] = active?.assignment.extra_cardio ?? [];
  const mostExercises = active
    ? Math.max(0, ...trainingDays(active.exercises).map(
        (day) => active.exercises.filter((e) => slotOf(e) === day && e.kind !== "cardio").length,
      ))
    : 0;
  const [addingCardio, setAddingCardio] = useState(false);
  const [cardioAfter, setCardioAfter] = useState<number | null>(null);
  const [cardioName, setCardioName] = useState(CARDIO_OPTIONS[0]);
  const [cardioReps, setCardioReps] = useState(cardioDuration(30));

  const saveExtras = async (next: ExtraCardio[]) => {
    setBusy(true);
    const { error } = await supabase.from("client_programs").update({ extra_cardio: next }).eq("client_id", clientId);
    if (error) Alert.alert("Couldn't save cardio", error.message);
    await load();
    setBusy(false);
  };

  const addCardio = async () => {
    await saveExtras([...extras, { after: cardioAfter, name: cardioName, reps: cardioReps }]);
    setAddingCardio(false);
  };

  const positionLabel = (after: number | null) => (after == null ? "At the end" : `After exercise ${after}`);

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

  if (loading) return <ActivityIndicator color={themeText("#22C55E")} style={{ marginVertical: 12 }} />;

  return (
    <View>
      <Text style={styles.heading}>Old-style program</Text>
      {active ? (
        <View style={styles.card}>
          <Text style={styles.name}>{active.program.name}</Text>
          <Text style={styles.helper}>Since {active.assignment.started_on}</Text>
          {progressLine(active) && <Text style={styles.progress}>{progressLine(active)}</Text>}
          <Pressable onPress={() => setShowWorkouts((v) => !v)} hitSlop={6}>
            <Text style={styles.toggle}>{showWorkouts ? "Hide workouts ▴" : "Show workouts ▾"}</Text>
          </Pressable>
          {showWorkouts && (
            <ProgramSummary program={active.program} exercises={active.exercises} onPressExercise={setChanging} />
          )}
        </View>
      ) : (
        <Text style={styles.helper}>Not on an old-style program. Programs now go on the calendar: tap a day at the top of this tab.</Text>
      )}

      {active && (
        <View style={styles.cardioBox}>
          <Text style={styles.cardioHeading}>🚴 Extra cardio for {clientName}</Text>
          <Text style={styles.helper}>Added to every workout in this program, ready-made ones too.</Text>
          {extras.map((extra, i) => (
            <View key={i} style={styles.extraRow}>
              <Text style={styles.extraText}>
                {positionLabel(extra.after)}: {cardioLabel({ exercise_name: extra.name, reps: extra.reps })}
              </Text>
              <Pressable onPress={() => saveExtras(extras.filter((_, j) => j !== i))} disabled={busy} hitSlop={8}>
                <Text style={styles.secondaryText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          {addingCardio ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Where</Text>
              <View style={styles.chips}>
                {[...Array.from({ length: Math.max(mostExercises - 1, 0) }, (_, i) => i + 1), null].map((after) => (
                  <Chip
                    key={String(after)}
                    label={positionLabel(after)}
                    on={cardioAfter === after}
                    onPress={() => {
                      setCardioAfter(after);
                      if (after != null && cardioName === CARDIO_ALL) setCardioName(CARDIO_OPTIONS[0]);
                    }}
                  />
                ))}
              </View>
              <Text style={styles.label}>Machine</Text>
              <View style={styles.chips}>
                {[...CARDIO_OPTIONS, ...(cardioAfter == null ? [CARDIO_ALL] : [])].map((name) => (
                  <Chip key={name} label={name} on={cardioName === name} onPress={() => setCardioName(name)} />
                ))}
              </View>
              <Text style={styles.label}>How long</Text>
              <CardioDurationPicker value={cardioReps} onChange={setCardioReps} />
              <View style={styles.buttonRow}>
                <Pressable style={styles.button} onPress={addCardio} disabled={busy}>
                  <Text style={styles.buttonText}>Add</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setAddingCardio(false)} disabled={busy}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.addCardio} onPress={() => setAddingCardio(true)} disabled={busy}>
              <Text style={styles.addCardioText}>+ Add cardio</Text>
            </Pressable>
          )}
        </View>
      )}

      {active && (
        <View style={styles.buttonRow}>
          <Text style={[styles.helper, { flex: 1 }]}>To change it, tap a day on the calendar and pick a new program.</Text>
          <Pressable style={styles.secondaryButton} onPress={stop} disabled={busy}>
            <Text style={styles.secondaryText}>Take off</Text>
          </Pressable>
        </View>
      )}

      <ExerciseChangeModal
        row={changing}
        clientId={clientId}
        clientName={clientName}
        trainingPlace={trainingPlace}
        injuries={injuries}
        onClose={() => setChanging(null)}
        onSaved={() => {
          setChanging(null);
          load();
        }}
      />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles({
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
  cardioBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 10 },
  cardioHeading: { color: "#fff", fontWeight: "700", fontSize: 15 },
  extraRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8 },
  extraText: { color: "#E2E8F0", flex: 1 },
  label: { color: "#94A3B8", fontWeight: "600", marginTop: 8, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#0F172A" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontSize: 13 },
  chipTextOn: { color: "#0F172A", fontWeight: "700" },
  cancelText: { color: "#CBD5E1", fontWeight: "700" },
  addCardio: { marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: BRAND_GOLD, padding: 10, alignItems: "center" },
  addCardioText: { color: BRAND_GOLD, fontWeight: "700" },
  toggle: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginTop: 8 },
  activate: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginTop: 6 },
});
