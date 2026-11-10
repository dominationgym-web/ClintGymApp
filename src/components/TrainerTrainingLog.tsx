import React, { useState } from "react";
import { EFFORT_LABEL as PROGRESSION_EFFORT_LABEL } from "@/lib/progression";
import { View, Text, Pressable, Alert } from "react-native";
import { groupTrainingLog, type TrainingLogExercise } from "@/lib/trainingLog";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { SESSION_COLORS, SESSION_LABELS, STAR_GOLD } from "@/lib/workoutSessions";
import type { WorkoutLog, WorkoutSession } from "@/types/database";
import { themeBg, themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";
import EditSetModal from "@/components/EditSetModal";
import { LoggedSetsByExercise } from "@/components/LoggedSetsByExercise";
import { removeLiveDay, trainerCanRemove } from "@/lib/fixLiveWorkout";

const EFFORT_LABEL: Record<string, string> = PROGRESSION_EFFORT_LABEL;

// The client's last two weeks of training, one row per calendar day. Tap a day
// to open what they logged. A dot shows how the workout went and ⭐ that they
// pushed their weights up (0076); the improved exercises are highlighted gold.
export default function TrainerTrainingLog({
  logs,
  sessions = {},
  client = false,
  trainerId,
  clientId,
  onChanged,
  onBackIntoToday,
}: {
  logs: WorkoutLog[];
  sessions?: Record<string, WorkoutSession>;
  /** The client looking at their own log, so the words speak to them. */
  client?: boolean;
  /** The client's own trainer (0210): fix any set, remove the sets they logged, delete a live workout. */
  trainerId?: string;
  clientId?: string;
  /** A set was fixed or removed: load the log again. */
  onChanged?: () => void;
  /** Opens today's live session again, to carry on where they left off. */
  onBackIntoToday?: () => void;
}) {
  const days = groupTrainingLog(logs, todayIso());
  const [open, setOpen] = useState<string | null>(null);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open !== null, () => setOpen(null));
  // Trainer: the day's sets as buttons to fix (GRIZZ 2026-11-10).
  const [fixing, setFixing] = useState<string | null>(null);
  useStepBack(fixing !== null, () => setFixing(null));
  const [editing, setEditing] = useState<WorkoutLog | null>(null);
  const canFix = !client && !!trainerId;

  const deleteDay = (date: string, label: string, live: boolean) => {
    if (!trainerId || !clientId) return;
    Alert.alert(live ? "Delete this live session?" : "Delete this workout?", `Every set you logged on ${label} comes off their log. Sets they logged themselves stay.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const problem = await removeLiveDay(clientId, date, trainerId);
          if (problem) Alert.alert("Couldn't delete it", problem);
          setFixing(null);
          onChanged?.();
        },
      },
    ]);
  };

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
                <View style={[styles.dot, { backgroundColor: themeBg(SESSION_COLORS[result.status]) }]} />
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
                <Text style={[styles.resultText, { color: themeText(SESSION_COLORS[result.status]) }]}>
                  {SESSION_LABELS[result.status]}
                  {result.status !== "missed" ? ` · ${result.sets_done}/${result.sets_planned} sets` : ""}
                </Text>
                {result.in_person ? <Text style={styles.set}>In person, live session with {client ? "your coach" : "you"}</Text> : null}
                {result.reason ? <Text style={styles.set}>Why: {result.reason}</Text> : null}
              </View>
            )}
            {isOpen && fixing !== day.date && <LoggedExercises exercises={day.exercises} session={result} client={client} />}
            {isOpen && canFix && fixing === day.date && (
              <View style={styles.exercise}>
                <Text style={styles.fixHint}>Tap a set to change it.</Text>
                <LoggedSetsByExercise sets={day.exercises.flatMap((e) => e.sets)} onPick={setEditing} />
              </View>
            )}
            {isOpen && canFix && (
              <View style={styles.actions}>
                {day.date === todayIso() && onBackIntoToday && day.exercises.some((e) => e.sets.some((s) => s.logged_by === trainerId)) && (
                  <Pressable style={styles.actionGold} onPress={onBackIntoToday}>
                    <Text style={styles.actionGoldText}>▶ Back into today's live session</Text>
                  </Pressable>
                )}
                {day.setCount > 0 && (
                  <Pressable style={styles.action} onPress={() => setFixing(fixing === day.date ? null : day.date)}>
                    <Text style={styles.actionText}>{fixing === day.date ? "Done fixing" : "✏️ Fix a set"}</Text>
                  </Pressable>
                )}
                {(day.exercises.some((e) => e.sets.some((s) => trainerCanRemove(s, trainerId))) || (result?.in_person && day.setCount === 0)) && (
                  <Pressable style={styles.actionRed} onPress={() => deleteDay(day.date, day.label, !!result?.in_person)}>
                    <Text style={styles.actionRedText}>🗑 {result?.in_person ? "Delete this live session" : "Delete the sets you logged"}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}
      {canFix && (
        <EditSetModal
          set={editing}
          onSaved={() => onChanged?.()}
          onClose={() => setEditing(null)}
          onRemoved={editing && trainerCanRemove(editing, trainerId) ? () => onChanged?.() : undefined}
        />
      )}
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
              {s.warm_up ? "Warm-up" : s.gauge ? "Gauge set" : `Set ${s.set_number}`}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
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

const styles = themedStyles({
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
  fixHint: { color: "#94A3B8", fontSize: 12, marginBottom: 6 },
  actions: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  action: { borderRadius: 10, borderWidth: 1.5, borderColor: BRAND_GOLD, paddingVertical: 10, alignItems: "center" },
  actionText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14 },
  actionGold: { borderRadius: 10, backgroundColor: BRAND_GOLD, paddingVertical: 11, alignItems: "center" },
  actionGoldText: { color: "#0F172A", fontWeight: "800", fontSize: 14 },
  actionRed: { borderRadius: 10, borderWidth: 1.5, borderColor: "#EF4444", paddingVertical: 10, alignItems: "center" },
  actionRedText: { color: "#F87171", fontWeight: "800", fontSize: 14 },
  improvedText: { color: STAR_GOLD, fontWeight: "700", fontSize: 12, marginBottom: 2 },
});
