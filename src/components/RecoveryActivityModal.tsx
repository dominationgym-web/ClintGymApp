import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { IconName } from "@/components/ScreenTabBar";
import { todayIso } from "@/lib/dates";
import { RECOVERY_ACTIVITIES, findRecoveryActivity, planDayChoices, type RecoveryActivityKey } from "@/lib/recoveryActivities";
import { planRecovery } from "@/lib/recoveryPlanQueries";

export const RECOVERY_GREEN = "#4ADE80";

// One recovery activity (0107): what it is, how to do it and how long, then
// "Done it today" or plan it for a day this week. Opened without an activity
// (the "Add recovery activity" button), it first lists all eight.
export default function RecoveryActivityModal({
  visible,
  clientId,
  activity,
  reason,
  onClose,
  onSaved,
}: {
  visible: boolean;
  clientId: string;
  activity: RecoveryActivityKey | null;
  /** Why the app suggested it, kept with the plan so the coach sees it. */
  reason?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayIso();
  const [picked, setPicked] = useState<RecoveryActivityKey | null>(activity);
  const [day, setDay] = useState(today);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPicked(activity);
      setDay(today);
    }
  }, [visible, activity]);

  const info = findRecoveryActivity(picked);

  const save = async (done: boolean) => {
    if (!info) return;
    setSaving(true);
    const { error } = await planRecovery(clientId, info.key, done ? today : day, {
      done,
      minutes: done ? info.minutes : undefined,
      reason: reason ?? null,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 32 }}>
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
              <Text style={styles.body}>{info.what}</Text>
              <Text style={styles.subhead}>How to do it</Text>
              {info.how.map((step, i) => (
                <Text key={i} style={styles.step}>
                  {i + 1}. {step}
                </Text>
              ))}
              <Text style={styles.subhead}>Best for</Text>
              <Text style={styles.body}>{info.bestFor}</Text>
              {info.careful ? <Text style={styles.careful}>⚠️ {info.careful}</Text> : null}

              <Pressable style={styles.doneButton} onPress={() => save(true)} disabled={saving}>
                {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.doneText}>✓ Done it today</Text>}
              </Pressable>

              <Text style={styles.subhead}>Or plan it for</Text>
              <View style={styles.chips}>
                {planDayChoices(today).map((c) => (
                  <Pressable key={c.date} style={[styles.chip, day === c.date && styles.chipOn]} onPress={() => setDay(c.date)}>
                    <Text style={[styles.chipText, day === c.date && styles.chipTextOn]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.planButton} onPress={() => save(false)} disabled={saving}>
                <Text style={styles.planText}>📅 Plan it</Text>
              </Pressable>
            </>
          )}
          <Pressable style={styles.close} onPress={activity || !info ? onClose : () => setPicked(null)}>
            <Text style={styles.closeText}>{activity || !info ? "Close" : "‹ Back to activities"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { flexGrow: 0, maxHeight: "90%", backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  duration: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  reason: { color: "#FDE68A", fontSize: 13, backgroundColor: "#2A2410", borderRadius: 8, padding: 10, marginBottom: 8 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  subhead: { color: RECOVERY_GREEN, fontWeight: "700", fontSize: 14, marginTop: 14, marginBottom: 4 },
  step: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginBottom: 2 },
  careful: { color: "#FBBF24", fontSize: 12, marginTop: 10, lineHeight: 17 },
  doneButton: { backgroundColor: RECOVERY_GREEN, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 18 },
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
