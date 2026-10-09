import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatRest, WEEKDAY_NAMES } from "@/lib/programs";
import type { Program, ProgramExercise } from "@/types/database";

// A program's exercises, grouped by weekday for weekly programs.
export default function ProgramSummary({ program, exercises }: { program: Program; exercises: ProgramExercise[] }) {
  const days = program.kind === "weekly" ? [1, 2, 3, 4, 5, 6, 7] : [1];
  return (
    <View>
      {days.map((day) => {
        const rows = exercises.filter((e) => e.day_number === day).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <View key={day} style={{ marginTop: 8 }}>
            {program.kind === "weekly" && (
              <Text style={styles.day}>
                {WEEKDAY_NAMES[day - 1]} · {program.day_titles[day - 1] ?? ""}
              </Text>
            )}
            {rows.length === 0 && program.kind === "weekly" ? (
              <Text style={styles.line}>Rest</Text>
            ) : (
              rows.map((r) => (
                <Text key={r.id} style={styles.line}>
                  {r.exercise_name}: {r.sets} x {r.reps}, rest {formatRest(r.rest_seconds)}
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
  line: { color: "#94A3B8", fontSize: 13, marginBottom: 2 },
});
