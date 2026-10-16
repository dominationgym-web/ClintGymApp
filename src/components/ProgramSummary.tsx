import React, { useState } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { cardioLabel, formatRest, slotOf, WEEKDAY_NAMES } from "@/lib/programs";
import type { Program, ProgramExercise } from "@/types/database";
import ExerciseInfoModal from "@/components/ExerciseInfoModal";

// A program's exercises, grouped by weekday for weekly programs. Multi-week
// programs (0065) list each week's training days under a week heading. On a
// client's screen the trainer can tap an exercise to change it for them (0070).
// ▶ beside each exercise opens its demo video and How to do it (2026-10-14);
// where there's nothing to change, tapping the exercise opens it too.
export default function ProgramSummary({
  program,
  exercises,
  onPressExercise,
  collapsible = false,
  onlySlot = null,
}: {
  program: Program;
  exercises: ProgramExercise[];
  onPressExercise?: (row: ProgramExercise) => void;
  /** Programs tab: the list stays shut until the trainer taps to check it (GRIZZ, 2026-10-14). */
  collapsible?: boolean;
  /** Just this session of a weekly program, for a single day on the calendar (GRIZZ, 2026-10-16). */
  onlySlot?: number | null;
}) {
  const [info, setInfo] = useState<ProgramExercise | null>(null);
  const [shown, setShown] = useState(!collapsible);
  const weeks = program.weeks ?? 1;
  const days =
    onlySlot != null
      ? [onlySlot]
      : program.kind !== "weekly"
      ? [1]
      : weeks > 1
        ? [...new Set(exercises.map(slotOf))].sort((a, b) => a - b)
        : [1, 2, 3, 4, 5, 6, 7];
  return (
    <View>
      {program.warm_up ? <Text style={styles.line}>Warm-up: {program.warm_up}</Text> : null}
      {onPressExercise ? (
        <Text style={styles.tapHint}>✎ Tap an exercise to change it, or its sets and reps, for this client. Tap ▶ to watch it.</Text>
      ) : collapsible ? (
        <Pressable onPress={() => setShown(!shown)} hitSlop={6} accessibilityRole="button" style={styles.checkButton}>
          <Text style={styles.checkText}>
            {shown
              ? "▲ Hide exercises"
              : `▶ Check all ${exercises.filter((e) => e.kind !== "cardio").length} exercises before you give it out`}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.tapHint}>▶ Tap an exercise to watch its video and how to do it.</Text>
      )}
      {collapsible && shown ? <Text style={styles.tapHint}>Tap an exercise or ▶ to watch its video and how to do it.</Text> : null}
      {shown && days.map((day) => {
        const rows = exercises.filter((e) => slotOf(e) === day).sort((a, b) => a.sort_order - b.sort_order);
        const weekOf = (slot: number) => Math.floor((slot - 1) / 7) + 1;
        const i = days.indexOf(day);
        const newWeek = weeks > 1 && (i === 0 || weekOf(days[i - 1]) !== weekOf(day));
        return (
          <View key={day} style={{ marginTop: 8 }}>
            {newWeek ? <Text style={styles.week}>Week {weekOf(day)}</Text> : null}
            {program.kind === "weekly" && (
              <Text style={styles.day}>
                {WEEKDAY_NAMES[(day - 1) % 7]} · {program.day_titles[day - 1] ?? ""}
              </Text>
            )}
            {rows.length === 0 && program.kind === "weekly" ? (
              <Text style={styles.line}>Rest</Text>
            ) : (
              rows.map((r) => {
                if (r.kind === "cardio") {
                  return (
                    <Text key={r.id} style={styles.line}>
                      🔥 Cardio: {cardioLabel(r)}
                    </Text>
                  );
                }
                const line = (
                  <Text style={[styles.line, onPressExercise && styles.tappable, r.changed_from && styles.changed]}>
                    {`${r.exercise_name}: ${r.sets} x ${r.reps}, rest ${formatRest(r.rest_seconds)}`}
                    {r.changed_from ? (
                      <Text style={styles.was}>
                        {r.changed_from.exercise_name !== r.exercise_name
                          ? `  ✎ changed, was ${r.changed_from.exercise_name}`
                          : `  ✎ changed, was ${r.changed_from.sets} x ${r.changed_from.reps}`}
                      </Text>
                    ) : null}
                  </Text>
                );
                return (
                  <View key={r.id} style={styles.row}>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => (onPressExercise ? onPressExercise(r) : setInfo(r))}
                      hitSlop={4}
                      accessibilityRole="button"
                    >
                      {line}
                    </Pressable>
                    <Pressable onPress={() => setInfo(r)} hitSlop={8} accessibilityLabel={`Watch ${r.exercise_name}`}>
                      <Text style={styles.watch}>▶</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
      <ExerciseInfoModal exercise={info} onClose={() => setInfo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  day: { color: "#fff", fontWeight: "700", fontSize: 13, marginBottom: 2 },
  week: { color: "#D4AF37", fontWeight: "800", fontSize: 14, marginTop: 6, marginBottom: 2 },
  line: { color: "#94A3B8", fontSize: 13, marginBottom: 2 },
  tappable: { color: "#CBD5E1", paddingVertical: 3 },
  changed: { color: "#fff" },
  was: { color: "#D4AF37", fontSize: 12, fontWeight: "600" },
  tapHint: { color: "#D4AF37", fontSize: 12, marginTop: 6 },
  checkButton: { borderWidth: 1, borderColor: "#D4AF37", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  checkText: { color: "#D4AF37", fontSize: 14, fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  watch: { color: "#D4AF37", fontSize: 14, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 3 },
});
