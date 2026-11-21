import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Text, View } from "react-native";
import Pressable from "@/components/Pressable";
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
  stepsFromPlan,
  blockOfStep,
  blocksOf,
  nextBehind,
  roundsDone,
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
import KeepScreenOn from "@/components/KeepScreenOn";

// Group live session (GRIZZ, 2026-10-21): "a trainer might be training up to
// 4 people ... the same session ... when the session is done it logs it all
// back to the correct client". Every set is saved straight away under the
// client's own id (0134 trainer policy), and each client keeps one colour and
// letter (src/lib/groupSession.ts) on their card, on the set box and on its
// Save button. Finish saves each client's day as in person (0138).
// Person blocks (GRIZZ 2026-11-16): one block per person in their colour. Tap
// it to open everything they're doing now (one exercise or the whole
// superset), fill in each exercise and tap Log set; jump straight to the next
// person with the A B C D tabs. Add another exercise or circuit any time.

type Props = NativeStackScreenProps<TrainerStackParamList, "GroupLive">;
type Step = GroupStep;
/** One exercise's boxes in a person's open block. Warm-up: easy set at about half the weight, saved as set 0. */
type Draft = { warm: boolean; weight: string; reps: string; effort: SetEffort | null };

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
  // The block (one exercise, or a whole superset) everyone is on now.
  const [block, setBlock] = useState(0);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [earlier, setEarlier] = useState<WorkoutLog[]>([]);
  // The person whose block is open, and what's typed for each person so far
  // (kept when the trainer jumps to someone else and back).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>({});
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
    setBlock(0);
    setStage("train");
    if (!from) setAdding("one");
  };

  const blocks = blocksOf(steps);
  const current = (blocks[block] ?? []).map((i) => steps[i]);
  const names = current.map((s) => s.name);
  const isCircuit = current.length > 1;
  const rounds = current.length ? Math.max(...current.map((s) => s.sets)) : 0;
  const categoryOf = (name: string) => library.find((e) => e.name === name)?.category ?? null;
  const startNum = (w: string) => (w ? Number(w) : null);
  const active = picked.filter((id) => !holds[id]);
  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  // Fresh boxes for one person: a warm-up where the body part isn't warm yet
  // (each body part once), else their start weight.
  const freshDraft = (id: string, now: WorkoutLog[] = logs): Draft[] => {
    const warmed: (string | null)[] = [];
    return current.map((s) => {
      const cat = categoryOf(s.name);
      const due = !warmed.includes(cat) && groupWarmUpDue(now, id, s.name, categoryOf);
      if (due) warmed.push(cat);
      const start = startWeight(now, earlier, id, s.name);
      const half = warmUpWeight(startNum(start));
      return due
        ? { warm: true, weight: half ? String(half) : "", reps: warmUpRepsToFill(s.reps), effort: null }
        : { warm: false, weight: start, reps: "", effort: null };
    });
  };
  const draftOf = (id: string) => (drafts[id]?.length === current.length ? drafts[id] : freshDraft(id));
  const setDraft = (id: string, i: number, change: Partial<Draft>) =>
    setDrafts((prev) => {
      const base = prev[id]?.length === current.length ? prev[id] : freshDraft(id);
      return { ...prev, [id]: base.map((d, at) => (at === i ? { ...d, ...change } : d)) };
    });
  const pickWarm = (id: string, i: number, warm: boolean) => {
    const s = current[i];
    const start = startWeight(logs, earlier, id, s.name);
    const half = warmUpWeight(startNum(start));
    setDraft(id, i, warm ? { warm, weight: half ? String(half) : "", reps: warmUpRepsToFill(s.reps), effort: null } : { warm, weight: start, reps: "", effort: null });
  };

  const goBlock = (b: number) => {
    setBlock(b);
    setDrafts({});
  };

  const usePlan = (id: string | null) => {
    setPlanFrom(id);
    setSteps(stepsOf(id ? plans[id] : null));
    goBlock(0);
    if (!id) setAdding("one");
  };

  const openPerson = (id: string) => {
    if (!current.length) return;
    if (holds[id]) {
      Alert.alert(`${first({ name: nameOf(id) })} is on a medical hold`, "No sets can be logged for them until the hold is cleared on their Overview.");
      return;
    }
    setOpenFor(id);
  };

  // Log set: everything filled in for this person goes in at once. An exercise
  // left without reps is skipped (they didn't get to it).
  const logSet = async () => {
    const id = openFor;
    if (!id) return;
    const draft = draftOf(id);
    const filled = current.map((s, i) => ({ s, d: draft[i] })).filter(({ d }) => d && d.reps.trim() !== "");
    if (filled.length === 0) return Alert.alert("Nothing to log", "Enter the reps for at least one exercise.");
    for (const { s, d } of filled) {
      const n = Number(d.reps);
      if (!Number.isInteger(n) || n <= 0) return Alert.alert("Check the reps", `Check the reps for ${s.name}.`);
      if (!d.warm && !d.effort) return Alert.alert("Good reps left?", `Pick how many more good reps they had left on ${s.name}.`);
    }
    const rows = filled.map(({ s, d }) => ({
      client_id: id,
      exercise_id: s.id,
      exercise_name: s.name,
      log_date: todayIso(),
      set_number: d.warm ? 0 : nextSetNumber(logs, id, s.name),
      weight_kg: parseWeight(d.weight),
      reps: Number(d.reps),
      effort: d.warm ? ("comfortable" as const) : d.effort!,
      warm_up: d.warm,
      gauge: false,
    }));
    setSaving(true);
    const { data, error } = await supabase.from("workout_logs").insert(rows).select();
    setSaving(false);
    if (error || !data) return Alert.alert("Couldn't save", error?.message ?? "Please try again.");
    const now = [...logs, ...data];
    setLogs(now);
    // Their next round starts fresh, keeping the weights they just used.
    setDrafts((prev) => ({ ...prev, [id]: freshDraft(id, now) }));
    const onlyWarm = rows.every((r) => r.warm_up);
    const who = `${slotOf(id).letter} · ${first({ name: nameOf(id) })}`;
    if (onlyWarm) return say(`✓ ${who}: warm-up saved. Now their working set.`);
    const next = nextBehind(active, id, now, names);
    if (next) {
      setOpenFor(next);
      return say(`✓ ${who} saved. Now ${first({ name: nameOf(next) })}.`);
    }
    setOpenFor(null);
    const allDone = active.every((p) => roundsDone(now, p, names) >= rounds);
    if (allDone && block < blocks.length - 1) {
      goBlock(block + 1);
      say(`✓ Everyone's done. Next: ${blocks[block + 1].map((i) => steps[i].name).join(" + ")}`);
    } else if (allDone) say("✓ Everyone's done. Add another exercise or circuit, or finish.");
    else say(`✓ Round done for everyone. Round ${Math.min(...active.map((p) => roundsDone(now, p, names))) + 1} next.`);
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
    if (!openFor) return setAdding(mode);
    // From a person's block: let it close first (iPhone can't open one full-screen pop-up while another closes).
    setOpenFor(null);
    setTimeout(() => setAdding(mode), 450);
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
    const out = addSteps(steps, ticked, adding === "superset", `ss-${Date.now()}`);
    setSteps(out.steps);
    goBlock(blockOfStep(out.steps, out.index));
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
  const blockTitle = isCircuit ? `Superset · ${current.length} exercises` : current[0]?.name ?? "";
  const setLine = (l: WorkoutLog, n: number) => `${l.warm_up ? "W" : `${n}.`} ${l.weight_kg != null ? `${l.weight_kg}kg×` : ""}${l.reps}`;
  const opened = openFor ? group.find((c) => c.id === openFor) ?? null : null;

  return (
    <View style={styles.container}>
      <KeepScreenOn />
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

        {current.length > 0 ? (
          <>
            {/* What everyone is on now: one exercise or a whole superset. */}
            <View style={[styles.stepRow, isCircuit && { borderColor: themeBorder(BRAND_GOLD) }]}>
              <Pressable style={styles.arrowBox} onPress={() => goBlock(Math.max(0, block - 1))} disabled={block === 0} hitSlop={10}>
                <Text style={[styles.arrow, block === 0 && styles.arrowOff]}>◀</Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.stepCount}>
                  {block + 1} of {blocks.length}
                </Text>
                <Text style={styles.stepName} numberOfLines={2}>
                  {blockTitle}
                </Text>
                {isCircuit ? (
                  current.map((s, i) => (
                    <Text key={s.name} style={styles.stepSub} numberOfLines={1}>
                      {i + 1}. {s.name} · {s.sets} × {s.reps}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.stepSub}>
                    {current[0].sets} sets × {current[0].reps}
                  </Text>
                )}
              </View>
              <Pressable style={styles.arrowBox} onPress={() => goBlock(Math.min(blocks.length - 1, block + 1))} disabled={block >= blocks.length - 1} hitSlop={10}>
                <Text style={[styles.arrow, block >= blocks.length - 1 && styles.arrowOff]}>▶</Text>
              </Pressable>
            </View>

            {/* One block per person, in their colour. Tap to open everything they're doing now. */}
            <View style={styles.grid}>
              {group.map((c) => {
                const slot = slotOf(c.id);
                const done = roundsDone(logs, c.id, names);
                const finishedAll = done >= rounds;
                return (
                  <Pressable key={c.id} style={[styles.card, { borderColor: themeBorder(slot.color) }]} onPress={() => openPerson(c.id)}>
                    <View style={styles.cardTop}>
                      <View style={[styles.badge, { backgroundColor: themeBg(slot.color) }]}>
                        <Text style={styles.badgeText}>{slot.letter}</Text>
                      </View>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {first(c)}
                      </Text>
                    </View>
                    {holds[c.id] ? (
                      <Text style={styles.hold}>On hold</Text>
                    ) : (
                      <>
                        <Text style={[styles.cardCount, finishedAll && { color: themeText("#22C55E") }]}>
                          {finishedAll ? "✓ Done" : `${isCircuit ? "Round" : "Set"} ${done + 1} of ${rounds}`}
                        </Text>
                        {current.map((s) => {
                          const last = clientSets(logs, c.id, s.name).at(-1);
                          return (
                            <Text key={s.name} style={styles.cardLine} numberOfLines={1}>
                              {isCircuit ? `${s.name.split(" ").slice(-1)[0]}: ` : "Last: "}
                              {last ? `${last.weight_kg != null ? `${last.weight_kg}kg×` : ""}${last.reps}` : "–"}
                            </Text>
                          );
                        })}
                        <View style={[styles.logButton, { backgroundColor: themeBg(slot.color) }]}>
                          <Text style={styles.logText}>Open {first(c)} ›</Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={[styles.helper, { textAlign: "center", marginVertical: 20 }]}>Add the first exercise or circuit to start.</Text>
        )}

        <View style={styles.addRow}>
          <Pressable style={styles.addButton} onPress={() => openPicker("one")}>
            <Text style={styles.addText}>+ Exercise</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={() => openPicker("superset")}>
            <Text style={styles.addText}>+ Circuit / superset</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {toast && !openFor && (
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

      {/* One person's block: every exercise they're on now, their tabs to jump to the next person. */}
      <Modal visible={!!opened} animationType="slide" onRequestClose={() => setOpenFor(null)}>
        <KeyboardSafe style={styles.container}>
          <ModalSafeArea style={{ flex: 1 }}>
            {opened && (
              <>
                <View style={styles.tabs}>
                  {group.map((c) => {
                    const slot = slotOf(c.id);
                    const on = c.id === opened.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={[styles.tab, { borderColor: themeBorder(slot.color) }, on && { backgroundColor: themeBg(slot.color) }]}
                        onPress={() => openPerson(c.id)}
                      >
                        <Text style={[styles.tabText, { color: themeText(on ? "#0F172A" : slot.color) }]} numberOfLines={1}>
                          {slot.letter} {first(c)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.banner, { backgroundColor: themeBg(slotOf(opened.id).color), marginHorizontal: 12 }]}>
                  <Text style={styles.bannerLetter}>{slotOf(opened.id).letter}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bannerText} numberOfLines={1}>
                      {opened.name.toUpperCase()}
                    </Text>
                    <Text style={styles.bannerSub} numberOfLines={1}>
                      {isCircuit ? `Superset · round ${Math.min(roundsDone(logs, opened.id, names) + 1, rounds)} of ${rounds}` : current[0]?.name}
                    </Text>
                  </View>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                  {current.map((s, i) => {
                    const d = draftOf(opened.id)[i];
                    const color = slotOf(opened.id).color;
                    const today = logs.filter((l) => l.client_id === opened.id && l.exercise_name === s.name);
                    const warmLogs = today.filter((l) => l.warm_up);
                    const working = clientSets(logs, opened.id, s.name);
                    return (
                      <View key={s.name} style={styles.exBox}>
                        <Text style={styles.exName} numberOfLines={1}>
                          {isCircuit ? `${i + 1}. ` : ""}
                          {s.name} <Text style={styles.exPlan}>{s.sets} × {s.reps}</Text>
                        </Text>
                        {today.length > 0 && (
                          <View style={styles.setChips}>
                            {[...warmLogs, ...working].map((l, n) => (
                              <Pressable key={l.id} style={[styles.setChip, l.warm_up && styles.setChipWarm]} onPress={() => setSetMenu(l)} hitSlop={3}>
                                <Text style={styles.setChipText}>{setLine(l, n - warmLogs.length + 1)} ✏️</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                        <View style={styles.kindRow}>
                          {[true, false].map((w) => (
                            <Pressable
                              key={String(w)}
                              style={[styles.kind, d?.warm === w && { backgroundColor: themeBg(color), borderColor: themeBorder(color) }]}
                              onPress={() => pickWarm(opened.id, i, w)}
                            >
                              <Text style={[styles.kindText, d?.warm === w && styles.chipTextOn]}>
                                {w ? "Warm-up" : `Set ${nextSetNumber(logs, opened.id, s.name)} of ${s.sets}`}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={styles.inputs}>
                          <View style={{ flex: 1 }}>
                            <TextInput style={styles.input} value={d?.weight ?? ""} onChangeText={(v) => setDraft(opened.id, i, { weight: v })} keyboardType="decimal-pad" placeholder="kg (blank = bodyweight)" placeholderTextColor="#64748B" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <TextInput style={styles.input} value={d?.reps ?? ""} onChangeText={(v) => setDraft(opened.id, i, { reps: v })} keyboardType="number-pad" placeholder={`reps (${s.reps})`} placeholderTextColor="#64748B" />
                          </View>
                        </View>
                        {!d?.warm && (
                          <View style={[styles.chips, { marginTop: 6 }]}>
                            {EFFORT_OPTIONS.map((o) => (
                              <Pressable key={o.key} style={[styles.chip, d?.effort === o.key && { backgroundColor: themeBg(color) }]} onPress={() => setDraft(opened.id, i, { effort: o.key })}>
                                <Text style={[styles.chipText, d?.effort === o.key && styles.chipTextOn]}>{o.label}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
                {toast && (
                  <View style={styles.panelToast}>
                    <Text style={styles.toastText}>{toast}</Text>
                  </View>
                )}
                <View style={styles.panelFooter}>
                  <Pressable style={[styles.saveButton, { backgroundColor: themeBg(slotOf(opened.id).color), marginTop: 0 }]} onPress={logSet} disabled={saving}>
                    {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.finishText}>✓ Log {first(opened)}'s set</Text>}
                  </Pressable>
                  <View style={styles.addRow}>
                    <Pressable style={styles.addButton} onPress={() => openPicker("superset")}>
                      <Text style={styles.addText}>+ Another circuit</Text>
                    </Pressable>
                    <Pressable style={styles.addButton} onPress={() => setOpenFor(null)}>
                      <Text style={styles.addText}>Back to everyone</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </ModalSafeArea>
        </KeyboardSafe>

        {/* A logged set: fix it, move it to the right person, or remove it. Inside this Modal so it opens on top. */}
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
                  <Text style={styles.pickName}>✏️ Fix the weight or reps, or remove it</Text>
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
      </Modal>

      {/* The exercise picker: tick one or more (in order), then add them. */}
      <Modal visible={!!adding} animationType="slide" onRequestClose={() => setAdding(null)}>
        <KeyboardSafe style={styles.container}>
          <ModalSafeArea style={{ flex: 1 }}>
            <View style={{ padding: 16, flex: 1 }}>
              <View style={styles.addHeader}>
                <Text style={styles.title}>{adding === "superset" ? "Add a circuit / superset" : "Add exercises"}</Text>
                <Pressable onPress={() => setAdding(null)} hitSlop={10}>
                  <Text style={styles.cancelText}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.helper}>
                {adding === "superset"
                  ? `Tick ${SUPERSET_MIN}-${SUPERSET_MAX} exercises in the order they'll do them, back to back.`
                  : "Tick one or more. Everyone in the group does them, one after the other."}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginBottom: 8 }}>
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
                    ? `Add circuit (${ticked.length})`
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
  cardCount: { color: "#E2E8F0", fontSize: 16, fontWeight: "900", marginBottom: 2 },
  cardLine: { color: "#CBD5E1", fontSize: 13 },
  tabs: { flexDirection: "row", gap: 6, padding: 12 },
  tab: { flex: 1, borderWidth: 2, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  tabText: { fontWeight: "900", fontSize: 14 },
  exBox: { backgroundColor: "#1E293B", borderRadius: 12, padding: 10, marginBottom: 8 },
  exName: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  exPlan: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  panelFooter: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#1E293B" },
  panelToast: { marginHorizontal: 12, marginBottom: 6, backgroundColor: "#14532D", borderRadius: 10, padding: 10 },
  setChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 },
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
