import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { groupTrainingLog } from "@/lib/trainingLog";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import type { WorkoutLog } from "@/types/database";

const EFFORT_LABEL: Record<string, string> = {
  comfortable: "Comfortable",
  close_to_failure: "Close to failure",
  failure: "Failure",
};

// The client's last two weeks of training, one row per calendar day. Tap a day
// to open what they logged.
export default function TrainerTrainingLog({ logs }: { logs: WorkoutLog[] }) {
  const days = groupTrainingLog(logs, todayIso());
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View>
      {days.map((day) => {
        const trained = day.setCount > 0;
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
              <Text style={[styles.label, !trained && styles.labelEmpty]}>{day.label}</Text>
              <Text style={styles.summary}>
                {trained
                  ? `${day.exercises.length} exercise${day.exercises.length === 1 ? "" : "s"} · ${day.setCount} set${day.setCount === 1 ? "" : "s"}`
                  : "Nothing logged"}
              </Text>
              {trained && <Text style={styles.chevron}>{isOpen ? "▲" : "▼"}</Text>}
            </Pressable>
            {isOpen &&
              day.exercises.map((exercise) => (
                <View key={exercise.name} style={styles.exercise}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {exercise.sets.map((s) => (
                    <Text key={s.id} style={styles.set}>
                      Set {s.set_number}: {s.weight_kg ? `${s.weight_kg}kg x ` : ""}
                      {s.reps} reps · {EFFORT_LABEL[s.effort] ?? s.effort}
                    </Text>
                  ))}
                </View>
              ))}
          </View>
        );
      })}
    </View>
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
});
