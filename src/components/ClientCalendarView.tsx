import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { displayProgramName } from "@/lib/programs";
import { loadCalendarBlocks, loadCalendarWorkoutFor, loadCalendarWorkouts, type CalendarDayWorkout } from "@/lib/programQueries";
import { forPlace, swapOptions, withHomeAlternatives, type HomeFit } from "@/lib/exerciseFilter";
import { getExerciseSwaps, saveExerciseSwaps, type ExerciseSwaps } from "@/lib/exerciseSwaps";
import ExerciseSwapModal from "@/components/ExerciseSwapModal";
import ExerciseGuideButton from "@/components/ExerciseGuide";
import { applyMoves, monthOf, monthRange, shortWorkoutName, slotLabel, type CalendarMonth } from "@/lib/trainingCalendar";
import TrainingCalendar from "@/components/TrainingCalendar";
import WorkoutSessionResult from "@/components/WorkoutSessionResult";
import { useWorkoutSessions } from "@/components/useWorkoutSessions";
import { useRecoveryCalendar } from "@/components/useRecoveryCalendar";
import { useStabilityCalendar } from "@/components/useStabilityCalendar";
import { loadStabilityDays, STABILITY_PURPLE } from "@/lib/stabilityCalendar";
import type { ClientCalendarBlock, ClientCalendarWorkout, Exercise, Program, ProgramExercise } from "@/types/database";

// The client's own training calendar (0069), under a tap-to-open heading on
// their workout screen. Only shows once their coach has planned something.
// Tapping a day lists its exercises, and from today on each can be changed
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
}) {
  const today = todayIso();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [month, setMonth] = useState<CalendarMonth>(monthOf(today));
  const [entries, setEntries] = useState<ClientCalendarWorkout[]>([]);
  const [blocks, setBlocks] = useState<ClientCalendarBlock[]>([]);
  const [dayExtras, setDayExtras] = useState<CalendarDayWorkout[]>([]);
  const [names, setNames] = useState<Record<string, Pick<Program, "name" | "trainer_id">>>({});
  const [hasAny, setHasAny] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // The selected day's workout and any swaps made for it.
  const [dayRows, setDayRows] = useState<ProgramExercise[]>([]);
  const [daySwaps, setDaySwaps] = useState<ExerciseSwaps>({});
  const [swapping, setSwapping] = useState<ProgramExercise | null>(null);

  useEffect(() => {
    setDayRows([]);
    setDayExtras([]);
    setDaySwaps({});
    if (!selected) return;
    let live = true;
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
  }, [clientId, today]);

  useEffect(() => {
    const { from, to } = monthRange(month);
    loadCalendarBlocks(clientId, from, to).then((extra) => {
      setBlocks(extra);
      if (extra.length > 0) setHasAny(true);
    });
    loadCalendarWorkouts(clientId, from, to).then(async (rows) => {
      setEntries(rows);
      if (rows.length > 0) setHasAny(true);
      const missing = [...new Set(rows.map((r) => r.program_id))].filter((id) => !names[id]);
      if (missing.length === 0) return;
      const { data } = await supabase.from("programs").select("id, name, trainer_id").in("id", missing);
      setNames((prev) => ({ ...prev, ...Object.fromEntries((data ?? []).map((p) => [p.id, p])) }));
    });
  }, [clientId, month]);

  const range = monthRange(month);
  const { byDate: sessions, marks } = useWorkoutSessions(clientId, range.from, range.to);
  const recovery = useRecoveryCalendar(clientId, range.from, range.to);
  const stability = useStabilityCalendar(clientId, range.from, range.to);
  const dayStability = selected ? stability.map[selected] ?? [] : [];

  if (!hasAny) return null;

  const labels: Record<string, string> = {};
  for (const e of entries) {
    const p = names[e.program_id];
    if (p) labels[e.workout_date] = p.trainer_id ? shortWorkoutName(p.name) : shortWorkoutName(displayProgramName(p), false);
  }
  // "+1" for each extra block on a day.
  for (const date of new Set(blocks.map((b) => b.workout_date))) {
    const extra = blocks.filter((b) => b.workout_date === date).length;
    labels[date] = labels[date] ? `${labels[date]} +${extra}` : `+${extra}`;
  }
  const moved = applyMoves(labels, Object.values(sessions));
  const picked = selected ? entries.find((e) => e.workout_date === selected) : null;
  const pickedProgram = picked ? names[picked.program_id] : null;
  const canChange = !!selected && selected >= today;
  const planned = atHome ? withHomeAlternatives(dayRows, exercises, fit).rows : dayRows;
  const categoryOf = (row: ProgramExercise) =>
    exercises.find((e) => e.id === row.exercise_id)?.category ??
    exercises.find((e) => e.name === row.exercise_name)?.category ??
    null;
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
      <Pressable onPress={() => setOpen(!open)} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.title}>📅 Your training calendar</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 10 }}>
          <TrainingCalendar
            month={month}
            onChangeMonth={setMonth}
            labels={moved.labels}
            moves={moved.moves}
            recovery={recovery}
            stability={stability.map}
            today={today}
            selected={selected}
            onPressDay={(date) => {
              // At the weekend a day with nothing on it goes straight to the
              // missed workout (GRIZZ, 2026-10-17).
              const empty =
                !entries.some((e) => e.workout_date === date) && !blocks.some((b) => b.workout_date === date) && !stability.map[date];
              if (empty && catchUpDates.length > 0 && onCatchUp) {
                onCatchUp(catchUpDates[0]);
                setOpen(false);
                return;
              }
              setSelected(date);
            }}
            marks={marks}
          />
          {selected && sessions[selected] && <WorkoutSessionResult session={sessions[selected]} />}
          <Text style={styles.helper}>
            {selected
              ? pickedProgram
                ? `${displayProgramName(pickedProgram)} on this day. It shows on your workout screen that morning.`
                : dayExtras.length > 0
                  ? "Extra blocks from your coach on this day."
                  : dayStability.length > 0
                    ? "Stability work from your coach on this day."
                    : "Nothing planned on this day."
              : "Your coach plans your workouts here. Tap a day to see what's on."}
          </Text>
          {selected && catchUpDates.includes(selected) && onCatchUp && (
            <Pressable
              style={styles.catchUpButton}
              onPress={() => {
                onCatchUp(selected);
                setOpen(false);
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
            <Pressable key={item.programId} style={styles.stabilityRow} onPress={() => navigation.navigate("Stability")} accessibilityRole="button">
              <Text style={styles.stabilityTitle}>
                {item.done ? "✓" : "🧘"} {item.label} stability{item.done ? " · logged" : ""}
              </Text>
              <Text style={styles.stabilityOpen}>Open my stability program ›</Text>
            </Pressable>
          ))}
          {dayExtras.map((block, i) => (
            <View key={`${block.program.id}-${i}`} style={{ marginTop: 12 }}>
              <Text style={styles.blockTitle}>➕ {displayProgramName(block.program)}</Text>
              {block.daySlot != null && <Text style={styles.rowSets}>{slotLabel(block.program, block.daySlot)}</Text>}
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
        </View>
      )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  chevron: { color: BRAND_GOLD, fontSize: 14 },
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
  changeLink: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 6 },
});
