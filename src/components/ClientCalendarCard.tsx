import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso } from "@/lib/dates";
import { loadAvailablePrograms, loadCalendarWorkouts, loadExerciseChanges, loadProgramExercises } from "@/lib/programQueries";
import { PROGRAM_FAMILIES, programFamily, WEEKDAY_NAMES, type ProgramFamily } from "@/lib/programs";
import {
  monthLabel,
  monthOf,
  monthRange,
  shortWorkoutName,
  usedInBatch,
  usedWorkoutIds,
  type CalendarMonth,
} from "@/lib/trainingCalendar";
import TrainingCalendar from "@/components/TrainingCalendar";
import WorkoutSessionResult from "@/components/WorkoutSessionResult";
import { useWorkoutSessions } from "@/components/useWorkoutSessions";
import ProgramSummary from "@/components/ProgramSummary";
import ExerciseChangeModal from "@/components/ExerciseChangeModal";
import { applyExerciseChanges } from "@/lib/exerciseChanges";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { ClientCalendarWorkout, ClientWorkoutReset, Program, ProgramExercise } from "@/types/database";

const RED = "#EF4444";

function dayHeading(date: string): string {
  const d = parseIsoDate(date);
  return `${WEEKDAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${monthLabel(monthOf(date))}`;
}

