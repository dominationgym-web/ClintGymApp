import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { trainerDisplayName } from "@/lib/trainers";
import TrainerLogo from "@/components/TrainerLogo";
import type { Trainer } from "@/types/database";

// The app owner's list of every trainer (0029): approve new ones, or block one.
// Only the owner can load other trainers' rows or change `approved`; the
// database enforces both, this tab is only shown to the owner.
export default function TrainersScreen() {
  const { trainer: me } = useAuth();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("trainers").select("*").order("created_at", { ascending: false });
    if (error) Alert.alert("Couldn't load trainers", error.message);
    // Waiting for approval first, then everyone else, newest first.
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

  const confirm = (t: Trainer) => {
    const name = trainerDisplayName(t);
    if (t.approved) {
      Alert.alert(
        `Block ${name}?`,
        "They'll see a waiting screen instead of their clients, and no new clients can join them. You can approve them again later.",
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
      ListEmptyComponent={
        <Text style={styles.empty}>No other trainers yet. When a trainer applies in the app, they'll show up here.</Text>
      }
      renderItem={({ item }) => {
        const name = trainerDisplayName(item);
        return (
          <View style={styles.row}>
            <TrainerLogo name={name} path={item.logo_path} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{name}</Text>
              {item.business_name ? <Text style={styles.detail}>{item.name}</Text> : null}
              <Text style={styles.detail}>{item.email}</Text>
              {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
              <Text style={styles.detail}>
                {item.agreement_accepted_at
                  ? `Signed the agreement as "${item.agreement_signed_name}" on ${new Date(item.agreement_accepted_at).toLocaleDateString()}`
                  : "Hasn't signed the trainer agreement yet"}
              </Text>
              <Text style={[styles.status, { color: item.approved ? "#22C55E" : "#F59E0B" }]}>
                {item.approved ? `Approved · code ${item.join_code}` : "Waiting for your approval"}
              </Text>
            </View>
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
  action: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, minWidth: 80, alignItems: "center" },
  approveAction: { backgroundColor: "#22C55E" },
  blockAction: { backgroundColor: "#475569" },
  actionText: { color: "#fff", fontWeight: "700" },
});
