import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import ModalSafeArea from "../ModalSafeArea";
import KeyboardSafe from "@/components/KeyboardSafe";
import { getResetSwaps, saveResetSwaps, type ResetSwap } from "@/lib/exerciseSwaps";
import { bodyPartLabel, filterExercises } from "@/lib/exerciseFilter";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import LogSetModal, { type LogExercise } from "@/components/LogSetModal";
import { useAuth } from "@/context/AuthContext";
import { todayIso } from "@/lib/dates";
import {
  RESET_HOME_KIT,
  RESET_HOME_WARM_UP,
  RESET_LOCATIONS,
  RESET_PHASES,
  RESET_WARM_UP,
  RESET_WEEKS_TOTAL,
  resetSetTarget,
  resetTraining,
  resetWeek,
  type ResetLocation,
} from "@/lib/resetProgram";

// The Reset Training tab: the sessions for a week of the programme, with a
// demo video under each exercise, a Log button to log weight and reps (with
// the rest timer and guide), and a tick for "I trained today" and
// "I did cardio today" (the same ticks as the daily checklist).
export default function ResetTraining({
  location,
  onChangeLocation,
  currentWeek,
  trainedToday,
  cardioToday,
  strengthThisWeek,
  cardioThisWeek,
  onToggleTrained,
  onToggleCardio,
}: {
  location: ResetLocation | null;
  onChangeLocation: (location: ResetLocation) => void;
  // Null until she has started the programme: she can look, not tick.
  currentWeek: number | null;
  trainedToday: boolean;
  cardioToday: boolean;
  strengthThisWeek: number;
  cardioThisWeek: number;
  onToggleTrained: () => void;
  onToggleCardio: () => void;
}) {
  const [week, setWeek] = useState(currentWeek ?? 1);
  const { client } = useAuth();
  const [info, setInfo] = useState<Record<string, LogExercise>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [logging, setLogging] = useState<{ exercise: LogExercise; note?: string } | null>(null);
  // Sets logged today per exercise name, for the "✓ 2 sets" next to each.
  const [setsToday, setSetsToday] = useState<Record<string, number>>({});
  // Change exercise when the gym is busy: today's swaps by row, and the row
  // being changed with its same-body-part options.
  const [swaps, setSwaps] = useState<Record<string, ResetSwap>>({});
  const [swapping, setSwapping] = useState<{ key: string; base: LogExercise } | null>(null);
  const [options, setOptions] = useState<ResetSwap[] | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [swapPreview, setSwapPreview] = useState<string | null>(null);

  useEffect(() => {
    getResetSwaps(todayIso()).then(setSwaps);
  }, []);

  const openSwap = (key: string, base: LogExercise) => {
    if (!base.id) return;
    setSwapping({ key, base });
    setOptions(null);
    setSwapSearch("");
    setSwapPreview(null);
    supabase.rpc("swap_options_for", { p_exercise: base.id, p_home: location === "home" }).then(({ data }) => setOptions(data ?? []));
  };

  const chooseSwap = (choice: ResetSwap | null) => {
    if (!swapping) return;
    const next = { ...swaps };
    if (choice) next[swapping.key] = choice;
    else delete next[swapping.key];
    setSwaps(next);
    saveResetSwaps(todayIso(), next);
    setSwapping(null);
  };

  useEffect(() => {
    supabase.rpc("reset_exercise_info").then(({ data }) => {
      setInfo(Object.fromEntries((data ?? []).map((r) => [r.name, r])));
    });
  }, []);

  const loadSetsToday = async () => {
    if (!client) return;
    const { data } = await supabase
      .from("workout_logs")
      .select("exercise_name")
      .eq("client_id", client.id)
      .eq("log_date", todayIso());
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[r.exercise_name] = (counts[r.exercise_name] ?? 0) + 1;
    setSetsToday(counts);
  };

  useEffect(() => {
    loadSetsToday();
  }, [client]);

  const videos: Record<string, string | null> = {
    ...Object.fromEntries(Object.entries(info).map(([name, e]) => [name, e.external_url])),
    ...Object.fromEntries(Object.values(swaps).map((e) => [e.name, e.external_url])),
  };

  const plan = resetWeek(week, client?.sex);
  const phase = RESET_PHASES[plan.phase];
  const training = resetTraining(plan.phase, location, client?.sex);
  const isThisWeek = week === currentWeek;
  const target = resetSetTarget(training.sets);

  const exerciseFor = (name: string): LogExercise =>
    info[name] ?? Object.values(swaps).find((e) => e.name === name) ?? { id: null, name, category: null, external_url: null };
  const openLog = (name: string, note?: string) => setLogging({ exercise: exerciseFor(name), note });

  // One exercise line: its name (tap for the video), Log sets, and Change
  // exercise, showing today's swap in its place.
  const exerciseLine = (planned: string, rowKey: string, note?: string, prefix = "") => {
    const swapKey = `${rowKey}:${planned}`;
    const swap = swaps[swapKey];
    const name = swap?.name ?? planned;
    const canSwap = !!info[planned]?.id;
    return (
      <View>
        <View style={styles.nameLine}>
          <View style={{ flex: 1 }}>{exerciseName(name, rowKey, prefix)}</View>
          {logButton(name, note)}
        </View>
        {swap && <Text style={styles.swapped}>Swapped from {planned}</Text>}
        {canSwap && (
          <Pressable onPress={() => openSwap(swapKey, info[planned])} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <Text style={styles.changeLink}>⇄ Change exercise</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const exerciseName = (name: string, rowKey: string, prefix = "") => {
    const key = `${rowKey}:${name}`;
    return (
      <Pressable onPress={() => setOpen(open === key ? null : key)} hitSlop={6}>
        <Text style={styles.exercise}>
          {prefix}
          {name} <Text style={styles.play}>{open === key ? "▼" : "▶"}</Text>
        </Text>
      </Pressable>
    );
  };

  const logButton = (name: string, note?: string) => (
    <Pressable style={styles.logButton} onPress={() => openLog(name, note)} hitSlop={6}>
      <Text style={styles.logText}>{setsToday[name] ? `✓ ${setsToday[name]} set${setsToday[name] > 1 ? "s" : ""}` : "Log sets ›"}</Text>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.switchRow}>
        {RESET_LOCATIONS.map((l) => {
          const on = (location ?? "gym") === l.value;
          return (
            <Pressable key={l.value} style={[styles.switchButton, on && styles.switchOn]} onPress={() => onChangeLocation(l.value)}>
              <Text style={[styles.switchText, on && styles.switchTextOn]}>
                {l.emoji} {l.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.weekRow}>
        <Pressable disabled={week === 1} onPress={() => setWeek(week - 1)} hitSlop={10} style={week === 1 && styles.dim}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.weekTitle}>Week {week}</Text>
          <Text style={[styles.phase, { color: phase.color }]}>
            {phase.name}
            {isThisWeek ? " · THIS WEEK" : ""}
          </Text>
        </View>
        <Pressable
          disabled={week === RESET_WEEKS_TOTAL}
          onPress={() => setWeek(week + 1)}
          hitSlop={10}
          style={week === RESET_WEEKS_TOTAL && styles.dim}
        >
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>

      {isThisWeek && (
        <View style={styles.card}>
          <Text style={styles.label}>This week</Text>
          <Text style={styles.progress}>
            Strength: {Math.min(strengthThisWeek, training.sessionsPerWeek)} of {training.sessionsPerWeek} sessions done
          </Text>
          <Text style={styles.progressSub}>Cardio sessions: {cardioThisWeek}</Text>
          <View style={styles.tickRow}>
            <Pressable style={[styles.tick, trainedToday && styles.tickOn]} onPress={onToggleTrained}>
              <Text style={[styles.tickText, trainedToday && styles.tickTextOn]}>
                {trainedToday ? "✓ Trained today" : "I trained today"}
              </Text>
            </Pressable>
            <Pressable style={[styles.tick, cardioToday && styles.tickOn]} onPress={onToggleCardio}>
              <Text style={[styles.tickText, cardioToday && styles.tickTextOn]}>
                {cardioToday ? "✓ Cardio today" : "I did cardio today"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.summary}>{training.summary}</Text>
        <Text style={styles.line}>
          <Text style={styles.bold}>Sets: </Text>
          {training.sets}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.bold}>Effort: </Text>
          {training.effort}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.bold}>Cardio: </Text>
          {training.cardio}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.bold}>Warm-up: </Text>
          {location === "home" ? RESET_HOME_WARM_UP : RESET_WARM_UP}
        </Text>
        {location === "home" && (
          <Text style={styles.line}>
            <Text style={styles.bold}>Kit: </Text>
            {RESET_HOME_KIT}
          </Text>
        )}
      </View>

      <Text style={styles.hint}>Tap an exercise to watch how to do it, or "Log sets" to log your weights and reps.</Text>
      {training.sessions.map((s) => (
        <View key={s.key} style={styles.card}>
          <Text style={styles.sessionTitle}>{s.label}</Text>
          {s.exercises.map((e, i) => {
            const rowKey = `${s.key}-${i}`;
            const openName = open?.startsWith(`${rowKey}:`) ? open.slice(rowKey.length + 1) : null;
            return (
              <View key={rowKey} style={styles.exerciseRow}>
                <View style={styles.exerciseLine}>
                  <Text style={styles.number}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    {exerciseLine(e.name, rowKey, e.note)}
                    {e.or && exerciseLine(e.or, rowKey, e.note, "or ")}
                    {e.note && <Text style={styles.note}>{e.note}</Text>}
                  </View>
                </View>
                {openName && <ExerciseVideoPreview url={videos[openName] ?? null} name={openName} />}
              </View>
            );
          })}
        </View>
      ))}

      <Text style={styles.energy}>{training.energyNote}</Text>
      <Modal visible={!!swapping} animationType="slide" onRequestClose={() => setSwapping(null)}>
        <KeyboardSafe>
          <ModalSafeArea style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Change exercise</Text>
                <Text style={styles.note}>
                  Gym busy? Swap {swapping?.base.name} for another {bodyPartLabel(swapping?.base.category ?? null)} exercise, just for
                  today.
                </Text>
              </View>
              <Pressable onPress={() => setSwapping(null)} hitSlop={8}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            {swapping && swaps[swapping.key] && (
              <Pressable style={styles.swapBack} onPress={() => chooseSwap(null)}>
                <Text style={styles.logText}>↺ Back to {swapping.base.name}</Text>
              </Pressable>
            )}
            <TextInput
              style={styles.search}
              value={swapSearch}
              onChangeText={setSwapSearch}
              placeholder="Search"
              placeholderTextColor="#64748B"
              autoCorrect={false}
            />
            {options === null ? (
              <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filterExercises(options, swapSearch)}
                keyExtractor={(e) => e.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={<Text style={styles.note}>No other exercises for this body part.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.swapRow}>
                    <View style={styles.nameLine}>
                      <Text style={[styles.exercise, { flex: 1 }]}>{item.name}</Text>
                      <Pressable hitSlop={6} onPress={() => setSwapPreview(swapPreview === item.id ? null : item.id)}>
                        <Text style={styles.play}>{swapPreview === item.id ? "Hide" : "▶ Watch"}</Text>
                      </Pressable>
                      <Pressable style={styles.logButton} onPress={() => chooseSwap(item)}>
                        <Text style={styles.logText}>Use this</Text>
                      </Pressable>
                    </View>
                    {swapPreview === item.id && <ExerciseVideoPreview url={item.external_url} name={item.name} />}
                  </View>
                )}
              />
            )}
          </ModalSafeArea>
        </KeyboardSafe>
      </Modal>
      <LogSetModal
        exercise={logging?.exercise ?? null}
        target={target}
        note={logging?.note}
        onClose={() => {
          setLogging(null);
          loadSetsToday();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 10, padding: 4, marginBottom: 14 },
  switchButton: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  switchOn: { backgroundColor: BRAND_GOLD },
  switchText: { color: "#CBD5E1", fontWeight: "700", fontSize: 14 },
  switchTextOn: { color: "#0F172A" },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 8 },
  arrow: { color: BRAND_GOLD, fontSize: 34, fontWeight: "700", paddingHorizontal: 12 },
  dim: { opacity: 0.25 },
  weekTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  phase: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5, marginTop: 2 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 10 },
  label: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 },
  progress: { color: "#fff", fontSize: 15, fontWeight: "700" },
  progressSub: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  tickRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tick: { flex: 1, borderWidth: 1.5, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  tickOn: { backgroundColor: BRAND_GOLD },
  tickText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13.5 },
  tickTextOn: { color: "#0F172A" },
  summary: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  line: { color: "#CBD5E1", fontSize: 13.5, lineHeight: 20, marginBottom: 4 },
  bold: { color: "#fff", fontWeight: "700" },
  hint: { color: "#64748B", fontSize: 12, marginBottom: 8 },
  sessionTitle: { color: BRAND_GOLD, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  exerciseRow: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#0F172A" },
  exerciseLine: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  number: { color: "#64748B", fontWeight: "700", width: 16, fontSize: 14, lineHeight: 22 },
  exercise: { color: "#E2E8F0", fontSize: 14.5, lineHeight: 22 },
  play: { color: BRAND_GOLD, fontSize: 11 },
  note: { color: "#94A3B8", fontSize: 12.5 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  logButton: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  logText: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700" },
  swapped: { color: "#94A3B8", fontSize: 12, fontStyle: "italic" },
  changeLink: { color: "#38BDF8", fontSize: 12.5, fontWeight: "700", marginTop: 2 },
  modal: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 16 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  close: { color: BRAND_GOLD, fontWeight: "700" },
  swapBack: { alignSelf: "flex-start", borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10 },
  search: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, marginBottom: 10 },
  swapRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 10, marginBottom: 8 },
  energy: { color: "#94A3B8", fontSize: 13, lineHeight: 19, fontStyle: "italic", marginTop: 4, marginBottom: 12 },
});
