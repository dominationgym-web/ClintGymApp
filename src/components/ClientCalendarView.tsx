import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso } from "@/lib/dates";
import { displayProgramName, isFunctionalProgram } from "@/lib/programs";
import { loadCalendarBlocks, loadCalendarWorkoutFor, loadCalendarWorkouts, type CalendarDayWorkout } from "@/lib/programQueries";
import { forPlace, swapOptions, withHomeAlternatives, type HomeFit } from "@/lib/exerciseFilter";
import { getExerciseSwaps, saveExerciseSwaps, type ExerciseSwaps } from "@/lib/exerciseSwaps";
import ExerciseSwapModal from "@/components/ExerciseSwapModal";
import ExerciseGuideButton from "@/components/ExerciseGuide";
import { addDays } from "@/lib/programSchedule";
import {
  applyMoves,
  bodyPartsLabel,
  exercisesForSlot,
  FUNCTIONAL_TEAL,
  functionalShortName,
  mondayOf,
  shortWorkoutName,
  slotLabel,
  weekDates,
} from "@/lib/trainingCalendar";
import WeekCalendar, { type WeekDayPlan } from "@/components/WeekCalendar";
import WorkoutSessionResult from "@/components/WorkoutSessionResult";
import { LoggedExercises } from "@/components/TrainerTrainingLog";
import { groupTrainingLog } from "@/lib/trainingLog";
import { useWorkoutSessions } from "@/components/useWorkoutSessions";
import { useWorkoutSwaps } from "@/components/useWorkoutSwaps";
import { useRecoveryCalendar } from "@/components/useRecoveryCalendar";
import { useStabilityCalendar } from "@/components/useStabilityCalendar";
import { loadStabilityDays, STABILITY_PURPLE } from "@/lib/stabilityCalendar";
import type { ClientCalendarBlock, ClientCalendarWorkout, Exercise, Program, ProgramExercise, WorkoutLog } from "@/types/database";

