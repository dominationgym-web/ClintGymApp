import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

  const videos = Object.fromEntries(Object.entries(info).map(([name, e]) => [name, e.external_url]));

  const plan = resetWeek(week, client?.sex);
  const phase = RESET_PHASES[plan.phase];
  const training = resetTraining(plan.phase, location, client?.sex);
  const isThisWeek = week === currentWeek;
  const target = resetSetTarget(training.sets);

  const openLog = (name: string, note?: string) =>
    setLogging({ exercise: info[name] ?? { id: null, name, category: null, external_url: null }, note });

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
                    <View style={styles.nameLine}>
                      <View style={{ flex: 1 }}>{exerciseName(e.name, rowKey)}</View>
                      {logButton(e.name, e.note)}
                    </View>
                    {e.or && (
                      <View style={styles.nameLine}>
                        <View style={{ flex: 1 }}>{exerciseName(e.or, rowKey, "or ")}</View>
                        {logButton(e.or, e.note)}
                      </View>
                    )}
                    {e.note && <Text style={styles.note}>{e.note}</Text>}
                  </View>
                </View>
                {openName && <ExerciseVideoPreview url={videos[openName] ?? null} />}
              </View>
            );
          })}
        </View>
      ))}

      <Text style={styles.energy}>{training.energyNote}</Text>
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
  energy: { color: "#94A3B8", fontSize: 13, lineHeight: 19, fontStyle: "italic", marginTop: 4, marginBottom: 12 },
});
