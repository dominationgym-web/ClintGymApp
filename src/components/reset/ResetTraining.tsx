import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import { RESET_PHASES, RESET_TRAINING, RESET_WARM_UP, RESET_WEEKS_TOTAL, resetWeek } from "@/lib/resetProgram";

// The Reset Training tab: the sessions for a week of the programme, with a
// demo video under each exercise and a tick for "I trained today" and
// "I did cardio today" (the same ticks as the daily checklist).
export default function ResetTraining({
  currentWeek,
  trainedToday,
  cardioToday,
  strengthThisWeek,
  cardioThisWeek,
  onToggleTrained,
  onToggleCardio,
}: {
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
  const [videos, setVideos] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("reset_exercise_videos").then(({ data }) => {
      setVideos(Object.fromEntries((data ?? []).map((r) => [r.name, r.external_url])));
    });
  }, []);

  const plan = resetWeek(week);
  const phase = RESET_PHASES[plan.phase];
  const training = RESET_TRAINING[plan.phase];
  const isThisWeek = week === currentWeek;

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

  return (
    <View>
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
          {RESET_WARM_UP}
        </Text>
      </View>

      <Text style={styles.hint}>Tap an exercise to watch how to do it.</Text>
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
                    {exerciseName(e.name, rowKey)}
                    {e.or && exerciseName(e.or, rowKey, "or ")}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  energy: { color: "#94A3B8", fontSize: 13, lineHeight: 19, fontStyle: "italic", marginTop: 4, marginBottom: 12 },
});
