import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Modal,
  Alert,
  AppState,
  useWindowDimensions,
} from "react-native";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import ModalSafeArea from "../../components/ModalSafeArea";
import { useVideoPlayer, VideoView } from "expo-video";
import { supabase } from "@/lib/supabase";
import {
  categoryLabel,
  clientBrowsable,
  exerciseCategories,
  filterExercises,
  forPlace,
  swapOptions,
  withHomeAlternatives,
  type ExercisePlace,
} from "@/lib/exerciseFilter";
import { getCardioDone, getExerciseSwaps, saveCardioDone, saveExerciseSwaps, type ExerciseSwaps } from "@/lib/exerciseSwaps";
import WatchOnlineLink from "@/components/WatchOnlineLink";
import YouTubeCard, { ExerciseThumb } from "@/components/YouTubeCard";
import { playableClip } from "@/lib/watchOnline";
import ExerciseGuideButton, { DoSetButton, MuscleNotWeight } from "@/components/ExerciseGuide";
import GymHomeTabs from "@/components/GymHomeTabs";
import { todayIso, toIsoDate } from "@/lib/dates";
import { parseWeight, isBodyweight } from "@/lib/weightInput";
import { useWorkoutClient } from "@/context/LiveClientContext";
import MedicalHoldNotice from "@/components/MedicalHoldNotice";
import type { Exercise, ProgramExercise, SetEffort, WorkoutLog, WorkoutSession } from "@/types/database";
import WorkoutReasonModal from "@/components/WorkoutReasonModal";
import { findImprovements, SESSION_COLORS, SESSION_LABELS, sessionStatus, STAR_GOLD } from "@/lib/workoutSessions";
import RestTimer from "@/components/RestTimer";
import SupersetLogger from "@/components/SupersetLogger";
import EditSetModal from "@/components/EditSetModal";
import AchievementBadge from "@/components/AchievementBadge";
import Celebration, { type CelebrationInfo } from "@/components/Celebration";
import { checkAchievement } from "@/lib/achievementQueries";
import type { ClientAchievement } from "@/types/database";
import { AB_MAX_ROUNDS, AB_REPS, abExerciseFor, absAfterExercise, absBetweenSets, abRoundsDone } from "@/lib/absBetweenSets";
import EveryRepTips from "@/components/EveryRepTips";
import { EFFORT_LABEL, EFFORT_OPTIONS, EFFORT_QUESTION, suggestNext, type Suggestion } from "@/lib/progression";
import { apreBase, apreNextSet, apreRestAfter, isApre, type ApreStart } from "@/lib/apre";
import { gaugeWeight, inIntro, introWeeks, needsGauge, needsSafeties, SAFETIES_NOTE, type GaugeResult } from "@/lib/gauge";
import { DELOAD_BLUE, deloadSuggestion } from "@/lib/deload";
import { loadCalendarWorkoutFor, loadClientProgram, type ActiveProgram, type CalendarDayWorkout } from "@/lib/programQueries";
import { PACE_OPTIONS, withPace, type WorkoutPace } from "@/lib/trainingCalendar";
import ClientCalendarView from "@/components/ClientCalendarView";
import MyPastWorkouts from "@/components/MyPastWorkouts";
import OtherActivityCard from "@/components/OtherActivityCard";
import HomeEquipmentCard from "@/components/HomeEquipmentCard";
import IntervalTimerModal from "@/components/IntervalTimerModal";
import { hasIntervals } from "@/lib/intervalTimer";
import DropSetLogger from "@/components/DropSetLogger";
import { isDropSetProgram, roundsForLevel } from "@/lib/dropSets";
import { equipmentList, homeFit } from "@/lib/equipment";
import ExerciseSwapModal from "@/components/ExerciseSwapModal";
import PainSwapModal from "@/components/PainSwapModal";
import { lastPainFor, painAreaLabel, shortDate, type ExercisePain } from "@/lib/painSwap";
import type { StabilityArea } from "@/lib/stability";
import {
  cardioLabel,
  dayTitle,
  withExtraCardio,
  DEFAULT_REST_SECONDS,
  displayProgramName,
  exercisesForDate,
  formatRest,
  needsWarmUp,
  contrastRest,
  supersetNext,
  supersetStep,
  nextUnfinished,
  needsRamp,
  warmUpReps,
  warmUpRepsToFill,
  warmUpWeight,
} from "@/lib/programs";
import {
  currentSession,
  isDue,
  sessionAfterComplete,
  slotOf,
  slotParts,
  sessionMovedToTomorrow,
  sessionTitle,
  trainingDays,
  type ProgramSession,
} from "@/lib/programSchedule";
import { weekdayOf } from "@/lib/programSchedule";
import { catchUpChoices, catchUpDate, isWeekend, orderByRestedMuscles, type MissedWorkout } from "@/lib/catchUp";
import { applyRecoveryAdjustment } from "@/lib/recovery";
import { BRAND_GOLD } from "@/lib/brand";
import KeyboardSafe from "@/components/KeyboardSafe";
import FoldSection from "@/components/FoldSection";
import TodayPlanRows from "@/components/TodayPlanRows";
import WorkoutSwapRow from "@/components/WorkoutSwapRow";
import { useFormVideoUpload } from "@/components/useFormVideoUpload";
import ExerciseClip from "@/components/ExerciseClip";
import { useWideScreen } from "@/hooks/useWideScreen";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

