import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import GymHomeTabs from "@/components/GymHomeTabs";
import EditSetModal from "@/components/EditSetModal";
import { markCalendarSessionsTrained } from "@/lib/liveFromCalendar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toIsoDate, todayIso } from "@/lib/dates";
import { clientGroup } from "@/lib/clientGroups";
import { loadCalendarWorkoutFor, type CalendarDayWorkout } from "@/lib/programQueries";
import { displayProgramName } from "@/lib/programs";
import { sessionTitle } from "@/lib/programSchedule";
import { EFFORT_OPTIONS } from "@/lib/progression";
import { parseWeight } from "@/lib/weightInput";
import { findImprovements } from "@/lib/workoutSessions";
import { categoryLabel, exerciseCategories, filterExercises, forPlace, type ExercisePlace } from "@/lib/exerciseFilter";
import { ExerciseThumb } from "@/components/YouTubeCard";
import {
  MAX_GROUP,
  addSteps,
  clientSets,
  groupWarmUpDue,
  nextSetNumber,
  setsByClient,
  slotFor,
  startWeight,
  stationsOf,
  stepsFromPlan,
  supersetNext,
  type GroupStep,
} from "@/lib/groupSession";
import { SUPERSET_MAX, SUPERSET_MIN } from "@/lib/superset";
import { warmUpRepsToFill, warmUpWeight } from "@/lib/programs";
import { BRAND_GOLD } from "@/lib/brand";
import type { TrainerStackParamList } from "@/navigation/types";
import type { Client, Exercise, SetEffort, WorkoutLog } from "@/types/database";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";
import SafeBottom from "@/components/SafeBottom";
import ModalSafeArea from "@/components/ModalSafeArea";

// Group live session (GRIZZ, 2026-10-21): "a trainer might be training up to
// 4 people ... the same session ... when the session is done it logs it all
// back to the correct client". Every set is saved straight away under the
// client's own id (0134 trainer policy), and each client keeps one colour and
// letter (src/lib/groupSession.ts) on their card, on the set box and on its
// Save button. Finish saves each client's day as in person (0138).
// One flow for everything (GRIZZ 2026-11-16): every exercise is one page with
// arrows and a card per person; a superset is linked pages the screen moves
// through by itself; a warm-up is a tap in the same set box. Add exercises or
// supersets any time without starting a new workout.

type Props = NativeStackScreenProps<TrainerStackParamList, "GroupLive">;
type Step = GroupStep;

const first = (c: Pick<Client, "name">) => c.name.split(" ")[0];

const planTitle = (w: CalendarDayWorkout) =>
  w.daySlot != null ? `${displayProgramName(w.program)}: ${sessionTitle(w.program, w.daySlot)}` : displayProgramName(w.program);

const stepsOf = (w: CalendarDayWorkout | null | undefined): Step[] => stepsFromPlan(w?.exercises ?? []);

