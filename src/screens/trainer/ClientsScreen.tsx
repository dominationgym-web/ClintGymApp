import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { toIsoDate } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { AccessStatus, Client } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";

type Props = TrainerTabScreenProps<"Clients">;

const STATUS_LABEL: Record<AccessStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

const STATUS_ORDER: AccessStatus[] = ["expired", "expiring_soon", "active"];

export default function ClientsScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainer.id)
      .order("plan_expires_at", { ascending: true, nullsFirst: true });
    const list = data ?? [];
    setClients(list);

    // This month's consistency score - only meaningful for active clients.
    const active = list.filter((c) => c.access_status === "active");
    const results = await Promise.all(
      active.map((c) => supabase.rpc("client_monthly_consistency", { p_client_id: c.id }))
    );
    const scoreMap: Record<string, number> = {};
    active.forEach((c, i) => {
      const row = results[i].data?.[0];
      if (row) scoreMap[c.id] = row.overall_score;
    });
    setScores(scoreMap);
  }, [trainer]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Activate a client: confirm payment received, set dates, move to active status
  const activateClient = async (client: Client) => {
    Alert.alert(
      "Activate client?",
      `Confirm payment received for ${client.name}. Their access will activate now.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate",
          style: "default",
          onPress: async () => {
            if (!client.plan_type) {
              Alert.alert("Error", "No plan type selected for this client.");
              return;
            }

            const today = new Date();
            const planDays =
              client.plan_type === "intro_1mo" ? 30 :
              client.plan_type === "sub_6mo" ? 180 :
              365; // sub_12mo

            const expiryDate = new Date(today);
            expiryDate.setDate(expiryDate.getDate() + planDays);

            const updates = {
              access_status: "active" as const,
              plan_started_at: toIsoDate(today),
              plan_expires_at: toIsoDate(expiryDate),
            };

            const { error } = await supabase.from("clients").update(updates).eq("id", client.id);
            if (!error) {
              setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...updates } : c)));
            } else {
              Alert.alert("Error", "Failed to activate client.");
            }
          },
        },
      ]
    );
  };

  // Mark client as expired: revoke access, move to expired status
  const markExpired = async (client: Client) => {
    Alert.alert(
      "Mark as expired?",
      `This will revoke ${client.name}'s access. Are you sure?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark expired",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("clients")
              .update({ access_status: "expired" })
              .eq("id", client.id);
            if (!error) {
              setClients((prev) =>
                prev.map((c) => (c.id === client.id ? { ...c, access_status: "expired" } : c))
              );
            } else {
              Alert.alert("Error", "Failed to mark client as expired.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  const topScore = Math.max(0, ...Object.values(scores));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clients</Text>
      <Text style={styles.helper}>Use Activate/Mark expired to manage client access after confirming payment.</Text>
      <FlatList
        data={clients}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const score = scores[item.id];
          const isLeader = score !== undefined && score > 0 && score === topScore;
          return (
            <Pressable style={styles.row} onPress={() => navigation.navigate("ClientDetail", { clientId: item.id })}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  {item.status_flag === "red" && <Text style={styles.flagIcon}>🚩</Text>}
                  {item.status_flag === "orange" && <View style={[styles.flagDot, { backgroundColor: "#F59E0B" }]} />}
                  {isLeader && <Text style={styles.flagIcon}>🏆</Text>}
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusBadge, statusStyle(item.access_status)]}>
                    <Text style={styles.statusLabel}>{STATUS_LABEL[item.access_status]}</Text>
                  </View>
                  {item.plan_expires_at && (
                    <Text style={styles.expiry}>expires {new Date(item.plan_expires_at).toLocaleDateString()}</Text>
                  )}
                </View>
              </View>
              {item.access_status === "expired" ? (
                <Pressable style={styles.actionButton} onPress={() => activateClient(item)}>
                  <Text style={styles.actionButtonText}>Activate</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.dangerButton} onPress={() => markExpired(item)}>
                  <Text style={styles.dangerButtonText}>Mark expired</Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.helper}>No clients yet.</Text>}
      />
    </View>
  );
}

function statusStyle(status: AccessStatus) {
  switch (status) {
    case "active":
      return { backgroundColor: "#22C55E" };
    case "expiring_soon":
      return { backgroundColor: "#F59E0B" };
    default:
      return { backgroundColor: "#EF4444" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  helper: { color: "#64748B", fontSize: 12, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flagIcon: { fontSize: 13 },
  flagDot: { width: 9, height: 9, borderRadius: 5 },
  name: { color: "#fff", fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  statusLabel: { color: "#0F172A", fontWeight: "700", fontSize: 11 },
  expiry: { color: "#64748B", fontSize: 12 },
  actionButton: { backgroundColor: "#22C55E", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  actionButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
  dangerButton: { backgroundColor: "#EF4444", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  dangerButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
