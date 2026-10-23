import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import GymHomeTabs from "@/components/GymHomeTabs";
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
import { exerciseCategories, filterExercises, forPlace, type ExercisePlace } from "@/lib/exerciseFilter";
import { MAX_GROUP, clientSets, nextSetNumber, setsByClient, slotFor, startWeight } from "@/lib/groupSession";
import { BRAND_GOLD } from "@/lib/brand";
import type { TrainerStackParamList } from "@/navigation/types";
import type { Client, Exercise, SetEffort, WorkoutLog } from "@/types/database";

// Group live session (GRIZZ, 2026-10-21): "a trainer might be training up to
// 4 people ... the same session ... when the session is done it logs it all
// back to the correct client". Every set is saved straight away under the
// client's own id (0134 trainer policy), and each client keeps one colour and
// letter (src/lib/groupSession.ts) on their card, on the set box and on its
// Save button. Finish saves each client's day as in person (0138).

type Props = NativeStackScreenProps<TrainerStackParamList, "GroupLive">;
type Step = { id: string | null; name: string; sets: number; reps: string };

const first = (c: Pick<Client, "name">) => c.name.split(" ")[0];

const planTitle = (w: CalendarDayWorkout) =>
  w.daySlot != null ? `${displayProgramName(w.program)}: ${sessionTitle(w.program, w.daySlot)}` : displayProgramName(w.program);

const stepsOf = (w: CalendarDayWorkout | null | undefined): Step[] =>
  (w?.exercises ?? [])
    .filter((r) => r.kind === "exercise")
    .map((r) => ({ id: r.exercise_id, name: r.exercise_name, sets: r.sets, reps: r.reps }));

