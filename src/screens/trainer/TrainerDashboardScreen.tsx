import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Checkin, Client } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";

type Props = TrainerTabScreenProps<"Dashboard">;

interface ClientStatus {
  client: Client;
  todaysCheckin: Checkin | null;
  distressFlag: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function TrainerDashboardScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  const [rows, setRows] = useState<ClientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data: clients } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainer.id)
      .eq("access_status", "active");

    if (!clients) {
      setRows([]);
      return;
    }

    const { data: checkins } = await supabase
      .from("checkins")
      .select("*")
      .eq("checkin_date", todayIso())
      .in("client_id", clients.map((c) => c.id));

    const checkinByClient = new Map((checkins ?? []).map((c) => [c.client_id, c]));

    const result: ClientStatus[] = clients.map((client) => {
      const todaysCheckin = checkinByClient.get(client.id) ?? null;
      return { client, todaysCheckin, distressFlag: todaysCheckin?.distress_flag ?? false };
    });

    // Needs attention first: distress flags, then missing check-ins, then done.
    result.sort((a, b) => {
      const score = (r: ClientStatus) => (r.distressFlag ? 0 : r.todaysCheckin ? 2 : 1);
      return score(a) - score(b);
    });

    setRows(result);
  }, [trainer]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
      <Text style={styles.title}>Today's compliance</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.client.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, item.distressFlag && styles.rowDistress]}
            onPress={() => navigation.navigate("ClientDetail", { clientId: item.client.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.client.name}</Text>
              {item.distressFlag && <Text style={styles.distressText}>⚠ Distress/pain flagged today</Text>}
            </View>
            <View style={[styles.statusDot, item.todaysCheckin ? styles.dotGreen : styles.dotRed]} />
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.helper}>No active clients yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowDistress: { borderWidth: 1.5, borderColor: "#EF4444" },
  name: { color: "#fff", fontWeight: "600", fontSize: 15 },
  distressText: { color: "#F87171", fontSize: 12, marginTop: 4, fontWeight: "600" },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  dotGreen: { backgroundColor: "#22C55E" },
  dotRed: { backgroundColor: "#EF4444" },
  helper: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
