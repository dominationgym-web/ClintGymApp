import React, { useState } from "react";
import { EFFORT_LABEL as PROGRESSION_EFFORT_LABEL } from "@/lib/progression";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { groupTrainingLog, type TrainingLogExercise } from "@/lib/trainingLog";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { SESSION_COLORS, SESSION_LABELS, STAR_GOLD } from "@/lib/workoutSessions";
import type { WorkoutLog, WorkoutSession } from "@/types/database";

const EFFORT_LABEL: Record<string, string> = PROGRESSION_EFFORT_LABEL;

// The client's last two weeks of training, one row per calendar day. Tap a day
// to open what they logged. A dot shows how the workout went and ⭐ that they
// pushed their weights up (0076); the improved exercises are highlighted gold.
export default function TrainerTrainingLog({
  logs,
  sessions = {},
  client = false,
}: {
  logs: WorkoutLog[];
  sessions?: Record<string, WorkoutSession>;
  /** The client looking at their own log, so the words speak to them. */
  client?: boolean;
}) {
  const days = groupTrainingLog(logs, todayIso());
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View>
      {days.map((day) => {
        const result = sessions[day.date];
        const trained = day.setCount > 0 || !!result;
        const isOpen = open === day.date;
        return (
          <View key={day.date} style={[styles.day, !trained && styles.dayEmpty]}>
            <Pressable
              style={styles.header}
              disabled={!trained}
              onPress={() => setOpen(isOpen ? null : day.date)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen, disabled: !trained }}
            >
              {result ? (
                <View style={[styles.dot, { backgroundColor: SESSION_COLORS[result.status] }]} />
              ) : (
                <View style={styles.dot} />
              )}
              <Text style={[styles.label, !trained && styles.labelEmpty]}>{day.label}</Text>
              <Text style={styles.summary}>
                {result?.star ? "⭐ " : ""}
                {result?.in_person ? "🤝 " : ""}
                {result && day.setCount === 0
                  ? SESSION_LABELS[result.status]
                  : trained
                  ? `${day.exercises.length} exercise${day.exercises.length === 1 ? "" : "s"} · ${day.setCount} set${day.setCount === 1 ? "" : "s"}`
                  : "Nothing logged"}
              </Text>
              {trained && <Text style={styles.chevron}>{isOpen ? "▲" : "▼"}</Text>}
            </Pressable>
            {isOpen && result && (
              <View style={styles.exercise}>
                <Text style={[styles.resultText, { color: SESSION_COLORS[result.status] }]}>
                  {SESSION_LABELS[result.status]}
                  {result.status !== "missed" ? ` · ${result.sets_done}/${result.sets_planned} sets` : ""}
                </Text>
                {result.in_person ? <Text style={styles.set}>🤝 In person, live session with {client ? "your coach" : "you"}</Text> : null}
                {result.reason ? <Text style={styles.set}>Why: {result.reason}</Text> : null}
              </View>
            )}
            {isOpen && <LoggedExercises exercises={day.exercises} session={result} client={client} />}
          </View>
        );
      })}
    </View>
  );
}

// One day's sets, exercise by exercise, with the ones pushed up in gold. Also
// on the client's calendar day page (GRIZZ, 2026-10-27: see the live workouts
// they did with their coach).
export function LoggedExercises({
  exercises,
  session,
  client = false,
}: {
  exercises: TrainingLogExercise[];
  session?: WorkoutSession;
  client?: boolean;
}) {
  const improved = new Map((session?.improvements ?? []).map((i) => [i.exercise, i]));
  return (
    <>
      {exercises.map((exercise) => (
        <View key={exercise.name} style={[styles.exercise, improved.has(exercise.name) && styles.improved]}>
          <Text style={styles.exerciseName}>
            {improved.has(exercise.name) ? "⭐ " : ""}
            {exercise.name}
          </Text>
          {improved.has(exercise.name) && (
            <Text style={styles.improvedText}>
              Up from {improved.get(exercise.name)!.before} to {improved.get(exercise.name)!.after}
            </Text>
          )}
          {exercise.sets.map((s) => (
            <Text key={s.id} style={styles.set}>
              {s.warm_up ? "Warm-up" : s.gauge ? "🎯 Gauge set" : `Set ${s.set_number}`}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
              {s.reps} reps ·{" "}
              {s.warm_up
                ? "not a working set"
                : s.gauge
                  ? `stopped 1-2 reps short, to find ${client ? "your" : "their"} weight`
                  : EFFORT_LABEL[s.effort] ?? s.effort}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  day: { backgroundColor: "#1E293B", borderRadius: 10, marginBottom: 6, overflow: "hidden" },
  dayEmpty: { backgroundColor: "#162032" },
  header: { flexDirection: "row", alignItems: "center", padding: 12 },
  label: { color: "#fff", fontWeight: "700", fontSize: 14, width: 96 },
  labelEmpty: { color: "#64748B", fontWeight: "600" },
  summary: { color: "#94A3B8", fontSize: 12, flex: 1 },
  chevron: { color: BRAND_GOLD, fontSize: 12, marginLeft: 8 },
  exercise: { paddingHorizontal: 12, paddingBottom: 10 },
  exerciseName: { color: BRAND_GOLD, fontWeight: "600", fontSize: 14, marginBottom: 2 },
  set: { color: "#E2E8F0", fontSize: 13, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: "transparent" },
  resultText: { fontWeight: "700", fontSize: 13 },
  improved: { backgroundColor: "#3A3110", marginHorizontal: 8, marginBottom: 8, borderRadius: 8, paddingTop: 8 },
  improvedText: { color: STAR_GOLD, fontWeight: "700", fontSize: 12, marginBottom: 2 },
});
