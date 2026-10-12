import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { displayProgramName } from "@/lib/programs";
import { loadCalendarWorkouts } from "@/lib/programQueries";
import { monthOf, monthRange, shortWorkoutName, type CalendarMonth } from "@/lib/trainingCalendar";
import TrainingCalendar from "@/components/TrainingCalendar";
import type { ClientCalendarWorkout, Program } from "@/types/database";

// The client's own training calendar (0069), read-only, under a tap-to-open
// heading on their workout screen. Only shows once their coach has planned
// something.
export default function ClientCalendarView({ clientId }: { clientId: string }) {
  const today = todayIso();
  const [month, setMonth] = useState<CalendarMonth>(monthOf(today));
  const [entries, setEntries] = useState<ClientCalendarWorkout[]>([]);
  const [names, setNames] = useState<Record<string, Pick<Program, "name" | "trainer_id">>>({});
  const [hasAny, setHasAny] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Show the calendar as soon as anything is planned from today on, even
  // when it's all next month.
  useEffect(() => {
    const yearOn = `${Number(today.slice(0, 4)) + 1}-12-31`;
    loadCalendarWorkouts(clientId, today, yearOn).then((rows) => {
      if (rows.length > 0) setHasAny(true);
    });
  }, [clientId, today]);

  useEffect(() => {
    const { from, to } = monthRange(month);
    loadCalendarWorkouts(clientId, from, to).then(async (rows) => {
      setEntries(rows);
      if (rows.length > 0) setHasAny(true);
      const missing = [...new Set(rows.map((r) => r.program_id))].filter((id) => !names[id]);
      if (missing.length === 0) return;
      const { data } = await supabase.from("programs").select("id, name, trainer_id").in("id", missing);
      setNames((prev) => ({ ...prev, ...Object.fromEntries((data ?? []).map((p) => [p.id, p])) }));
    });
  }, [clientId, month]);

  if (!hasAny) return null;

  const labels: Record<string, string> = {};
  for (const e of entries) {
    const p = names[e.program_id];
    if (p) labels[e.workout_date] = p.trainer_id ? shortWorkoutName(p.name) : shortWorkoutName(displayProgramName(p), false);
  }
  const picked = selected ? entries.find((e) => e.workout_date === selected) : null;
  const pickedProgram = picked ? names[picked.program_id] : null;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen(!open)} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.title}>📅 Your training calendar</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 10 }}>
          <TrainingCalendar
            month={month}
            onChangeMonth={setMonth}
            labels={labels}
            today={today}
            selected={selected}
            onPressDay={setSelected}
          />
          <Text style={styles.helper}>
            {selected
              ? pickedProgram
                ? `${displayProgramName(pickedProgram)} on this day. It shows on your workout screen that morning.`
                : "Nothing planned on this day."
              : "Your coach plans your workouts here. Tap a day to see what's on."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  chevron: { color: BRAND_GOLD, fontSize: 14 },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 8 },
});