// On the trainer's view of a client (Training tab): their month as a
// calendar (0069). Tap a day to put a workout on it. Workouts already used
// for this client show "Used" in red until the whole batch is used or the
// trainer taps Reset for that batch, so the same workout isn't repeated by
// accident.
export default function ClientCalendarCard({
  clientId,
  clientName,
  trainingPlace,
  resetNotice = null,
}: {
  clientId: string;
  clientName: string;
  trainingPlace: ExercisePlace;
  // Set when the client is on the Health Reset (resetNotice in src/lib/resetProgram.ts).
  resetNotice?: string | null;
}) {
  const today = todayIso();
  // The Reset warning pops up once per visit, then stays as a banner in the picker.
  const resetWarned = useRef(false);
  const [month, setMonth] = useState<CalendarMonth>(monthOf(today));
  const [monthEntries, setMonthEntries] = useState<ClientCalendarWorkout[]>([]);
  const [allEntries, setAllEntries] = useState<Pick<ClientCalendarWorkout, "program_id" | "created_at">[]>([]);
  const [resets, setResets] = useState<ClientWorkoutReset[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<ProgramExercise[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [changing, setChanging] = useState<ProgramExercise | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMonth = useCallback(async () => {
    const { from, to } = monthRange(month);
    setMonthEntries(await loadCalendarWorkouts(clientId, from, to));
  }, [clientId, month]);

  const loadUsed = useCallback(async () => {
    const [{ data: entries }, { data: batchResets }] = await Promise.all([
      supabase.from("client_calendar_workouts").select("program_id, created_at").eq("client_id", clientId),
      supabase.from("client_workout_resets").select("*").eq("client_id", clientId),
    ]);
    setAllEntries(entries ?? []);
    setResets(batchResets ?? []);
  }, [clientId]);

  useEffect(() => {
    Promise.all([loadUsed(), loadAvailablePrograms().then(setPrograms)]).finally(() => setLoading(false));
  }, [loadUsed]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  // Only single-session workouts fit on a day.
  const workouts = programs.filter((p) => p.kind === "quick");
  const byId = new Map(programs.map((p) => [p.id, p]));
  const entryOn = (date: string) => monthEntries.find((e) => e.workout_date === date) ?? null;
  const labels: Record<string, string> = {};
  for (const e of monthEntries) {
    const p = byId.get(e.program_id);
    if (p) labels[e.workout_date] = shortWorkoutName(p.name);
  }
  const selectedEntry = selected ? entryOn(selected) : null;
  const selectedProgram = selectedEntry ? byId.get(selectedEntry.program_id) ?? null : null;

  // The day's workout with this client's exercise changes in place (0070).
  const loadSelectedExercises = useCallback(async () => {
    setSelectedExercises([]);
    if (!selectedProgram) return;
    const [{ data }, changes] = await Promise.all([loadProgramExercises(selectedProgram.id), loadExerciseChanges(clientId)]);
    setSelectedExercises(applyExerciseChanges(data ?? [], changes));
  }, [selectedProgram?.id, clientId]);

  useEffect(() => {
    loadSelectedExercises();
  }, [loadSelectedExercises]);

  // Dots and gold stars for how each day's workout went (0076).
  const range = monthRange(month);
  const { byDate: sessions, marks } = useWorkoutSessions(clientId, range.from, range.to);

  const pressDay = (date: string) => {
    setSelected(date);
    // A day the client already trained shows how it went instead of the picker.
    if (!entryOn(date) && !sessions[date]) openPicker(date);
  };

  const openPicker = (date: string) => {
    if (resetNotice && !resetWarned.current) {
      resetWarned.current = true;
      Alert.alert("On the Health Reset", `${resetNotice} Do you still want to add a workout?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Add a workout", onPress: () => setPicking(date) },
      ]);
      return;
    }
    setPicking(date);
  };

  const choose = async (program: Program) => {
    if (!picking) return;
    setBusy(true);
    const { error } = await supabase.from("client_calendar_workouts").upsert(
      // created_at is when it was (re)planned, which is what "used" counts from.
      { client_id: clientId, workout_date: picking, program_id: program.id, created_at: new Date().toISOString() },
      { onConflict: "client_id,workout_date" },
    );
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    setSelected(picking);
    setPicking(null);
    await Promise.all([loadMonth(), loadUsed()]);
  };

  const clearDay = (entry: ClientCalendarWorkout) => {
    Alert.alert("Take this workout off the calendar?", `${clientName} won't see it on ${dayHeading(entry.workout_date)}.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Take it off",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("client_calendar_workouts").delete().eq("id", entry.id);
          if (error) {
            Alert.alert("Couldn't remove it", error.message);
            return;
          }
          await Promise.all([loadMonth(), loadUsed()]);
        },
      },
    ]);
  };

  const resetBatch = (batch: ProgramFamily, title: string) => {
    Alert.alert(`Reset ${title}?`, `Every workout in this batch becomes available for ${clientName} again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        onPress: async () => {
          const { error } = await supabase
            .from("client_workout_resets")
            .upsert({ client_id: clientId, batch, reset_at: new Date().toISOString() }, { onConflict: "client_id,batch" });
          if (error) {
            Alert.alert("Couldn't reset", error.message);
            return;
          }
          await loadUsed();
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📅 Training calendar</Text>
      <Text style={styles.helper}>
        Tap a day to give {clientName} a workout. On those days it replaces their program. Used workouts show in red so you
        don't repeat one by accident. A green dot means they finished the workout, orange partly, red couldn't train, and ⭐
        means they pushed their weights up. Tap the day to see.
      </Text>
      {loading ? (
        <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 16 }} />
      ) : (
        <TrainingCalendar
          month={month}
          onChangeMonth={setMonth}
          labels={labels}
          today={today}
          selected={selected}
          onPressDay={pressDay}
          marks={marks}
        />
      )}
      {selected && sessions[selected] && !(selectedEntry && selectedProgram) && (
        <View style={styles.dayBox}>
          <Text style={styles.dayTitle}>{dayHeading(selected)}</Text>
          <WorkoutSessionResult session={sessions[selected]} />
        </View>
      )}
      {selectedEntry && selectedProgram && (
        <View style={styles.dayBox}>
          <Text style={styles.dayTitle}>{dayHeading(selectedEntry.workout_date)}</Text>
          <Text style={styles.dayWorkout}>{selectedProgram.name}</Text>
          {sessions[selectedEntry.workout_date] && <WorkoutSessionResult session={sessions[selectedEntry.workout_date]} />}
          <ProgramSummary program={selectedProgram} exercises={selectedExercises} onPressExercise={setChanging} />
          <View style={styles.dayButtons}>
            <Pressable style={styles.changeButton} onPress={() => openPicker(selectedEntry.workout_date)}>
              <Text style={styles.changeText}>Change workout</Text>
            </Pressable>
            <Pressable style={styles.clearButton} onPress={() => clearDay(selectedEntry)}>
              <Text style={styles.clearText}>Take it off</Text>
            </Pressable>
          </View>
        </View>
      )}
      <WorkoutPicker
        date={picking}
        workouts={workouts}
        entries={allEntries}
        resets={resets}
        currentId={picking ? entryOn(picking)?.program_id ?? null : null}
        clientName={clientName}
        trainingPlace={trainingPlace}
        resetNotice={resetNotice}
        busy={busy}
        onChoose={choose}
        onReset={resetBatch}
        onClose={() => setPicking(null)}
      />
      <ExerciseChangeModal
        row={changing}
        clientId={clientId}
        clientName={clientName}
        trainingPlace={trainingPlace}
        onClose={() => setChanging(null)}
        onSaved={() => {
          setChanging(null);
          loadSelectedExercises();
        }}
      />
    </View>
  );
}

// The workouts to put on one day, under tap-to-open batch headings, with
// used ones in red and a Reset per batch.
function WorkoutPicker({
  date,
  workouts,
  entries,
  resets,
  currentId,
  clientName,
  trainingPlace,
  resetNotice,
  busy,
  onChoose,
  onReset,
  onClose,
}: {
  date: string | null;
  workouts: Program[];
  entries: Pick<ClientCalendarWorkout, "program_id" | "created_at">[];
  resets: ClientWorkoutReset[];
  currentId: string | null;
  clientName: string;
  trainingPlace: ExercisePlace;
  resetNotice: string | null;
  busy: boolean;
  onChoose: (program: Program) => void;
  onReset: (batch: ProgramFamily, title: string) => void;
  onClose: () => void;
}) {
  const [place, setPlace] = useState<ExercisePlace>(trainingPlace);
  const [open, setOpen] = useState<ProgramFamily | null>(null);

  useEffect(() => {
    if (date) {
      setPlace(trainingPlace);
      setOpen(null);
    }
  }, [date, trainingPlace]);

  const here = workouts.filter((p) => p.place === place);
  // Gym and home batches are used up separately.
  const used = usedWorkoutIds(entries, resets, here);
  const families = PROGRAM_FAMILIES.map((f) => ({ ...f, programs: here.filter((p) => programFamily(p) === f.key) })).filter(
    (f) => f.programs.length > 0,
  );

  return (
    <Modal visible={!!date} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{date ? `Workout for ${dayHeading(date)}` : ""}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <GymHomeTabs
            current={place}
            onChange={(next) => {
              setPlace(next);
              setOpen(null);
            }}
            accent={BRAND_GOLD}
            labels={PROGRAM_PLACE_LABELS}
          />
          {resetNotice ? (
            <View style={styles.resetBanner}>
              <Text style={styles.resetBannerText}>🌿 {resetNotice}</Text>
            </View>
          ) : null}
          {place !== trainingPlace && (
            <Text style={styles.warning}>
              {clientName} trains at {trainingPlace === "home" ? "home" : "the gym"}. A {trainingPlace} workout fits better.
            </Text>
          )}
          <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 4 }}>
            {families.map((f) => {
              const isOpen = open === f.key;
              const usedCount = usedInBatch(f.key, f.programs, used);
              return (
                <View key={f.key} style={[styles.family, isOpen && styles.familyOpen]}>
                  <Pressable style={styles.familyHeader} onPress={() => setOpen(isOpen ? null : f.key)}>
                    <Text style={styles.familyIcon}>{f.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.familyTitle}>{f.title}</Text>
                      <Text style={[styles.usedCount, usedCount > 0 && { color: RED }]}>
                        {usedCount} of {f.programs.length} used
                      </Text>
                    </View>
                    <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
                  </Pressable>
                  {isOpen && usedCount > 0 && (
                    <Pressable style={styles.reset} onPress={() => onReset(f.key, f.title)}>
                      <Text style={styles.resetText}>↺ Reset this batch</Text>
                    </Pressable>
                  )}
                  {isOpen &&
                    f.programs.map((p) => {
                      const current = p.id === currentId;
                      const isUsed = used.has(p.id) && !current;
                      return (
                        <Pressable
                          key={p.id}
                          style={[styles.choice, current && { borderColor: BRAND_GOLD }, isUsed && styles.choiceUsed]}
                          onPress={() => onChoose(p)}
                          disabled={busy || current || isUsed}
                        >
                          <View style={styles.choiceTop}>
                            <Text style={[styles.name, isUsed && { color: "#94A3B8" }]}>{p.name}</Text>
                            {isUsed && <Text style={styles.usedTag}>Used</Text>}
                            {current && <Text style={styles.currentTag}>On this day</Text>}
                          </View>
                          {p.description ? (
                            <Text style={styles.description} numberOfLines={2}>
                              {p.description}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                </View>
              );
            })}
            {families.length === 0 && <Text style={styles.description}>No {place} workouts yet.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  dayBox: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 10 },
  dayTitle: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  dayWorkout: { color: BRAND_GOLD, fontSize: 16, fontWeight: "800", marginTop: 2 },
  dayButtons: { flexDirection: "row", gap: 8, marginTop: 12 },
  changeButton: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  changeText: { color: "#0F172A", fontWeight: "800" },
  clearButton: { flex: 1, borderWidth: 1, borderColor: RED, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  clearText: { color: RED, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.8)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#0F172A", borderRadius: 16, padding: 16, maxHeight: "90%", borderWidth: 1, borderColor: "#1E293B" },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  sheetTitle: { color: "#fff", fontWeight: "800", fontSize: 17, flex: 1 },
  close: { color: "#94A3B8", fontSize: 20, fontWeight: "700" },
  warning: { color: "#FBBF24", fontSize: 13, marginTop: 4 },
  resetBanner: { backgroundColor: "#422006", borderColor: "#F59E0B", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  resetBannerText: { color: "#FDE68A", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  family: { backgroundColor: "#1E293B", borderRadius: 12, marginTop: 8, padding: 4 },
  familyOpen: { borderWidth: 1, borderColor: BRAND_GOLD },
  familyHeader: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  familyIcon: { fontSize: 20 },
  familyTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  usedCount: { color: "#64748B", fontSize: 12, marginTop: 1 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  reset: { alignSelf: "flex-start", marginHorizontal: 10, marginBottom: 8, paddingVertical: 4 },
  resetText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13 },
  choice: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, margin: 6, marginTop: 0, borderWidth: 1.5, borderColor: "transparent" },
  choiceUsed: { borderColor: "#7F1D1D" },
  choiceTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 },
  usedTag: { color: RED, fontWeight: "800", fontSize: 12 },
  currentTag: { color: BRAND_GOLD, fontWeight: "800", fontSize: 12 },
  description: { color: "#64748B", fontSize: 13, marginTop: 2 },
});
