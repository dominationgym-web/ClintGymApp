import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import ModalSafeArea from "./ModalSafeArea";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import RestTimer from "@/components/RestTimer";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { parseWeight } from "@/lib/weightInput";
import { filterExercises } from "@/lib/exerciseFilter";
import { EFFORT_OPTIONS } from "@/lib/progression";
import { WARM_UP_REST_SECONDS } from "@/lib/programs";
import {
  lastWeightOf,
  roundProblem,
  SUPERSET_MAX,
  SUPERSET_MIN,
  supersetRest,
  supersetRounds,
  warmUpEntry,
  warmUpPicks,
  workingSetsOf,
  type RoundEntry,
  type SupersetPick,
} from "@/lib/superset";
import type { Client, Exercise, ProgramExercise, WorkoutLog } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

const blank = (): RoundEntry => ({ weight: "", reps: "", effort: null });

// Superset logger (GRIZZ, 2026-10-23): pick 2-4 exercises from today's
// workout (or the library), tap Start, do one set of each back to back, then
// log the whole round at once and rest. Used on any workout and in live
// sessions, where the trainer logs for the client.
export default function SupersetLogger({
  visible,
  client,
  rows,
  library,
  todaysSets,
  categoryOf,
  categoriesToday,
  onSaved,
  onClose,
}: {
  visible: boolean;
  client: Client;
  /** Today's workout exercises (no cardio), offered first. */
  rows: ProgramExercise[];
  /** Exercises that can be added from the library. */
  library: Exercise[];
  /** Everything logged today, to number the sets. */
  todaysSets: WorkoutLog[];
  /** The body part of an exercise, for the warm-up round. */
  categoryOf: (pick: SupersetPick) => string | null;
  /** Body parts already worked today. */
  categoriesToday: (string | null)[];
  onSaved: (logs: WorkoutLog[]) => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<SupersetPick[]>([]);
  const [started, setStarted] = useState(false);
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<RoundEntry[]>([]);
  const [round, setRound] = useState(1);
  const [rounds, setRounds] = useState(0);
  const [resting, setResting] = useState(0);
  const [restFor, setRestFor] = useState(0);
  const [saving, setSaving] = useState(false);
  // Warm-up round (GRIZZ 2026-11-12): before round 1, one easy set of each
  // exercise whose body part isn't warm yet, so a warm-up isn't logged as a
  // working round. Null once it's done or skipped.
  const [warmUps, setWarmUps] = useState<boolean[] | null>(null);
  const [startWeights, setStartWeights] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setPicks([]);
    setStarted(false);
    setSearch("");
    setResting(0);
    setWarmUps(null);
  }, [visible]);

  const picked = (name: string) => picks.some((p) => p.exercise_name === name);
  const toggle = (pick: SupersetPick) => {
    if (picked(pick.exercise_name)) {
      setPicks((ps) => ps.filter((p) => p.exercise_name !== pick.exercise_name));
    } else if (picks.length < SUPERSET_MAX) {
      setPicks((ps) => [...ps, pick]);
      setSearch("");
    } else {
      Alert.alert("Up to 4", `A superset has ${SUPERSET_MIN} to ${SUPERSET_MAX} exercises. Take one off first.`);
    }
  };

  const start = async () => {
    // Start each exercise from the latest weight used for it.
    const { data } = await supabase
      .from("workout_logs")
      .select("exercise_id, exercise_name, weight_kg, log_date, created_at")
      .eq("client_id", client.id)
      .in("exercise_name", picks.map((p) => p.exercise_name))
      .order("log_date", { ascending: false })
      .limit(100);
    const logs = (data as Pick<WorkoutLog, "exercise_id" | "exercise_name" | "weight_kg" | "log_date" | "created_at">[]) ?? [];
    const starts = picks.map((p) => String(lastWeightOf(p, logs) ?? ""));
    setStartWeights(starts);
    const done = Math.min(...picks.map((p) => workingSetsOf(p, todaysSets)));
    const due = done === 0 ? warmUpPicks(picks, categoryOf, todaysSets, categoriesToday) : [];
    if (due.some(Boolean)) {
      setWarmUps(due);
      setEntries(picks.map((p, i) => (due[i] ? warmUpEntry(p, starts[i] ? Number(starts[i]) : null) : blank())));
    } else {
      setWarmUps(null);
      setEntries(starts.map((weight) => ({ ...blank(), weight })));
    }
    setRounds(supersetRounds(picks));
    setRound(done + 1);
    setStarted(true);
  };

  const setEntry = (i: number, change: Partial<RoundEntry>) =>
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...change } : e)));

  const toWorkingSets = () => {
    setWarmUps(null);
    setEntries(startWeights.map((weight) => ({ ...blank(), weight })));
  };

  const logWarmUps = async () => {
    if (!warmUps) return;
    const rowsToSave = picks
      .map((p, i) => ({ p, e: entries[i], due: warmUps[i] }))
      .filter(({ e, due }) => due && Number(e?.reps) > 0)
      .map(({ p, e }) => ({
        client_id: client.id,
        exercise_id: p.exercise_id,
        exercise_name: p.exercise_name,
        log_date: todayIso(),
        set_number: 0,
        weight_kg: parseWeight(e.weight),
        reps: Number(e.reps),
        effort: "comfortable" as const,
        warm_up: true,
      }));
    if (rowsToSave.length === 0) {
      Alert.alert("Almost there", "Enter the reps for the warm-up, or tap Skip the warm-up.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("workout_logs").insert(rowsToSave).select();
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save the warm-up", error.message);
      return;
    }
    onSaved((data as WorkoutLog[]) ?? []);
    toWorkingSets();
    setRestFor(WARM_UP_REST_SECONDS);
    setResting((n) => n + 1);
  };

  const logRound = async () => {
    const problem = roundProblem(picks, entries);
    if (problem) {
      Alert.alert("Almost there", problem);
      return;
    }
    const rowsToSave = picks
      .map((p, i) => ({ p, e: entries[i] }))
      .filter(({ e }) => e.reps.trim() !== "")
      .map(({ p, e }) => ({
        client_id: client.id,
        exercise_id: p.exercise_id,
        exercise_name: p.exercise_name,
        log_date: todayIso(),
        set_number: workingSetsOf(p, todaysSets) + 1,
        weight_kg: parseWeight(e.weight),
        reps: Number(e.reps),
        effort: e.effort!,
        warm_up: false,
      }));
    setSaving(true);
    const { data, error } = await supabase.from("workout_logs").insert(rowsToSave).select();
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save the round", error.message);
      return;
    }
    onSaved((data as WorkoutLog[]) ?? []);
    // Keep the weights for the next round; reps and effort start empty.
    setEntries((es) => es.map((e) => ({ ...blank(), weight: e.weight })));
    setRound((r) => r + 1);
    if (round < rounds) {
      setRestFor(supersetRest(picks));
      setResting((n) => n + 1);
    }
  };

  const options: SupersetPick[] = rows
    .filter((r) => r.kind !== "cardio")
    .map((r) => ({ exercise_id: r.exercise_id, exercise_name: r.exercise_name, row: r }));
  const found = search.trim()
    ? filterExercises(library, search)
        .filter((e) => !options.some((o) => o.exercise_name === e.name))
        .slice(0, 6)
    : [];
  const allDone = round > rounds;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={styles.screen}>
        <KeyboardSafe>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.title}>Superset</Text>
              <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.close}>{started ? "Done" : "Close"}</Text>
              </Pressable>
            </View>

            {!started ? (
              <>
                <Text style={styles.sub}>
                  Pick {SUPERSET_MIN} to {SUPERSET_MAX} exercises in the order you'll do them. Do one set of each back to back, then log the round.
                </Text>
                {picks.length > 0 && (
                  <Text style={styles.order}>{picks.map((p, i) => `${i + 1}. ${p.exercise_name}`).join("   ")}</Text>
                )}
                {options.length > 0 && <Text style={styles.label}>Today's workout</Text>}
                <View style={styles.chips}>
                  {options.map((o) => (
                    <Pressable
                      key={o.exercise_name}
                      style={[styles.chip, picked(o.exercise_name) && styles.chipOn]}
                      onPress={() => toggle(o)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: picked(o.exercise_name) }}
                    >
                      <Text style={[styles.chipText, picked(o.exercise_name) && styles.chipTextOn]}>
                        {picked(o.exercise_name) ? "✓ " : ""}
                        {o.exercise_name}
                      </Text>
                    </Pressable>
                  ))}
                  {picks
                    .filter((p) => !options.some((o) => o.exercise_name === p.exercise_name))
                    .map((p) => (
                      <Pressable key={p.exercise_name} style={[styles.chip, styles.chipOn]} onPress={() => toggle(p)} accessibilityRole="button">
                        <Text style={[styles.chipText, styles.chipTextOn]}>✓ {p.exercise_name}</Text>
                      </Pressable>
                    ))}
                </View>
                {library.length > 0 && (
                  <>
                    <Text style={styles.label}>Add another exercise</Text>
                    <TextInput
                      style={styles.search}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search exercises"
                      placeholderTextColor="#64748B"
                    />
                    {found.map((e) => (
                      <Pressable
                        key={e.id}
                        style={styles.found}
                        onPress={() => toggle({ exercise_id: e.id, exercise_name: e.name, row: null })}
                        accessibilityRole="button"
                      >
                        <Text style={styles.foundText}>＋ {e.name}</Text>
                        {e.category && <Text style={styles.foundCat}>{e.category}</Text>}
                      </Pressable>
                    ))}
                  </>
                )}
                <Pressable
                  style={[styles.start, picks.length < SUPERSET_MIN && { opacity: 0.4 }]}
                  onPress={start}
                  disabled={picks.length < SUPERSET_MIN}
                  accessibilityRole="button"
                >
                  <Text style={styles.startText}>
                    {picks.length < SUPERSET_MIN ? `Pick at least ${SUPERSET_MIN}` : `▶ Start superset (${picks.length} exercises)`}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {resting > 0 && <RestTimer key={resting} seconds={restFor || supersetRest(picks)} onClose={() => setResting(0)} />}
                {warmUps ? (
                  <>
                    <Text style={styles.round}>Warm-up round</Text>
                    <Text style={styles.sub}>
                      One easy set of each, at about half the weight. Warm-ups don't count as rounds. Then a short rest and round 1 starts.
                    </Text>
                    {picks.map((p, i) =>
                      warmUps[i] ? (
                        <View key={p.exercise_name} style={styles.card}>
                          <Text style={styles.cardTitle}>
                            {i + 1}. {p.exercise_name} <Text style={styles.cardPlan}>· warm-up</Text>
                          </Text>
                          <View style={styles.inputs}>
                            <TextInput
                              style={styles.input}
                              value={entries[i]?.weight ?? ""}
                              onChangeText={(v) => setEntry(i, { weight: v })}
                              placeholder="kg"
                              placeholderTextColor="#64748B"
                              keyboardType="decimal-pad"
                              accessibilityLabel={`${p.exercise_name} warm-up weight`}
                            />
                            <TextInput
                              style={styles.input}
                              value={entries[i]?.reps ?? ""}
                              onChangeText={(v) => setEntry(i, { reps: v })}
                              placeholder="Reps"
                              placeholderTextColor="#64748B"
                              keyboardType="number-pad"
                              accessibilityLabel={`${p.exercise_name} warm-up reps`}
                            />
                          </View>
                        </View>
                      ) : (
                        <Text key={p.exercise_name} style={styles.hint}>
                          {i + 1}. {p.exercise_name}: no warm-up needed (that body part is already warm).
                        </Text>
                      ),
                    )}
                    <Pressable style={styles.log} onPress={logWarmUps} disabled={saving} accessibilityRole="button">
                      {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.logText}>✓ Log warm-ups</Text>}
                    </Pressable>
                    <Pressable onPress={toWorkingSets} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "center" }}>
                      <Text style={styles.more}>Already warmed up? Skip the warm-up</Text>
                    </Pressable>
                  </>
                ) : (
                <>
                <View style={styles.roundRow}>
                  <Text style={styles.round}>{allDone ? `All ${rounds} rounds done 💪` : `Round ${round} of ${rounds}`}</Text>
                  {allDone && (
                    <Pressable onPress={() => setRounds((r) => r + 1)} accessibilityRole="button" hitSlop={8}>
                      <Text style={styles.more}>＋ One more round</Text>
                    </Pressable>
                  )}
                </View>
                {!allDone && (
                  <>
                    {picks.map((p, i) => (
                      <View key={p.exercise_name} style={styles.card}>
                        <Text style={styles.cardTitle}>
                          {i + 1}. {p.exercise_name}
                        </Text>
                        {p.row && (
                          <Text style={styles.cardPlan}>
                            Plan: {p.row.sets} sets x {p.row.reps}
                          </Text>
                        )}
                        <View style={styles.inputs}>
                          <TextInput
                            style={styles.input}
                            value={entries[i]?.weight ?? ""}
                            onChangeText={(v) => setEntry(i, { weight: v })}
                            placeholder="kg"
                            placeholderTextColor="#64748B"
                            keyboardType="decimal-pad"
                            accessibilityLabel={`${p.exercise_name} weight`}
                          />
                          <TextInput
                            style={styles.input}
                            value={entries[i]?.reps ?? ""}
                            onChangeText={(v) => setEntry(i, { reps: v })}
                            placeholder="Reps"
                            placeholderTextColor="#64748B"
                            keyboardType="number-pad"
                            accessibilityLabel={`${p.exercise_name} reps`}
                          />
                        </View>
                        <View style={styles.efforts}>
                          {EFFORT_OPTIONS.map((o) => (
                            <Pressable
                              key={o.key}
                              style={[styles.effort, entries[i]?.effort === o.key && styles.effortOn]}
                              onPress={() => setEntry(i, { effort: o.key })}
                              accessibilityRole="button"
                              accessibilityState={{ selected: entries[i]?.effort === o.key }}
                            >
                              <Text style={[styles.effortText, entries[i]?.effort === o.key && styles.effortTextOn]}>{o.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))}
                    <Text style={styles.hint}>Reps left (the buttons): how many more good reps you could have done. Leave reps empty for one you skipped.</Text>
                    <Pressable style={styles.log} onPress={logRound} disabled={saving} accessibilityRole="button">
                      {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.logText}>✓ Log round {round}</Text>}
                    </Pressable>
                  </>
                )}
                {allDone && (
                  <Pressable style={styles.log} onPress={onClose} accessibilityRole="button">
                    <Text style={styles.logText}>Done</Text>
                  </Pressable>
                )}
                </>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardSafe>
      </ModalSafeArea>
    </Modal>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  body: { padding: 16, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: BRAND_GOLD, fontSize: 22, fontWeight: "800", flex: 1 },
  close: { color: BRAND_GOLD, fontWeight: "700", padding: 6, fontSize: 15 },
  sub: { color: "#CBD5E1", fontSize: 14 },
  order: { color: "#F8FAFC", fontSize: 14, fontWeight: "700" },
  label: { color: "#94A3B8", fontWeight: "700", marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#E2E8F0", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  search: { backgroundColor: "#1E293B", color: "#F8FAFC", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  found: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1E293B", borderRadius: 8, padding: 10 },
  foundText: { color: "#F8FAFC", fontWeight: "600", flex: 1 },
  foundCat: { color: "#64748B", fontSize: 12 },
  start: { backgroundColor: "#D4AF37", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  startText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  roundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  round: { color: "#F8FAFC", fontSize: 18, fontWeight: "800" },
  more: { color: BRAND_GOLD, fontWeight: "700" },
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 10, gap: 6 },
  cardTitle: { color: "#F8FAFC", fontWeight: "700", fontSize: 15 },
  cardPlan: { color: "#94A3B8", fontSize: 12 },
  inputs: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: "#0F172A", color: "#F8FAFC", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16 },
  efforts: { flexDirection: "row", gap: 6 },
  effort: { flex: 1, borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  effortOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  effortText: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  effortTextOn: { color: "#0F172A" },
  hint: { color: "#64748B", fontSize: 12 },
  log: { backgroundColor: "#D4AF37", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  logText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
