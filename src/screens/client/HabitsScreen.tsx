import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
  Keyboard,
} from "react-native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { toIsoDate, todayIso } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { Habit } from "@/types/database";
import { calculateHabitTier, DAYS_PER_TIER, STREAK_TIERS } from "@/lib/habitStreak";
import { parseReminderTime } from "@/lib/reminderTime";
import { scheduleHabitReminders } from "@/lib/notifications";
import { findHabit, isRunning } from "@/lib/habitLibrary";
import { BRAND_GOLD } from "@/lib/brand";
import ChooseHabitsModal from "@/components/ChooseHabitsModal";
import ChallengeCard from "@/components/ChallengeCard";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
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
  // Which habit's time was just saved, to show a "Saved" tick next to it.
  const [savedTimeFor, setSavedTimeFor] = useState<string | null>(null);
  // The habit whose days and reminder are open; the rest stay folded away.
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);
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
        .gte("log_date", toIsoDate(since))
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

  // Reload whenever the tab comes back into view, so a habit the coach just
  // added shows up without a pull-down.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

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
    // A habit with no days opens on its days; keep it open while she picks more.
    if (habit.active_days.length === 0) setSettingsFor(habit.id);
    const { error } = await supabase.from("habits").update({ active_days: nextDays }).eq("id", habit.id);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    const updated = habits.map((h) => (h.id === habit.id ? { ...h, active_days: nextDays } : h));
    setHabits(updated);
  };

  // Keep the phone's habit reminders in step with the list (the reminder used
  // to only save a time).
  useEffect(() => {
    if (!loading) scheduleHabitReminders(habits);
  }, [habits, loading]);

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
    const time = parseReminderTime(reminderDrafts[habit.id] ?? "");
    if (!time) {
      Alert.alert("Check the time", "Enter the reminder time like 08:00 or 18:30.");
      return;
    }
    Keyboard.dismiss();
    // .select() so a save that changed no rows shows as a failure instead of
    // silently looking like it worked.
    const { data, error } = await supabase
      .from("habits")
      .update({ reminder_time: `${time}:00` })
      .eq("id", habit.id)
      .select("id");
    if (error || !data || data.length === 0) {
      Alert.alert("Couldn't save the time", error?.message ?? "Please try again.");
      return;
    }
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, reminder_time: `${time}:00` } : h)));
    setReminderDrafts((prev) => ({ ...prev, [habit.id]: time }));
    setSavedTimeFor(habit.id);
  };

  // Add a habit the client picked, or start a stopped one of theirs again.
  const addHabit = async (name: string, reps: number): Promise<boolean> => {
    if (!client) return false;
    const existing = findHabit(habits, name);
    if (existing && isRunning(existing, todayIso())) return true;
    if (existing?.chosen_by_client) {
      const { error } = await supabase.from("habits").update({ end_date: null }).eq("id", existing.id);
      if (error) {
        Alert.alert("Couldn't add habit", error.message);
        return false;
      }
      setHabits((prev) => prev.map((h) => (h.id === existing.id ? { ...h, end_date: null } : h)));
      return true;
    }
    const { data, error } = await supabase
      .from("habits")
      .insert({ client_id: client.id, name: name.trim(), reps_target: reps, start_date: todayIso(), chosen_by_client: true })
      .select()
      .single();
    if (error || !data) {
      Alert.alert("Couldn't add habit", error?.message ?? "Please try again.");
      return false;
    }
    setHabits((prev) => [...prev, data]);
    setReminderDrafts((prev) => ({ ...prev, [data.id]: "" }));
    return true;
  };

  // Stopping keeps the habit's history for the trainer; it just ends yesterday.
  const stopHabit = (habit: Habit) => {
    Alert.alert(`Stop "${habit.name}"?`, "It comes off your list. You can add it again any time.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: async () => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const end = toIsoDate(yesterday);
          const { error } = await supabase.from("habits").update({ end_date: end }).eq("id", habit.id);
          if (error) {
            Alert.alert("Couldn't stop habit", error.message);
            return;
          }
          setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, end_date: end } : h)));
        },
      },
    ]);
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

  const running = habits.filter((h) => isRunning(h, todayIso()));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={themeText("#22C55E")} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      // Without this, the first tap on "Save time" while the keyboard is open
      // only closes the keyboard and the save never runs.
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Habits</Text>
      {/* This month's challenge from their coach (0153), when there is one. */}
      {client?.trainer_id ? <ChallengeCard clientId={client.id} trainerId={client.trainer_id} /> : null}
      <Text style={styles.helper}>Choose what you want to work on, then pick the days that fit your schedule.</Text>
      <Pressable style={styles.chooseButton} onPress={() => setChoosing(true)}>
        <Text style={styles.chooseButtonText}>+ Choose habits</Text>
      </Pressable>
      {running.length === 0 && <Text style={styles.helper}>No habits yet. Tap "Choose habits" to pick some.</Text>}

      {running.map((h) => {
        const activeToday = isActiveToday(h);
        const habitLogs = logsByHabit[h.id] ?? {};
        const completed = habitLogs[todayIso()] ?? 0;
        const done = completed >= h.reps_target;
        const tierResult = calculateHabitTier(h, habitLogs);
        const isMaxTier = tierResult.tier === STREAK_TIERS.length - 1;
        // A habit with no days picked opens straight onto its days.
        const showSettings = settingsFor === h.id || h.active_days.length === 0;
        return (
          <View key={h.id} style={[styles.habitCard, activeToday && done && styles.habitCardDone]}>
            <View style={styles.habitHeaderRow}>
              <Text style={styles.habitName}>{h.name}</Text>
              <View style={styles.streakBadge}>
                <View style={[styles.streakDot, { backgroundColor: themeBg(tierResult.color) }]} />
                <Text style={[styles.streakText, { color: themeText(tierResult.color) }]}>
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

            <Pressable style={styles.settingsToggle} onPress={() => setSettingsFor(showSettings ? null : h.id)} hitSlop={6}>
              <Text style={styles.settingsToggleText}>⚙ Days and reminder {showSettings ? "▲" : "▼"}</Text>
            </Pressable>
            {showSettings && (
              <>
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
                  <Text style={styles.fieldLabel}>Remind me on this habit's days</Text>
                </Pressable>
                {h.reminder_enabled && (
                  <View style={styles.reminderTimeRow}>
                    <TextInput
                      style={styles.timeInput}
                      placeholder="HH:MM"
                      placeholderTextColor="#64748B"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      returnKeyType="done"
                      value={reminderDrafts[h.id] ?? ""}
                      onChangeText={(v) => {
                        setReminderDrafts((prev) => ({ ...prev, [h.id]: v }));
                        if (savedTimeFor === h.id) setSavedTimeFor(null);
                      }}
                      onSubmitEditing={() => saveReminderTime(h)}
                    />
                    <Pressable style={styles.saveTimeButton} onPress={() => saveReminderTime(h)}>
                      <Text style={styles.saveTimeButtonText}>Save time</Text>
                    </Pressable>
                    {savedTimeFor === h.id && <Text style={styles.savedText}>Saved ✓</Text>}
                  </View>
                )}
                {h.chosen_by_client ? (
                  <Pressable onPress={() => stopHabit(h)} hitSlop={8}>
                    <Text style={styles.stopText}>Stop this habit</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.coachSet}>Set by your coach</Text>
                )}
              </>
            )}
          </View>
        );
      })}
      <ChooseHabitsModal visible={choosing} habits={habits} onAdd={addHabit} onClose={() => setChoosing(false)} />
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 6 },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 12 },
  settingsToggle: { marginTop: 12, alignSelf: "flex-start" },
  settingsToggleText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
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
  savedText: { color: "#22C55E", fontWeight: "700", fontSize: 13 },
  chooseButton: { borderRadius: 12, borderWidth: 1.5, borderColor: BRAND_GOLD, borderStyle: "dashed", padding: 12, alignItems: "center", marginBottom: 14 },
  chooseButtonText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  stopText: { color: "#F87171", fontSize: 13, fontWeight: "600", marginTop: 14 },
  coachSet: { color: "#64748B", fontSize: 12, marginTop: 14 },
});
