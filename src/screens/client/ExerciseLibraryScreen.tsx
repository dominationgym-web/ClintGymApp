import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  AppState,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { supabase } from "@/lib/supabase";
import {
  clientBrowsable,
  exerciseCategories,
  filterExercises,
  forPlace,
  withHomeAlternatives,
  swapOptions,
  type ExercisePlace,
} from "@/lib/exerciseFilter";
import { getCardioDone, getExerciseSwaps, saveCardioDone, saveExerciseSwaps, type ExerciseSwaps } from "@/lib/exerciseSwaps";
import WatchOnlineLink from "@/components/WatchOnlineLink";
import ExerciseGuideButton, { DoSetButton, MuscleNotWeight } from "@/components/ExerciseGuide";
import GymHomeTabs from "@/components/GymHomeTabs";
import { todayIso, toIsoDate } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { Exercise, ProgramExercise, SetEffort, WorkoutLog, WorkoutSession } from "@/types/database";
import WorkoutReasonModal from "@/components/WorkoutReasonModal";
import { findImprovements, SESSION_COLORS, SESSION_LABELS, sessionStatus, STAR_GOLD } from "@/lib/workoutSessions";
import RestTimer from "@/components/RestTimer";
import AchievementBadge from "@/components/AchievementBadge";
import { checkAchievement } from "@/lib/achievementQueries";
import type { ClientAchievement } from "@/types/database";
import { AB_REPS, abExerciseFor, absBetweenSets } from "@/lib/absBetweenSets";
import EveryRepTips from "@/components/EveryRepTips";
import { suggestNext, type Suggestion } from "@/lib/progression";
import { loadCalendarWorkoutFor, loadClientProgram, type ActiveProgram, type CalendarDayWorkout } from "@/lib/programQueries";
import { PACE_OPTIONS, withPace, type WorkoutPace } from "@/lib/trainingCalendar";
import ClientCalendarView from "@/components/ClientCalendarView";
import HomeEquipmentCard from "@/components/HomeEquipmentCard";
import IntervalTimerModal from "@/components/IntervalTimerModal";
import { hasIntervals } from "@/lib/intervalTimer";
import { equipmentList, homeFit } from "@/lib/equipment";
import ExerciseSwapModal from "@/components/ExerciseSwapModal";
import {
  cardioLabel,
  dayTitle,
  withExtraCardio,
  DEFAULT_REST_SECONDS,
  displayProgramName,
  exercisesForDate,
  formatRest,
  needsWarmUp,
  supersetNext,
  supersetStep,
  nextUnfinished,
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
import { applyRecoveryAdjustment } from "@/lib/recovery";
import { BRAND_GOLD } from "@/lib/brand";
import KeyboardSafe from "@/components/KeyboardSafe";

const EFFORT_OPTIONS: { key: SetEffort; label: string }[] = [
  { key: "comfortable", label: "Comfortable" },
  { key: "close_to_failure", label: "Close to failure" },
  { key: "failure", label: "Failure" },
];

const EFFORT_LABEL: Record<SetEffort, string> = {
  comfortable: "Comfortable",
  close_to_failure: "Close to failure",
  failure: "Failure",
};

export default function ExerciseLibraryScreen() {
  const { client, refreshProfile } = useAuth();
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
  const [calendarExtras, setCalendarExtras] = useState<CalendarDayWorkout[]>([]);
  const [pace, setPace] = useState<WorkoutPace>("planned");
  // How today's workout went, once the client has finished it (0076).
  const [todaySession, setTodaySession] = useState<WorkoutSession | null>(null);
  const [reasonFor, setReasonFor] = useState<"partial" | "missed" | null>(null);
  // Every set logged today, to tick off the program and spot warm-ups.
  const [allTodaysSets, setAllTodaysSets] = useState<WorkoutLog[]>([]);
  // The program line for the exercise that's open, if it came from the program.
  const [target, setTarget] = useState<ProgramExercise | null>(null);
  // Bumped after each logged set to (re)start the rest timer.
  const [restRun, setRestRun] = useState(0);
  // Length of the rest timer that's showing.
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  // Abs between sets (0083): after a working set the client does 20 ab reps
  // and taps Complete, which starts the rest timer. `rest` is that timer's length.
  // Gold achievement badge (0085) earned by the set just logged.
  const [badge, setBadge] = useState<ClientAchievement | null>(null);
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
  // Cardio blocks (0048) ticked off today.
  const [cardioDone, setCardioDone] = useState<string[]>([]);
  // The program's how-to and nutrition notes open on tap, so the workout stays near the top.
  const [openInfo, setOpenInfo] = useState<"how" | "food" | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
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
      if (loadedFor.current && loadedFor.current !== todayIso()) setRefresh((r) => r + 1);
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
      const [{ data, error }, active, calendar, { data: logged }, todaysSwaps, { data: sessionRow }] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        client ? loadClientProgram(client.id) : Promise.resolve(null),
        client ? loadCalendarWorkoutFor(client.id, todayIso()) : Promise.resolve(null),
        client
          ? supabase.from("workout_logs").select("*").eq("client_id", client.id).eq("log_date", todayIso())
          : Promise.resolve({ data: [] as WorkoutLog[] }),
        getExerciseSwaps(todayIso()),
        client
          ? supabase.from("workout_sessions").select("*").eq("client_id", client.id).eq("session_date", todayIso()).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setTodaySession(sessionRow ?? null);
      setSwaps(todaysSwaps);
      setCardioDone(await getCardioDone(todayIso()));
      if (!error && data) setExercises(data);
      setCalendarExtras(calendar?.extras ?? []);
      setCalendarSlot(calendar?.main?.daySlot ?? null);
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
  }, [client?.id, refresh]);

  // Weekly programs are worked through in order (0037): the current session
  // shows from its day until it's completed or moved.
  const today = todayIso();
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
  const todaysWorkout = homePlan.map((row) => {
    const swap = swaps[row.id];
    return swap ? { ...row, exercise_id: swap.id, exercise_name: swap.name } : row;
  });
  const plannedRow = (row: ProgramExercise) => homePlan.find((r) => r.id === row.id) ?? row;
  // 20 ab reps between sets on this workout, unless the trainer switched it off (0083).
  const absOn = absBetweenSets(program?.program, client);
  const abReps = program?.program.abs_reps || AB_REPS;
  const abName = (count: number) => abExerciseFor(count - 1, program?.program.abs_exercise);
  const workingSetsToday = () => allTodaysSets.filter((s) => !s.warm_up).length;
  const categoryOf = (row: ProgramExercise) =>
    exercises.find((e) => e.id === row.exercise_id)?.category ??
    exercises.find((e) => e.name === row.exercise_name)?.category ??
    null;
  const programExerciseIds = program ? [...program.exercises.map((e) => e.exercise_id), ...homeIds] : [];
  // Without full library access the database also lets a client see other
  // exercises for their program's body parts (for Change exercise, 0047), but
  // the reference list still only shows their program's.
  const browsable =
    client?.library_access === false
      ? exercises.filter((e) => programExerciseIds.includes(e.id))
      : clientBrowsable(exercises, programExerciseIds);
  const shown = forPlace(browsable, place, fit);
  // The program card already lists today's exercises, so the reference list
  // only shows for clients who aren't on a program yet.
  const showReference = !program;
  const choosePlace = (next: ExercisePlace) => {
    setPlace(next);
    setCategory(null);
  };
  // The open exercise is the first half of a superset: no rest timer after it.
  const targetNext = target ? supersetNext(target, todaysWorkout) : null;
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

  const swapCategory = swapping ? categoryOf(swapping) : null;
  const swapChoices = swapping
    ? forPlace(swapOptions(exercises, swapCategory, [swapping.exercise_id, swaps[swapping.id]?.id ?? null]), atHome ? "home" : "gym", fit)
    : [];

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
    const planned = todaysWorkout.reduce((t, r) => t + r.sets, 0);
    const done = todaysWorkout.reduce((t, r) => t + Math.min(setsDoneFor(r), r.sets), 0);
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
      p_title: workoutTitle(),
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
    return data;
  };

  const afterRecorded = async (saved: WorkoutSession) => {
    if (session && sessionDue) {
      if (saved.status === "missed") await saveProgress(sessionMovedToTomorrow(session, today), false);
      else await saveProgress(sessionAfterComplete(session, days, today), true);
    }
    const star = saved.improvements.length
      ? `\n\n⭐ Gold star! You pushed up: ${saved.improvements.map((i) => `${i.exercise} ${i.before} → ${i.after}`).join(", ")}.`
      : "";
    if (saved.status === "complete") Alert.alert("Workout complete ✅", `Great work.${star}`);
    else Alert.alert("Thanks for letting your coach know", saved.status === "partial" ? `Every set counts.${star}` : "Rest up and look after yourself.");
  };

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
          (s) => !s.warm_up && (row.exercise_id ? s.exercise_id === row.exercise_id : s.exercise_name === row.exercise_name),
        ).length;

  // `rest`: start a rest timer on arrival (coming back to a superset's first half).
  const openProgramExercise = (row: ProgramExercise, rest = 0) => {
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
    openExercise(exercise, row, rest);
  };

  const player = useVideoPlayer(selected?.external_url ?? null, (p) => {
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

  const openExercise = async (exercise: Exercise, programRow: ProgramExercise | null = null, rest = 0) => {
    setSelected(exercise);
    setTarget(programRow);
    // Rest after a set waits for the ab reps when the workout has them.
    const abs = rest > 0 && absOn;
    setAbsDue(abs ? { rest, count: workingSetsToday() } : null);
    setRestSeconds(rest);
    setRestRun(rest > 0 && !abs ? Date.now() : 0);
    setVideoExpanded(false);
    setWeight("");
    setReps("");
    setEffort(null);
    setSuggestion(null);
    setWarmUpDue(false);
    setStartWeight("");
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
    const next = lastDate ? suggestNext(earlier.filter((s) => s.log_date === lastDate), programRow?.reps, exercise) : null;
    setSuggestion(next);
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
    if (!effort && !warmUp) {
      Alert.alert("Missing effort", "Pick how the set felt.");
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
        weight_kg: weight ? Number(weight) : null,
        reps: repsNum,
        effort: warmUp ? "comfortable" : effort!,
        warm_up: warmUp,
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
    if (warmUp) {
      // Warm-up done: back to the start weight for the working sets, after a short breather.
      setWarmUpDue(false);
      setAbsDue(null);
      setWeight(startWeight);
      setRestSeconds(60);
      setRestRun((n) => n + 1);
      return;
    }
    // Keep the weight for the next set; most sets use the same one.
    setWeight(data.weight_kg !== null ? String(data.weight_kg) : "");
    const done = (row: ProgramExercise) =>
      target && row.id === target.id ? workingDone + 1 : setsDoneFor(row);
    // Supersets alternate: straight into the partner, or back to the first
    // half with the rest timer running.
    const step = target ? supersetStep(target, todaysWorkout, done) : null;
    if (step) {
      openProgramExercise(step.go, step.restSeconds);
      return;
    }
    const rest = target?.rest_seconds || DEFAULT_REST_SECONDS;
    const next = target && workingDone + 1 >= target.sets ? nextUnfinished(target, todaysWorkout, done) : null;
    // Abs between sets, except after the very last set of the workout.
    if (target && absOn && (workingDone + 1 < target.sets || next)) {
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
          { text: "Next exercise", onPress: () => openProgramExercise(next, absOn ? rest : 0) },
        ]);
      } else {
        const finish = session && sessionDue ? " Tap Complete workout to unlock your next session." : " Tap Complete workout so your coach sees it.";
        Alert.alert("Workout done 💪", `That's every exercise.${finish}`, [{ text: "OK", onPress: () => setSelected(null) }]);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
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
            {client && atHome && equipmentList(client.home_equipment).length === 0 && (
              <HomeEquipmentCard client={client} onChanged={() => refreshProfile()} />
            )}
            {client && (
              <ClientCalendarView
                clientId={client.id}
                exercises={exercises}
                atHome={atHome}
                fit={fit}
                onSwapsChanged={(date) => {
                  if (date === todayIso()) getExerciseSwaps(date).then(setSwaps);
                }}
              />
            )}
            {program && (
              <View style={styles.programCard}>
                {calendarToday && <Text style={styles.fromCalendar}>📅 Today's workout from your training calendar</Text>}
                <Text style={styles.programKicker}>{displayProgramName(program.program).toUpperCase()}</Text>
                <Text style={styles.programTitle}>
                  {session
                    ? sessionDue
                      ? sessionTitle(program.program, session.day)
                      : "Rest day"
                    : calendarToday && calendarSlot != null
                      ? sessionTitle(program.program, calendarSlot)
                      : dayTitle(program.program, new Date())}
                </Text>
                {session && sessionDue && session.dueOn < today && (
                  <Text style={styles.carried}>Carried over from {weekdayOf(session.dueOn)}. Complete it to unlock your next workout.</Text>
                )}
                {lightened && (
                  <Text style={styles.carried}>Your coach made today's session lighter to give your muscles time to recover.</Text>
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
                      Complete to start your rest.
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
                          <Text style={[styles.setsDone, ticked && { color: "#22C55E" }]}>{ticked ? "Done ✓" : "Tap when done"}</Text>
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
                            {next ? `superset: straight into ${next.exercise_name}` : `rest ${formatRest(row.rest_seconds)}`}
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
                          <Pressable onPress={() => openSwap(row)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                            <Text style={styles.changeLink}>⇄ Change exercise</Text>
                          </Pressable>
                        </View>
                        <Text style={[styles.setsDone, done >= row.sets && { color: "#22C55E" }]}>
                          {done >= row.sets ? "Done ✓" : `${done}/${row.sets}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                {todaySession && (
                  <View style={[styles.sessionResult, { borderColor: SESSION_COLORS[todaySession.status] }]}>
                    <View style={styles.nameRow}>
                      <View style={[styles.resultDot, { backgroundColor: SESSION_COLORS[todaySession.status] }]} />
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
                {todaysWorkout.length > 0 && todaySession?.status !== "complete" && (
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
            {calendarExtras.map((block, i) => (
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
                      return (
                        <View key={row.id} style={[styles.programRow, styles.cardioRow]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>🔥 Cardio</Text>
                            <Text style={styles.category}>{cardioLabel(row)}</Text>
                          </View>
                        </View>
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
              </View>
            ))}
            {showReference && <Text style={styles.title}>Exercise reference</Text>}
            {!showReference ? null : client?.library_access === false ? (
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
            {client?.library_access === false ? "Your coach hasn't set up your program yet." : "No exercises match that search."}
          </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openExercise(item)}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <ExerciseGuideButton name={item.name} category={item.category} onDoSet={() => openExercise(item)} videoUrl={item.external_url} />
              </View>
              {item.category && <Text style={styles.category}>{item.category}</Text>}
            </View>
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
      <WorkoutReasonModal
        kind={reasonFor}
        done={todaysWorkout.reduce((t, r) => t + Math.min(setsDoneFor(r), r.sets), 0)}
        planned={todaysWorkout.reduce((t, r) => t + r.sets, 0)}
        saving={savingProgress}
        onCancel={() => setReasonFor(null)}
        onSend={sendReason}
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
        <SafeAreaView style={styles.modalContainer}>
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
            {selected?.external_url ? (
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
            {selected && <ExerciseGuideButton name={selected.name} category={selected.category} variant="bar" onDoSet={() => {}} />}
            <View style={{ height: 10 }} />
            {target && (
              <Text style={styles.targetText}>
                Target: {target.sets} sets x {target.reps} reps ·{" "}
                {targetNext ? `superset: straight into ${targetNext.exercise_name}` : `rest ${formatRest(target.rest_seconds)}`}
              </Text>
            )}
            {target && target.kind !== "cardio" && todaysSets.every((s) => s.warm_up) && (
              <Pressable onPress={() => changeFromLog(target)} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom: 10 }}>
                <Text style={styles.changeLink}>⇄ Gym busy? Change exercise</Text>
              </Pressable>
            )}
            {warmUpDue &&
              (() => {
                const warmUpRepsText = target ? warmUpReps(target.reps) : null;
                const half = warmUpWeight(startWeight ? Number(startWeight) : null);
                return (
                  <View style={styles.warmUpBox}>
                    <Text style={styles.warmUpTitle}>Warm-up set first</Text>
                    <Text style={styles.warmUpText}>
                      First {selected?.category?.toLowerCase()} exercise today: do 1 warm-up set at half your start weight
                      {half ? ` (${half}kg)` : ""} for double the reps{warmUpRepsText ? ` (${warmUpRepsText})` : ""}. It's logged as a
                      warm-up and doesn't count as one of your working sets.
                    </Text>
                    <Pressable onPress={skipWarmUp} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                      <Text style={styles.changeLink}>Already warmed up? Skip it</Text>
                    </Pressable>
                  </View>
                );
              })()}
            {suggestion && (
              <View style={styles.warmUpBox}>
                <Text style={styles.warmUpTitle}>📈 {suggestion.last}</Text>
                <Text style={styles.warmUpText}>{suggestion.advice}</Text>
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

            {!warmUpDue && <Text style={styles.fieldLabel}>How did it feel?</Text>}
            {!warmUpDue && <View style={styles.effortRow}>
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
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.buttonText}>{warmUpDue ? "Log warm-up set" : "Log set"}</Text>
              )}
            </Pressable>

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
                {todaysSets.map((s) => (
                  <View key={s.id} style={styles.loggedSetRow}>
                    <Text style={styles.loggedSetText}>
                      {s.warm_up ? "Warm-up" : `Set ${s.set_number}`}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
                      {s.reps} reps
                    </Text>
                    <Text style={styles.loggedSetEffort}>{s.warm_up ? "Not a working set" : EFFORT_LABEL[s.effort]}</Text>
                  </View>
                ))}
              </>
            )}

          </ScrollView>
        </SafeAreaView>
        </KeyboardSafe>
        <AchievementBadge badge={badge} onClose={() => setBadge(null)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  doSetRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  absBox: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginTop: 12, borderWidth: 1.5, borderColor: BRAND_GOLD },
  absButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
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
  categoryChip: { flex: 0, paddingHorizontal: 14, marginRight: 8 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 15 },
  effortRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  effortChip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  effortChipSelected: { backgroundColor: "#22C55E" },
  effortChipText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  effortChipTextSelected: { color: "#0F172A" },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
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
