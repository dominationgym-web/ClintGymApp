import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { countryName } from "@/lib/phoneCountry";
import { useAuth } from "@/context/AuthContext";
import { REFERRAL_DISCOUNT_PERCENT, referralRewards, trainerDisplayName, trialDaysLeft, trialLabel } from "@/lib/trainers";
import { addDays } from "@/lib/programSchedule";
import { todayIso } from "@/lib/dates";
import TrainerLogo from "@/components/TrainerLogo";
import type { Trainer } from "@/types/database";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";

// The app owner's list of every trainer (0029): approve new ones, or block one.
// Also each trainer's free trial and referral rewards (0060): the owner can add
// a week to a trial and mark a 25% referral discount as used.
// Only the owner can load other trainers' rows or change `approved`; the
// database enforces both, this tab is only shown to the owner.
export default function TrainersScreen() {
  const { trainer: me } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  // Every trainer including the owner, to count referrals and name referrers.
  const [everyone, setEveryone] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Each trainer is a small row (name, email, time left or Paid); tap to open the rest.
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("trainers").select("*").order("created_at", { ascending: false });
    if (error) Alert.alert("Couldn't load trainers", error.message);
    // Waiting for approval first, then everyone else, newest first.
    setEveryone(data ?? []);
    const rows = (data ?? []).filter((t) => t.id !== me?.id);
    rows.sort((a, b) => Number(a.approved) - Number(b.approved));
    setTrainers(rows);
  }, [me?.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const setApproved = async (t: Trainer, approved: boolean) => {
    setBusyId(t.id);
    const { error } = await supabase.from("trainers").update({ approved }).eq("id", t.id);
    setBusyId(null);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    await load();
  };

  const updateTrainer = async (t: Trainer, changes: Partial<Trainer>) => {
    setBusyId(t.id);
    const { error } = await supabase.from("trainers").update(changes).eq("id", t.id);
    setBusyId(null);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    await load();
  };

  const extendTrial = (t: Trainer) => {
    const today = todayIso();
    const from = t.trial_ends_at && t.trial_ends_at > today ? t.trial_ends_at : today;
    Alert.alert(`Add a week to ${trainerDisplayName(t)}'s trial?`, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Add 7 days", onPress: () => updateTrainer(t, { trial_ends_at: addDays(from, 7) }) },
    ]);
  };

  const confirm = (t: Trainer) => {
    const name = trainerDisplayName(t);
    if (t.approved) {
      Alert.alert(
        `Block ${name}?`,
        "They'll see an \"account paused\" screen instead of their clients, and no new clients can join them. You can approve them again later.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Block", style: "destructive", onPress: () => setApproved(t, false) },
        ]
      );
    } else {
      const unsigned = !t.agreement_accepted_at;
      Alert.alert(
        `Approve ${name}?`,
        unsigned
          ? "They haven't signed the trainer agreement yet. The app will ask them to sign it before they can use it."
          : "They'll be able to use the app and invite their clients with their code.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Approve", onPress: () => setApproved(t, true) },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={trainers}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <Pressable style={styles.billingButton} onPress={() => navigation.navigate("Billing")} accessibilityRole="button">
          <Text style={styles.billingTitle}>💰 Billing</Text>
          <Text style={styles.detail}>Plans, client fees, payments owed, monthly and 6-month totals</Text>
        </Pressable>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No other trainers yet. When a trainer applies in the app, they'll show up here.</Text>
      }
      renderItem={({ item }) => {
        const name = trainerDisplayName(item);
        const today = todayIso();
        const trial = trialLabel(item.trial_ends_at, today);
        const trialOver = (trialDaysLeft(item.trial_ends_at, today) ?? 1) < 0;
        const referrer = item.referred_by ? everyone.find((t) => t.id === item.referred_by) : null;
        const rewards = referralRewards(
          everyone.filter((t) => t.referred_by === item.id && t.approved).length,
          item.referral_credits_used,
        );
        const open = openId === item.id;
        const pay = !item.approved
          ? { text: "Waiting for your approval", color: "#F59E0B" }
          : item.free_use_from
            ? { text: "Free use", color: "#22C55E" }
            : trial && !trialOver
              ? { text: trial, color: "#94A3B8" }
              : item.billing_plan
                ? { text: "Paid", color: "#22C55E" }
                : { text: trial ?? "No plan yet", color: "#F59E0B" };
        if (!open) {
          return (
            <Pressable style={styles.compactRow} onPress={() => setOpenId(item.id)} accessibilityRole="button">
              <TrainerLogo name={name} path={item.logo_path} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.detail} numberOfLines={1}>{item.email}</Text>
                <Text style={[styles.status, { color: pay.color, marginTop: 2 }]}>{pay.text}</Text>
              </View>
              <Text style={styles.chevron}>▸</Text>
            </Pressable>
          );
        }
        return (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Pressable style={styles.openHeader} onPress={() => setOpenId(null)} accessibilityRole="button">
                <TrainerLogo name={name} path={item.logo_path} size={32} />
                <Text style={[styles.name, { flex: 1 }]}>{name}</Text>
                <Text style={styles.chevron}>▾</Text>
              </Pressable>
              {item.business_name ? <Text style={styles.detail}>{item.name}</Text> : null}
              <Text style={styles.detail}>{item.email}</Text>
              {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
              <Text style={styles.detail}>
                📍 {item.signup_country ? `Applied from ${countryName(item.signup_country)}` : "Country not checked"}
                </Text>
                <Text style={styles.detail}>
                {item.agreement_accepted_at
                  ? `Signed the agreement as "${item.agreement_signed_name}" on ${new Date(item.agreement_accepted_at).toLocaleDateString()}`
                  : "Hasn't signed the trainer agreement yet"}
              </Text>
              <Text style={[styles.status, { color: item.approved ? "#22C55E" : "#F59E0B" }]}>
                {item.approved ? `Approved · code ${item.join_code}` : "Waiting for your approval"}
              </Text>
              {referrer ? <Text style={styles.detail}>Referred by {trainerDisplayName(referrer)}</Text> : null}
              {trial ? (
                <View style={styles.extraRow}>
                  <Text style={[styles.detail, trialOver && { color: "#F59E0B" }]}>{trial}</Text>
                  <Pressable onPress={() => extendTrial(item)} hitSlop={8} disabled={busyId === item.id}>
                    <Text style={styles.extraLink}>+7 days</Text>
                  </Pressable>
                </View>
              ) : null}
              {rewards.earned > 0 ? (
                <View style={styles.extraRow}>
                  <Text style={styles.detail}>
                    {rewards.earned} referral{rewards.earned === 1 ? "" : "s"} · {rewards.unusedPercent}% off to give
                    {rewards.freeMonths > 0 ? ` (${rewards.freeMonths} free month${rewards.freeMonths === 1 ? "" : "s"})` : ""}
                  </Text>
                  {/* Referral credit is used or paid out only in Billing (review 2026-10-18). */}
                  {rewards.unused > 0 ? <Text style={styles.detail}>Use it in Billing when you record their payment.</Text> : null}
                </View>
              ) : null}
            <Pressable
              style={[styles.action, item.approved ? styles.blockAction : styles.approveAction]}
              onPress={() => confirm(item)}
              disabled={busyId === item.id}
            >
              {busyId === item.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionText}>{item.approved ? "Block" : "Approve"}</Text>
              )}
            </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  empty: { color: "#94A3B8", textAlign: "center", marginTop: 40, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  name: { color: "#fff", fontSize: 16, fontWeight: "700" },
  detail: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  status: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  extraRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  extraLink: { color: "#D4AF37", fontSize: 13, fontWeight: "700", marginTop: 2 },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  openHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  chevron: { color: "#D4AF37", fontSize: 18, fontWeight: "700" },
  action: { alignSelf: "flex-start", marginTop: 12, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, minWidth: 80, alignItems: "center" },
  approveAction: { backgroundColor: "#22C55E" },
  blockAction: { backgroundColor: "#475569" },
  actionText: { color: "#fff", fontWeight: "700" },
  billingButton: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: "#D4AF37" },
  billingTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
