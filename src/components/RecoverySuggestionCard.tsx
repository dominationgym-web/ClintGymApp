import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { todayIso } from "@/lib/dates";
import { findRecoveryActivity } from "@/lib/recoveryActivities";
import { loadRecoverySuggestions } from "@/lib/recoveryPlanQueries";
import type { RecoverySuggestion } from "@/lib/recoverySuggest";
import RecoveryActivityModal, { RECOVERY_GREEN } from "@/components/RecoveryActivityModal";

// The app's recovery suggestion for today (0107), worked out from the
// client's training and check-ins. On the Check-in screen it shows the top
// one and links to the Recovery screen; on the Recovery screen it shows two.
export default function RecoverySuggestionCard({
  clientId,
  limit = 1,
  refreshKey,
  onChanged,
  showLink = true,
}: {
  clientId: string;
  limit?: number;
  /** Change it to reload (after a check-in or a plan was saved). */
  refreshKey?: unknown;
  onChanged?: () => void;
  showLink?: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [suggestions, setSuggestions] = useState<RecoverySuggestion[]>([]);
  const [open, setOpen] = useState<RecoverySuggestion | null>(null);

  const load = useCallback(() => {
    loadRecoverySuggestions(clientId, todayIso(), limit).then(setSuggestions);
  }, [clientId, limit]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>🌿 Recovery suggested for you</Text>
      {suggestions.map((s) => {
        const info = findRecoveryActivity(s.activity);
        if (!info) return null;
        return (
          <Pressable key={s.activity} style={styles.card} onPress={() => setOpen(s)}>
            <Ionicons name={info.icon} size={22} color={RECOVERY_GREEN} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {info.title} · <Text style={styles.duration}>{info.durationLabel}</Text>
              </Text>
              <Text style={styles.reason}>{s.reason}</Text>
              <Text style={styles.tap}>Tap to see how, then do it or plan it</Text>
            </View>
          </Pressable>
        );
      })}
      {showLink && (
        <Pressable onPress={() => navigation.navigate("Recovery")} hitSlop={8}>
          <Text style={styles.link}>Open Recovery ›</Text>
        </Pressable>
      )}
      <RecoveryActivityModal
        visible={!!open}
        clientId={clientId}
        activity={open?.activity ?? null}
        reason={open?.reason}
        onClose={() => setOpen(null)}
        onSaved={() => {
          load();
          onChanged?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#0F2A1C", borderRadius: 12, borderWidth: 1, borderColor: "#166534", padding: 12, marginBottom: 14 },
  heading: { color: RECOVERY_GREEN, fontWeight: "800", fontSize: 15, marginBottom: 6 },
  card: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 8 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  duration: { color: "#94A3B8", fontWeight: "500", fontSize: 13 },
  reason: { color: "#E2E8F0", fontSize: 13, lineHeight: 18, marginTop: 2 },
  tap: { color: RECOVERY_GREEN, fontSize: 12, marginTop: 4 },
  link: { color: RECOVERY_GREEN, fontWeight: "700", textAlign: "right", marginTop: 4 },
});