export default function GroupLiveScreen({ route, navigation }: Props) {
  const { trainer } = useAuth();
  const [stage, setStage] = useState<"pick" | "loading" | "train">("pick");
  const [clients, setClients] = useState<Client[]>([]);
  const [picked, setPicked] = useState<string[]>(route.params?.clientId ? [route.params.clientId] : []);
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
  const [moving, setMoving] = useState<WorkoutLog | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [place, setPlace] = useState<ExercisePlace>("gym");
  const [finished, setFinished] = useState(false);

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
    if (!from) setAdding(true);
  };

  const step = steps[index] ?? null;

  const usePlan = (id: string | null) => {
    setPlanFrom(id);
    setSteps(stepsOf(id ? plans[id] : null));
    setIndex(0);
    if (!id) setAdding(true);
  };

  const openEntry = (id: string) => {
    if (!step) return;
    if (holds[id]) {
      Alert.alert(`${first({ name: nameOf(id) })} is on a medical hold`, "No sets can be logged for them until the hold is cleared on their Overview.");
      return;
    }
    setWeight(startWeight(logs, earlier, id, step.name));
    setReps("");
    setEffort(null);
    setEntryFor(id);
  };

  const saveSet = async () => {
    const id = entryFor;
    if (!id || !step) return;
    const repsNum = Number(reps);
    if (!reps || Number.isNaN(repsNum) || repsNum <= 0) return Alert.alert("Missing reps", "Enter how many reps they did.");
    if (!effort) return Alert.alert("Missing effort", "Pick how many more good reps they could have done.");
    setSaving(true);
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        client_id: id,
        exercise_id: step.id,
        exercise_name: step.name,
        log_date: todayIso(),
        set_number: nextSetNumber(logs, id, step.name),
        weight_kg: parseWeight(weight),
        reps: repsNum,
        effort,
        warm_up: false,
        gauge: false,
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) return Alert.alert("Couldn't save set", error?.message ?? "Please try again.");
    setLogs((prev) => [...prev, data]);
    setEntryFor(null);
    setToast(`✓ ${slotOf(id).letter} · Saved to ${nameOf(id)}`);
    setTimeout(() => setToast(null), 2500);
  };

  // Wrong person tapped: the set moves to the right client (trainer update policy, 0134).
  const moveSet = async (set: WorkoutLog, to: string) => {
    setMoving(null);
    const { data, error } = await supabase
      .from("workout_logs")
      .update({ client_id: to, set_number: nextSetNumber(logs, to, set.exercise_name) })
      .eq("id", set.id)
      .select()
      .single();
    if (error || !data) return Alert.alert("Couldn't move the set", error?.message ?? "Please try again.");
    setLogs((prev) => prev.map((l) => (l.id === set.id ? data : l)));
    setToast(`✓ Moved to ${slotOf(to).letter} · ${nameOf(to)}`);
    setTimeout(() => setToast(null), 2500);
  };

  const addExercise = (e: Exercise) => {
    const at = steps.findIndex((s) => s.name === e.name);
    if (at >= 0) setIndex(at);
    else {
      setSteps((prev) => [...prev, { id: e.id, name: e.name, sets: 3, reps: "8-12" }]);
      setIndex(steps.length);
    }
    setAdding(false);
    setSearch("");
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
          setFinished(true);
          Alert.alert("Saved 🤝", withSets.map((c) => `✓ ${c.name}`).join("\n"), [{ text: "OK", onPress: () => navigation.goBack() }]);
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
              <Pressable key={c.id} style={[styles.pickRow, slot && { borderColor: slot.color }]} onPress={() => toggle(c.id)}>
                <View style={[styles.badge, { backgroundColor: slot?.color ?? "#334155" }]}>
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
        </View>
      </View>
    );
  }

  if (stage === "loading") {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={BRAND_GOLD} />
      </View>
    );
  }

  const withPlan = picked.filter((id) => plans[id]);
  const shown = forPlace(library, place);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {withPlan.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {withPlan.map((id) => (
              <Pressable key={id} style={[styles.chip, planFrom === id && { backgroundColor: slotOf(id).color }]} onPress={() => usePlan(id)}>
                <Text style={[styles.chipText, planFrom === id && styles.chipTextOn]}>
                  {slotOf(id).letter} · {first({ name: nameOf(id) })}'s workout
                </Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, !planFrom && { backgroundColor: BRAND_GOLD }]} onPress={() => usePlan(null)}>
              <Text style={[styles.chipText, !planFrom && styles.chipTextOn]}>Build as you go</Text>
            </Pressable>
          </ScrollView>
        )}
        <Text style={styles.helper}>{title}</Text>

        {step ? (
          <>
            <View style={styles.stepRow}>
              <Pressable onPress={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} hitSlop={10}>
                <Text style={[styles.arrow, index === 0 && styles.arrowOff]}>◀</Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.stepCount}>
                  Exercise {index + 1} of {steps.length}
                </Text>
                <Text style={styles.stepName}>{step.name}</Text>
                <Text style={styles.helper}>
                  {step.sets} sets × {step.reps}
                </Text>
              </View>
              <Pressable onPress={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={index >= steps.length - 1} hitSlop={10}>
                <Text style={[styles.arrow, index >= steps.length - 1 && styles.arrowOff]}>▶</Text>
              </Pressable>
            </View>

            <View style={styles.grid}>
              {group.map((c) => {
                const slot = slotOf(c.id);
                const sets = clientSets(logs, c.id, step.name);
                const last = sets.at(-1);
                return (
                  <Pressable key={c.id} style={[styles.card, { borderColor: slot.color }]} onPress={() => openEntry(c.id)}>
                    <View style={styles.cardTop}>
                      <View style={[styles.badge, { backgroundColor: slot.color }]}>
                        <Text style={styles.badgeText}>{slot.letter}</Text>
                      </View>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {first(c)}
                      </Text>
                    </View>
                    {holds[c.id] ? (
                      <Text style={styles.hold}>🩺 On hold</Text>
                    ) : (
                      <>
                        <Text style={styles.cardSets}>
                          {sets.length} of {step.sets} sets
                        </Text>
                        {sets.map((s) => (
                          <Text key={s.id} style={styles.cardSet}>
                            {s.set_number}. {s.weight_kg != null ? `${s.weight_kg}kg × ` : ""}
                            {s.reps}
                          </Text>
                        ))}
                        {last && (
                          <Pressable onPress={() => setMoving(last)} hitSlop={6}>
                            <Text style={styles.wrong}>Wrong person?</Text>
                          </Pressable>
                        )}
                        <Text style={[styles.tapHint, { color: slot.color }]}>+ Log {first(c)}'s set</Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={styles.helper}>Add the first exercise to start.</Text>
        )}

        <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
          <Text style={styles.addText}>+ Add an exercise</Text>
        </Pressable>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerCounts}>{group.map((c) => `${slotOf(c.id).letter} ${counts[c.id]}`).join("  ·  ")} sets</Text>
        <Pressable style={styles.finishButton} onPress={finish} disabled={saving}>
          {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.finishText}>Finish group session</Text>}
        </Pressable>
      </View>

      {/* The set box: banner, heading and Save button all name the client in their colour. */}
      <Modal visible={!!entryFor} animationType="slide" transparent onRequestClose={() => setEntryFor(null)}>
        <KeyboardSafe>
          <View style={styles.sheetWrap}>
            {entryFor && step && (
              <View style={[styles.sheet, { borderColor: slotOf(entryFor).color }]}>
                <View style={[styles.banner, { backgroundColor: slotOf(entryFor).color }]}>
                  <Text style={styles.bannerLetter}>{slotOf(entryFor).letter}</Text>
                  <Text style={styles.bannerText} numberOfLines={1}>
                    Logging for {nameOf(entryFor).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.sheetTitle}>
                  {step.name} · set {nextSetNumber(logs, entryFor, step.name)}
                </Text>
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
                <Text style={styles.label}>Good reps left</Text>
                <View style={styles.chips}>
                  {EFFORT_OPTIONS.map((o) => (
                    <Pressable key={o.key} style={[styles.chip, effort === o.key && { backgroundColor: slotOf(entryFor).color }]} onPress={() => setEffort(o.key)}>
                      <Text style={[styles.chipText, effort === o.key && styles.chipTextOn]}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={[styles.saveButton, { backgroundColor: slotOf(entryFor).color }]} onPress={saveSet} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.finishText}>Save {first({ name: nameOf(entryFor) })}'s set</Text>}
                </Pressable>
                <Pressable style={styles.cancel} onPress={() => setEntryFor(null)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardSafe>
      </Modal>

      <Modal visible={!!moving} animationType="fade" transparent onRequestClose={() => setMoving(null)}>
        <View style={styles.sheetWrap}>
          {moving && (
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                Move {moving.exercise_name} {moving.weight_kg != null ? `${moving.weight_kg}kg × ` : ""}
                {moving.reps} from {slotOf(moving.client_id).letter} · {nameOf(moving.client_id)} to:
              </Text>
              {group
                .filter((c) => c.id !== moving.client_id && !holds[c.id])
                .map((c) => (
                  <Pressable key={c.id} style={[styles.pickRow, { borderColor: slotOf(c.id).color }]} onPress={() => moveSet(moving, c.id)}>
                    <View style={[styles.badge, { backgroundColor: slotOf(c.id).color }]}>
                      <Text style={styles.badgeText}>{slotOf(c.id).letter}</Text>
                    </View>
                    <Text style={styles.pickName}>{c.name}</Text>
                  </Pressable>
                ))}
              <Pressable style={styles.cancel} onPress={() => setMoving(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardSafe style={styles.container}>
          <View style={{ padding: 16, flex: 1 }}>
            <View style={styles.addHeader}>
              <Text style={styles.title}>Add an exercise</Text>
              <Pressable onPress={() => setAdding(false)} hitSlop={10}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.helper}>Pick whatever's free in the gym. Everyone in the group does it.</Text>
            <GymHomeTabs current={place} onChange={setPlace} accent="#22C55E" />
            <TextInput
              style={[styles.input, { marginVertical: 10 }]}
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${shown.length} exercises`}
              placeholderTextColor="#64748B"
              autoCorrect={false}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }}>
              {[null, ...exerciseCategories(shown)].map((c) => (
                <Pressable key={c ?? "all"} style={[styles.chip, category === c && { backgroundColor: BRAND_GOLD }]} onPress={() => setCategory(c)}>
                  <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c ?? "All"}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView keyboardShouldPersistTaps="handled">
              {filterExercises(shown, search, category).map((e) => (
                <Pressable key={e.id} style={styles.libRow} onPress={() => addExercise(e)}>
                  <Text style={styles.pickName}>{e.name}</Text>
                  {e.category && <Text style={styles.helper}>{e.category}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </KeyboardSafe>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  stepRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 12 },
  arrow: { color: BRAND_GOLD, fontSize: 26, paddingHorizontal: 6 },
  arrowOff: { color: "#334155" },
  stepCount: { color: "#94A3B8", fontSize: 12 },
  stepName: { color: "#fff", fontSize: 19, fontWeight: "800", textAlign: "center", marginVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { width: "48%", flexGrow: 1, backgroundColor: "#1E293B", borderRadius: 14, borderWidth: 3, padding: 10, minHeight: 130 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  cardName: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  cardSets: { color: "#E2E8F0", fontWeight: "700", marginBottom: 2 },
  cardSet: { color: "#CBD5E1", fontSize: 13 },
  hold: { color: "#F87171", fontWeight: "700", marginTop: 8 },
  wrong: { color: "#F59E0B", fontSize: 12, marginTop: 4, textDecorationLine: "underline" },
  tapHint: { fontWeight: "800", marginTop: 8 },
  addButton: { marginTop: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: BRAND_GOLD, alignItems: "center" },
  addText: { color: BRAND_GOLD, fontWeight: "800" },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: "#1E293B", backgroundColor: "#0F172A" },
  footerCounts: { color: "#94A3B8", textAlign: "center", marginBottom: 8, fontSize: 13 },
  finishButton: { backgroundColor: "#22C55E", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  off: { backgroundColor: "#334155" },
  finishText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  toast: { position: "absolute", top: 12, left: 16, right: 16, backgroundColor: "#14532D", borderRadius: 10, padding: 12 },
  toastText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  sheetWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: "#334155", padding: 16, paddingBottom: 28 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, padding: 12, marginBottom: 12 },
  bannerLetter: { color: "#0F172A", fontSize: 26, fontWeight: "900" },
  bannerText: { color: "#0F172A", fontSize: 17, fontWeight: "900", flex: 1 },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  inputs: { flexDirection: "row", gap: 10 },
  label: { color: "#E2E8F0", fontWeight: "700", marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 10, padding: 12, fontSize: 16 },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
  addHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  libRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 6 },
});
