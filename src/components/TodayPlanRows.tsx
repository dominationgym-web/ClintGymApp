import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { loadStabilityCalendar, STABILITY_PURPLE, type StabilityCalendarItem } from "@/lib/stabilityCalendar";
import { loadRecoveryActivities } from "@/lib/recoveryPlanQueries";
import { findRecoveryActivity } from "@/lib/recoveryActivities";
import RecoveryActivityModal, { RECOVERY_GREEN } from "@/components/RecoveryActivityModal";
import type { RecoveryActivityRow } from "@/types/database";
import { COACH_MEAL_PLAN_TITLE, useHasMealPlan } from "@/hooks/useHasMealPlan";

// The rest of what's planned today, on the Today card under the workout
// (app-flow review C4, 2026-10-18): 🧘 stability (opens the program) and
// 🌿 recovery (Done / Skip), so a day with only these isn't shown as a rest day,
// then 🥗 the coach's meal plan.
export default function TodayPlanRows({
  clientId,
  refreshKey,
  onCount,
}: {
  clientId: string;
  refreshKey?: unknown;
  /** How many rows showed, so the card can leave out "Rest day". */
  onCount?: (n: number) => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [stability, setStability] = useState<StabilityCalendarItem[]>([]);
  const [recovery, setRecovery] = useState<RecoveryActivityRow[]>([]);
  const [completing, setCompleting] = useState<RecoveryActivityRow | null>(null);
  const [focus, setFocus] = useState(0);
  const hasMealPlan = useHasMealPlan(clientId);
  useFocusEffect(useCallback(() => setFocus((f) => f + 1), []));

  const load = useCallback(() => {
    const today = todayIso();
    Promise.all([loadStabilityCalendar(clientId, today, today), loadRecoveryActivities(clientId, today, today)]).then(([s, r]) => {
      setStability(s.map[today] ?? []);
      setRecovery(r.filter((row) => !row.skipped));
    });
  }, [clientId]);
  useEffect(load, [load, refreshKey, focus]);

  const count = stability.length + recovery.length;
  useEffect(() => onCount?.(count), [count]);

  const skip = async (row: RecoveryActivityRow) => {
    const { error } = await supabase.from("recovery_activities").update({ skipped: true }).eq("id", row.id);
    if (error) return Alert.alert("Couldn't save", error.message);
    load();
  };

  return (
    <>
      {stability.map((item) => (
        <Pressable key={item.programId} style={[styles.row, { borderColor: "#6B21A8" }]} onPress={() => navigation.navigate("Stability")}>
          <Text style={styles.icon}>🧘</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: STABILITY_PURPLE }]}>{item.label} stability</Text>
            <Text style={styles.hint}>{item.done ? "Logged ✓" : "From your coach"}</Text>
          </View>
          <Text style={styles.open}>Open ›</Text>
        </Pressable>
      ))}
      {recovery.map((row) => {
        const info = findRecoveryActivity(row.activity);
        return (
          <View key={row.id} style={[styles.row, { borderColor: "#166534" }]}>
            <Text style={styles.icon}>🌿</Text>
            <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("Recovery")}>
              <Text style={[styles.title, { color: RECOVERY_GREEN }]}>{info?.title ?? row.activity}</Text>
              <Text style={styles.hint}>{row.done_on ? "Done ✓" : "Recovery for today"}</Text>
            </Pressable>
            {!row.done_on && (
              <>
                <Pressable style={styles.done} onPress={() => setCompleting(row)} hitSlop={6} accessibilityLabel="Mark done">
                  <Text style={styles.doneText}>✓ Done</Text>
                </Pressable>
                <Pressable onPress={() => skip(row)} hitSlop={6} accessibilityLabel="Skip">
                  <Text style={styles.skipText}>Skip</Text>
                </Pressable>
              </>
            )}
          </View>
        );
      })}
      {/* The coach's meal plan in one tap (GRIZZ, 2026-10-27). Not counted in onCount: it isn't training. */}
      {hasMealPlan && (
        <Pressable
          style={[styles.row, { borderColor: "#166534" }]}
          onPress={() => navigation.navigate("Section", { sectionKey: "nutrition", open: COACH_MEAL_PLAN_TITLE })}
        >
          <Text style={styles.icon}>🥗</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: "#22C55E" }]}>My meal plan</Text>
            <Text style={styles.hint}>What to eat today, from your coach</Text>
          </View>
          <Text style={styles.open}>Open ›</Text>
        </Pressable>
      )}
      <RecoveryActivityModal
        visible={!!completing}
        clientId={clientId}
        activity={null}
        completing={completing}
        onClose={() => setCompleting(null)}
        onSaved={() => {
          setCompleting(null);
          load();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F172A", borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1 },
  icon: { fontSize: 26 },
  title: { fontSize: 16, fontWeight: "700" },
  hint: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  open: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700" },
  done: { backgroundColor: RECOVERY_GREEN, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  doneText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  skipText: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
});
