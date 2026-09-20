import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Pressable,
  Alert,
  RefreshControl,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Habit } from "@/types/database";
import { calculateHabitTier, DAYS_PER_TIER, STREAK_TIERS } from "@/lib/habitStreak";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const todayIso = () => new Date().toISOString().slice(0, 10);
const todayWeekday = () => new Date().getDay(); // 0 = Sunday .. 6 = Saturday

function isActiveToday(habit: Habit) {
  const today = todayIso();
  if (today < habit.start_date) return false;
  if (habit.end_date && today > habit.end_date) return false;
  return habit.active_days.includes(todayWeekday());
}

export default function HabitsScreen() {
  const { client } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  // habit_id -> { "2026-09-20": repsCompleted, ... } for the last 60 days, used
  // for both today's reps counter and the streak calculation.
  const [logsByHabit, setLogsByHabit] = useState<Record<string, Record<string, number>>>({});
  const [reminderDrafts, setReminderDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    const { data: habitRows } = await supabase
      .from("habits")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true });
    const list = habitRows ?? [];
    setHabits(list);
    setReminderDrafts(Object.fromEntries(list.map((h) => [h.id, h.reminder_time ? h.reminder_time.slice(0, 5) : ""])));

    if (list.length > 0) {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data: logRows } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("log_date", since.toISOString().slice(0, 10))
        .in("habit_id", list.map((h) => h.id));
      const byHabit: Record<string, Record<string, number>> = {};
      for (const l of logRows ?? []) {
        byHabit[l.habit_id] = byHabit[l.habit_id] ?? {};
        byHabit[l.habit_id][l.log_date] = l.reps_completed;
      }
      setLogsByHabit(byHabit);
    } else {
      setLogsByHabit({});
    }
  }, [client]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleDay = async (habit: Habit, day: number) => {
    const nextDays = habit.active_days.includes(day)
      ? habit.active_days.filter((d) => d !== day)
      : [...habit.active_days, day].sort();
    if (nextDays.length === 0) {
      Alert.alert("Keep at least one day", "A habit needs to apply on at least one day.");
      return;
    }
    const { error } = await supabase.from("habits").update({ active_days: nextDays }).eq("id", habit.id);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    const updated = habits.map((h) => (h.id === habit.id ? { ...h, active_days: nextDays } : h));
    setHabits(updated);
  };

  const toggleReminder = async (habit: Habit) => {
    const nextEnabled = !habit.reminder_enabled;
    const { error } = await supabase.from("habits").update({ reminder_enabled: nextEnabled }).eq("id", habit.id);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, reminder_enabled: nextEnabled } : h)));
  };

  const saveReminderTime = async (habit: Habit) => {
    const raw = (reminderDrafts[habit.id] ?? "").trim();
    if (!/^\d{2}:\d{2}$/.test(raw)) {
      Alert.alert("Use HH:MM", "Enter the reminder time like 08:00 or 18:30.");
      return;
    }
    const { error } = await supabase.from("habits").update({ reminder_time: `${raw}:00` }).eq("id", habit.id);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, reminder_time: `${raw}:00` } : h)));
  };

  const logReps = async (habit: Habit, delta: number) => {
    const current = logsByHabit[habit.id]?.[todayIso()] ?? 0;
    const next = Math.max(0, Math.min(habit.reps_target, current + delta));
    setLogsByHabit((prev) => ({
      ...prev,
      [habit.id]: { ...(prev[habit.id] ?? {}), [todayIso()]: next },
    }));
    const { error } = await supabase
      .from("habit_logs")
      .upsert({ habit_id: habit.id, log_date: todayIso(), reps_completed: next }, { onConflict: "habit_id,log_date" });
    if (error) Alert.alert("Couldn't save", error.message);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Habits</Text>
      <Text style={styles.helper}>Pick whichever days and reminder time actually fit your schedule.</Text>
      {habits.length === 0 && <Text style={styles.helper}>Your trainer hasn't set up any habits yet.</Text>}

      {habits.map((h) => {
        const activeToday = isActiveToday(h);
        const habitLogs = logsByHabit[h.id] ?? {};
        const completed = habitLogs[todayIso()] ?? 0;
        const done = completed >= h.reps_target;
        const tierResult = calculateHabitTier(h, habitLogs);
        const isMaxTier = tierResult.tier === STREAK_TIERS.length - 1;
        return (
          <View key={h.id} style={[styles.habitCard, activeToday && done && styles.habitCardDone]}>
            <View style={styles.habitHeaderRow}>
              <Text style={styles.habitName}>{h.name}</Text>
              <View style={styles.streakBadge}>
                <View style={[styles.streakDot, { backgroundColor: tierResult.color }]} />
                <Text style={[styles.streakText, { color: tierResult.color }]}>
                  {tierResult.label}
                  {!isMaxTier ? ` · ${tierResult.progress}/${DAYS_PER_TIER}` : ""}
                </Text>
              </View>
            </View>
            <Text style={styles.habitTarget}>{h.reps_target}x/day</Text>

            {activeToday ? (
              <View style={styles.repsRow}>
                <Pressable style={styles.stepperButton} onPress={() => logReps(h, -1)}>
                  <Text style={styles.stepperButtonText}>-</Text>
                </Pressable>
                <Text style={styles.repsValue}>
                  {completed} / {h.reps_target} today
                </Text>
                <Pressable style={styles.stepperButton} onPress={() => logReps(h, 1)}>
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.helper}>Not scheduled for today.</Text>
            )}

            <Text style={styles.fieldLabel}>Days that work for you</Text>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, i) => (
                <Pressable
                  key={i}
                  style={[styles.dayChip, h.active_days.includes(i) && styles.dayChipSelected]}
                  onPress={() => toggleDay(h, i)}
                >
                  <Text style={[styles.dayChipText, h.active_days.includes(i) && styles.dayChipTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.reminderToggleRow} onPress={() => toggleReminder(h)}>
              <View style={[styles.checkbox, h.reminder_enabled && styles.checkboxChecked]} />
              <Text style={styles.fieldLabel}>Remind me (coming soon - saves your preferred time for now)</Text>
            </Pressable>
            {h.reminder_enabled && (
              <View style={styles.reminderTimeRow}>
                <TextInput
                  style={styles.timeInput}
                  placeholder="HH:MM"
                  placeholderTextColor="#64748B"
                  value={reminderDrafts[h.id] ?? ""}
                  onChangeText={(v) => setReminderDrafts((prev) => ({ ...prev, [h.id]: v }))}
                />
                <Pressable style={styles.saveTimeButton} onPress={() => saveReminderTime(h)}>
                  <Text style={styles.saveTimeButtonText}>Save time</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 6 },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 12 },
  habitCard: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 14 },
  habitCardDone: { borderWidth: 1.5, borderColor: "#22C55E" },
  habitHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  habitName: { color: "#fff", fontWeight: "700", fontSize: 16, flexShrink: 1 },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  streakDot: { width: 8, height: 8, borderRadius: 4 },
  streakText: { fontSize: 12, fontWeight: "600" },
  habitTarget: { color: "#64748B", fontSize: 12, marginTop: 2, marginBottom: 12 },
  repsRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { color: "#22C55E", fontSize: 20, fontWeight: "700" },
  repsValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  fieldLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 8 },
  dayRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  dayChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipSelected: { backgroundColor: "#22C55E" },
  dayChipText: { color: "#64748B", fontWeight: "600", fontSize: 12 },
  dayChipTextSelected: { color: "#0F172A" },
  reminderToggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#64748B" },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  reminderTimeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  timeInput: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 10, width: 90, fontSize: 14 },
  saveTimeButton: { backgroundColor: "#22C55E", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  saveTimeButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
});
