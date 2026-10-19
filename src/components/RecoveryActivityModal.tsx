import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { IconName } from "@/components/ScreenTabBar";
import KeyboardSafe from "@/components/KeyboardSafe";
import FullBodyStretchRoutine from "@/components/FullBodyStretchRoutine";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import {
  RECOVERY_ACTIVITIES,
  durationChoices,
  durationText,
  findRecoveryActivity,
  planDayChoices,
  type RecoveryActivityKey,
} from "@/lib/recoveryActivities";
import { planRecovery } from "@/lib/recoveryPlanQueries";
import type { RecoveryActivityRow } from "@/types/database";

export const RECOVERY_GREEN = "#4ADE80";

// One recovery activity (0107/0108): what it is, duration, benefits, how and
// safety. Then log it for today in the Daily Log (how long, and an optional
// note on soreness, energy or how they feel) or plan it for a day this week.
// Opened without an activity ("Add recovery activity") it first lists all
// eight; opened with `completing`, it ticks off that planned one.
export default function RecoveryActivityModal({
  visible,
  clientId,
  activity,
  reason,
  completing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  clientId: string;
  activity: RecoveryActivityKey | null;
  /** Why the app suggested it, kept with the plan so the coach sees it. */
  reason?: string | null;
  /** A planned activity being marked done. */
  completing?: RecoveryActivityRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayIso();
  const [picked, setPicked] = useState<RecoveryActivityKey | null>(activity);
  const [day, setDay] = useState(today);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Following the full body stretch routine, one stretch per page.
  const [routine, setRoutine] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const key = (completing?.activity as RecoveryActivityKey | undefined) ?? activity;
    setPicked(key);
    setDay(today);
    setMinutes(findRecoveryActivity(key)?.minutes ?? null);
    setNotes("");
    setRoutine(false);
  }, [visible, activity, completing?.id]);

  const info = findRecoveryActivity(picked);

  const logDone = async (done = minutes) => {
    if (!info) return;
    setSaving(true);
    const note = notes.trim() || null;
    const { error } = completing
      ? await supabase
          .from("recovery_activities")
          .update({ done_on: today, skipped: false, minutes: done, notes: note })
          .eq("id", completing.id)
      : await planRecovery(clientId, info.key, today, { done: true, minutes: done ?? undefined, reason, notes: note });
    setSaving(false);
    if (error) return Alert.alert("Couldn't save", error.message);
    onSaved();
    onClose();
  };

  const plan = async () => {
    if (!info) return;
    setSaving(true);
    const { error } = await planRecovery(clientId, info.key, day, { reason });
    setSaving(false);
    if (error) return Alert.alert("Couldn't save", error.message);
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {!info ? (
              <>
                <Text style={styles.title}>Add recovery activity</Text>
                <View style={styles.grid}>
                  {RECOVERY_ACTIVITIES.map((a) => (
                    <Pressable key={a.key} style={styles.pick} onPress={() => setPicked(a.key)}>
                      <Ionicons name={`${a.icon}-outline` as IconName} size={20} color={RECOVERY_GREEN} />
                      <Text style={styles.pickTitle}>{a.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : routine ? (
              <FullBodyStretchRoutine onFinished={(m) => logDone(m)} onClose={() => setRoutine(false)} />
            ) : (
              <>
                <View style={styles.headRow}>
                  <Ionicons name={info.icon} size={26} color={RECOVERY_GREEN} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{info.title}</Text>
                    <Text style={styles.duration}>⏱ {info.durationLabel}</Text>
                  </View>
                </View>
                {reason ? <Text style={styles.reason}>💡 {reason}</Text> : null}
                {!completing && (
                  <>
                    <Text style={styles.body}>{info.what}</Text>
                    <Text style={styles.subhead}>Benefits</Text>
                    <Text style={styles.body}>{info.benefits}</Text>
                    <Text style={styles.subhead}>How</Text>
                    {info.how.map((step, i) => (
                      <Text key={i} style={styles.step}>
                        • {step}
                      </Text>
                    ))}
                    <Text style={styles.careful}>⚠️ {info.safety}</Text>
                  </>
                )}

                {info.key === "stretching" && (
                  <Pressable style={styles.routineButton} onPress={() => setRoutine(true)}>
                    <Text style={styles.routineTitle}>🧘 Follow the full body stretch routine</Text>
                    <Text style={styles.routineText}>12 easy stretches with videos, about 12 minutes. Logs itself when you finish.</Text>
                  </Pressable>
                )}
                <Text style={styles.subhead}>{completing ? "How long did you do it?" : "Did it today? How long?"}</Text>
                <View style={styles.chips}>
                  {durationChoices(info).map((m) => (
                    <Pressable key={m} style={[styles.chip, minutes === m && styles.chipOn]} onPress={() => setMinutes(m)}>
                      <Text style={[styles.chipText, minutes === m && styles.chipTextOn]}>{durationText(m)}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="How do you feel? Soreness, energy... (optional)"
                  placeholderTextColor="#64748B"
                  multiline
                />
                <Pressable style={styles.doneButton} onPress={() => logDone()} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.doneText}>✓ Log as done today</Text>}
                </Pressable>

                {!completing && (
                  <>
                    <Text style={styles.subhead}>Or plan it for</Text>
                    <View style={styles.chips}>
                      {planDayChoices(today).map((c) => (
                        <Pressable key={c.date} style={[styles.chip, day === c.date && styles.chipOn]} onPress={() => setDay(c.date)}>
                          <Text style={[styles.chipText, day === c.date && styles.chipTextOn]}>{c.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable style={styles.planButton} onPress={plan} disabled={saving}>
                      <Text style={styles.planText}>📅 Plan it</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
            <Pressable style={styles.close} onPress={activity || completing || !info ? onClose : () => setPicked(null)}>
              <Text style={styles.closeText}>{activity || completing || !info ? "Close" : "‹ Back to activities"}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = StyleSheet.create({
  routineButton: { borderWidth: 1, borderColor: RECOVERY_GREEN, borderRadius: 10, padding: 12, marginTop: 14 },
  routineTitle: { color: RECOVERY_GREEN, fontWeight: "700", fontSize: 15 },
  routineText: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { flexGrow: 0, maxHeight: "92%", backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  duration: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  reason: { color: "#FDE68A", fontSize: 13, backgroundColor: "#2A2410", borderRadius: 8, padding: 10, marginBottom: 8 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  subhead: { color: RECOVERY_GREEN, fontWeight: "700", fontSize: 14, marginTop: 12, marginBottom: 4 },
  step: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginBottom: 2 },
  careful: { color: "#FBBF24", fontSize: 12, marginTop: 10, lineHeight: 17 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 10, padding: 10, marginTop: 8, minHeight: 44, fontSize: 14 },
  doneButton: { backgroundColor: RECOVERY_GREEN, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  doneText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { backgroundColor: RECOVERY_GREEN, borderColor: RECOVERY_GREEN },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  planButton: { borderWidth: 1, borderColor: RECOVERY_GREEN, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  planText: { color: RECOVERY_GREEN, fontWeight: "700", fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  pick: { width: "48%", backgroundColor: "#0F172A", borderRadius: 10, padding: 12, gap: 6 },
  pickTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  close: { alignItems: "center", marginTop: 16, padding: 8 },
  closeText: { color: "#94A3B8", fontWeight: "600" },
});
