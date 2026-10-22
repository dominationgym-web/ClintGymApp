import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso } from "@/lib/dates";
import {
  loadAvailablePrograms,
  loadCalendarBlocks,
  loadCalendarWorkouts,
  loadCardioSkips,
  loadExerciseChanges,
  loadProgramExercises,
} from "@/lib/programQueries";
import { isFunctionalProgram, PROGRAM_FAMILIES, programFamily, WEEKDAY_NAMES, type ProgramFamily, type ProgramGroup } from "@/lib/programs";
import ProgramGroups from "@/components/ProgramGroups";
import {
  applyMoves,
  calendarDayLabels,
  FUNCTIONAL_TEAL,
  functionalShortName,
  monthLabel,
  monthOf,
  mondayOf,
  exercisesForSlot,
  programSlots,
  shortWorkoutName,
  slotLabel,
  usedInBatch,
  usedWorkoutIds,
  weekDates,
} from "@/lib/trainingCalendar";
import { addDays } from "@/lib/programSchedule";
import WeekCalendar, { type WeekDayPlan } from "@/components/WeekCalendar";
import WorkoutSessionResult from "@/components/WorkoutSessionResult";
import { useWorkoutSessions } from "@/components/useWorkoutSessions";
import { useRecoveryCalendar } from "@/components/useRecoveryCalendar";
import { useStabilityCalendar } from "@/components/useStabilityCalendar";
import StabilityDayPlanner from "@/components/stability/StabilityDayPlanner";
import WeeklyPlanCard from "@/components/WeeklyPlanCard";
import DeloadCard from "@/components/DeloadCard";
import ProgramSummary from "@/components/ProgramSummary";
import { workoutAddOns, type AddOnClient } from "@/lib/workoutAddOns";
import { withClientCardio } from "@/lib/clientExtras";
import { cardioKey, cardioSkipped, withoutSkippedCardio, type CardioSkip } from "@/lib/cardioSkips";
import { cardioLabel } from "@/lib/programs";
import PlanProgramModal from "@/components/PlanProgramModal";
import type { StabilityArea } from "@/lib/stability";
import ExerciseChangeModal from "@/components/ExerciseChangeModal";
import { applyExerciseChanges } from "@/lib/exerciseChanges";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { ClientCalendarBlock, ClientCalendarWorkout, ClientWorkoutReset, Program, ProgramExercise } from "@/types/database";

// What the picker is choosing: the day's main workout, or an extra block (0098).
type PickMode = "main" | "block";

const RED = "#EF4444";

// Opening a pop-up while another (or an alert) is still closing can leave an
// invisible layer over the screen on Android, so the next one waits a moment.
function afterPopup(open: () => void) {
  setTimeout(open, 250);
}

function dayHeading(date: string): string {
  const d = parseIsoDate(date);
  return `${WEEKDAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${monthLabel(monthOf(date))}`;
}

