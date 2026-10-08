import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl, Modal } from "react-native";
import { supabase } from "@/lib/supabase";
import { toIsoDate, todayIso } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { LifestyleResetDailyLog } from "@/types/database";
import LifestyleResetContent from "@/screens/client/LifestyleResetContent";
import { RESET_GUIDES, type ResetHabitKey } from "@/lib/resetGuides";

type HabitKey = ResetHabitKey;

const HABITS: { key: HabitKey; label: string; target: string }[] = [
  { key: "morning_daylight", label: "Morning daylight", target: "5-7 days" },
  { key: "breathing", label: "Breathing", target: "5-7 days" },
  { key: "daily_movement", label: "Daily movement", target: "5-7 days" },
  { key: "protein_meals", label: "Protein-focused meals", target: "Most days" },
  { key: "strength_training", label: "Strength training", target: "2-3 sessions" },
  { key: "aerobic_exercise", label: "Aerobic exercise", target: "2-4 sessions" },
  { key: "consistent_sleep", label: "Consistent sleep", target: "5-7 nights" },
  { key: "evening_winddown", label: "Evening wind-down", target: "5+ nights" },
];

function currentWeekNumber(startedAt: string): number {
  const start = new Date(`${startedAt}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(12, Math.max(1, Math.floor(days / 7) + 1));
}

export default function LifestyleResetScreen() {
  const { client } = useAuth();
  const [todayLog, setTodayLog] = useState<Partial<LifestyleResetDailyLog>>({});
  const [weekLogs, setWeekLogs] = useState<LifestyleResetDailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guideKey, setGuideKey] = useState<HabitKey | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const { data } = await supabase
      .from("lifestyle_reset_daily_logs")
      .select("*")
      .eq("client_id", client.id)
      .gte("log_date", toIsoDate(since))
      .order("log_date", { ascending: true });
    const rows = data ?? [];
    setWeekLogs(rows);
    setTodayLog(rows.find((r) => r.log_date === todayIso()) ?? {});
  }, [client]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleHabit = async (key: HabitKey) => {
    if (!client) return;
    const next = !todayLog[key];
    setTodayLog((prev) => ({ ...prev, [key]: next }));
    const payload: Partial<LifestyleResetDailyLog> = { client_id: client.id, log_date: todayIso(), [key]: next };
    const { data, error } = await supabase
      .from("lifestyle_reset_daily_logs")
      .upsert(payload, { onConflict: "client_id,log_date" })
      .select()
      .single();
    if (!error && data) {
      setWeekLogs((prev) => {
        const others = prev.filter((r) => r.log_date !== todayIso());
        return [...others, data].sort((a, b) => a.log_date.localeCompare(b.log_date));
      });
    }
  };

  const weekCount = (key: HabitKey) => weekLogs.filter((r) => r[key]).length;

  if (loading || !client) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  const week = client.lifestyle_reset_started_at ? currentWeekNumber(client.lifestyle_reset_started_at) : 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.weekBadge}>Week {week} of 12</Text>
      <Text style={styles.sectionTitle}>Today's Daily 6</Text>
      <Text style={styles.hint}>Tap a habit to tick it off. Tap ? to see how to do it.</Text>
      {HABITS.map((h) => (
        <View key={h.key} style={styles.habitRow}>
          <Pressable style={styles.habitToggle} onPress={() => toggleHabit(h.key)}>
            <View style={[styles.checkbox, todayLog[h.key] && styles.checkboxChecked]} />
            <Text style={styles.habitLabel}>{h.label}</Text>
          </Pressable>
          <Pressable
            style={styles.helpButton}
            onPress={() => setGuideKey(h.key)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`How to do ${h.label}`}
          >
            <Text style={styles.helpButtonText}>?</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.sectionTitle}>This Week's Check-in</Text>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Habit</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Target</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Done</Text>
        </View>
        {HABITS.map((h) => (
          <View key={h.key} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, color: "#E2E8F0" }]}>{h.label}</Text>
            <Text style={[styles.tableCell, { color: "#94A3B8" }]}>{h.target}</Text>
            <Text style={[styles.tableCell, { color: "#22C55E", fontWeight: "700" }]}>{weekCount(h.key)}/7</Text>
          </View>
        ))}
      </View>
      <Text style={styles.helper}>Don't chase 100%. 70-80% consistently is what builds something sustainable.</Text>

      <View style={styles.divider} />
      <LifestyleResetContent />

      <HabitGuideSheet
        habitKey={guideKey}
        done={guideKey ? !!todayLog[guideKey] : false}
        onToggleDone={() => guideKey && toggleHabit(guideKey)}
        onClose={() => setGuideKey(null)}
      />
    </ScrollView>
  );
}

function HabitGuideSheet({
  habitKey,
  done,
  onToggleDone,
  onClose,
}: {
  habitKey: HabitKey | null;
  done: boolean;
  onToggleDone: () => void;
  onClose: () => void;
}) {
  const guide = habitKey ? RESET_GUIDES[habitKey] : null;
  return (
    <Modal visible={!!guide} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {guide && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {guide.icon} {guide.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={styles.sheetWhy}>{guide.why}</Text>

            <Text style={styles.sheetLabel}>How to do it</Text>
            {guide.steps.map((step, i) => (
              <View key={step} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            <Text style={styles.sheetLabel}>Coach's tips</Text>
            {guide.tips.map((tip) => (
              <Text key={tip} style={styles.tipText}>
                •  {tip}
              </Text>
            ))}

            <View style={styles.easierBox}>
              <Text style={styles.easierLabel}>Tough day?</Text>
              <Text style={styles.easierText}>{guide.easier}</Text>
            </View>
          </ScrollView>
          <Pressable style={[styles.doneButton, done && styles.doneButtonDone]} onPress={onToggleDone}>
            <Text style={[styles.doneButtonText, done && styles.doneButtonTextDone]}>
              {done ? "✓ Done today" : "Mark as done today"}
            </Text>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  weekBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#1E293B",
    color: "#22C55E",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 16,
  },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 17, marginTop: 8, marginBottom: 10 },
  hint: { color: "#64748B", fontSize: 12, marginTop: -4, marginBottom: 10 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    marginBottom: 8,
  },
  habitToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  helpButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  helpButtonText: { color: "#22C55E", fontWeight: "700", fontSize: 14 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#64748B" },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  habitLabel: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  table: { backgroundColor: "#1E293B", borderRadius: 10, overflow: "hidden" },
  tableRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: "#0F172A" },
  tableHeaderRow: { borderTopWidth: 0 },
  tableCell: { flex: 1, fontSize: 12.5 },
  tableHeaderText: { color: "#64748B", fontWeight: "700", textTransform: "uppercase", fontSize: 10.5 },
  helper: { color: "#64748B", fontSize: 12, marginTop: 10, fontStyle: "italic" },
  divider: { height: 1, backgroundColor: "#1E293B", marginTop: 28, marginBottom: 20 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    maxHeight: "85%",
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "#1E293B",
    padding: 20,
    paddingBottom: 32,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetTitle: { color: "#fff", fontSize: 19, fontWeight: "700", flex: 1 },
  sheetClose: { color: "#94A3B8", fontSize: 18, paddingLeft: 12 },
  sheetWhy: { color: "#CBD5E1", fontSize: 14, lineHeight: 21 },
  sheetLabel: { color: "#22C55E", fontWeight: "700", fontSize: 13, marginTop: 18, marginBottom: 8, textTransform: "uppercase" },
  stepRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1E293B",
    color: "#22C55E",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 22,
    overflow: "hidden",
  },
  stepText: { color: "#E2E8F0", fontSize: 14, lineHeight: 21, flex: 1 },
  tipText: { color: "#CBD5E1", fontSize: 13.5, lineHeight: 20, marginBottom: 4 },
  easierBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 16 },
  easierLabel: { color: "#F59E0B", fontWeight: "700", fontSize: 12.5, marginBottom: 4 },
  easierText: { color: "#E2E8F0", fontSize: 13.5, lineHeight: 20 },
  doneButton: {
    borderWidth: 1.5,
    borderColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  doneButtonDone: { backgroundColor: "#22C55E" },
  doneButtonText: { color: "#22C55E", fontWeight: "700", fontSize: 15 },
  doneButtonTextDone: { color: "#0F172A" },
});
