import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { cardioLabel, formatRest, slotOf, WEEKDAY_NAMES } from "@/lib/programs";
import type { Program, ProgramExercise } from "@/types/database";

// A program's exercises, grouped by weekday for weekly programs. Multi-week
// programs (0065) list each week's training days under a week heading.
export default function ProgramSummary({ program, exercises }: { program: Program; exercises: ProgramExercise[] }) {
  const weeks = program.weeks ?? 1;
  const days =
    program.kind !== "weekly"
      ? [1]
      : weeks > 1
        ? [...new Set(exercises.map(slotOf))].sort((a, b) => a - b)
        : [1, 2, 3, 4, 5, 6, 7];
  return (
    <View>
      {program.warm_up ? <Text style={styles.line}>Warm-up: {program.warm_up}</Text> : null}
      {days.map((day) => {
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
              rows.map((r) => (
                <Text key={r.id} style={styles.line}>
                  {r.kind === "cardio"
                    ? `🔥 Cardio: ${cardioLabel(r)}`
                    : `${r.exercise_name}: ${r.sets} x ${r.reps}, rest ${formatRest(r.rest_seconds)}`}
                </Text>
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { color: "#fff", fontWeight: "700", fontSize: 13, marginBottom: 2 },
  week: { color: "#D4AF37", fontWeight: "800", fontSize: 14, marginTop: 6, marginBottom: 2 },
  line: { color: "#94A3B8", fontSize: 13, marginBottom: 2 },
});