export default function ExerciseLibraryScreen() {
  // In a live 1-on-1 session (0134) the trainer runs this screen for the client.
  const { client, refreshProfile, live } = useWorkoutClient();
  // The trainer training themselves (0146): their own row, so "my" wording.
  const self = live && !!client && client.id === client.trainer_id;
  // Trainer's laptop layout (useWideScreen is never true for clients).
  const wide = useWideScreen();
  // Serious symptoms on a check-in (0133) hold every workout until the trainer clears it.
  const [hold, setHold] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [todaysSets, setTodaysSets] = useState<WorkoutLog[]>([]);
  // Warm-up set (0079): the open exercise is the body part's first today, so
  // the next set logged is the warm-up unless the client skips it. The start
  // weight goes back in once the warm-up is done.
  const [warmUpDue, setWarmUpDue] = useState(false);
  const [startWeight, setStartWeight] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  // Gauge test (GRIZZ, 2026-10-17): first set of a new exercise to failure,
  // then the app works out the working weight.
  const [gaugeDue, setGaugeDue] = useState(false);
  const [gaugeResult, setGaugeResult] = useState<GaugeResult | null>(null);
  // APRE Program rows (GRIZZ, 2026-10-26): today's 7-rep weight and why,
  // and each set's weight is worked out from it (src/lib/apre.ts).
  const [apre, setApre] = useState<ApreStart | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [effort, setEffort] = useState<SetEffort | null>(null);
  const [logging, setLogging] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [program, setProgram] = useState<ActiveProgram | null>(null);
  // A workout the trainer put on today's calendar (0069) replaces the program for the day.
  const [calendarToday, setCalendarToday] = useState(false);
  // One day of a weekly program on today's calendar (its slot), and extra
  // blocks the coach added for today (0098, GRIZZ, 2026-10-16).
  const [calendarSlot, setCalendarSlot] = useState<number | null>(null);
  // Today's calendar workout is in a deload week (0115).
  const [deloadToday, setDeloadToday] = useState(false);
  const [calendarExtras, setCalendarExtras] = useState<CalendarDayWorkout[]>([]);
  const [pace, setPace] = useState<WorkoutPace>("planned");
  // How today's workout went, once the client has finished it (0076).
  const [todaySession, setTodaySession] = useState<WorkoutSession | null>(null);
  // Weekend catch-up (0101): calendar workouts missed this week, the client's
  // pick (a missed date, or "today"), and the missed day showing right now.
  const [missed, setMissed] = useState<MissedWorkout[]>([]);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [catchUpFor, setCatchUpFor] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<"partial" | "missed" | null>(null);
  // Every set logged today, to tick off the program and spot warm-ups.
  const [allTodaysSets, setAllTodaysSets] = useState<WorkoutLog[]>([]);
  // The program line for the exercise that's open, if it came from the program.
  const [target, setTarget] = useState<ProgramExercise | null>(null);
  // Bumped after each logged set to (re)start the rest timer.
  const [restRun, setRestRun] = useState(0);
  // Length of the rest timer that's showing.
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  // Abs between sets (0083): after a working set the client does 15 ab reps
  // and taps Complete, which starts the rest timer. `rest` is that timer's length.
  // Gold achievement badge (0085) earned by the set just logged.
  const [badge, setBadge] = useState<ClientAchievement | null>(null);
  // A logged set being fixed (wrong weight or reps).
  const [editingSet, setEditingSet] = useState<WorkoutLog | null>(null);
  // Gold star confetti pop-up when a finished workout pushed something up.
  const [starred, setStarred] = useState<CelebrationInfo | null>(null);
  // Superset logger (GRIZZ, 2026-10-23): 2-4 exercises logged a round at a time.
  const [supersetOpen, setSupersetOpen] = useState(false);
  // A badge earned in the superset logger shows once it closes (two pop-ups can't open at once).
  const supersetBadge = useRef<ClientAchievement | null>(null);
  const [absDue, setAbsDue] = useState<{ rest: number; count: number } | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  // Home training (0052): home clients start on the Home tab.
  const atHome = client?.training_place === "home";
  // Their home equipment list (0092): home choices only use what it covers.
  const fit = homeFit(client?.home_equipment);
  const [place, setPlace] = useState<ExercisePlace>(atHome ? "home" : "gym");
  useEffect(() => setPlace(atHome ? "home" : "gym"), [atHome]);
  // Change exercise (0047): today's swaps, and the program line being swapped.
  const [swaps, setSwaps] = useState<ExerciseSwaps>({});
  const [swapping, setSwapping] = useState<ProgramExercise | null>(null);
  // "This hurts" (0129): the exercise that hurts, and every time they said one did.
  const [hurting, setHurting] = useState<ProgramExercise | null>(null);
  const [pains, setPains] = useState<ExercisePain[]>([]);
  // Cardio blocks (0048) ticked off today.
  const [cardioDone, setCardioDone] = useState<string[]>([]);
  // The program's how-to and nutrition notes open on tap, so the workout stays near the top.
  const [openInfo, setOpenInfo] = useState<"how" | "food" | null>(null);
  // The simple Today view (GRIZZ, 2026-10-18: "a simplified structure when you
  // open. So the client can see what's on for the day. Then only if he clicks
  // on it then it opens up."): which part is open, undefined until tapped.
  const [openPart, setOpenPart] = useState<string | null | undefined>(undefined);
  const [timerOpen, setTimerOpen] = useState(false);
  // Drop set programs (0099, GRIZZ, 2026-10-16) log in their own logger.
  const [dropRow, setDropRow] = useState<ProgramExercise | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  // Stability and recovery rows on Today (app-flow review C4), so a day with only those isn't a "rest day".
  const [planRows, setPlanRows] = useState(0);
  // Done / Couldn't do it on extra blocks (0123), as just tapped, by block id.
  const [blockResults, setBlockResults] = useState<Record<string, "done" | "skipped" | null>>({});
  // "🎥 Film this set" in the set log (C2): the video goes to the coach with the exercise filled in.
  const film = useFormVideoUpload(client?.id);
  // Keep the demo video (shown under the set log) compact so it fits on screen;
  // the client can tap to make it bigger.
  const compactVideoHeight = Math.min(screenHeight * 0.28, 240);

  // Bottom tabs stay mounted, so reload when the day changes (app left open
  // overnight) and whenever the app comes back, which also picks up a
  // workout or exercise change the trainer has just made.
  const loadedFor = useRef<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (loadedFor.current && loadedFor.current !== todayIso()) {
        setChosenDay(null);
        setRefresh((r) => r + 1);
      }
    }, [])
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && loadedFor.current) setRefresh((r) => r + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const load = async () => {
      loadedFor.current = todayIso();
      if (client) supabase.rpc("has_medical_hold", { p_client: client.id }).then(({ data: held }) => setHold(!!held));
      const [{ data, error }, active, { data: logged }, todaysSwaps, { data: sessionRow }, { data: missedRows }] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        client ? loadClientProgram(client.id) : Promise.resolve(null),
        client
          ? supabase.from("workout_logs").select("*").eq("client_id", client.id).eq("log_date", todayIso())
          : Promise.resolve({ data: [] as WorkoutLog[] }),
        getExerciseSwaps(todayIso()),
        client
          ? supabase.from("workout_sessions").select("*").eq("client_id", client.id).eq("session_date", todayIso()).maybeSingle()
          : Promise.resolve({ data: null }),
        client ? supabase.rpc("my_missed_workouts") : Promise.resolve({ data: [] as MissedWorkout[] }),
      ]);
      let missedList = missedRows ?? [];
      // More than one to catch up: start with the one that rests the body
      // parts they trained yesterday (GRIZZ, 2026-10-17).
      if (client && missedList.length > 1 && !sessionRow && isWeekend(todayIso())) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const [workouts, { data: yesterdaySets }] = await Promise.all([
          Promise.all(missedList.map((m) => loadCalendarWorkoutFor(client.id, m.workout_date))),
          supabase.from("workout_logs").select("exercise_id, exercise_name").eq("client_id", client.id).eq("log_date", toIsoDate(yesterday)),
        ]);
        const library = data ?? [];
        const partOf = (row: { exercise_id: string | null; exercise_name: string }) =>
          (library.find((e) => e.id === row.exercise_id) ?? library.find((e) => e.name === row.exercise_name))?.category ?? null;
        const parts = (rows: { exercise_id: string | null; exercise_name: string }[]) =>
          rows.map(partOf).filter((c): c is string => !!c);
        const partsByDate: Record<string, string[]> = {};
        missedList.forEach((m, i) => (partsByDate[m.workout_date] = parts(workouts[i]?.main?.exercises ?? [])));
        missedList = orderByRestedMuscles(missedList, partsByDate, parts(yesterdaySets ?? []));
      }
      setMissed(missedList);
      // At the weekend the screen opens on a missed workout instead of today's.
      const makeUp = catchUpDate(todayIso(), missedList, sessionRow ?? null, chosenDay);
      setCatchUpFor(makeUp);
      const calendar = client ? await loadCalendarWorkoutFor(client.id, makeUp ?? todayIso()) : null;
      setTodaySession(sessionRow ?? null);
      setSwaps(todaysSwaps);
      if (client)
        supabase
          .from("client_exercise_pain")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(200)
          .then(({ data: painRows }) => setPains(painRows ?? []));
      setCardioDone(await getCardioDone(todayIso()));
      if (!error && data) setExercises(data);
      setCalendarExtras(calendar?.extras ?? []);
      setBlockResults({});
      setCalendarSlot(calendar?.main?.daySlot ?? null);
      setDeloadToday(!!calendar?.main?.deload);
      const main = calendar?.main ?? null;
      if (main && client) {
        const assignment = active?.assignment ?? {
          client_id: client.id,
          program_id: main.program.id,
          started_on: todayIso(),
          assigned_at: todayIso(),
          current_day: null,
          current_week: null,
          due_on: null,
          last_completed_at: null,
          extra_cardio: [],
          recovery_ignored_on: null,
          recovery_adjustment: null,
        };
        setProgram({
          assignment,
          program: main.program,
          exercises: withExtraCardio(main.exercises, assignment.extra_cardio),
        });
        setCalendarToday(true);
      } else {
        setProgram(active);
      }
      if (!main) setCalendarToday(false);
      setAllTodaysSets(logged ?? []);
      setLoading(false);
    };
    load();
  }, [client?.id, refresh, chosenDay]);

  // Weekly programs are worked through in order (0037): the current session
  // shows from its day until it's completed or moved.
  const today = todayIso();
  // Intro (first 6 weeks, 2 for advanced clients, or a Foundation program): no sets to failure.
  const intro = inIntro(program?.program.name, client?.plan_started_at, today, client?.training_level);
  const introLength = `${introWeeks(client?.training_level)} weeks`;
  // A calendar workout is just the day's exercises, even when it's one day of a weekly program (0098).
  const weekly = !calendarToday && program?.program.kind === "weekly";
  const days = program && weekly ? trainingDays(program.exercises) : [];
  const session = program && weekly ? currentSession(program.assignment, days) : null;
  const sessionDue = session ? isDue(session, today) : false;
  const fullPlan = !program
    ? []
    : calendarToday
      ? [...program.exercises].sort((a, b) => a.sort_order - b.sort_order)
      : weekly
      ? session && sessionDue
        ? program.exercises.filter((e) => slotOf(e) === session.day).sort((a, b) => a.sort_order - b.sort_order)
        : []
      : exercisesForDate(program.program, program.exercises, new Date());
  // A lighter session the trainer set for today after a recovery check (0059).
  const adjusted = program ? applyRecoveryAdjustment(fullPlan, program.assignment, today) : fullPlan;
  // Calendar workouts can be done faster or slower, which changes the rests.
  const plannedWorkout = calendarToday ? withPace(adjusted, pace) : adjusted;
  const lightened = !!program && program.assignment.recovery_adjustment?.date === today && fullPlan.length > 0;
  // Home training (0052): a client who trains at home gets a home exercise of
  // the same body part in place of each gym-only one, automatically.
  const { rows: homePlan, homeIds } = atHome
    ? withHomeAlternatives(plannedWorkout, exercises, fit)
    : { rows: plannedWorkout, homeIds: [] as string[] };
  const gymName = (row: ProgramExercise) => {
    const original = plannedWorkout.find((r) => r.id === row.id);
    return original && original.exercise_id !== homePlan.find((r) => r.id === row.id)?.exercise_id
      ? original.exercise_name
      : null;
  };
  // Today's workout with any swaps in place, so logging, ticking off and the
  // next-exercise prompt all follow the exercise the client actually does.
  // Drop set programs show 2 rounds (intermediate) or 3 (advanced) as the sets.
  const dropMode = isDropSetProgram(program?.program);
  const dropRounds = roundsForLevel(client?.training_level);
  const todayTitle = !program
    ? ""
    : session
      ? sessionDue
        ? sessionTitle(program.program, session.day)
        : "Rest day"
      : calendarToday && calendarSlot != null
        ? sessionTitle(program.program, calendarSlot)
        : dayTitle(program.program, new Date());
  const todaysWorkout = homePlan.map((row) => {
    const swap = swaps[row.id];
    const r = swap ? { ...row, exercise_id: swap.id, exercise_name: swap.name } : row;
    return dropMode && r.kind === "exercise" ? { ...r, sets: dropRounds } : r;
  });
  const plannedRow = (row: ProgramExercise) => homePlan.find((r) => r.id === row.id) ?? row;
  // Ab reps between sets on this workout, unless the trainer switched it off (0083).
  const absOn = absBetweenSets(program?.program, client);
  const abReps = program?.program.abs_reps || AB_REPS;
  const abName = (count: number) => abExerciseFor(count - 1, program?.program.abs_exercise);
  // Not after heavy squats, hinges, lunges or rows, and at most AB_MAX_ROUNDS a session (0118).
  const absAfter = (row: ProgramExercise | null) =>
    absOn && !!row && absAfterExercise(row.exercise_name) && abRoundsDone(allTodaysSets) < AB_MAX_ROUNDS;
  const workingSetsToday = () => allTodaysSets.filter((s) => !s.warm_up).length;
  const categoryOf = (row: ProgramExercise) =>
    exercises.find((e) => e.id === row.exercise_id)?.category ??
    exercises.find((e) => e.name === row.exercise_name)?.category ??
    null;
  const programExerciseIds = program ? [...program.exercises.map((e) => e.exercise_id), ...homeIds] : [];
  // Without full library access the database also lets a client see other
  // exercises for their program's body parts (for Change exercise, 0047), but
  // the reference list still only shows their program's.
  // A live session (GRIZZ, 2026-10-21) can use any exercise, picked by what's free in the gym.
  const browsable = live
    ? exercises
    : client?.library_access === false
      ? exercises.filter((e) => programExerciseIds.includes(e.id))
      : clientBrowsable(exercises, programExerciseIds);
  const shown = forPlace(browsable, place, fit);
  // The program card already lists today's exercises, so the reference list
  // only shows for clients who aren't on a program yet.
  const showReference = !program || live;
  // What's open on the Today view (GRIZZ, 2026-10-18: "they must click on the program for it to open").
  const part = hold ? null : (openPart ?? null);
  const togglePart = (key: string) => setOpenPart(part === key ? null : key);
  const choosePlace = (next: ExercisePlace) => {
    setPlace(next);
    setCategory(null);
  };
  // The open exercise is the first half of a superset: no rest timer after it.
  const targetNext = target ? supersetNext(target, todaysWorkout) : null;
  const supersetLabel = (row: ProgramExercise, next: ProgramExercise) =>
    contrastRest(row) > 0
      ? `rest ${formatRest(contrastRest(row))}, then ${next.exercise_name}`
      : `superset: straight into ${next.exercise_name}`;
  const [savingProgress, setSavingProgress] = useState(false);

  const openSwap = (row: ProgramExercise) => {
    setSwapping(plannedRow(row));
  };

  // From the set log: close it first, since two pop-ups can't open at once.
  const changeFromLog = (row: ProgramExercise) => {
    setSelected(null);
    setTimeout(() => openSwap(row), 400);
  };

  const chooseSwap = (exercise: Exercise | null) => {
    if (!swapping) return;
    const next = { ...swaps };
    if (exercise) next[swapping.id] = { id: exercise.id, name: exercise.name };
    else delete next[swapping.id];
    setSwaps(next);
    saveExerciseSwaps(todayIso(), next);
    setSwapping(null);
  };

  // From the set log: close it first, since two pop-ups can't open at once.
  const hurtsFromLog = (row: ProgramExercise) => {
    setSelected(null);
    setTimeout(() => setHurting(row), 400);
  };

  // Saves the report for the coach, then swaps today's exercise for the one
  // they're trying (or leaves the planned one in place if they leave it out).
  const reportPain = async (area: StabilityArea, instead: Exercise | null) => {
    if (!hurting || !client) return;
    const row = hurting;
    setHurting(null);
    const { data, error } = await supabase
      .from("client_exercise_pain")
      .insert({
        client_id: client.id,
        exercise_id: row.exercise_id,
        exercise_name: row.exercise_name,
        area,
        tried_exercise_id: instead?.id ?? null,
        tried_name: instead?.name ?? null,
      })
      .select("*")
      .single();
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    setPains((prev) => [data, ...prev]);
    if (instead) {
      const next = { ...swaps, [row.id]: { id: instead.id, name: instead.name } };
      setSwaps(next);
      saveExerciseSwaps(todayIso(), next);
    } else {
      Alert.alert("Left out today", `Your coach can see that ${row.exercise_name} hurt your ${painAreaLabel(area).toLowerCase()}.`);
    }
  };
  const painLibrary = forPlace(exercises, atHome ? "home" : "gym", fit);

  const swapCategory = swapping ? categoryOf(swapping) : null;
  const swapChoices = swapping
    ? forPlace(swapOptions(exercises, swapCategory, [swapping.exercise_id, swaps[swapping.id]?.id ?? null]), atHome ? "home" : "gym", fit)
    : [];

  const resultOf = (block: CalendarDayWorkout) =>
    block.blockId && block.blockId in blockResults ? blockResults[block.blockId] : block.result ?? null;
  // Extra blocks (bug 11, app-flow review): the client ticks them off so the coach sees them on their calendar.
  const setBlockResult = async (block: CalendarDayWorkout, result: "done" | "skipped" | null) => {
    if (!block.blockId) return;
    const { data, error } = await supabase.rpc("set_my_block_result", { p_block: block.blockId, p_result: result });
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      return;
    }
    setBlockResults((prev) => ({ ...prev, [block.blockId!]: result }));
  };

  const saveProgress = async (next: ProgramSession, completed: boolean) => {
    if (!program) return;
    setSavingProgress(true);
    const { week, day } = slotParts(next.day);
    const { error } = await supabase.rpc("set_my_program_week_progress", {
      p_current_week: week,
      p_current_day: day,
      p_due_on: next.dueOn,
      p_completed: completed,
    });
    setSavingProgress(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    setProgram({ ...program, assignment: { ...program.assignment, current_week: week, current_day: day, due_on: next.dueOn } });
  };

  // Complete workout: green when every set and cardio block is done, else
  // orange with a reason for the coach. Couldn't train: red with a reason.
  // Either way a weekly program moves on as before (0037).
  const workoutTitle = () =>
    !program
      ? ""
      : session
        ? sessionTitle(program.program, session.day)
        : calendarToday
          ? calendarSlot != null
            ? `${displayProgramName(program.program)}: ${sessionTitle(program.program, calendarSlot)}`
            : displayProgramName(program.program)
          : dayTitle(program.program, new Date());

  const recordSession = async (status: "complete" | "partial" | "missed", reason: string | null) => {
    if (!client) return null;
    let planned = todaysWorkout.reduce((t, r) => t + r.sets, 0);
    let done = todaysWorkout.reduce((t, r) => t + Math.min(setsDoneFor(r), r.sets), 0);
    // A live session counts every set logged today, planned or added as you go.
    if (live) {
      done = Math.max(done, workingSetsToday());
      planned = Math.max(planned, done);
    }
    let improvements: ReturnType<typeof findImprovements> = [];
    if (status !== "missed" && allTodaysSets.length > 0) {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data: earlier } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("client_id", client.id)
        .gte("log_date", toIsoDate(since))
        .lt("log_date", today)
        .in("exercise_name", [...new Set(allTodaysSets.map((s) => s.exercise_name))])
        .limit(2000);
      improvements = findImprovements(allTodaysSets, earlier ?? []);
    }
    setSavingProgress(true);
    const { data, error } = await supabase.rpc("record_workout_session", {
      p_title: live ? workoutTitle() || "Live session" : workoutTitle(),
      p_status: status,
      p_sets_done: done,
      p_sets_planned: planned,
      p_reason: reason,
      p_improvements: improvements,
    });
    setSavingProgress(false);
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      return null;
    }
    setTodaySession(data);
    if (catchUpFor && status !== "missed") {
      const { data: made, error: makeUpError } = await supabase.rpc("mark_workout_makeup", { p_date: catchUpFor });
      if (makeUpError || !made) {
        console.warn("Couldn't mark the catch-up", makeUpError);
        return data;
      }
      setTodaySession(made);
      setMissed((prev) => prev.filter((m) => m.workout_date !== catchUpFor));
      return made;
    }
    return data;
  };

  const afterRecorded = async (saved: WorkoutSession) => {
    if (session && sessionDue) {
      if (saved.status === "missed") await saveProgress(sessionMovedToTomorrow(session, today), false);
      else await saveProgress(sessionAfterComplete(session, days, today), true);
    }
    if (saved.improvements.length && saved.status !== "missed") {
      setStarred(goldStar(saved, saved.status === "complete" ? "Workout complete ✅ Great work." : "Every set counts."));
      return;
    }
    if (saved.status === "complete") Alert.alert("Workout complete ✅", "Great work.");
    else Alert.alert("Thanks for letting your coach know", saved.status === "partial" ? "Every set counts." : "Rest up and look after yourself.");
  };

  const goldStar = (saved: WorkoutSession, first: string): CelebrationInfo => ({
    emoji: "⭐",
    title: "Gold star!",
    lines: [first, ...saved.improvements.map((i) => `${i.exercise}: ${i.before} → ${i.after}`)],
    highlight: saved.improvements.length === 1 ? "New personal best" : `${saved.improvements.length} personal bests`,
  });

  const completeWorkout = () => {
    if (!program) return;
    const planned = todaysWorkout.reduce((t, r) => t + r.sets, 0);
    const done = todaysWorkout.reduce((t, r) => t + Math.min(setsDoneFor(r), r.sets), 0);
    if (sessionStatus(done, planned) === "partial") {
      setReasonFor("partial");
      return;
    }
    const next = session && sessionDue ? " Your next workout unlocks on your next training day." : "";
    Alert.alert(`Finished ${workoutTitle()}?`, `Every set is done.${next}`, [
      { text: "Not yet", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          const saved = await recordSession("complete", null);
          if (saved) afterRecorded(saved);
        },
      },
    ]);
  };

  // Live session (0137): saves today's sets to the client's profile as an in-person session.
  const finishLive = () => {
    const first = client?.name.split(" ")[0] ?? "the client";
    const where = self ? "your training log" : `${first}'s profile as an in-person session`;
    Alert.alert(self ? "Finish workout?" : "Finish live session?", `${workingSetsToday()} sets save to ${where}.`, [
      { text: "Not yet", style: "cancel" },
      {
        text: "Finish",
        onPress: async () => {
          const saved = await recordSession("complete", null);
          if (!saved) return;
          if (session && sessionDue) await saveProgress(sessionAfterComplete(session, days, today), true);
          const savedTo = `Saved to ${where}.`;
          if (saved.improvements.length) setStarred(goldStar(saved, savedTo));
          else Alert.alert(self ? "Saved 💪" : "Saved 🤝", savedTo);
        },
      },
    ]);
  };

  const sendReason = async (reason: string) => {
    if (!reasonFor) return;
    const saved = await recordSession(reasonFor, reason);
    if (!saved) return;
    setReasonFor(null);
    afterRecorded(saved);
  };
  const categoryById = new Map(exercises.map((e) => [e.id, e.category]));
  const categoriesLoggedToday = allTodaysSets.map((s) => (s.exercise_id ? categoryById.get(s.exercise_id) ?? null : null));
  // Read when an exercise opens, which can be from an older render (the
  // next-exercise prompt), so it always sees the latest sets.
  const categoriesRef = useRef(categoriesLoggedToday);
  categoriesRef.current = categoriesLoggedToday;
  // Interval timer finished (2026-10-14): each finished effort becomes a set
  // (reps = its seconds, or 1 for a distance), and cardio blocks tick off.
  const saveIntervals = async (efforts: { row: ProgramExercise; seconds: number | null }[], cardioIds: string[]): Promise<boolean> => {
    if (!client) return false;
    const counts: Record<string, number> = {};
    const inserts = efforts.map(({ row, seconds }) => {
      const key = row.exercise_id ?? row.exercise_name;
      counts[key] = (counts[key] ?? setsDoneFor(row)) + 1;
      return {
        client_id: client.id,
        exercise_id: row.exercise_id,
        exercise_name: row.exercise_name,
        log_date: todayIso(),
        set_number: counts[key],
        weight_kg: null,
        reps: seconds ?? 1,
        effort: "close_to_failure" as const,
        warm_up: false,
      };
    });
    if (inserts.length) {
      const { data, error } = await supabase.from("workout_logs").insert(inserts).select();
      if (error) {
        Alert.alert("Couldn't save", error.message);
        return false;
      }
      setAllTodaysSets((prev) => [...prev, ...(data ?? [])]);
    }
    if (cardioIds.length) {
      const next = Array.from(new Set([...cardioDone, ...cardioIds]));
      setCardioDone(next);
      saveCardioDone(todayIso(), next);
    }
    return true;
  };

  const toggleCardio = (row: ProgramExercise) => {
    const next = cardioDone.includes(row.id) ? cardioDone.filter((id) => id !== row.id) : [...cardioDone, row.id];
    setCardioDone(next);
    saveCardioDone(todayIso(), next);
  };
  const setsDoneFor = (row: ProgramExercise) =>
    row.kind === "cardio"
      ? cardioDone.includes(row.id) ? row.sets : 0
      : allTodaysSets.filter(
          (s) =>
            !s.warm_up &&
            // A drop set round starts at set 1, so count rounds, not drops.
            (!dropMode || s.set_number === 1) &&
            (row.exercise_id ? s.exercise_id === row.exercise_id : s.exercise_name === row.exercise_name),
        ).length;

  // `rest`: start a rest timer on arrival (coming back to a superset's first half).
  const openProgramExercise = (row: ProgramExercise, rest = 0, abs = absOn) => {
    if (dropMode) {
      setDropRow(row);
      return;
    }
    // Fall back to a name-only entry if the exercise was taken out of the library.
    const exercise = exercises.find((e) => e.id === row.exercise_id) ??
      exercises.find((e) => e.name === row.exercise_name) ?? {
      id: "",
      name: row.exercise_name,
      category: null,
      source: "own_library" as const,
      external_url: null,
      sort_order: 0,
      home_friendly: false,
    };
    openExercise(exercise, row, rest, abs);
  };

  const player = useVideoPlayer(playableClip(selected?.external_url), (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (selected) player.play();
    return () => {
      // useVideoPlayer recreates/releases the native player whenever the
      // source changes or this screen unmounts, which can race with this
      // cleanup - pausing an already-released player throws, but there's
      // nothing to pause in that case anyway, so it's safe to ignore.
      try {
        player.pause();
      } catch {
        // Already released - nothing to do.
      }
    };
  }, [selected, player]);

  const openExercise = async (exercise: Exercise, programRow: ProgramExercise | null = null, rest = 0, absFirst = absOn) => {
    setSelected(exercise);
    setTarget(programRow);
    // Rest after a set waits for the ab reps when the workout has them.
    const abs = rest > 0 && absFirst;
    setAbsDue(abs ? { rest, count: workingSetsToday() } : null);
    setRestSeconds(rest);
    setRestRun(rest > 0 && !abs ? Date.now() : 0);
    setVideoExpanded(false);
    setWeight("");
    setReps("");
    setEffort(null);
    setSuggestion(null);
    setGaugeDue(false);
    setGaugeResult(null);
    setWarmUpDue(false);
    setStartWeight("");
    setApre(null);
    if (!client) return;
    const query = supabase.from("workout_logs").select("*").eq("client_id", client.id).eq("log_date", todayIso());
    const { data } = await (exercise.id ? query.eq("exercise_id", exercise.id) : query.eq("exercise_name", exercise.name))
      .order("set_number", { ascending: true });
    setTodaysSets(data ?? []);
    // The last session before today, for "try this weight next".
    const before = supabase.from("workout_logs").select("*").eq("client_id", client.id).lt("log_date", todayIso());
    const { data: earlier } = await (exercise.id ? before.eq("exercise_id", exercise.id) : before.eq("exercise_name", exercise.name))
      .order("log_date", { ascending: false })
      .limit(20);
    const lastDate = earlier?.[0]?.log_date;
    if (programRow && isApre(programRow.reps)) {
      // APRE: sets 1 and 2 are the warm-up, and no gauge set.
      const sessions: WorkoutLog[][] = [];
      for (const s of earlier ?? []) {
        const day = sessions[sessions.length - 1];
        if (day && day[0].log_date === s.log_date) day.push(s);
        else sessions.push([s]);
      }
      for (const day of sessions) day.sort((a, b) => a.set_number - b.set_number);
      const start = apreBase(sessions, exercise);
      setApre(start);
      const plan = apreNextSet(start.base, data ?? [], programRow.sets, exercise, start);
      setSuggestion(plan);
      setWeight(plan.weight ? String(plan.weight) : "");
      return;
    }
    const usual = lastDate ? suggestNext(earlier.filter((s) => s.log_date === lastDate), programRow?.reps, exercise, intro ? 2 : 1) : null;
    // Deload week (0115): about 70% of the usual weight, and no gauge set.
    const next = deloadToday && calendarToday ? deloadSuggestion(usual, exercise) : usual;
    setSuggestion(next);
    setGaugeDue(!(deloadToday && calendarToday) && !!programRow && needsGauge(earlier ?? [], data ?? [], programRow.reps, exercise.name));
    const working = (data ?? []).filter((s) => !s.warm_up);
    const lastToday = working[working.length - 1]?.weight_kg;
    const start = lastToday ? String(lastToday) : next?.weight ? String(next.weight) : "";
    setStartWeight(start);
    const due = (data ?? []).length === 0 && needsWarmUp(exercise.category, categoriesRef.current);
    setWarmUpDue(due);
    if (due) {
      const half = warmUpWeight(start ? Number(start) : null);
      setWeight(half ? String(half) : "");
      setReps(programRow ? warmUpRepsToFill(programRow.reps) : "");
    } else {
      setWeight(start);
    }
  };

  const finishAbs = () => {
    if (!absDue) return;
    setRestSeconds(absDue.rest);
    setRestRun(Date.now());
    setAbsDue(null);
  };

  const skipWarmUp = () => {
    setWarmUpDue(false);
    setWeight(startWeight);
    setReps("");
  };

  const logSet = async () => {
    if (!client || !selected) return;
    const repsNum = Number(reps);
    if (!reps || Number.isNaN(repsNum) || repsNum <= 0) {
      Alert.alert("Missing reps", "Enter how many reps you did.");
      return;
    }
    const warmUp = warmUpDue;
    const gauge = gaugeDue && !warmUp;
    if (gauge && parseWeight(weight) == null && !isBodyweight(weight)) {
      Alert.alert("Missing weight", "Enter the weight you picked for your gauge set, or 0 if it's bodyweight only.");
      return;
    }
    if (!effort && !warmUp && !gauge) {
      Alert.alert("Missing effort", "Pick how many more good reps you could have done.");
      return;
    }
    const workingDone = todaysSets.filter((s) => !s.warm_up).length;
    setLogging(true);
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        client_id: client.id,
        exercise_id: selected.id || null,
        exercise_name: selected.name,
        log_date: todayIso(),
        set_number: warmUp ? 0 : workingDone + 1,
        weight_kg: parseWeight(weight),
        reps: repsNum,
        effort: warmUp ? "comfortable" : gauge ? "close_to_failure" : effort!,
        warm_up: warmUp,
        gauge,
      })
      .select()
      .single();
    setLogging(false);
    if (error || !data) {
      Alert.alert("Couldn't save set", error?.message ?? "Unknown error");
      return;
    }
    setTodaysSets((prev) => [...prev, data]);
    setAllTodaysSets((prev) => [...prev, data]);
    if (!warmUp) checkAchievement(client.id, data).then((b) => b && setBadge(b));
    setReps("");
    setEffort(null);
    if (gauge && target) {
      setGaugeDue(false);
      const result = gaugeWeight({ weight: parseWeight(weight) ?? 0, reps: repsNum }, target.reps, selected, intro);
      setGaugeResult(result);
      if (result) {
        setWeight(String(result.weight));
        setStartWeight(String(result.weight));
        Alert.alert(`🎯 Your working weight: ${result.weight}kg`, result.advice);
      }
    }
    if (warmUp) {
      // Warm-up done: back to the start weight for the working sets, after a short breather.
      setWarmUpDue(false);
      setAbsDue(null);
      setWeight(startWeight);
      setRestSeconds(60);
      setRestRun((n) => n + 1);
      return;
    }
    // Keep the weight for the next set; most sets use the same one (after a
    // gauge set, the weight it worked out). APRE works out the next set's.
    const apreRow = target && apre ? target : null;
    if (apreRow && apre) {
      const plan = apreNextSet(apre.base, [...todaysSets, data], apreRow.sets, selected);
      setSuggestion(plan);
      setWeight(plan.weight ? String(plan.weight) : data.weight_kg !== null ? String(data.weight_kg) : "");
    } else if (!gauge) setWeight(data.weight_kg !== null ? String(data.weight_kg) : "");
    const done = (row: ProgramExercise) =>
      target && row.id === target.id ? workingDone + 1 : setsDoneFor(row);
    // Supersets alternate: straight into the partner, or back to the first
    // half with the rest timer running.
    const step = target ? supersetStep(target, todaysWorkout, done) : null;
    if (step) {
      openProgramExercise(step.go, step.restSeconds, absAfter(target));
      return;
    }
    const rowRest = target?.rest_seconds || DEFAULT_REST_SECONDS;
    const rest = apreRow ? apreRestAfter(workingDone + 1, apreRow.sets, rowRest) : rowRest;
    const next = target && workingDone + 1 >= target.sets ? nextUnfinished(target, todaysWorkout, done) : null;
    // Abs between sets, except after the very last set of the workout.
    if (target && absAfter(target) && (workingDone + 1 < target.sets || next)) {
      // Any rest still counting from the last set stops: abs come first.
      setRestRun(0);
      setAbsDue({ rest, count: workingSetsToday() + 1 });
    } else {
      setRestSeconds(rest);
      setRestRun((n) => n + 1);
    }
    // Last set of a program exercise: offer to go straight to the next one.
    if (target && workingDone + 1 >= target.sets) {
      if (next?.kind === "cardio") {
        Alert.alert(`${target.exercise_name} done ✓`, `Next up: 🔥 ${cardioLabel(next)}. Tick it off on your workout when you're done.`, [
          { text: "Not yet", style: "cancel" },
          { text: "Go to cardio", onPress: () => setSelected(null) },
        ]);
      } else if (next) {
        Alert.alert(`${target.exercise_name} done ✓`, `Ready to move on to ${next.exercise_name}?`, [
          { text: "Not yet", style: "cancel" },
          // With abs between sets, the abs and rest come along to the next exercise.
          { text: "Next exercise", onPress: () => openProgramExercise(next, absAfter(target) ? rest : 0) },
        ]);
      } else {
        const finish = session && sessionDue ? " Tap Complete workout to unlock your next session." : " Tap Complete workout so your coach sees it.";
        Alert.alert("Workout done 💪", `That's every exercise.${finish}`, [{ text: "OK", onPress: () => setSelected(null) }]);
      }
    }
  };

  // A fixed set replaces the old one; when it's the latest working set, the
  // next set starts from its weight (APRE works the next set out again).
  const setFixed = (updated: WorkoutLog) => {
    const swap = (list: WorkoutLog[]) => list.map((s) => (s.id === updated.id ? updated : s));
    const sets = swap(todaysSets);
    setTodaysSets(sets);
    setAllTodaysSets(swap);
    const working = sets.filter((s) => !s.warm_up);
    if (updated.warm_up || working[working.length - 1]?.id !== updated.id || warmUpDue) return;
    if (target && apre && selected) {
      const plan = apreNextSet(apre.base, sets, target.sets, selected);
      setSuggestion(plan);
      setWeight(plan.weight ? String(plan.weight) : updated.weight_kg !== null ? String(updated.weight_kg) : "");
    } else setWeight(updated.weight_kg !== null ? String(updated.weight_kg) : "");
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={themeText("#22C55E")} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={showReference ? filterExercises(shown, search, category) : []}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <>
            {hold && <MedicalHoldNotice live={live} />}
            {live && !hold && (
              <View style={styles.liveBar}>
                <Text style={styles.liveBarText}>
                  {self ? "💪" : "🤝"} {workingSetsToday()} set{workingSetsToday() === 1 ? "" : "s"} logged
                  {(self ? todaySession : todaySession?.in_person) ? " · saved" : ""}
                </Text>
                <Pressable style={styles.liveFinish} onPress={finishLive} disabled={savingProgress || workingSetsToday() === 0}>
                  <Text style={styles.completeText}>{(self ? todaySession : todaySession?.in_person) ? "Save again" : self ? "Finish workout" : "Finish live session"}</Text>
                </Pressable>
              </View>
            )}
            {client && !live && atHome && equipmentList(client.home_equipment).length === 0 && (
              <HomeEquipmentCard client={client} onChanged={() => refreshProfile()} />
            )}
            {client && !live && (
              <ClientCalendarView
                clientId={client.id}
                exercises={exercises}
                atHome={atHome}
                fit={fit}
                onSwapsChanged={(date) => {
                  if (date === todayIso()) getExerciseSwaps(date).then(setSwaps);
                }}
                catchUpDates={!todaySession ? catchUpChoices(today, missed).map((m) => m.workout_date) : []}
                onCatchUp={setChosenDay}
                refreshKey={refresh}
              />
            )}
            {client && (
              <View style={styles.todayCard}>
                <Text style={styles.todayHeading}>Today</Text>
                <Text style={styles.todayDate}>
                  {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
                </Text>
                {!hold && program && todaysWorkout.length > 0 && (
                  <Pressable style={[styles.todayRow, part === "main" && styles.todayRowOpen]} onPress={() => togglePart("main")}>
                    <Text style={styles.todayIcon}>{deloadToday && calendarToday ? "🌙" : catchUpFor ? "🔁" : "🏋️"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.todayTitle}>{todayTitle}</Text>
                      <Text style={styles.todayHint}>
                        {catchUpFor ? `Catching up ${weekdayOf(catchUpFor)}'s workout · ` : ""}
                        {todaysWorkout.length} exercise{todaysWorkout.length === 1 ? "" : "s"}
                        {todaySession ? ` · ${SESSION_LABELS[todaySession.status]}` : allTodaysSets.length > 0 ? " · In progress" : ""}
                      </Text>
                    </View>
                    {todaySession ? (
                      <View style={[styles.resultDot, { backgroundColor: themeBg(SESSION_COLORS[todaySession.status]) }]} />
                    ) : (
                      <Text style={styles.todayOpen}>{part === "main" ? "Close ▴" : "Start ›"}</Text>
                    )}
                  </Pressable>
                )}
                {!hold && calendarExtras.map((block, i) => (
                  <Pressable
                    key={`row-${block.program.id}-${i}`}
                    style={[styles.todayRow, part === `extra-${i}` && styles.todayRowOpen]}
                    onPress={() => togglePart(`extra-${i}`)}
                  >
                    <Text style={styles.todayIcon}>🤸</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.todayTitle}>{displayProgramName(block.program)}</Text>
                      <Text style={styles.todayHint}>
                        {block.daySlot != null ? `${sessionTitle(block.program, block.daySlot)} · ` : ""}
                        {block.exercises.length} exercise{block.exercises.length === 1 ? "" : "s"}
                        {resultOf(block) === "done" ? " · Done ✓" : resultOf(block) === "skipped" ? " · Couldn't do it" : ""}
                      </Text>
                    </View>
                    <Text style={styles.todayOpen}>{part === `extra-${i}` ? "Close ▴" : "Open ›"}</Text>
                  </Pressable>
                ))}
                {client && !live && !hold && <TodayPlanRows clientId={client.id} refreshKey={refresh} onCount={setPlanRows} />}
                {(!program || todaysWorkout.length === 0) && calendarExtras.length === 0 && planRows === 0 && (
                  <Text style={styles.todayRest}>
                    {program ? "😌 Rest day. Let your body recover." : "Nothing planned for today."}
                  </Text>
                )}
                {/* On a weekday yesterday's missed workout is offered here too, so it's seen without opening today's. */}
                {program && (todaysWorkout.length === 0 || !isWeekend(today)) && !catchUpFor && catchUpChoices(today, missed).length > 0 && !todaySession && (
                  <View style={styles.catchUpChips}>
                    {catchUpChoices(today, missed).map((m) => (
                      <Pressable key={m.workout_date} style={styles.catchUpChip} onPress={() => setChosenDay(m.workout_date)}>
                        <Text style={styles.catchUpChipText}>🔁 Catch up {weekdayOf(m.workout_date)}'s workout</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {!hold && (
                  <Pressable style={styles.supersetButton} onPress={() => setSupersetOpen(true)} accessibilityRole="button">
                    <Text style={styles.supersetButtonText}>⚡ Do a superset (2-4 exercises)</Text>
                    <Text style={styles.supersetButtonSub}>Pick the exercises, start, then log the whole round after each set.</Text>
                  </Pressable>
                )}
              </View>
            )}
            {program && part === "main" && (
              <View style={styles.programCard}>
                {catchUpFor ? (
                  <View style={styles.catchUp}>
                    <Text style={styles.catchUpTitle}>🔁 Catching up {weekdayOf(catchUpFor)}'s missed workout</Text>
                    {!todaySession && (
                      <View style={styles.catchUpChips}>
                        {catchUpChoices(today, missed)
                          .filter((m) => m.workout_date !== catchUpFor)
                          .map((m) => (
                            <Pressable key={m.workout_date} style={styles.catchUpChip} onPress={() => setChosenDay(m.workout_date)}>
                              <Text style={styles.catchUpChipText}>Do {weekdayOf(m.workout_date)}'s instead</Text>
                            </Pressable>
                          ))}
                        <Pressable style={styles.catchUpChip} onPress={() => setChosenDay("today")}>
                          <Text style={styles.catchUpChipText}>Do today's workout instead</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    {calendarToday && <Text style={styles.fromCalendar}>📅 Today's workout from your training calendar</Text>}
                    {calendarToday && client && !live && (
                      <WorkoutSwapRow
                        clientId={client.id}
                        today={today}
                        todayName={todayTitle}
                        startedToday={!!todaySession || allTodaysSets.length > 0}
                        refreshKey={refresh}
                        onSwapped={() => setRefresh((r) => r + 1)}
                      />
                    )}
                    {catchUpChoices(today, missed).length > 0 && !todaySession && (
                      <View style={styles.catchUpChips}>
                        {catchUpChoices(today, missed).map((m) => (
                          <Pressable key={m.workout_date} style={styles.catchUpChip} onPress={() => setChosenDay(m.workout_date)}>
                            <Text style={styles.catchUpChipText}>🔁 Catch up {weekdayOf(m.workout_date)}'s workout</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {missed.length > 0 && catchUpChoices(today, missed).length === 0 && !isWeekend(today) && (
                      <Text style={styles.carried}>
                        Missed {weekdayOf(missed[0].workout_date)}'s workout? You can catch it up on Saturday or Sunday.
                      </Text>
                    )}
                  </>
                )}
                <Text style={styles.programKicker}>{displayProgramName(program.program).toUpperCase()}</Text>
                <Text style={styles.programTitle}>{todayTitle}</Text>
                {session && sessionDue && session.dueOn < today && (
                  <Text style={styles.carried}>Carried over from {weekdayOf(session.dueOn)}. Complete it to unlock your next workout.</Text>
                )}
                {lightened && (
                  <Text style={styles.carried}>Your coach made today's session lighter to give your muscles time to recover.</Text>
                )}
                {deloadToday && calendarToday && (
                  <View style={styles.deload}>
                    <Text style={styles.deloadTitle}>🌙 Deload week</Text>
                    <Text style={styles.deloadText}>
                      Your coach has given you a lighter week so your body can recover and come back stronger: half the sets, about 70% of
                      your usual weights, and stop 3 or more reps before failure. Your normal program carries on next week.
                    </Text>
                  </View>
                )}
                {program.program.description ? (
                  <Pressable style={styles.howTo} onPress={() => setOpenInfo(openInfo === "how" ? null : "how")}>
                    <Text style={styles.howToTitle}>How to do it {openInfo === "how" ? "▲" : "▼"}</Text>
                    {openInfo === "how" ? <Text style={styles.howToText}>{program.program.description}</Text> : null}
                  </Pressable>
                ) : null}
                {program.program.nutrition ? (
                  <Pressable style={styles.howTo} onPress={() => setOpenInfo(openInfo === "food" ? null : "food")}>
                    <Text style={styles.howToTitle}>🍽 Nutrition for this program {openInfo === "food" ? "▲" : "▼"}</Text>
                    {openInfo === "food" ? <Text style={styles.howToText}>{program.program.nutrition}</Text> : null}
                  </Pressable>
                ) : null}
                {todaysWorkout.length === 0 ? (
                  <Text style={styles.helper}>
                    Rest day. Recover well, you've earned it.
                    {session && !sessionDue
                      ? ` Next up: ${sessionTitle(program.program, session.day)} on ${weekdayOf(session.dueOn)}.`
                      : ""}
                  </Text>
                ) : (
                  <View style={styles.sessionWarmUp}>
                    <Text style={styles.sessionWarmUpTitle}>Warm up first</Text>
                    <Text style={styles.howToText}>{program.program.warm_up}</Text>
                  </View>
                )}
                {hasIntervals(todaysWorkout) && todaySession?.status !== "complete" && (
                  <Pressable style={styles.timerButton} onPress={() => setTimerOpen(true)}>
                    <Text style={styles.timerButtonText}>⏱ Start interval timer</Text>
                    <Text style={styles.timerButtonSub}>Counts every round for you: red for work, green for easy.</Text>
                  </Pressable>
                )}
                {absOn && todaysWorkout.length > 0 && (
                  <View style={styles.sessionWarmUp}>
                    <Text style={styles.sessionWarmUpTitle}>Abs between sets</Text>
                    <Text style={styles.howToText}>
                      After each set, do {abReps} reps of{" "}
                      {program.program.abs_exercise ? program.program.abs_exercise.toLowerCase() : "the ab exercise the app shows you"}, then tap
                      Complete to start your rest. No abs after heavy squats, deadlifts, hip thrusts, lunges or heavy rows: rest fully for
                      those. At most {AB_MAX_ROUNDS} rounds of abs a session.
                    </Text>
                  </View>
                )}
                {calendarToday && todaysWorkout.length > 0 && (
                  <View style={styles.paceBox}>
                    <Text style={styles.sessionWarmUpTitle}>Your pace today</Text>
                    <View style={styles.paceChips}>
                      {PACE_OPTIONS.map((o) => (
                        <Pressable
                          key={o.key}
                          onPress={() => setPace(o.key)}
                          style={[styles.paceChip, pace === o.key && styles.paceChipOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: pace === o.key }}
                        >
                          <Text style={[styles.paceChipText, pace === o.key && styles.paceChipTextOn]}>{o.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.howToText}>{PACE_OPTIONS.find((o) => o.key === pace)?.guide}</Text>
                  </View>
                )}
                {todaysWorkout.length > 0 &&
                  todaysWorkout.map((row) => {
                    const done = setsDoneFor(row);
                    if (row.kind === "cardio") {
                      const ticked = done >= row.sets;
                      return (
                        <Pressable key={row.id} style={[styles.programRow, styles.cardioRow]} onPress={() => toggleCardio(row)}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>🔥 Cardio</Text>
                            <Text style={styles.category}>{cardioLabel(row)}</Text>
                          </View>
                          <Text style={[styles.setsDone, ticked && { color: themeText("#22C55E") }]}>{ticked ? "Done ✓" : "Tap when done"}</Text>
                        </Pressable>
                      );
                    }
                    const next = supersetNext(row, todaysWorkout);
                    return (
                      <Pressable key={row.id} style={styles.programRow} onPress={() => openProgramExercise(row)}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.doSetRow}>
                            <Text style={[styles.name, { flex: 1 }]}>{row.exercise_name}</Text>
                            <DoSetButton name={row.exercise_name} onPress={() => openProgramExercise(row)} />
                          </View>
                          <Text style={styles.category}>
                            {row.sets} sets x {row.reps} ·{" "}
                            {next ? supersetLabel(row, next) : `rest ${formatRest(row.rest_seconds)}`}
                          </Text>
                          <ExerciseGuideButton
                            name={row.exercise_name}
                            category={categoryOf(row)}
                            variant="bar"
                            onDoSet={() => openProgramExercise(row)}
                            videoUrl={
                              (exercises.find((e) => e.id === row.exercise_id) ?? exercises.find((e) => e.name === row.exercise_name))
                                ?.external_url ?? null
                            }
                          />
                          {swaps[row.id] && <Text style={styles.swappedText}>Swapped from {plannedRow(row).exercise_name}</Text>}
                          {!swaps[row.id] && gymName(row) && <Text style={styles.swappedText}>🏠 Home version of {gymName(row)}</Text>}
                          {(() => {
                            // It hurt last time: say so, and offer what they tried instead.
                            const hurt = swaps[row.id] ? null : lastPainFor(pains, row);
                            if (!hurt) return null;
                            const tried = hurt.tried_exercise_id ? exercises.find((e) => e.id === hurt.tried_exercise_id) : null;
                            return (
                              <View style={styles.hurtBox}>
                                <Text style={styles.hurtText}>
                                  😣 Hurt your {painAreaLabel(hurt.area).toLowerCase()} on {shortDate(hurt.created_at)}
                                  {hurt.tried_name ? `. You tried ${hurt.tried_name} instead.` : "."}
                                </Text>
                                {tried && (
                                  <Pressable
                                    hitSlop={6}
                                    onPress={() => {
                                      const next = { ...swaps, [row.id]: { id: tried.id, name: tried.name } };
                                      setSwaps(next);
                                      saveExerciseSwaps(todayIso(), next);
                                    }}
                                  >
                                    <Text style={styles.hurtUse}>Use {tried.name} again</Text>
                                  </Pressable>
                                )}
                              </View>
                            );
                          })()}
                          <View style={styles.rowLinks}>
                            <Pressable onPress={() => openSwap(row)} hitSlop={8}>
                              <Text style={styles.changeLink}>⇄ Change exercise</Text>
                            </Pressable>
                            <Pressable onPress={() => setHurting(row)} hitSlop={8}>
                              <Text style={styles.changeLink}>😣 This hurts</Text>
                            </Pressable>
                          </View>
                        </View>
                        <Text style={[styles.setsDone, done >= row.sets && { color: themeText("#22C55E") }]}>
                          {done >= row.sets ? "Done ✓" : `${done}/${row.sets}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                {todaySession && (
                  <View style={[styles.sessionResult, { borderColor: themeBorder(SESSION_COLORS[todaySession.status]) }]}>
                    <View style={styles.nameRow}>
                      <View style={[styles.resultDot, { backgroundColor: themeBg(SESSION_COLORS[todaySession.status]) }]} />
                      <Text style={styles.resultTitle}>
                        {SESSION_LABELS[todaySession.status]} today
                        {todaySession.status !== "missed" ? ` · ${todaySession.sets_done}/${todaySession.sets_planned} sets` : ""}
                      </Text>
                    </View>
                    {todaySession.reason ? <Text style={styles.howToText}>{todaySession.reason}</Text> : null}
                    {todaySession.improvements.map((i) => (
                      <Text key={i.exercise} style={styles.starLine}>
                        ⭐ {i.exercise}: {i.before} → {i.after}
                      </Text>
                    ))}
                  </View>
                )}
                {!live && todaysWorkout.length > 0 && todaySession?.status !== "complete" && (
                  <View style={styles.sessionButtons}>
                    <Pressable style={styles.completeButton} onPress={completeWorkout} disabled={savingProgress}>
                      <Text style={styles.completeText}>Complete workout</Text>
                    </Pressable>
                    {!todaySession && (
                      <Pressable style={styles.moveButton} onPress={() => setReasonFor("missed")} disabled={savingProgress}>
                        <Text style={styles.moveText}>{session && sessionDue ? "Move to tomorrow" : "Couldn't train today"}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}
            {calendarExtras.map((block, i) =>
              part !== `extra-${i}` ? null : (
              <View key={`${block.program.id}-${i}`} style={styles.programCard}>
                <Text style={styles.fromCalendar}>📅 Extra block from your coach for today</Text>
                <Text style={styles.programTitle}>{displayProgramName(block.program)}</Text>
                {block.daySlot != null && <Text style={styles.category}>{sessionTitle(block.program, block.daySlot)}</Text>}
                {block.program.warm_up ? (
                  <View style={styles.sessionWarmUp}>
                    <Text style={styles.sessionWarmUpTitle}>Warm up first</Text>
                    <Text style={styles.howToText}>{block.program.warm_up}</Text>
                  </View>
                ) : null}
                {[...block.exercises]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((row) => {
                    if (row.kind === "cardio") {
                      const ticked = cardioDone.includes(row.id);
                      return (
                        <Pressable key={row.id} style={[styles.programRow, styles.cardioRow]} onPress={() => toggleCardio(row)}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>🔥 Cardio</Text>
                            <Text style={styles.category}>{cardioLabel(row)}</Text>
                          </View>
                          <Text style={[styles.setsDone, ticked && { color: themeText("#22C55E") }]}>{ticked ? "Done ✓" : "Tap when done"}</Text>
                        </Pressable>
                      );
                    }
                    const ex = exercises.find((e) => e.id === row.exercise_id) ?? exercises.find((e) => e.name === row.exercise_name);
                    return (
                      <View key={row.id} style={styles.programRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{row.exercise_name}</Text>
                          <Text style={styles.category}>
                            {row.sets} sets x {row.reps} · rest {formatRest(row.rest_seconds)}
                          </Text>
                          <ExerciseGuideButton
                            name={row.exercise_name}
                            category={ex?.category ?? null}
                            variant="bar"
                            onDoSet={ex ? () => openExercise(ex) : undefined}
                            videoUrl={ex?.external_url ?? null}
                          />
                        </View>
                      </View>
                    );
                  })}
                {block.blockId &&
                  (resultOf(block) ? (
                    <View style={styles.nameRow}>
                      <Text style={[styles.resultTitle, { flex: 1 }]}>
                        {resultOf(block) === "done" ? "✅ Done. Your coach can see it." : "Marked as couldn't do it. Your coach can see it."}
                      </Text>
                      <Pressable onPress={() => setBlockResult(block, null)} hitSlop={8}>
                        <Text style={styles.changeLink}>Undo</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.sessionButtons}>
                      <Pressable style={styles.completeButton} onPress={() => setBlockResult(block, "done")}>
                        <Text style={styles.completeText}>Done ✓</Text>
                      </Pressable>
                      <Pressable style={styles.moveButton} onPress={() => setBlockResult(block, "skipped")}>
                        <Text style={styles.moveText}>Couldn't do it</Text>
                      </Pressable>
                    </View>
                  ))}
              </View>
            ))}
            {client && !live && (
              <FoldSection icon="🏃" title="Other exercise" hint="Log a walk, run, ride or hike" open={part === "other"} onToggle={() => togglePart("other")}>
                <OtherActivityCard clientId={client.id} role="client" />
              </FoldSection>
            )}
            {client && !live && (
              <FoldSection icon="📋" title="My past workouts" hint="Last two weeks, 🤝 live sessions with your coach" open={part === "past"} onToggle={() => togglePart("past")}>
                <MyPastWorkouts clientId={client.id} />
              </FoldSection>
            )}
            {showReference && <Text style={styles.title}>{live ? "Add an exercise" : "Exercise reference"}</Text>}
            {live && <Text style={styles.helper}>Pick whatever's free in the gym. Tap it to log sets.</Text>}
            {!showReference ? null : !live && client?.library_access === false ? (
              <Text style={styles.helper}>
                These are the exercises in your program. Ask your coach if you'd like the full exercise library.
              </Text>
            ) : (
              <>
                <GymHomeTabs current={place} onChange={choosePlace} accent="#22C55E" />
                <TextInput
                  style={[styles.input, { marginBottom: 10 }]}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={`Search ${shown.length} exercises`}
                  placeholderTextColor="#64748B"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {[null, ...exerciseCategories(shown)].map((c) => (
                    <Pressable
                      key={c ?? "all"}
                      style={[styles.effortChip, styles.categoryChip, category === c && styles.effortChipSelected]}
                      onPress={() => setCategory(c)}
                    >
                      <Text style={[styles.effortChipText, category === c && styles.effortChipTextSelected]}>{c ?? "All"}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          !showReference ? null : (
          <Text style={styles.helper}>
            {!live && client?.library_access === false ? "Your coach hasn't set up your program yet." : "No exercises match that search."}
          </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openExercise(item)}>
            {/* A picture of the move, so clients who don't know the name can spot it (0171). */}
            {!wide && <ExerciseThumb url={item.external_url} />}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <ExerciseGuideButton name={item.name} category={item.category} onDoSet={() => openExercise(item)} videoUrl={item.external_url} />
              </View>
              {item.category && <Text style={styles.category}>{categoryLabel(item.category)}</Text>}
            </View>
            {/* Trainer's laptop: the clip plays small right in the list (GRIZZ, 2026-10-27). */}
            {wide && item.external_url ? (
              <View style={{ marginHorizontal: 14 }}>
                <ExerciseClip url={item.external_url} width={110} height={64} />
              </View>
            ) : null}
            <Text style={styles.link}>{"Log a set >"}</Text>
          </Pressable>
        )}
      />

      {program && (
        <IntervalTimerModal
          visible={timerOpen}
          title={workoutTitle()}
          description={program.program.description}
          warmUp={program.program.warm_up}
          rows={todaysWorkout}
          onSave={saveIntervals}
          onClose={() => setTimerOpen(false)}
        />
      )}
      {client && (
        <SupersetLogger
          visible={supersetOpen}
          client={client}
          rows={todaysWorkout}
          library={browsable}
          todaysSets={allTodaysSets}
          onSaved={(logs) => {
            setAllTodaysSets((prev) => [...prev, ...logs]);
            logs.forEach((l) => checkAchievement(client.id, l).then((b) => b && (supersetBadge.current = b)));
          }}
          onClose={() => {
            setSupersetOpen(false);
            if (supersetBadge.current) setBadge(supersetBadge.current);
            supersetBadge.current = null;
          }}
        />
      )}
      {program && client && dropMode && (
        <DropSetLogger
          visible={!!dropRow}
          row={dropRow}
          client={client}
          programId={program.program.id}
          rounds={dropRounds}
          roundsDone={dropRow ? setsDoneFor(dropRow) : 0}
          onSaved={(logs) => setAllTodaysSets((prev) => [...prev, ...logs])}
          onClose={() => setDropRow(null)}
        />
      )}
      <Celebration info={starred} onClose={() => setStarred(null)} />
      <WorkoutReasonModal
        kind={reasonFor}
        done={todaysWorkout.reduce((t, r) => t + Math.min(setsDoneFor(r), r.sets), 0)}
        planned={todaysWorkout.reduce((t, r) => t + r.sets, 0)}
        saving={savingProgress}
        onCancel={() => setReasonFor(null)}
        onSend={sendReason}
      />
      <PainSwapModal
        exercise={hurting ? { exercise_id: hurting.exercise_id, exercise_name: hurting.exercise_name, category: categoryOf(hurting) } : null}
        library={painLibrary}
        hurtIds={[...pains.map((p) => p.exercise_id), hurting ? plannedRow(hurting).exercise_id : null]}
        onPick={reportPain}
        onClose={() => setHurting(null)}
      />
      <ExerciseSwapModal
        visible={!!swapping}
        exerciseName={swapping?.exercise_name ?? null}
        category={swapCategory}
        choices={swapChoices}
        swapped={!!swapping && !!swaps[swapping.id]}
        onChoose={chooseSwap}
        onClose={() => setSwapping(null)}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardSafe>
        <ModalSafeArea style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{selected?.name}</Text>
              {selected?.category && <Text style={styles.category}>{selected.category}</Text>}
            </View>
            <Pressable onPress={() => setSelected(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {/* GRIZZ 2026-10-13: the video first so the client sees the movement straight away,
                then How to do it, and last time's weights and reps just above Log a set. */}
            {selected?.external_url && !playableClip(selected.external_url) ? (
              <YouTubeCard url={selected.external_url} />
            ) : selected?.external_url ? (
              <>
                <VideoView
                  style={[styles.video, videoExpanded ? styles.videoExpanded : { height: compactVideoHeight }]}
                  player={player}
                  contentFit="contain"
                  nativeControls
                />
                <Pressable onPress={() => setVideoExpanded((v) => !v)} hitSlop={8}>
                  <Text style={styles.expandText}>{videoExpanded ? "Make video smaller" : "Make video bigger"}</Text>
                </Pressable>
              </>
            ) : (
              selected && <WatchOnlineLink name={selected.name} />
            )}
            {selected && <ExerciseGuideButton name={selected.name} category={selected.category} variant="bar" />}
            <View style={{ height: 10 }} />
            {target && (
              <Text style={styles.targetText}>
                Target: {target.sets} sets x {target.reps} reps ·{" "}
                {targetNext ? supersetLabel(target, targetNext) : `rest ${formatRest(target.rest_seconds)}`}
              </Text>
            )}
            {target && target.kind !== "cardio" && (
              <View style={[styles.rowLinks, { marginBottom: 10 }]}>
                {todaysSets.every((s) => s.warm_up) && (
                  <Pressable onPress={() => changeFromLog(target)} hitSlop={8}>
                    <Text style={styles.changeLink}>⇄ Gym busy? Change exercise</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => hurtsFromLog(target)} hitSlop={8}>
                  <Text style={styles.changeLink}>😣 This hurts</Text>
                </Pressable>
              </View>
            )}
            {warmUpDue &&
              (() => {
                const warmUpRepsText = target ? warmUpReps(target.reps) : null;
                const half = warmUpWeight(startWeight ? Number(startWeight) : null);
                return (
                  <View style={styles.warmUpBox}>
                    <Text style={styles.warmUpTitle}>Warm-up set first</Text>
                    <Text style={styles.warmUpText}>
                      First {selected?.category?.toLowerCase()} exercise today: do 1 warm-up set at about half your start weight
                      {half ? ` (${half}kg)` : ""}{warmUpRepsText ? ` for ${warmUpRepsText} easy reps` : ""}. It's logged as a warm-up and
                      doesn't count as one of your working sets.
                    </Text>
                    {target && needsRamp(target.reps) && (
                      <Text style={styles.warmUpText}>
                        These are heavy sets, so build up after it: 3-5 reps at about 70% of your start weight, then 1-2 reps at about 85%,
                        before your first working set. No need to log those.
                      </Text>
                    )}
                    <Pressable onPress={skipWarmUp} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                      <Text style={styles.changeLink}>Already warmed up? Skip it</Text>
                    </Pressable>
                  </View>
                );
              })()}
            {gaugeDue && !warmUpDue && (
              <View style={styles.gaugeBox}>
                <Text style={styles.gaugeTitle}>🎯 Gauge set: first time doing this exercise</Text>
                <Text style={styles.warmUpText}>
                  Your coach isn't there to pick your weight, so this set finds it. Pick a weight you think you can lift about 6-10 times.
                  Do a hard set, and stop when you think you have 1-2 good reps left, or as soon as a rep slows right down or your form
                  changes. Log the weight and your reps, and the app works out the right weight for the rest of your sets. No weight
                  needed (bodyweight only)? Put 0.
                </Text>
                <Text style={styles.warmUpText}>
                  {intro ? `Don't go to failure: no set does in your first ${introLength}, this one included.` : "Don't go to failure on this set."}
                </Text>
                {selected && needsSafeties(selected.name) && <Text style={styles.warmUpText}>{SAFETIES_NOTE}</Text>}
              </View>
            )}
            {gaugeResult && (
              <View style={styles.gaugeBox}>
                <Text style={styles.gaugeTitle}>🎯 Your working weight: {gaugeResult.weight}kg</Text>
                <Text style={styles.warmUpText}>{gaugeResult.advice}</Text>
              </View>
            )}
            {suggestion && (
              <View style={styles.warmUpBox}>
                <Text style={styles.warmUpTitle}>{apre ? "📊" : "📈"} {suggestion.last}</Text>
                <Text style={styles.warmUpText}>{suggestion.advice}</Text>
                {apre && selected && needsSafeties(selected.name) && <Text style={styles.warmUpText}>{SAFETIES_NOTE}</Text>}
              </View>
            )}
            <Text style={[styles.sectionHeading, { marginTop: 0 }]}>{warmUpDue ? "Log your warm-up set" : "Log a set"}</Text>
            <MuscleNotWeight />
            <EveryRepTips />
            <View style={styles.setRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Optional"
                  placeholderTextColor="#64748B"
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="e.g. 8"
                  placeholderTextColor="#64748B"
                  value={reps}
                  onChangeText={setReps}
                />
              </View>
            </View>

            {!warmUpDue && !gaugeDue && <Text style={styles.fieldLabel}>{EFFORT_QUESTION}</Text>}
            {!warmUpDue && !gaugeDue && intro && (
              <Text style={styles.introNote}>
                Your first {introLength}: stop each set when you could still do 1-2 more good reps. Going to failure comes after your intro program.
              </Text>
            )}
            {!warmUpDue && !gaugeDue && <View style={styles.effortRow}>
              {EFFORT_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  style={[styles.effortChip, effort === o.key && styles.effortChipSelected]}
                  onPress={() => setEffort(o.key)}
                >
                  <Text style={[styles.effortChipText, effort === o.key && styles.effortChipTextSelected]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>}

            <Pressable style={styles.button} onPress={logSet} disabled={logging}>
              {logging ? (
                <ActivityIndicator color={themeText("#0F172A")} />
              ) : (
                <Text style={styles.buttonText}>{warmUpDue ? "Log warm-up set" : gaugeDue ? "Log gauge set" : "Log set"}</Text>
              )}
            </Pressable>
            {selected && !live && (
              <Pressable style={styles.filmButton} onPress={() => film.filmOrPick(selected.name)} disabled={film.uploading}>
                {film.uploading ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.filmText}>🎥 Film this set for my coach</Text>}
              </Pressable>
            )}

            {absDue && (
              <View style={styles.absBox}>
                <Text style={styles.warmUpTitle}>
                  Abs: {abReps} x {abName(absDue.count)}
                </Text>
                <Text style={styles.warmUpText}>
                  Do {abReps} reps of {abName(absDue.count).toLowerCase()} now, then tap Complete to start your rest.
                </Text>
                <Pressable style={styles.absButton} onPress={finishAbs} accessibilityRole="button">
                  <Text style={styles.buttonText}>Complete</Text>
                </Pressable>
              </View>
            )}
            {targetNext && restRun === 0 && !absDue && (
              <View style={styles.warmUpBox}>
                <Text style={styles.warmUpTitle}>Superset: no rest</Text>
                <Text style={styles.warmUpText}>After each set, the app takes you straight to {targetNext.exercise_name}, then you rest.</Text>
              </View>
            )}
            {restRun > 0 && (
              <RestTimer
                key={restRun}
                seconds={restSeconds}
                onClose={() => setRestRun(0)}
              />
            )}

            {todaysSets.length > 0 && (
              <>
                <Text style={styles.sectionHeading}>Today's sets</Text>
                <Text style={styles.loggedSetHint}>Made a mistake? Tap a set to change it.</Text>
                {todaysSets.map((s) => (
                  <Pressable key={s.id} style={styles.loggedSetRow} onPress={() => setEditingSet(s)}>
                    <Text style={styles.loggedSetText}>
                      {s.warm_up ? "Warm-up" : `Set ${s.set_number}`}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
                      {s.reps} reps
                    </Text>
                    <Text style={styles.loggedSetEffort}>{s.warm_up ? "Not a working set" : EFFORT_LABEL[s.effort]} ✏️</Text>
                  </Pressable>
                ))}
              </>
            )}

          </ScrollView>
        </ModalSafeArea>
        </KeyboardSafe>
        <AchievementBadge badge={badge} onClose={() => setBadge(null)} />
        <EditSetModal set={editingSet} onSaved={setFixed} onClose={() => setEditingSet(null)} />
      </Modal>
    </View>
  );
}

const styles = themedStyles({
  todayCard: { backgroundColor: "#111C33", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#1E293B" },
  todayHeading: { color: BRAND_GOLD, fontSize: 22, fontWeight: "800" },
  todayDate: { color: "#94A3B8", fontSize: 13, marginTop: 2, marginBottom: 6 },
  todayRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F172A", borderRadius: 12, padding: 14, marginTop: 8 },
  todayRowOpen: { borderWidth: 1, borderColor: BRAND_GOLD },
  todayIcon: { fontSize: 26 },
  todayTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  todayHint: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  todayOpen: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700" },
  todayRest: { color: "#CBD5E1", fontSize: 15, marginTop: 10 },
  deload: { borderWidth: 1, borderColor: DELOAD_BLUE, borderRadius: 10, padding: 10, marginTop: 8 },
  deloadTitle: { color: DELOAD_BLUE, fontWeight: "700", fontSize: 14 },
  deloadText: { color: "#E2E8F0", fontSize: 13, lineHeight: 18, marginTop: 4 },
  doSetRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  absBox: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginTop: 12, borderWidth: 1.5, borderColor: BRAND_GOLD },
  absButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  catchUp: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: BRAND_GOLD },
  catchUpTitle: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14 },
  catchUpChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 6 },
  catchUpChip: { backgroundColor: "#334155", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  catchUpChipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  fromCalendar: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  paceBox: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 10 },
  paceChips: { flexDirection: "row", gap: 6, marginVertical: 8 },
  paceChip: { flex: 1, borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  paceChipOn: { borderColor: BRAND_GOLD, backgroundColor: "#2A2410" },
  paceChipText: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  paceChipTextOn: { color: BRAND_GOLD },
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  name: { color: "#fff", fontWeight: "600", flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  category: { color: "#64748B", fontSize: 12, marginTop: 2 },
  link: { color: "#22C55E", fontSize: 13 },
  helper: { color: "#94A3B8", fontSize: 13, marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: "#0F172A" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
  },
  closeText: { color: "#22C55E", fontWeight: "600", fontSize: 15 },
  video: { width: "100%", backgroundColor: "#000", borderRadius: 10, marginBottom: 8 },
  videoExpanded: { aspectRatio: 9 / 16 },
  expandText: { color: "#22C55E", fontSize: 13, fontWeight: "600", textAlign: "center" },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 20, marginBottom: 10 },
  setRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  fieldLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  // Not flex: 0, which the website reads as "shrink to nothing" and stacks the letters.
  categoryChip: { flexGrow: 0, flexShrink: 0, paddingHorizontal: 14, marginRight: 8 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 15 },
  gaugeBox: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: BRAND_GOLD },
  gaugeTitle: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  introNote: { color: "#FBBF24", fontSize: 12, marginBottom: 8 },
  effortRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  effortChip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  effortChipSelected: { backgroundColor: "#22C55E" },
  effortChipText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  effortChipTextSelected: { color: "#0F172A" },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  filmButton: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  filmText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  loggedSetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  loggedSetText: { color: "#fff", fontSize: 14 },
  loggedSetEffort: { color: "#64748B", fontSize: 12 },
  loggedSetHint: { color: "#64748B", fontSize: 12, marginTop: -6, marginBottom: 6 },
  sessionWarmUp: {
    backgroundColor: "#1E293B",
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  sessionWarmUpTitle: { color: BRAND_GOLD, fontWeight: "700", marginBottom: 4 },
  cardioRow: { borderLeftWidth: 3, borderLeftColor: "#F97316", paddingLeft: 8 },
  supersetButton: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, marginTop: 10 },
  supersetButtonText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  supersetButtonSub: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  timerButton: { backgroundColor: "#7F1D1D", borderColor: "#DC2626", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  timerButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  timerButtonSub: { color: "#FECACA", fontSize: 13, marginTop: 2 },
  programCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
  },
  swappedText: { color: BRAND_GOLD, fontSize: 12, marginTop: 2 },
  changeLink: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 6 },
  rowLinks: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignSelf: "flex-start" },
  hurtBox: { backgroundColor: "#3B1D1D", borderRadius: 8, padding: 8, marginTop: 6 },
  hurtText: { color: "#FCA5A5", fontSize: 12, fontWeight: "600" },
  hurtUse: { color: "#22C55E", fontSize: 12, fontWeight: "800", marginTop: 4 },
  swapBack: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 10 },
  swapBackText: { color: BRAND_GOLD, fontWeight: "700" },
  swapRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  swapRowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  swapWatch: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  swapUse: { backgroundColor: "#22C55E", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  swapUseText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  programKicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  programTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2, marginBottom: 10 },
  programRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  carried: { color: "#FBBF24", fontSize: 13, marginBottom: 8 },
  howTo: { backgroundColor: "#0F172A", borderRadius: 8, padding: 10, marginBottom: 10 },
  howToTitle: { color: BRAND_GOLD, fontWeight: "700", fontSize: 12, marginBottom: 4 },
  howToText: { color: "#E2E8F0", fontSize: 13 },
  sessionButtons: { flexDirection: "row", gap: 8, marginTop: 10 },
  sessionResult: { borderWidth: 1.5, borderRadius: 10, padding: 10, marginTop: 10, gap: 4 },
  resultDot: { width: 12, height: 12, borderRadius: 6 },
  resultTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  starLine: { color: STAR_GOLD, fontWeight: "700", fontSize: 13 },
  liveBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#14532D", borderRadius: 12, padding: 12, marginBottom: 14 },
  liveBarText: { color: "#fff", fontWeight: "700", flex: 1 },
  liveFinish: { backgroundColor: "#22C55E", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  completeButton: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  completeText: { color: "#0F172A", fontWeight: "800" },
  moveButton: { flex: 1, borderWidth: 1, borderColor: "#475569", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  moveText: { color: "#E2E8F0", fontWeight: "600" },
  setsDone: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  targetText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginBottom: 12 },
  warmUpBox: { backgroundColor: "#2A2114", borderColor: "#F59E0B", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  warmUpTitle: { color: "#FBBF24", fontWeight: "700", fontSize: 14 },
  warmUpText: { color: "#E2E8F0", fontSize: 13, marginTop: 4 },
});
