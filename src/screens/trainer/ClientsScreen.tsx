import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { supabase } from "@/lib/supabase";
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainer.id)
      .order("plan_expires_at", { ascending: true, nullsFirst: true });
    setClients(data ?? []);
  }, [trainer]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Manual payment confirmation: this is the single field gating a client's
  // access, per the brief. Cycling it here is the "admin screen" - the
  // trainer only flips this after confirming EFT/PayPal payment themselves.
  const cycleStatus = async (client: Client) => {
    const currentIdx = STATUS_ORDER.indexOf(client.access_status);
    const next = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
    const { error } = await supabase.from("clients").update({ access_status: next }).eq("id", client.id);
    if (!error) {
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, access_status: next } : c)));
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
    <View style={styles.container}>
      <Text style={styles.title}>Clients</Text>
      <Text style={styles.helper}>Tap the status pill to cycle it after confirming payment.</Text>
      <FlatList
        data={clients}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate("ClientDetail", { clientId: item.id })}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                {item.status_flag === "red" && <Text style={styles.flagIcon}>🚩</Text>}
                {item.status_flag === "orange" && <View style={[styles.flagDot, { backgroundColor: "#F59E0B" }]} />}
                <Text style={styles.name}>{item.name}</Text>
              </View>
              {item.plan_expires_at && (
                <Text style={styles.expiry}>expires {new Date(item.plan_expires_at).toLocaleDateString()}</Text>
              )}
            </View>
            <Pressable style={[styles.statusPill, statusStyle(item.access_status)]} onPress={() => cycleStatus(item)}>
              <Text style={styles.statusText}>{STATUS_LABEL[item.access_status]}</Text>
            </Pressable>
          </Pressable>
        )}
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
  expiry: { color: "#64748B", fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
});
