import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import { supabase } from "@/lib/supabase";
import { cancelCard } from "@/lib/cardBilling";
import { shortDate } from "@/lib/billing";
import { CANCEL_REASONS, cancelSummary } from "@/lib/cancelSubscription";
import { useStepBack } from "@/hooks/useStepBack";
import { BRAND_GOLD } from "@/lib/brand";
import { themeText, themedStyles } from "@/lib/theme";
import type { MyCancellation } from "@/types/database";

// A trainer cancels their own Daily Evolution subscription (GRIZZ,
// 2026-11-18; Trainer Agreement section 9, migration 0220). All taps, no
// typing: one page shows the end date, that there's no refund and what
// happens to their clients, then a reason and Confirm. Undo any time before
// the end date. The phone apps show no prices or website links here.
export default function CancelSubscription() {
  const [info, setInfo] = useState<MyCancellation | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useStepBack(open, () => setOpen(false));

  const load = useCallback(() => {
    supabase.rpc("my_cancellation").then(({ data }) => {
      setInfo(data?.[0] ?? null);
      setLoading(false);
    });
  }, []);
  useEffect(load, [load]);

  if (loading) return null;
  if (!info) return null;

  const confirm = async () => {
    if (!reason) return;
    setSaving(true);
    const { error } = await supabase.rpc("cancel_my_subscription", { p_reason: reason });
    if (!error) {
      // Removes the saved card at Paystack too. The database has already
      // switched automatic payments off, so a failure here charges nothing.
      await cancelCard().catch(() => undefined);
    }
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't cancel", error.message);
      return;
    }
    setOpen(false);
    setReason(null);
    load();
  };

  const undo = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("undo_my_cancellation");
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't undo it", error.message);
      return;
    }
    Alert.alert("You're staying", "Your subscription carries on as normal.");
    load();
  };

  if (info.status === "pending") {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Subscription cancelled</Text>
        <Text style={styles.line}>You keep full use until {shortDate(info.ends_on)}. After that your account and your clients' access are paused.</Text>
        <Pressable style={styles.outline} onPress={undo} disabled={saving} accessibilityRole="button">
          {saving ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.outlineText}>Undo: keep my subscription</Text>}
        </Pressable>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={6} accessibilityRole="button" style={styles.linkWrap}>
        <Text style={styles.link}>Cancel subscription</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Cancel your subscription?</Text>
      {cancelSummary(info.ends_on, info.free_months).map((line) => (
        <Text key={line} style={styles.line}>
          • {line}
        </Text>
      ))}
      <Text style={styles.label}>Why are you leaving?</Text>
      <View style={styles.chips}>
        {CANCEL_REASONS.map((r) => (
          <Pressable
            key={r}
            style={[styles.chip, reason === r && styles.chipOn]}
            onPress={() => setReason(r)}
            accessibilityRole="button"
            accessibilityState={{ selected: reason === r }}
          >
            <Text style={[styles.chipText, reason === r && styles.chipTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.danger, !reason && styles.disabled]}
        onPress={confirm}
        disabled={!reason || saving}
        accessibilityRole="button"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerText}>{reason ? "Cancel my subscription" : "Pick a reason first"}</Text>}
      </Pressable>
      <Pressable style={styles.outline} onPress={() => setOpen(false)} accessibilityRole="button">
        <Text style={styles.outlineText}>Keep my subscription</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles({
  box: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#334155" },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 6, lineHeight: 19 },
  label: { color: "#fff", fontWeight: "700", marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#475569", borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600" },
  chipTextOn: { color: "#0F172A" },
  danger: { backgroundColor: "#DC2626", borderRadius: 10, padding: 13, alignItems: "center", marginTop: 16 },
  dangerText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.5 },
  outline: { borderWidth: 1.5, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  linkWrap: { alignSelf: "center", marginBottom: 16 },
  link: { color: "#94A3B8", fontWeight: "600", textDecorationLine: "underline" },
});