// The client's own training calendar (0069), always open at the top of their
// workout screen (GRIZZ, 2026-10-18: "already open. So they dont need to
// click"). One week at a time, Monday to Sunday, with each day's workout and
// the body parts it trains (GRIZZ, 2026-10-18). It always shows, even before
// their coach has planned anything (GRIZZ, 2026-10-19: "Only show today").
// Tapping a day opens it in a pop-up page (app-flow review C5, 2026-10-18), so
// the week and Today below stay where they are. It lists the day's exercises, and from today on each can be changed
// for that day if the gym will be busy (0047). Extra blocks the coach added
// to a day (mobility, flexibility, fight..., 0098) show under its workout.
// Stability sessions show in purple and open the stability program (0110).
export default function ClientCalendarView({
  clientId,
  exercises,
  atHome,
  fit = null,
  onSwapsChanged,
  catchUpDates = [],
  onCatchUp,
  refreshKey = 0,
}: {
  clientId: string;
  /** The exercises the client can see, for the swap choices. */
  exercises: Exercise[];
  atHome: boolean;
  /** Their home equipment check (0092), null for every home exercise. */
  fit?: HomeFit;
  /** A swap was made for this date, so the workout screen can pick it up. */
  onSwapsChanged?: (date: string) => void;
  /** Missed days this week that can be done today (weekend catch-up, 0101). */
  catchUpDates?: string[];
  onCatchUp?: (date: string) => void;
  /** Bumped by the workout screen when it comes back into view, to reload the plan. */
  refreshKey?: number;
}) {
  const today = todayIso();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [monday, setMonday] = useState(mondayOf(today));
  const [entries, setEntries] = useState<ClientCalendarWorkout[]>([]);
  const [blocks, setBlocks] = useState<ClientCalendarBlock[]>([]);
  const [dayExtras, setDayExtras] = useState<CalendarDayWorkout[]>([]);
  const [names, setNames] = useState<Record<string, Pick<Program, "name" | "trainer_id">>>({});
  // The week's programs' exercises, for the body parts each day trains.
  const [programRows, setProgramRows] = useState<Record<string, ProgramExercise[]>>({});
  const [hasAny, setHasAny] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // The selected day's workout and any swaps made for it.
  const [dayRows, setDayRows] = useState<ProgramExercise[]>([]);
  const [daySwaps, setDaySwaps] = useState<ExerciseSwaps>({});
  const [swapping, setSwapping] = useState<ProgramExercise | null>(null);
  // What was logged on the selected day, so a past day shows the sets done,
  // live sessions with the coach included (GRIZZ, 2026-10-27).
  const [dayLogs, setDayLogs] = useState<WorkoutLog[]>([]);
  // Reload each time the screen comes back into view, so a week the coach has
  // just planned shows without changing week or restarting the app.
  const [focusKey, setFocusKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    setDayRows([]);
    setDayExtras([]);
    setDaySwaps({});
    setDayLogs([]);
    if (!selected) return;
    let live = true;
    if (selected <= today) {
      supabase
        .from("workout_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("log_date", selected)
        .then(({ data }) => {
          if (live) setDayLogs(data ?? []);
        });
    }
    Promise.all([loadCalendarWorkoutFor(clientId, selected), getExerciseSwaps(selected)]).then(([workout, swaps]) => {
      if (!live) return;
      setDayRows(workout?.main ? [...workout.main.exercises].sort((a, b) => a.sort_order - b.sort_order) : []);
      setDayExtras(workout?.extras ?? []);
      setDaySwaps(swaps);
    });
    return () => {
      live = false;
    };
  }, [clientId, selected, entries, blocks]);

  // Show the calendar as soon as anything is planned from today on, even
  // when it's all next month.
  useEffect(() => {
    const yearOn = `${Number(today.slice(0, 4)) + 1}-12-31`;
    Promise.all([
      loadCalendarWorkouts(clientId, today, yearOn),
      loadCalendarBlocks(clientId, today, yearOn),
      loadStabilityDays(clientId, today, yearOn),
    ]).then(([rows, extra, stabilityDays]) => {
      if (rows.length > 0 || extra.length > 0 || stabilityDays.length > 0) setHasAny(true);
    });
  }, [clientId, today, refreshKey, focusKey]);

  const range = { from: monday, to: addDays(monday, 6) };
  useEffect(() => {
    const { from, to } = range;
    Promise.all([loadCalendarBlocks(clientId, from, to), loadCalendarWorkouts(clientId, from, to)]).then(async ([extra, rows]) => {
      setBlocks(extra);
      if (extra.length > 0) setHasAny(true);
      const extraIds = extra.map((b) => b.program_id);
      setEntries(rows);
      if (rows.length > 0) setHasAny(true);
      const missing = [...new Set([...rows.map((r) => r.program_id), ...extraIds])].filter((id) => !names[id]);
      if (missing.length > 0) {
        const { data } = await supabase.from("programs").select("id, name, trainer_id").in("id", missing);
        setNames((prev) => ({ ...prev, ...Object.fromEntries((data ?? []).map((p) => [p.id, p])) }));
      }
      // Paged, as Supabase returns at most 1000 rows.
      const need = [...new Set(rows.map((r) => r.program_id))].filter((id) => !programRows[id]);
      if (need.length === 0) return;
      const found: ProgramExercise[] = [];
      for (let page = 0; ; page++) {
        const { data } = await supabase
          .from("program_exercises")
          .select("*")
          .in("program_id", need)
          .order("id")
          .range(page * 1000, page * 1000 + 999);
        found.push(...((data ?? []) as ProgramExercise[]));
        if (!data || data.length < 1000) break;
      }
      setProgramRows((prev) => {
        const next = { ...prev };
        for (const id of need) next[id] = found.filter((r) => r.program_id === id);
        return next;
      });
    });
  }, [clientId, monday, refreshKey, focusKey]);

  const { byDate: sessions, marks } = useWorkoutSessions(clientId, range.from, range.to);
  // Days the client swapped workouts (0167).
  const swapped = useWorkoutSwaps(clientId, range.from, range.to, entries);
  const recovery = useRecoveryCalendar(clientId, range.from, range.to);
  const stability = useStabilityCalendar(clientId, range.from, range.to);
  const dayStability = selected ? stability.map[selected] ?? [] : [];


  const categoryOf = (row: Pick<ProgramExercise, "exercise_id" | "exercise_name">) =>
    exercises.find((e) => e.id === row.exercise_id)?.category ??
    exercises.find((e) => e.name === row.exercise_name)?.category ??
    null;
  // Training in gold; mobility and flexibility apart, in teal (GRIZZ, 2026-10-18).
  const nameOf = (p: Pick<Program, "name" | "trainer_id">) =>
    isFunctionalProgram(p)
      ? functionalShortName(p.name, !!p.trainer_id)
      : p.trainer_id
        ? shortWorkoutName(p.name)
        : shortWorkoutName(displayProgramName(p), false);
  const plans: Record<string, WeekDayPlan> = {};
  const mainLabels: Record<string, string> = {};
  for (const date of weekDates(monday)) {
    const plan: WeekDayPlan = { extras: [] };
    const entry = entries.find((e) => e.workout_date === date);
    const p = entry ? names[entry.program_id] : undefined;
    if (entry && p) {
      if (isFunctionalProgram(p)) plan.extras.push({ title: nameOf(p), functional: true });
      else {
        const rows = exercisesForSlot(programRows[entry.program_id] ?? [], entry.day_slot).filter((r) => r.kind !== "cardio");
        plan.main = { title: nameOf(p), parts: bodyPartsLabel(rows.map(categoryOf)), deload: !!entry.deload };
        mainLabels[date] = plan.main.title;
      }
    }
    for (const b of blocks) {
      if (b.workout_date !== date) continue;
      const bp = names[b.program_id];
      if (bp) plan.extras.push({ title: nameOf(bp), functional: isFunctionalProgram(bp) });
    }
    plans[date] = plan;
  }
  const moved = applyMoves(mainLabels, Object.values(sessions));
  // A workout made up at the weekend shows on the day it was done.
  for (const s of Object.values(sessions)) {
    if (s.makeup_for && plans[s.session_date] && !plans[s.session_date].main && plans[s.makeup_for]?.main) {
      plans[s.session_date] = { ...plans[s.session_date], main: plans[s.makeup_for].main };
    }
  }
  const picked = selected ? entries.find((e) => e.workout_date === selected) : null;
  const pickedProgram = picked ? names[picked.program_id] : null;
  const canChange = !!selected && selected >= today;
  const planned = atHome ? withHomeAlternatives(dayRows, exercises, fit).rows : dayRows;
  const swapCategory = swapping ? categoryOf(swapping) : null;
  const swapChoices = swapping
    ? forPlace(swapOptions(exercises, swapCategory, [swapping.exercise_id, daySwaps[swapping.id]?.id ?? null]), atHome ? "home" : "gym", fit)
    : [];
  const chooseSwap = (exercise: Exercise | null) => {
    if (!swapping || !selected) return;
    const next = { ...daySwaps };
    if (exercise) next[swapping.id] = { id: exercise.id, name: exercise.name };
    else delete next[swapping.id];
    setDaySwaps(next);
    setSwapping(null);
    saveExerciseSwaps(selected, next).then(() => onSwapsChanged?.(selected));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Your training calendar</Text>
      </View>
      <View style={{ marginTop: 10 }}>
          <WeekCalendar
            monday={monday}
            onChangeWeek={(direction) => {
              setMonday(addDays(monday, direction * 7));
              setSelected(null);
            }}
            plans={plans}
            moves={moved.moves}
          swaps={swapped.labels}
            recovery={recovery}
            stability={stability.map}
            today={today}
            selected={selected}
            onPressDay={(date) => {
              // Tapping today with nothing on it goes straight to a missed workout
              // it can catch up (GRIZZ, 2026-10-17: weekends, 2026-10-23: yesterday's
              // on other days). Other empty days just open.
              const empty =
                date === today &&
                !entries.some((e) => e.workout_date === date) && !blocks.some((b) => b.workout_date === date) && !stability.map[date];
              if (empty && catchUpDates.length > 0 && onCatchUp) {
                onCatchUp(catchUpDates[0]);
                return;
              }
              setSelected(date);
            }}
            marks={marks}
            client
          />
          {!selected && (
            <Text style={styles.helper}>
              {hasAny
                ? "Your coach plans your workouts here. Tap a day to see what's on."
                : "Your coach hasn't put workouts on your calendar yet. They'll show here as soon as they do."}
            </Text>
          )}
      </View>
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.sheetBack}>‹ Back</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>
              {selected ? parseIsoDate(selected).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" }) : ""}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {selected && sessions[selected] && <WorkoutSessionResult session={sessions[selected]} />}
          {selected && dayLogs.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.doneTitle}>{sessions[selected]?.in_person ? "🤝 What you did with your coach" : "✅ What you did"}</Text>
              <View style={styles.doneBox}>
                <LoggedExercises exercises={groupTrainingLog(dayLogs, selected, 1)[0].exercises} session={sessions[selected]} client />
              </View>
            </View>
          )}
          <Text style={styles.helper}>
            {selected
              ? pickedProgram
                ? `${displayProgramName(pickedProgram)} on this day. It shows on your workout screen that morning.`
                : dayExtras.length > 0
                  ? "Extra blocks from your coach on this day."
                  : dayStability.length > 0
                    ? "Stability work from your coach on this day."
                    : dayLogs.length > 0
                      ? ""
                      : "Nothing planned on this day."
              : ""}
          </Text>
          {selected && catchUpDates.includes(selected) && onCatchUp && (
            <Pressable
              style={styles.catchUpButton}
              onPress={() => {
                onCatchUp(selected);
                setSelected(null);
              }}
            >
              <Text style={styles.catchUpText}>🔁 Missed this one? Do it today</Text>
            </Pressable>
          )}
          {pickedProgram &&
            planned.map((row) => {
              if (row.kind === "cardio") {
                return (
                  <View key={row.id} style={styles.row}>
                    <Text style={styles.rowName}>🔥 Cardio</Text>
                  </View>
                );
              }
              const swap = daySwaps[row.id];
              return (
                <View key={row.id} style={styles.row}>
                  <Text style={styles.rowName}>{swap ? swap.name : row.exercise_name}</Text>
                  <Text style={styles.rowSets}>
                    {row.sets} sets x {row.reps}
                  </Text>
                  {swap && <Text style={styles.swapped}>Swapped from {row.exercise_name}</Text>}
                  {canChange && (
                    <Pressable onPress={() => setSwapping(row)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                      <Text style={styles.changeLink}>⇄ Change exercise</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          {dayStability.map((item) => (
            <Pressable key={item.programId} style={styles.stabilityRow} onPress={() => {
                setSelected(null);
                navigation.navigate("Stability");
              }} accessibilityRole="button">
              <Text style={styles.stabilityTitle}>
                {item.done ? "✓" : "🧘"} {item.label} stability{item.done ? " · logged" : ""}
              </Text>
              <Text style={styles.stabilityOpen}>Open my stability program ›</Text>
            </Pressable>
          ))}
          {dayExtras.map((block, i) => (
            <View key={`${block.program.id}-${i}`} style={{ marginTop: 12 }}>
              <Text style={[styles.blockTitle, isFunctionalProgram(block.program) && { color: FUNCTIONAL_TEAL }]}>
                {isFunctionalProgram(block.program) ? "🤸" : "➕"} {displayProgramName(block.program)}
              </Text>
              {block.daySlot != null && <Text style={styles.rowSets}>{slotLabel(block.program, block.daySlot)}</Text>}
              {block.result && <Text style={styles.rowSets}>{block.result === "done" ? "✅ Done" : "Couldn't do it"}</Text>}
              {[...block.exercises]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((row) => {
                  const ex = exercises.find((e) => e.id === row.exercise_id) ?? exercises.find((e) => e.name === row.exercise_name);
                  return (
                    <View key={row.id} style={styles.row}>
                      <Text style={styles.rowName}>{row.kind === "cardio" ? "🔥 Cardio" : row.exercise_name}</Text>
                      {row.kind !== "cardio" && (
                        <>
                          <Text style={styles.rowSets}>
                            {row.sets} sets x {row.reps}
                          </Text>
                          <ExerciseGuideButton name={row.exercise_name} category={ex?.category ?? null} variant="bar" videoUrl={ex?.external_url ?? null} />
                        </>
                      )}
                    </View>
                  );
                })}
            </View>
          ))}
          </ScrollView>
      {/* Inside the day's page, so it opens on top of it. */}
      <ExerciseSwapModal
        visible={!!swapping}
        exerciseName={swapping?.exercise_name ?? null}
        category={swapCategory}
        choices={swapChoices}
        swapped={!!swapping && !!daySwaps[swapping.id]}
        when={selected === today ? "just for today" : "just for that day"}
        onChoose={chooseSwap}
        onClose={() => setSwapping(null)}
      />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12 },
  sheet: { flex: 1, backgroundColor: "#0F172A" },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  sheetBack: { color: BRAND_GOLD, fontWeight: "700", fontSize: 16 },
  sheetTitle: { color: "#fff", fontWeight: "800", fontSize: 17, flexShrink: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 8 },
  row: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginTop: 8 },
  rowName: { color: "#fff", fontWeight: "600" },
  rowSets: { color: "#64748B", fontSize: 12, marginTop: 2 },
  swapped: { color: BRAND_GOLD, fontSize: 12, marginTop: 2 },
  blockTitle: { color: "#38BDF8", fontWeight: "800", fontSize: 15 },
  stabilityRow: { borderWidth: 1, borderColor: "#6B21A8", backgroundColor: "#1A1029", borderRadius: 10, padding: 10, marginTop: 10 },
  stabilityTitle: { color: STABILITY_PURPLE, fontWeight: "800", fontSize: 15 },
  stabilityOpen: { color: "#E9D5FF", fontSize: 13, fontWeight: "700", marginTop: 4 },
  catchUpButton: { backgroundColor: "#22C55E", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  catchUpText: { color: "#0F172A", fontWeight: "800" },
  doneTitle: { color: "#22C55E", fontWeight: "800", fontSize: 15 },
  doneBox: { backgroundColor: "#1E293B", borderRadius: 10, paddingTop: 10, marginTop: 6 },
  changeLink: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 6 },
});