// On the trainer's view of a client (Training tab): their calendar (0069),
// one week at a time like the client's (GRIZZ, 2026-10-18: week by week). Tap a day to put a workout on it. Workouts already used
// for this client show "Used" in red until the whole batch is used or the
// trainer taps Reset for that batch, so the same workout isn't repeated by
// accident.
// Any day from any program (GRIZZ, 2026-10-16, 0098): the trainer can also
// put one session of a weekly or multi-week program on a day, and add extra
// blocks (mobility, flexibility, fight...) under the day's workout.
// Simpler set-up (GRIZZ, 2026-10-17): tapping an empty day from today on
// opens PlanProgramModal, which lays a whole program over a split of
// weekdays from that day. Single days can still be changed after.
export default function ClientCalendarCard({
  clientId,
  clientName,
  trainingPlace,
  trainingLevel = null,
  resetNotice = null,
  trainerId,
  onStabilityStarted,
  onPlanChanged,
  injuries = [],
  stabilityKey,
  extras,
}: {
  clientId: string;
  clientName: string;
  trainingPlace: ExercisePlace;
  // From the intake form: the planner shows the best-fit program first.
  trainingLevel?: string | null;
  trainerId?: string;
  // A rehab (stability) program started from the planner, so its card reloads.
  onStabilityStarted?: () => void;
  // The calendar's workouts changed, so the injury check runs again.
  onPlanChanged?: () => void;
  // Changes when a stability program starts or stops elsewhere, so its days reload.
  stabilityKey?: unknown;
  // The client's injured areas: risky exercises show red when changing one.
  injuries?: StabilityArea[];
  // Set when the client is on the Health Reset (resetNotice in src/lib/resetProgram.ts).
  resetNotice?: string | null;
  // The client's abs and extra cardio (0136), shown on each workout day.
  extras?: AddOnClient | null;
}) {
  const today = todayIso();
  // The Reset warning pops up once per visit, then stays as a banner in the picker.
  const resetWarned = useRef(false);
  const [monday, setMonday] = useState(mondayOf(today));
  const [monthEntries, setMonthEntries] = useState<ClientCalendarWorkout[]>([]);
  const [monthBlocks, setMonthBlocks] = useState<ClientCalendarBlock[]>([]);
  const [allEntries, setAllEntries] = useState<Pick<ClientCalendarWorkout, "program_id" | "created_at" | "day_slot">[]>([]);
  const [resets, setResets] = useState<ClientWorkoutReset[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<ProgramExercise[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>("main");
  // The selected day's extra blocks' exercises, by block id.
  const [blockExercises, setBlockExercises] = useState<Record<string, ProgramExercise[]>>({});
  const [changing, setChanging] = useState<ProgramExercise | null>(null);
  const [busy, setBusy] = useState(false);
  // The day a whole program is being planned from.
  const [planning, setPlanning] = useState<string | null>(null);
  // Cardio the trainer took off (0140); bumped to reload them.
  const [skips, setSkips] = useState<CardioSkip[]>([]);
  const [skipKey, setSkipKey] = useState(0);
  // Bumped when a program is planned, so the week-by-week card reloads.
  const [planKey, setPlanKey] = useState(0);

  const range = { from: monday, to: addDays(monday, 6) };
  const loadMonth = useCallback(async () => {
    const [from, to] = [monday, addDays(monday, 6)];
    const [entries, blocks] = await Promise.all([loadCalendarWorkouts(clientId, from, to), loadCalendarBlocks(clientId, from, to)]);
    setMonthEntries(entries);
    setMonthBlocks(blocks);
  }, [clientId, monday]);

  const loadUsed = useCallback(async () => {
    const [{ data: entries }, { data: batchResets }] = await Promise.all([
      supabase.from("client_calendar_workouts").select("program_id, created_at, day_slot").eq("client_id", clientId),
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

  // Quick workouts go on a day whole; weekly and multi-week programs give one
  // of their sessions (0098).
  const byId = new Map(programs.map((p) => [p.id, p]));
  const entryOn = (date: string) => monthEntries.find((e) => e.workout_date === date) ?? null;
  const blocksOn = (date: string) => monthBlocks.filter((b) => b.workout_date === date && byId.has(b.program_id));
  // Training in gold; mobility and flexibility apart, in teal (GRIZZ, 2026-10-18).
  const shortName = (p: Pick<Program, "name" | "trainer_id">) => (isFunctionalProgram(p) ? functionalShortName(p.name) : shortWorkoutName(p.name));
  const { labels } = calendarDayLabels(monthEntries, monthBlocks, (id) => byId.get(id), shortName);
  const selectedEntry = selected ? entryOn(selected) : null;
  const selectedProgram = selectedEntry ? byId.get(selectedEntry.program_id) ?? null : null;
  const selectedBlocks = selected ? blocksOn(selected) : [];
  const blockKey = selectedBlocks.map((b) => b.id).join(",");

  // The day's workout (just its session for a weekly program) and extra
  // blocks, with this client's exercise changes in place (0070).
  const loadSelectedExercises = useCallback(async () => {
    setSelectedExercises([]);
    setBlockExercises({});
    const [changes, skipList] = await Promise.all([loadExerciseChanges(clientId), loadCardioSkips(clientId)]);
    setSkips(skipList);
    // Cardio taken off is left in, so the trainer can see it and put it back.
    if (selectedProgram && selectedEntry) {
      const { data } = await loadProgramExercises(selectedProgram.id);
      // With the client's extra cardio in place, as they'll see it.
      const rows = applyExerciseChanges(exercisesForSlot(data ?? [], selectedEntry.day_slot), changes);
      setSelectedExercises(withClientCardio(selectedProgram, rows, extras?.extra_cardio));
    }
    const lists = await Promise.all(
      selectedBlocks.map(async (b) => {
        const { data } = await loadProgramExercises(b.program_id);
        return [b.id, applyExerciseChanges(exercisesForSlot(data ?? [], b.day_slot), changes)] as const;
      }),
    );
    setBlockExercises(Object.fromEntries(lists));
  }, [selectedProgram?.id, selectedEntry?.day_slot, blockKey, clientId, JSON.stringify(extras?.extra_cardio ?? []), skipKey]);

  useEffect(() => {
    loadSelectedExercises();
  }, [loadSelectedExercises]);

  // Dots and gold stars for how each day's workout went (0076).
  const { byDate: sessions, marks } = useWorkoutSessions(clientId, range.from, range.to);
  const recovery = useRecoveryCalendar(clientId, range.from, range.to);
  const [stabilityReload, setStabilityReload] = useState(0);
  const stability = useStabilityCalendar(clientId, range.from, range.to, `${String(stabilityKey)}-${stabilityReload}`);
  const moved = applyMoves(labels, Object.values(sessions));
  // Each day of the week: the workout and the session's title (the body
  // parts it trains) in gold, extra blocks under it, as on the client's week.
  const plans: Record<string, WeekDayPlan> = {};
  for (const date of weekDates(monday)) {
    const plan: WeekDayPlan = { extras: [] };
    const entry = entryOn(date);
    const p = entry ? byId.get(entry.program_id) : undefined;
    if (entry && p) {
      if (isFunctionalProgram(p)) plan.extras.push({ title: shortName(p), functional: true });
      else
        plan.main = {
          title: shortName(p),
          parts: entry.day_slot != null ? (p.day_titles[entry.day_slot - 1] ?? "") : "",
          deload: !!entry.deload,
          addOns: workoutAddOns(p, extras),
        };
    }
    for (const b of blocksOn(date)) {
      const bp = byId.get(b.program_id);
      if (bp) plan.extras.push({ title: shortName(bp), functional: isFunctionalProgram(bp) });
    }
    plans[date] = plan;
  }
  // A workout made up at the weekend shows on the day it was done.
  for (const s of Object.values(sessions)) {
    if (s.makeup_for && plans[s.session_date] && !plans[s.session_date].main && plans[s.makeup_for]?.main) {
      plans[s.session_date] = { ...plans[s.session_date], main: plans[s.makeup_for].main };
    }
  }

  const pressDay = (date: string) => {
    setSelected(date);
    // A day the client already trained shows how it went instead of the picker.
    if (entryOn(date) || sessions[date] || blocksOn(date).length > 0 || stability.map[date]) return;
    // A past day gets one workout. From today on the day box offers one
    // workout or a whole program (GRIZZ, 2026-10-19). It used to ask in a pop-up
    // that opened the planner straight from its button, which on Android could
    // leave the screen frozen until Back (GRIZZ, 2026-10-22).
    if (date < today) openPicker(date);
  };

  const openPlanner = (date: string) => {
    if (resetNotice && !resetWarned.current) {
      resetWarned.current = true;
      Alert.alert("On the Health Reset", `${resetNotice} Do you still want to plan a program?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Plan a program", onPress: () => afterPopup(() => setPlanning(date)) },
      ]);
      return;
    }
    setPlanning(date);
  };

  const openPicker = (date: string, mode: PickMode = "main") => {
    const open = () => {
      setPickMode(mode);
      setPicking(date);
    };
    if (resetNotice && !resetWarned.current) {
      resetWarned.current = true;
      Alert.alert("On the Health Reset", `${resetNotice} Do you still want to add a workout?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Add a workout", onPress: () => afterPopup(open) },
      ]);
      return;
    }
    open();
  };

  // `slot` is the session of a weekly program, null for a whole quick workout.
  const choose = async (program: Program, slot: number | null) => {
    if (!picking) return;
    setBusy(true);
    const { error } =
      pickMode === "block"
        ? await supabase.from("client_calendar_blocks").insert({
            client_id: clientId,
            workout_date: picking,
            program_id: program.id,
            day_slot: slot,
            position: Math.max(0, ...blocksOn(picking).map((b) => b.position)) + 1,
          })
        : await supabase.from("client_calendar_workouts").upsert(
            // created_at is when it was (re)planned, which is what "used" counts from.
            { client_id: clientId, workout_date: picking, program_id: program.id, day_slot: slot, created_at: new Date().toISOString() },
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
    onPlanChanged?.();
  };

  // Taking a day off asks whether it's just that day or the whole program
  // (GRIZZ, 2026-10-22: "if we've loaded a whole program, we don't have to
  // unload every single day separately"). The whole program means every day
  // of it from today on, extra blocks too, and its weekly plan stops; days
  // already done stay as the client's history.
  const removeWholeProgram = async (programId: string) => {
    const from = today;
    const results = await Promise.all([
      supabase.from("client_calendar_workouts").delete().eq("client_id", clientId).eq("program_id", programId).gte("workout_date", from),
      // Taking a block off keeps its row, marked removed (0098).
      supabase
        .from("client_calendar_blocks")
        .update({ removed_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("program_id", programId)
        .gte("workout_date", from)
        .is("removed_at", null),
      supabase
        .from("client_program_plans")
        .update({ ended_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("program_id", programId)
        .is("ended_at", null),
    ]);
    const error = results.find((r) => r.error)?.error;
    if (error) Alert.alert("Couldn't remove it", error.message);
    await Promise.all([loadMonth(), loadUsed()]);
    setPlanKey((k) => k + 1);
    onPlanChanged?.();
  };

  // How many days of this program are on the calendar from today on.
  const daysOfProgram = async (programId: string): Promise<number> => {
    const [{ count: main }, { count: blocks }] = await Promise.all([
      supabase.from("client_calendar_workouts").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("program_id", programId).gte("workout_date", today),
      supabase
        .from("client_calendar_blocks")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("program_id", programId)
        .gte("workout_date", today)
        .is("removed_at", null),
    ]);
    return (main ?? 0) + (blocks ?? 0);
  };

  const askTakeOff = async (programId: string, name: string, date: string, justThisDay: () => Promise<void>) => {
    const days = await daysOfProgram(programId);
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: "Keep it", style: "cancel" },
      { text: "Just this day", style: "destructive", onPress: justThisDay },
    ];
    // Only worth asking when the program has other days still to come.
    if (days > 1 || (days === 1 && date < today)) {
      buttons.push({
        text: `Whole program (${days} days)`,
        style: "destructive",
        onPress: () =>
          Alert.alert(`Take all of ${name} off?`, `Every day of it from today on comes off ${clientName}'s calendar. Days already done stay.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Take it all off", style: "destructive", onPress: () => removeWholeProgram(programId) },
          ]),
      });
    }
    Alert.alert(`Take ${name} off?`, `Just ${dayHeading(date)}, or the whole program?`, buttons);
  };

  // Tap a cardio block to take it off (GRIZZ, 2026-10-22: two cardio blocks
  // ended up at the end of a workout): just this day, or every week.
  const takeOffCardio = (row: ProgramExercise) => {
    if (!selected) return;
    const date = selected;
    const skip = async (workout_date: string | null) => {
      const { error } = await supabase.from("client_cardio_skips").insert({ client_id: clientId, workout_date, cardio_key: cardioKey(row) });
      // Already off (unique), nothing to do.
      if (error && error.code !== "23505") Alert.alert("Couldn't take it off", error.message);
      setSkipKey((k) => k + 1);
    };
    Alert.alert(`Take off ${cardioLabel(row)}?`, `${clientName} won't do this cardio. Take it off just ${dayHeading(date)}, or every week?`, [
      { text: "Keep it", style: "cancel" },
      { text: "Just this day", style: "destructive", onPress: () => skip(date) },
      { text: "Every week", style: "destructive", onPress: () => skip(null) },
    ]);
  };
  const putBackCardio = async (row: ProgramExercise) => {
    if (!selected) return;
    const key = cardioKey(row);
    const ids = skips.filter((s) => s.cardio_key === key && (s.workout_date == null || s.workout_date === selected)).map((s) => s.id).filter((id): id is string => !!id);
    if (ids.length) {
      const { error } = await supabase.from("client_cardio_skips").delete().in("id", ids);
      if (error) Alert.alert("Couldn't put it back", error.message);
    }
    setSkipKey((k) => k + 1);
  };

  const clearDay = (entry: ClientCalendarWorkout) =>
    askTakeOff(entry.program_id, byId.get(entry.program_id)?.name ?? "this workout", entry.workout_date, async () => {
      const { error } = await supabase.from("client_calendar_workouts").delete().eq("id", entry.id);
      if (error) {
        Alert.alert("Couldn't remove it", error.message);
        return;
      }
      await Promise.all([loadMonth(), loadUsed()]);
    });

  // Taking a block off keeps its row, marked removed (0098).
  const takeOffBlock = (block: ClientCalendarBlock, name: string) =>
    askTakeOff(block.program_id, name, block.workout_date, async () => {
      const { error } = await supabase
        .from("client_calendar_blocks")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", block.id);
      if (error) {
        Alert.alert("Couldn't remove it", error.message);
        return;
      }
      await loadMonth();
    });

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
        Tap the day {clientName} starts, pick the type, the program and the days they train, and the calendar fills itself.
        Tap any day after to change it.
      </Text>
      <WeeklyPlanCard
        clientId={clientId}
        clientName={clientName}
        programs={programs}
        refreshKey={planKey}
        onChanged={async () => {
          await Promise.all([loadMonth(), loadUsed()]);
          onPlanChanged?.();
        }}
      />
      <DeloadCard
        clientId={clientId}
        clientName={clientName}
        refreshKey={planKey}
        onAdded={async () => {
          setPlanKey((k) => k + 1);
          await Promise.all([loadMonth(), loadUsed()]);
          onPlanChanged?.();
        }}
      />
      {loading ? (
        <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 16 }} />
      ) : (
        <WeekCalendar
          monday={monday}
          onChangeWeek={(direction) => {
            setMonday(addDays(monday, direction * 7));
            setSelected(null);
          }}
          plans={plans}
          moves={moved.moves}
          recovery={recovery}
          stability={stability.map}
          today={today}
          selected={selected}
          onPressDay={pressDay}
          marks={marks}
        />
      )}
      {selected && (
        <View style={styles.dayBox}>
          <Text style={styles.dayTitle}>{dayHeading(selected)}</Text>
          {selectedEntry && selectedProgram ? (
            <>
              <Text style={[styles.dayWorkout, isFunctionalProgram(selectedProgram) && { color: FUNCTIONAL_TEAL }]}>{selectedProgram.name}</Text>
              {selectedEntry.day_slot != null && (
                <Text style={styles.daySlot}>{slotLabel(selectedProgram, selectedEntry.day_slot)}</Text>
              )}
              {sessions[selected] && <WorkoutSessionResult session={sessions[selected]} />}
              {workoutAddOns(selectedProgram, extras) ? <Text style={styles.addOns}>{workoutAddOns(selectedProgram, extras)}</Text> : null}
              <ProgramSummary
                program={selectedProgram}
                exercises={withoutSkippedCardio(selectedExercises, skips, selected)}
                onPressExercise={setChanging}
                onPressCardio={takeOffCardio}
                onlySlot={selectedEntry.day_slot}
              />
              {selectedExercises
                .filter((r) => cardioSkipped(r, skips, selected))
                .map((r) => (
                  <Pressable key={`off-${r.id}`} onPress={() => putBackCardio(r)} hitSlop={6}>
                    <Text style={styles.cardioOffLine}>Taken off: 🔥 {cardioLabel(r)}  ↩ Put back</Text>
                  </Pressable>
                ))}
              <View style={styles.dayButtons}>
                <Pressable style={styles.changeButton} onPress={() => openPicker(selectedEntry.workout_date)}>
                  <Text style={styles.changeText}>Change workout</Text>
                </Pressable>
                <Pressable style={styles.clearButton} onPress={() => clearDay(selectedEntry)}>
                  <Text style={styles.clearText}>Take it off</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {sessions[selected] && <WorkoutSessionResult session={sessions[selected]} />}
              <Pressable style={[styles.changeButton, styles.addWorkout]} onPress={() => openPicker(selected)}>
                <Text style={styles.changeText}>＋ One workout</Text>
              </Pressable>
              {selected >= today && selectedBlocks.length === 0 && (
                <Pressable style={[styles.changeButton, styles.addWorkout]} onPress={() => openPlanner(selected)}>
                  <Text style={styles.changeText}>📋 A whole program from this day</Text>
                </Pressable>
              )}
            </>
          )}
          {selectedBlocks.map((b) => {
            const p = byId.get(b.program_id);
            if (!p) return null;
            return (
              <View key={b.id} style={styles.block}>
                <Text style={[styles.blockName, isFunctionalProgram(p) && { color: FUNCTIONAL_TEAL }]}>{p.name}</Text>
                {b.day_slot != null && <Text style={styles.daySlot}>{slotLabel(p, b.day_slot)}</Text>}
                {/* The client's tick on an extra block (0123). */}
                {b.result && (
                  <Text style={[styles.daySlot, { color: b.result === "done" ? "#22C55E" : "#F59E0B" }]}>
                    {b.result === "done" ? "✅ Done" : "⚠️ Couldn't do it"}
                  </Text>
                )}
                <ProgramSummary
                  program={p}
                  exercises={withoutSkippedCardio(blockExercises[b.id] ?? [], skips, b.workout_date)}
                  onPressExercise={setChanging}
                  onPressCardio={takeOffCardio}
                  onlySlot={b.day_slot}
                />
                {(blockExercises[b.id] ?? [])
                  .filter((r) => cardioSkipped(r, skips, b.workout_date))
                  .map((r) => (
                    <Pressable key={`off-${r.id}`} onPress={() => putBackCardio(r)} hitSlop={6}>
                      <Text style={styles.cardioOffLine}>Taken off: 🔥 {cardioLabel(r)}  ↩ Put back</Text>
                    </Pressable>
                  ))}
                <Pressable style={[styles.clearButton, styles.blockOff]} onPress={() => takeOffBlock(b, p.name)}>
                  <Text style={styles.clearText}>Take it off</Text>
                </Pressable>
              </View>
            );
          })}
          <StabilityDayPlanner
            date={selected}
            clientId={clientId}
            programs={stability.programs}
            days={stability.days}
            items={stability.map[selected] ?? []}
            onChanged={() => setStabilityReload((k) => k + 1)}
          />
          <Pressable style={styles.addBlock} onPress={() => openPicker(selected, "block")}>
            <Text style={styles.addBlockText}>＋ Add a block (mobility, flexibility, fight…)</Text>
          </Pressable>
          {selected >= today && (selectedEntry || selectedBlocks.length > 0) && (
            <Pressable style={styles.addBlock} onPress={() => openPlanner(selected)}>
              <Text style={styles.addBlockText}>📋 Start a new program from this day</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.legend}>
        <Text style={styles.legendText}>🟢 done · 🟠 partly · 🔴 couldn't train · ⭐ weights up</Text>
      </View>
      {/* Mounted only while open, so a closed pop-up can't stay over the screen
          and swallow taps on Android. */}
      {planning && (
      <PlanProgramModal
        date={planning}
        clientId={clientId}
        clientName={clientName}
        trainerId={trainerId}
        trainingPlace={trainingPlace}
        trainingLevel={trainingLevel}
        programs={programs}
        resetNotice={resetNotice}
        onSingleWorkout={(date) => {
          setPlanning(null);
          afterPopup(() => {
            setPickMode("main");
            setPicking(date);
          });
        }}
        onDone={async (what) => {
          setPlanning(null);
          if (what === "stability") {
            onStabilityStarted?.();
            setStabilityReload((k) => k + 1);
          }
          else {
            await Promise.all([loadMonth(), loadUsed()]);
            setPlanKey((k) => k + 1);
            onPlanChanged?.();
          }
        }}
        onClose={() => setPlanning(null)}
      />
      )}
      {picking && (
      <WorkoutPicker
        date={picking}
        mode={pickMode}
        workouts={programs}
        entries={allEntries}
        resets={resets}
        currentId={picking && pickMode === "main" ? entryOn(picking)?.program_id ?? null : null}
        currentSlot={picking && pickMode === "main" ? entryOn(picking)?.day_slot ?? null : null}
        clientName={clientName}
        trainingPlace={trainingPlace}
        resetNotice={resetNotice}
        busy={busy}
        onChoose={choose}
        onReset={resetBatch}
        onClose={() => setPicking(null)}
      />
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
          loadSelectedExercises();
        }}
      />
    </View>
  );
}

// The workouts to put on one day, under tap-to-open batch headings, with
// used ones in red and a Reset per batch. Weekly and multi-week programs open
// to list their sessions (rest days left out); tap one to put that day on.
function WorkoutPicker({
  date,
  mode,
  workouts,
  entries,
  resets,
  currentId,
  currentSlot,
  clientName,
  trainingPlace,
  resetNotice,
  busy,
  onChoose,
  onReset,
  onClose,
}: {
  date: string | null;
  mode: PickMode;
  workouts: Program[];
  entries: Pick<ClientCalendarWorkout, "program_id" | "created_at" | "day_slot">[];
  resets: ClientWorkoutReset[];
  currentId: string | null;
  currentSlot: number | null;
  clientName: string;
  trainingPlace: ExercisePlace;
  resetNotice: string | null;
  busy: boolean;
  onChoose: (program: Program, slot: number | null) => void;
  onReset: (batch: ProgramFamily, title: string) => void;
  onClose: () => void;
}) {
  const [place, setPlace] = useState<ExercisePlace>(trainingPlace);
  const [open, setOpen] = useState<ProgramFamily | null>(null);
  const [openGroup, setOpenGroup] = useState<ProgramGroup | null>(null);
  // The weekly program open to show its sessions, and each one's sessions once loaded.
  const [openProgram, setOpenProgram] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (date) {
      setPlace(trainingPlace);
      setOpen(null);
      setOpenGroup(null);
      setOpenProgram(null);
    }
  }, [date, trainingPlace]);

  const toggleProgram = async (p: Program) => {
    if (openProgram === p.id) {
      setOpenProgram(null);
      return;
    }
    setOpenProgram(p.id);
    if (slots[p.id]) return;
    const { data } = await loadProgramExercises(p.id);
    setSlots((prev) => ({ ...prev, [p.id]: programSlots(data ?? []) }));
  };

  const here = workouts.filter((p) => p.place === place);
  // Gym and home batches are used up separately. Only quick workouts get used up.
  const used = usedWorkoutIds(
    entries,
    resets,
    here.filter((p) => p.kind === "quick"),
  );
  const families = PROGRAM_FAMILIES.map((f) => ({ ...f, programs: here.filter((p) => programFamily(p) === f.key) })).filter(
    (f) => f.programs.length > 0,
  );

  return (
    <Modal visible={!!date} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {date ? `${mode === "block" ? "Add a block to" : "Workout for"} ${dayHeading(date)}` : ""}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <GymHomeTabs
            current={place}
            onChange={(next) => {
              setPlace(next);
              setOpen(null);
              setOpenGroup(null);
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
            <ProgramGroups
              place={place}
              families={families}
              open={openGroup}
              onToggle={(g) => {
                setOpenGroup(g);
                setOpen(null);
              }}
              extra={{
                functional: (
                  <Text style={styles.stabilityNote}>
                    🛡️ Stability & Rehab programs run alongside the main program, not on calendar days. Give one from the
                    Stability card under the program on this Training tab.
                  </Text>
                ),
              }}
              renderFamily={(f) => {
                const isOpen = open === f.key;
                const usedCount = usedInBatch(f.key, f.programs, used);
                const quickCount = f.programs.filter((p) => p.kind === "quick").length;
                return (
                  <View key={f.key} style={[styles.family, isOpen && styles.familyOpen]}>
                    <Pressable style={styles.familyHeader} onPress={() => setOpen(isOpen ? null : f.key)}>
                      <Text style={styles.familyIcon}>{f.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.familyTitle}>{f.title}</Text>
                        {quickCount > 0 && (
                          <Text style={[styles.usedCount, usedCount > 0 && { color: RED }]}>
                            {usedCount} of {quickCount} used
                          </Text>
                        )}
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
                        if (p.kind === "weekly") {
                          const shut = openProgram !== p.id;
                          const list = slots[p.id];
                          return (
                            <View key={p.id} style={[styles.choice, !shut && { borderColor: BRAND_GOLD }]}>
                              <Pressable onPress={() => toggleProgram(p)} disabled={busy}>
                                <View style={styles.choiceTop}>
                                  <Text style={styles.name}>{p.name}</Text>
                                  {p.id === currentId && <Text style={styles.currentTag}>On this day</Text>}
                                  <Text style={styles.chevron}>{shut ? "▾" : "▴"}</Text>
                                </View>
                                <Text style={styles.description}>Tap to choose one of its days</Text>
                              </Pressable>
                              {!shut && !list && <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 8 }} />}
                              {!shut &&
                                list?.map((slot) => {
                                  const current = p.id === currentId && slot === currentSlot;
                                  return (
                                    <Pressable
                                      key={slot}
                                      style={[styles.session, current && { borderColor: BRAND_GOLD }]}
                                      onPress={() => onChoose(p, slot)}
                                      disabled={busy || current}
                                    >
                                      <Text style={styles.sessionText}>{slotLabel(p, slot)}</Text>
                                      {current && <Text style={styles.currentTag}>On this day</Text>}
                                    </Pressable>
                                  );
                                })}
                              {!shut && list?.length === 0 && <Text style={styles.description}>No exercises in this program yet.</Text>}
                            </View>
                          );
                        }
                        const current = p.id === currentId && currentSlot == null;
                        const isUsed = used.has(p.id) && !current;
                        return (
                          <Pressable
                            key={p.id}
                            style={[styles.choice, current && { borderColor: BRAND_GOLD }, isUsed && styles.choiceUsed]}
                            onPress={() => onChoose(p, null)}
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
              }}
            />
            {families.length === 0 && <Text style={styles.description}>No {place} workouts yet.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardioOffLine: { color: "#94A3B8", fontSize: 13, marginTop: 6 },
  addOns: { color: "#FCD34D", fontSize: 13, fontWeight: "600", marginTop: 4 },
  stabilityNote: { color: "#CBD5E1", fontSize: 13, marginHorizontal: 12, marginBottom: 12, marginTop: 4 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  legend: { marginTop: 8 },
  legendText: { color: "#64748B", fontSize: 11 },
  dayBox: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 10 },
  dayTitle: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  dayWorkout: { color: BRAND_GOLD, fontSize: 16, fontWeight: "800", marginTop: 2 },
  daySlot: { color: "#CBD5E1", fontSize: 13, fontWeight: "700", marginTop: 2 },
  addWorkout: { flex: 0, marginTop: 10 },
  block: { borderTopWidth: 1, borderTopColor: "#1E293B", marginTop: 12, paddingTop: 10 },
  blockName: { color: "#38BDF8", fontSize: 15, fontWeight: "800" },
  blockOff: { flex: 0, marginTop: 8, paddingVertical: 8 },
  addBlock: { borderWidth: 1, borderColor: BRAND_GOLD, borderStyle: "dashed", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 12 },
  addBlockText: { color: BRAND_GOLD, fontWeight: "800" },
  session: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginTop: 6, borderWidth: 1.5, borderColor: "transparent" },
  sessionText: { color: "#fff", fontWeight: "600", fontSize: 14, flex: 1 },
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