export default function GroupLiveScreen({ route, navigation }: Props) {
  const { trainer } = useAuth();
  const [stage, setStage] = useState<"pick" | "loading" | "train">("pick");
  const [clients, setClients] = useState<Client[]>([]);
  const [picked, setPicked] = useState<string[]>(
    route.params?.clientIds?.length ? route.params.clientIds.slice(0, MAX_GROUP) : route.params?.clientId ? [route.params.clientId] : [],
  );
  const [holds, setHolds] = useState<Record<string, boolean>>({});
  const [plans, setPlans] = useState<Record<string, CalendarDayWorkout | null>>({});
  const [planFrom, setPlanFrom] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [earlier, setEarlier] = useState<WorkoutLog[]>([]);
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [effort, setEffort] = useState<SetEffort | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fixing, setFixing] = useState<WorkoutLog | null>(null);
  // The exercise picker: "one" adds exercises as their own pages, "superset"
  // adds 2-4 as linked pages done back to back. Ticked in the order picked.
  const [adding, setAdding] = useState<"one" | "superset" | null>(null);
  const [ticked, setTicked] = useState<{ id: string | null; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [place, setPlace] = useState<ExercisePlace>("gym");
  const [finished, setFinished] = useState(false);
  // Warm-up set (GRIZZ 2026-11-12): easy set at about half the weight, saved
  // as set 0, never counted as a working set.
  const [entryWarm, setEntryWarm] = useState(false);
  const [setMenu, setSetMenu] = useState<WorkoutLog | null>(null);

  useEffect(() => {
    if (!trainer) return;
    supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainer.id).neq("id", trainer.id)
      .order("name")
      .then(({ data }) => setClients((data ?? []).filter((c) => clientGroup(c, todayIso()) === "active")));
  }, [trainer]);

  // Sets are saved as they go; only the end-of-session save would be lost.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (stage !== "train" || finished || logs.length === 0) return;
        e.preventDefault();
        Alert.alert("Leave the group session?", "Every set is already saved. Tap Finish group session first to mark it in person on each profile.", [
          { text: "Stay", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, stage, finished, logs.length],
  );

  // The group in the order it was picked: that order sets each client's colour and letter.
  const group = useMemo(() => picked.map((id) => clients.find((c) => c.id === id)).filter((c): c is Client => !!c), [picked, clients]);
  const slotOf = (id: string) => slotFor(picked.indexOf(id));
  const nameOf = (id: string) => group.find((c) => c.id === id)?.name ?? "";

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : prev.length >= MAX_GROUP ? prev : [...prev, id]));

  const start = async () => {
    setStage("loading");
    const today = todayIso();
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const [held, days, { data: ex }, { data: todayLogs }, { data: before }] = await Promise.all([
      Promise.all(picked.map((id) => supabase.rpc("has_medical_hold", { p_client: id }).then(({ data }) => !!data))),
      Promise.all(picked.map((id) => loadCalendarWorkoutFor(id, today))),
      supabase.from("exercises").select("*").order("sort_order"),
      supabase.from("workout_logs").select("*").in("client_id", picked).eq("log_date", today),
      supabase
        .from("workout_logs")
        .select("*")
        .in("client_id", picked)
        .gte("log_date", toIsoDate(since))
        .lt("log_date", today)
        .order("log_date", { ascending: false })
        .limit(1000),
    ]);
    setHolds(Object.fromEntries(picked.map((id, i) => [id, held[i]])));
    const byClient = Object.fromEntries(picked.map((id, i) => [id, days[i]?.main ?? null]));
    setPlans(byClient);
    const from = picked.find((id) => byClient[id]) ?? null;
    setPlanFrom(from);
    setSteps(stepsOf(from ? byClient[from] : null));
    setLibrary(ex ?? []);
    setLogs(todayLogs ?? []);
    // Newest first to keep the latest within the 1000-row cap; oldest first for startWeight.
    setEarlier([...(before ?? [])].reverse());
    setIndex(0);
    setStage("train");
    if (!from) setAdding("one");
  };

  const step = steps[index] ?? null;
  const categoryOf = (name: string) => library.find((e) => e.name === name)?.category ?? null;
  const warmUpDueFor = (id: string, name: string) => groupWarmUpDue(logs, id, name, categoryOf);
  const startNum = (w: string) => (w ? Number(w) : null);
  const stations = step ? stationsOf(steps, index) : [];
  const station = stations.indexOf(index);
  const inSuperset = stations.length > 1;
  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const usePlan = (id: string | null) => {
    setPlanFrom(id);
    setSteps(stepsOf(id ? plans[id] : null));
    setIndex(0);
    if (!id) setAdding("one");
  };

  const openEntry = (id: string) => {
    if (!step) return;
    if (holds[id]) {
      Alert.alert(`${first({ name: nameOf(id) })} is on a medical hold`, "No sets can be logged for them until the hold is cleared on their Overview.");
      return;
    }
    pickEntryWarm(id, warmUpDueFor(id, step.name));
    setEffort(null);
    setEntryFor(id);
  };

  // Warm-up: about half the start weight and easy reps; working set: the start weight.
  const pickEntryWarm = (id: string, warm: boolean) => {
    if (!step) return;
    const start = startWeight(logs, earlier, id, step.name);
    const half = warmUpWeight(startNum(start));
    setEntryWarm(warm);
    setWeight(warm ? (half ? String(half) : "") : start);
    setReps(warm ? warmUpRepsToFill(step.reps) : "");
  };

  const saveSet = async () => {
    const id = entryFor;
    if (!id || !step) return;
    const repsNum = Number(reps);
    if (!reps || Number.isNaN(repsNum) || repsNum <= 0) return Alert.alert("Missing reps", "Enter how many reps they did.");
    const warm = entryWarm;
    if (!effort && !warm) return Alert.alert("Missing effort", "Pick how many more good reps they could have done.");
    setSaving(true);
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        client_id: id,
        exercise_id: step.id,
        exercise_name: step.name,
        log_date: todayIso(),
        set_number: warm ? 0 : nextSetNumber(logs, id, step.name),
        weight_kg: parseWeight(weight),
        reps: repsNum,
        effort: warm ? "comfortable" : effort!,
        warm_up: warm,
        gauge: false,
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) return Alert.alert("Couldn't save set", error?.message ?? "Please try again.");
    const now = [...logs, data];
    setLogs(now);
    setEntryFor(null);
    // Superset: once everyone has done this station, go to the next one.
    const next = warm ? null : supersetNext(steps, index, now, picked.filter((p) => !holds[p]));
    if (next != null) {
      setIndex(next);
      const sameGroup = steps[next].group === step.group;
      say(sameGroup ? `✓ Saved · Next station: ${steps[next].name}` : `✓ Superset done · Next: ${steps[next].name}`);
    } else say(`✓ ${slotOf(id).letter} · ${warm ? "Warm-up saved" : "Saved"} to ${nameOf(id)}`);
  };

  // Wrong person tapped: the set moves to the right client (trainer update policy, 0134).
  const moveSet = async (set: WorkoutLog, to: string) => {
    setSetMenu(null);
    const { data, error } = await supabase
      .from("workout_logs")
      .update({ client_id: to, set_number: set.warm_up ? 0 : nextSetNumber(logs, to, set.exercise_name) })
      .eq("id", set.id)
      .select()
      .single();
    if (error || !data) return Alert.alert("Couldn't move the set", error?.message ?? "Please try again.");
    setLogs((prev) => prev.map((l) => (l.id === set.id ? data : l)));
    say(`✓ Moved to ${slotOf(to).letter} · ${nameOf(to)}`);
  };

  const openPicker = (mode: "one" | "superset") => {
    setTicked([]);
    setSearch("");
    setAdding(mode);
  };

  const tick = (e: { id: string | null; name: string }) =>
    setTicked((prev) =>
      prev.some((p) => p.name === e.name)
        ? prev.filter((p) => p.name !== e.name)
        : adding === "superset" && prev.length >= SUPERSET_MAX
          ? prev
          : [...prev, e],
    );

  const addTicked = () => {
    if (!adding || ticked.length === 0) return;
    const asSuperset = adding === "superset";
    const out = addSteps(steps, ticked, asSuperset, `ss-${Date.now()}`);
    setSteps(out.steps);
    setIndex(out.index);
    setAdding(null);
    setTicked([]);
  };

  const counts = setsByClient(logs, picked);
  const title = planFrom && plans[planFrom] ? planTitle(plans[planFrom]!) : "Group live session";

  const finish = () => {
    const withSets = group.filter((c) => counts[c.id] > 0);
    if (withSets.length === 0) return Alert.alert("Nothing logged yet", "Log at least one set first.");
    const lines = group.map((c) => `${slotOf(c.id).letter} · ${c.name}: ${counts[c.id]} set${counts[c.id] === 1 ? "" : "s"}`).join("\n");
    Alert.alert("Finish group session?", `Each person's sets save to their own profile as an in-person session:\n\n${lines}`, [
      { text: "Not yet", style: "cancel" },
      {
        text: "Finish",
        onPress: async () => {
          setSaving(true);
          const planned = steps.reduce((t, s) => t + s.sets, 0);
          const results = await Promise.all(
            withSets.map(async (c) => {
              const mine = logs.filter((l) => l.client_id === c.id);
              const { error } = await supabase.rpc("record_live_session_for", {
                p_client: c.id,
                p_title: title,
                p_sets_done: counts[c.id],
                p_sets_planned: Math.max(planned, counts[c.id]),
                p_improvements: findImprovements(mine, earlier.filter((l) => l.client_id === c.id)),
              });
              return { c, error };
            }),
          );
          setSaving(false);
          const failed = results.filter((r) => r.error);
          if (failed.length) {
            return Alert.alert("Some didn't save", failed.map((r) => `${r.c.name}: ${r.error?.message}`).join("\n") + "\n\nTheir sets are kept. Tap Finish again.");
          }
          // Opened from a joint 1 on 1 calendar session: tick each person's session as trained (GRIZZ 2026-11-09).
          const ids = route.params?.clientIds ?? [];
          const fromCalendar = withSets
            .map((c) => route.params?.sessionIds?.[ids.indexOf(c.id)])
            .filter((id): id is string => !!id);
          const ticked = await markCalendarSessionsTrained(fromCalendar);
          setFinished(true);
          Alert.alert("Saved 🤝", withSets.map((c) => `✓ ${c.name}`).join("\n") + (ticked ? "\n\nMarked as trained on your calendar." : ""), [{ text: "OK", onPress: () => navigation.goBack() }]);
        },
      },
    ]);
  };

  if (stage === "pick") {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <Text style={styles.title}>Who's training?</Text>
          <Text style={styles.helper}>Pick up to {MAX_GROUP}. Each person gets their own colour and letter for the whole session.</Text>
          {clients.map((c) => {
            const at = picked.indexOf(c.id);
            const slot = at >= 0 ? slotFor(at) : null;
            return (
              <Pressable key={c.id} style={[styles.pickRow, slot && { borderColor: themeBorder(slot.color) }]} onPress={() => toggle(c.id)}>
                <View style={[styles.badge, { backgroundColor: themeBg(slot?.color ?? "#334155") }]}>
                  <Text style={styles.badgeText}>{slot?.letter ?? ""}</Text>
                </View>
                <Text style={styles.pickName}>{c.name}</Text>
                <Text style={styles.pickTick}>{slot ? "✓" : ""}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable style={[styles.finishButton, picked.length < 2 && styles.off]} disabled={picked.length < 2} onPress={start}>
            <Text style={styles.finishText}>{picked.length < 2 ? "Pick at least 2 people" : `Start with ${picked.length} people`}</Text>
          </Pressable>
          <SafeBottom />
        </View>
      </View>
    );
  }

  if (stage === "loading") {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={themeText(BRAND_GOLD)} />
      </View>
    );
  }

  const withPlan = picked.filter((id) => plans[id]);
  const shown = forPlace(library, place);
  const nextUp = inSuperset ? steps[stations[(station + 1) % stations.length]] : null;
  const supersetLetter = (i: number) => {
    // Supersets are numbered in the order they appear: Superset 1, 2 ...
    const groups = [...new Set(steps.slice(0, i + 1).map((s) => s.group).filter(Boolean))];
    return groups.length;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 16 }}>
        {withPlan.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {withPlan.map((id) => (
              <Pressable key={id} style={[styles.chip, planFrom === id && { backgroundColor: themeBg(slotOf(id).color) }]} onPress={() => usePlan(id)}>
                <Text style={[styles.chipText, planFrom === id && styles.chipTextOn]}>
                  {slotOf(id).letter} · {first({ name: nameOf(id) })}'s workout
                </Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !planFrom && { backgroundColor: themeBg(BRAND_GOLD) }]} onPress={() => usePlan(null)}>
              <Text style={[styles.chipText, !planFrom && styles.chipTextOn]}>Build as you go</Text>
            </Pressable>
          </ScrollView>
        )}

        {step ? (
          <>
            {/* Every exercise, superset or not, is one page: arrows go back and forward. */}
            <View style={[styles.stepRow, inSuperset && { borderColor: themeBorder(BRAND_GOLD) }]}>
              <Pressable style={styles.arrowBox} onPress={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} hitSlop={10}>
                <Text style={[styles.arrow, index === 0 && styles.arrowOff]}>◀</Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.stepCount}>
                  Exercise {index + 1} of {steps.length}
                </Text>
                {inSuperset && (
                  <Text style={styles.supersetTag}>
                    Superset {supersetLetter(index)} · station {station + 1} of {stations.length}
                  </Text>
                )}
                <Text style={styles.stepName} numberOfLines={2}>
                  {step.name}
                </Text>
                <Text style={styles.stepSub}>
                  {step.sets} sets × {step.reps}
                  {nextUp ? `  ·  then ${nextUp.name}` : ""}
                </Text>
              </View>
              <Pressable style={styles.arrowBox} onPress={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={index >= steps.length - 1} hitSlop={10}>
                <Text style={[styles.arrow, index >= steps.length - 1 && styles.arrowOff]}>▶</Text>
              </Pressable>
            </View>

            <View style={styles.grid}>
              {group.map((c) => {
                const slot = slotOf(c.id);
                const all = logs.filter((l) => l.client_id === c.id && l.exercise_name === step.name);
                const warm = all.filter((l) => l.warm_up);
                const sets = clientSets(logs, c.id, step.name);
                const done = sets.length >= step.sets;
                return (
                  <Pressable key={c.id} style={[styles.card, { borderColor: themeBorder(slot.color) }]} onPress={() => openEntry(c.id)}>
                    <View style={styles.cardTop}>
                      <View style={[styles.badge, { backgroundColor: themeBg(slot.color) }]}>
                        <Text style={styles.badgeText}>{slot.letter}</Text>
                      </View>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {first(c)}
                      </Text>
                      {!holds[c.id] && (
                        <Text style={[styles.cardCount, done && { color: themeText("#22C55E") }]}>
                          {sets.length}/{step.sets}
                        </Text>
                      )}
                    </View>
                    {holds[c.id] ? (
                      <Text style={styles.hold}>On hold</Text>
                    ) : (
                      <>
                        {/* Tap a set to fix it, move it to the right person or remove it. */}
                        <View style={styles.setChips}>
                          {[...warm, ...sets].map((s, i) => (
                            <Pressable key={s.id} style={[styles.setChip, s.warm_up && styles.setChipWarm]} onPress={() => setSetMenu(s)} hitSlop={3}>
                              <Text style={styles.setChipText}>
                                {s.warm_up ? "W " : `${i - warm.length + 1}. `}
                                {s.weight_kg != null ? `${s.weight_kg}kg×` : ""}
                                {s.reps}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={[styles.logButton, { backgroundColor: themeBg(slot.color) }]}>
                          <Text style={styles.logText}>+ Log set</Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={[styles.helper, { textAlign: "center", marginVertical: 20 }]}>Add the first exercise or superset to start.</Text>
        )}

        {/* Add more any time: single exercises or a superset, they go in as new pages. */}
        <View style={styles.addRow}>
          <Pressable style={styles.addButton} onPress={() => openPicker("one")}>
            <Text style={styles.addText}>+ Exercise</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={() => openPicker("superset")}>
            <Text style={styles.addText}>+ Superset</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {/* Sits just above the Finish bar, so it never covers the exercise or the cards' buttons. */}
        {toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
        <View style={styles.footerRow}>
          <Text style={styles.footerCounts}>
            {group.map((c) => `${slotOf(c.id).letter} ${counts[c.id]}`).join(" · ")} sets
          </Text>
          <Pressable style={[styles.finishButton, { flex: 1 }]} onPress={finish} disabled={saving}>
            {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.finishText}>Finish session</Text>}
          </Pressable>
        </View>
        <SafeBottom />
      </View>

      {/* The set box, the same for every set: warm-up or working, superset or not. */}
      <Modal visible={!!entryFor} animationType="slide" transparent onRequestClose={() => setEntryFor(null)}>
        <KeyboardSafe>
          <View style={styles.sheetWrap}>
            {entryFor && step && (
              <View style={[styles.sheet, { borderColor: themeBorder(slotOf(entryFor).color) }]}>
                <View style={[styles.banner, { backgroundColor: themeBg(slotOf(entryFor).color) }]}>
                  <Text style={styles.bannerLetter}>{slotOf(entryFor).letter}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bannerText} numberOfLines={1}>
                      {nameOf(entryFor).toUpperCase()}
                    </Text>
                    <Text style={styles.bannerSub} numberOfLines={1}>
                      {step.name}
                    </Text>
                  </View>
                </View>
                <View style={styles.kindRow}>
                  {[true, false].map((w) => (
                    <Pressable
                      key={String(w)}
                      style={[styles.kind, entryWarm === w && { backgroundColor: themeBg(slotOf(entryFor).color), borderColor: themeBorder(slotOf(entryFor).color) }]}
                      onPress={() => pickEntryWarm(entryFor, w)}
                    >
                      <Text style={[styles.kindText, entryWarm === w && styles.chipTextOn]}>
                        {w ? "Warm-up" : `Set ${nextSetNumber(logs, entryFor, step.name)} of ${step.sets}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {entryWarm && <Text style={styles.helper}>Easy set at about half the weight. It doesn't count as one of the {step.sets} sets.</Text>}
                <View style={styles.inputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Weight (kg)</Text>
                    <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Bodyweight" placeholderTextColor="#64748B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Reps</Text>
                    <TextInput style={styles.input} value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder={step.reps} placeholderTextColor="#64748B" />
                  </View>
                </View>
                {!entryWarm && (
                  <>
                    <Text style={styles.label}>Good reps left</Text>
                    <View style={styles.chips}>
                      {EFFORT_OPTIONS.map((o) => (
                        <Pressable key={o.key} style={[styles.chip, effort === o.key && { backgroundColor: themeBg(slotOf(entryFor).color) }]} onPress={() => setEffort(o.key)}>
                          <Text style={[styles.chipText, effort === o.key && styles.chipTextOn]}>{o.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                <Pressable style={[styles.saveButton, { backgroundColor: themeBg(slotOf(entryFor).color) }]} onPress={saveSet} disabled={saving}>
                  {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.finishText}>Save {first({ name: nameOf(entryFor) })}'s {entryWarm ? "warm-up" : "set"}</Text>}
                </Pressable>
                <Pressable style={styles.cancel} onPress={() => setEntryFor(null)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <SafeBottom />
              </View>
            )}
          </View>
        </KeyboardSafe>
      </Modal>

      {/* A logged set: fix it, move it to the right person, or remove it. */}
      <Modal visible={!!setMenu} animationType="fade" transparent onRequestClose={() => setSetMenu(null)}>
        <View style={styles.sheetWrap}>
          {setMenu && (
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                {slotOf(setMenu.client_id).letter} · {first({ name: nameOf(setMenu.client_id) })} · {setMenu.exercise_name}
                {"\n"}
                {setMenu.warm_up ? "Warm-up" : `Set ${setMenu.set_number}`}: {setMenu.weight_kg != null ? `${setMenu.weight_kg}kg × ` : ""}
                {setMenu.reps}
              </Text>
              <Pressable
                style={[styles.pickRow, { borderColor: themeBorder(BRAND_GOLD) }]}
                onPress={() => {
                  setFixing(setMenu);
                  setSetMenu(null);
                }}
              >
                <Text style={styles.pickName}>✏️ Fix the weight or reps</Text>
              </Pressable>
              {group
                .filter((c) => c.id !== setMenu.client_id && !holds[c.id])
                .map((c) => (
                  <Pressable key={c.id} style={[styles.pickRow, { borderColor: themeBorder(slotOf(c.id).color) }]} onPress={() => moveSet(setMenu, c.id)}>
                    <View style={[styles.badge, { backgroundColor: themeBg(slotOf(c.id).color) }]}>
                      <Text style={styles.badgeText}>{slotOf(c.id).letter}</Text>
                    </View>
                    <Text style={styles.pickName}>Wrong person: move it to {first(c)}</Text>
                  </Pressable>
                ))}
              <Pressable style={styles.cancel} onPress={() => setSetMenu(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <SafeBottom />
            </View>
          )}
        </View>
      </Modal>

      <EditSetModal
        set={fixing}
        onSaved={(updated) => setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
        onRemoved={(gone) => setLogs((prev) => prev.filter((l) => l.id !== gone.id))}
        onClose={() => setFixing(null)}
      />

      {/* The exercise picker: tick one or more (in order), then add them. */}
      <Modal visible={!!adding} animationType="slide" onRequestClose={() => setAdding(null)}>
        <KeyboardSafe style={styles.container}>
          <ModalSafeArea style={{ flex: 1 }}>
            <View style={{ padding: 16, flex: 1 }}>
              <View style={styles.addHeader}>
                <Text style={styles.title}>{adding === "superset" ? "Add a superset" : "Add exercises"}</Text>
                <Pressable onPress={() => setAdding(null)} hitSlop={10}>
                  <Text style={styles.cancelText}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.helper}>
                {adding === "superset"
                  ? `Tick ${SUPERSET_MIN}-${SUPERSET_MAX} exercises in the order they'll do them, back to back.`
                  : "Tick one or more. Everyone in the group does them, each on its own page."}
              </Text>
              {adding === "superset" && steps.length > 0 && (
                <>
                  <Text style={styles.label}>Already in this session</Text>
                  <View style={styles.chips}>
                    {steps.map((s) => {
                      const at = ticked.findIndex((t) => t.name === s.name);
                      return (
                        <Pressable key={s.name} style={[styles.chip, at >= 0 && { backgroundColor: themeBg(BRAND_GOLD) }]} onPress={() => tick({ id: s.id, name: s.name })}>
                          <Text style={[styles.chipText, at >= 0 && styles.chipTextOn]}>
                            {at >= 0 ? `${at + 1}. ` : ""}
                            {s.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              <GymHomeTabs current={place} onChange={setPlace} accent="#22C55E" />
              <TextInput
                style={[styles.input, { marginVertical: 8 }]}
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${shown.length} exercises`}
                placeholderTextColor="#64748B"
                autoCorrect={false}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }}>
                {[null, ...exerciseCategories(shown)].map((c) => (
                  <Pressable key={c ?? "all"} style={[styles.chip, category === c && { backgroundColor: themeBg(BRAND_GOLD) }]} onPress={() => setCategory(c)}>
                    <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c ?? "All"}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
                {filterExercises(shown, search, category).map((e) => {
                  const at = ticked.findIndex((t) => t.name === e.name);
                  return (
                    <Pressable key={e.id} style={[styles.libRow, styles.libRowWithPic, at >= 0 && { borderColor: themeBorder(BRAND_GOLD) }]} onPress={() => tick({ id: e.id, name: e.name })}>
                      <ExerciseThumb url={e.external_url} />
                      <View style={styles.libRowText}>
                        <Text style={styles.pickName}>{e.name}</Text>
                        {e.category && <Text style={styles.helper}>{categoryLabel(e.category)}</Text>}
                      </View>
                      <View style={[styles.badge, { backgroundColor: themeBg(at >= 0 ? BRAND_GOLD : "#334155") }]}>
                        <Text style={styles.badgeText}>{at >= 0 ? at + 1 : ""}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {(() => {
                const need = adding === "superset" ? SUPERSET_MIN : 1;
                const ready = ticked.length >= need;
                const label = !ready
                  ? adding === "superset"
                    ? `Tick at least ${SUPERSET_MIN}`
                    : "Tick an exercise"
                  : adding === "superset"
                    ? `Add superset (${ticked.length})`
                    : `Add ${ticked.length} exercise${ticked.length === 1 ? "" : "s"}`;
                return (
                  <Pressable style={[styles.saveButton, { backgroundColor: themeBg(ready ? BRAND_GOLD : "#334155") }]} disabled={!ready} onPress={addTicked}>
                    <Text style={styles.finishText}>{label}</Text>
                  </Pressable>
                );
              })()}
            </View>
          </ModalSafeArea>
        </KeyboardSafe>
      </Modal>
    </View>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  title: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 13, marginBottom: 8 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 12,
    marginTop: 8,
  },
  pickName: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },
  pickTick: { color: "#22C55E", fontSize: 18, fontWeight: "800" },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#0F172A", fontWeight: "900", fontSize: 15 },
  chip: { borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "#1E293B", marginRight: 6, marginBottom: 6 },
  chipText: { color: "#CBD5E1", fontSize: 13 },
  chipTextOn: { color: "#0F172A", fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  stepRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, borderWidth: 2, borderColor: "transparent", paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10 },
  arrowBox: { paddingHorizontal: 8, paddingVertical: 14 },
  supersetTag: { color: BRAND_GOLD, fontSize: 12, fontWeight: "800", marginTop: 2 },
  stepSub: { color: "#94A3B8", fontSize: 13, textAlign: "center" },
  arrow: { color: BRAND_GOLD, fontSize: 30 },
  arrowOff: { color: "#334155" },
  stepCount: { color: "#94A3B8", fontSize: 12 },
  stepName: { color: "#fff", fontSize: 19, fontWeight: "800", textAlign: "center", marginVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { width: "48%", flexGrow: 1, backgroundColor: "#1E293B", borderRadius: 14, borderWidth: 3, padding: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  cardName: { color: "#fff", fontSize: 17, fontWeight: "800", flex: 1 },
  cardCount: { color: "#E2E8F0", fontSize: 17, fontWeight: "900" },
  setChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, minHeight: 26 },
  setChip: { backgroundColor: "#0F172A", borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6 },
  setChipWarm: { borderWidth: 1, borderColor: "#475569", backgroundColor: "transparent" },
  setChipText: { color: "#E2E8F0", fontSize: 12.5, fontWeight: "600" },
  logButton: { borderRadius: 10, paddingVertical: 9, alignItems: "center", marginTop: 8 },
  logText: { color: "#0F172A", fontWeight: "900", fontSize: 15 },
  hold: { color: "#F87171", fontWeight: "700", marginTop: 8 },
  addRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  addButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: BRAND_GOLD, alignItems: "center" },
  addText: { color: BRAND_GOLD, fontWeight: "800" },
  footer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: "#1E293B", backgroundColor: "#0F172A" },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  footerCounts: { color: "#94A3B8", fontSize: 13, fontWeight: "700" },
  finishButton: { backgroundColor: "#D4AF37", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  off: { backgroundColor: "#334155" },
  finishText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  toast: { position: "absolute", bottom: "100%", marginBottom: 8, left: 16, right: 16, backgroundColor: "#14532D", borderRadius: 10, padding: 12 },
  toastText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  sheetWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: "#334155", padding: 16, paddingBottom: 28 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, padding: 12, marginBottom: 12 },
  bannerLetter: { color: "#0F172A", fontSize: 26, fontWeight: "900" },
  bannerText: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  bannerSub: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  kindRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  kind: { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: "#334155", paddingVertical: 10, alignItems: "center" },
  kindText: { color: "#CBD5E1", fontWeight: "800" },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  inputs: { flexDirection: "row", gap: 10 },
  label: { color: "#E2E8F0", fontWeight: "700", marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 10, padding: 12, fontSize: 16 },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
  addHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  libRow: { backgroundColor: "#1E293B", borderRadius: 10, borderWidth: 2, borderColor: "transparent", padding: 10, marginBottom: 6, gap: 10 },
  libRowWithPic: { flexDirection: "row", alignItems: "center" },
  libRowText: { flex: 1 },
});
