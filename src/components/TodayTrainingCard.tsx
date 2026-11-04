import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { displayProgramName } from "@/lib/programs";
import { sessionTitle } from "@/lib/programSchedule";
import { COACH_MEAL_PLAN_TITLE, useHasMealPlan } from "@/hooks/useHasMealPlan";
import { themedStyles } from "@/lib/theme";

type Today = { title: string; sub: string; done: boolean } | null;

// The first thing on the client's Today tab (critique, 2026-11-04): today's
// workout with one big Start button, then the coach's meal plan. Start opens
// the Training tab, where the workout itself lives.
export default function TodayTrainingCard({ clientId }: { clientId: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const hasMealPlan = useHasMealPlan(clientId);
  const [today, setToday] = useState<Today | undefined>(undefined);

  const load = useCallback(() => {
    const date = todayIso();
    Promise.all([
      supabase.from("client_calendar_workouts").select("program_id, day_slot").eq("client_id", clientId).eq("workout_date", date).maybeSingle(),
      supabase.from("client_programs").select("program_id").eq("client_id", clientId).maybeSingle(),
      supabase.from("workout_sessions").select("status").eq("client_id", clientId).eq("session_date", date).maybeSingle(),
    ]).then(async ([{ data: entry }, { data: assigned }, { data: session }]) => {
      const programId = entry?.program_id ?? assigned?.program_id ?? null;
      if (!programId) return setToday(null);
      const { data: program } = await supabase.from("programs").select("*").eq("id", programId).maybeSingle();
      if (!program) return setToday(null);
      const name = displayProgramName(program);
      const title = entry?.day_slot != null ? sessionTitle(program, entry.day_slot) : name;
      setToday({ title, sub: title === name ? "Today's workout" : name, done: session?.status === "complete" });
    });
  }, [clientId]);
  useFocusEffect(load);

  const openTraining = () => navigation.navigate("ClientTabs", { screen: "Exercises" });

  return (
    <View style={styles.card}>
      {today === undefined ? null : today ? (
        <Pressable style={styles.workout} onPress={openTraining} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.sub}>{today.sub}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {today.title}
            </Text>
          </View>
          <View style={[styles.start, today.done && styles.startDone]}>
            <Text style={[styles.startText, today.done && styles.startTextDone]}>{today.done ? "Done ✓" : "Start"}</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable style={styles.workout} onPress={openTraining} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.sub}>Today</Text>
            <Text style={styles.title}>No workout planned</Text>
          </View>
          <Text style={styles.link}>Training ›</Text>
        </Pressable>
      )}
      {hasMealPlan && (
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate("Section", { sectionKey: "nutrition", open: COACH_MEAL_PLAN_TITLE })}
          accessibilityRole="button"
        >
          <Text style={styles.rowText}>My meal plan</Text>
          <Text style={styles.link}>Open ›</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 14, marginBottom: 14, overflow: "hidden" },
  workout: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  sub: { color: "#94A3B8", fontSize: 13, marginBottom: 2 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  start: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22 },
  startDone: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#22C55E" },
  startText: { color: "#0F172A", fontWeight: "800", fontSize: 17 },
  startTextDone: { color: "#22C55E" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: "#334155" },
  rowText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
});
