import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { problemColor, problemLevel, unfixedByClient, type ProblemLevel } from "@/lib/clientProblems";
import { toIsoDate } from "@/lib/dates";
import { bringBackChanges } from "@/lib/comeback";
import { CLIENT_GROUPS, clientGroup, type ClientGroup } from "@/lib/clientGroups";
import { useAuth } from "@/context/AuthContext";
import ClientAvatar, { signAvatarUrls } from "@/components/ClientAvatar";
import type { AccessStatus, Client } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";

type Props = TrainerTabScreenProps<"Clients">;

const STATUS_LABEL: Record<AccessStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

export default function ClientsScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  const [allClients, setClients] = useState<Client[]>([]);
  // Four tabs: Active / Waiting approval / Awaiting payment / Dormant (archived
  // clients from 0097 land under Dormant).
  const [group, setGroup] = useState<ClientGroup>("active");
  const today = toIsoDate(new Date());
  const groupOf = (c: Client) => clientGroup(c, today);
  const clients = allClients.filter((c) => groupOf(c) === group);
  const current = CLIENT_GROUPS.find((g) => g.key === group)!;
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  // Red dot while a problem is open, orange while it's being fixed (0075).
  const [problemLevels, setProblemLevels] = useState<Record<string, ProblemLevel>>({});
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
    // One request signs every photo on the list.
    signAvatarUrls(list.map((c) => c.avatar_path ?? "")).then(setAvatarUrls);
    supabase
      .from("client_problems")
      .select("client_id, status")
      .neq("status", "fixed")
      .in("client_id", list.map((c) => c.id))
      .then(({ data: rows }) => {
        const levels: Record<string, ProblemLevel> = {};
        unfixedByClient(rows ?? []).forEach((ps, id) => (levels[id] = problemLevel(ps)));
        setProblemLevels(levels);
      });

    // This month's consistency score - only meaningful for active clients.
    const active = list.filter((c) => c.access_status === "active" && !c.archived_at);
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

  // Bring an archived client back: all their old data is still there.
  const bringBack = (client: Client) => {
    Alert.alert(
      `Bring ${client.name} back?`,
      "All their old data is still here. They'll be asked to fill in the intake form again, so you can compare then and now on their Overview. Tap Activate once they've paid.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Bring back",
          onPress: async () => {
            const changes = bringBackChanges(client, new Date().toISOString());
            const { error } = await supabase.from("clients").update(changes).eq("id", client.id);
            if (error) return Alert.alert("Couldn't bring them back", error.message);
            setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...changes } : c)));
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
      <View style={styles.tabs}>
        {CLIENT_GROUPS.map((g) => {
          const count = allClients.filter((c) => groupOf(c) === g.key).length;
          const on = g.key === group;
          return (
            <Pressable key={g.key} style={[styles.tab, on && styles.tabOn]} onPress={() => setGroup(g.key)}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {g.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>{current.helper}</Text>
      <FlatList
        data={clients}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const score = scores[item.id];
          const isLeader = score !== undefined && score > 0 && score === topScore;
          return (
            <Pressable style={styles.row} onPress={() => navigation.navigate("ClientDetail", { clientId: item.id })}>
              <View style={styles.avatar}>
                <ClientAvatar name={item.name} url={item.avatar_path ? avatarUrls[item.avatar_path] : null} size={44} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  {problemLevels[item.id] && (
                    <View style={[styles.flagDot, { backgroundColor: problemColor(problemLevels[item.id]) }]} />
                  )}
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
              {item.archived_at ? (
                <Pressable style={styles.actionButton} onPress={() => bringBack(item)}>
                  <Text style={styles.actionButtonText}>Bring back</Text>
                </Pressable>
              ) : item.access_status === "expired" ? (
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
        ListEmptyComponent={<Text style={styles.helper}>{current.empty}</Text>}
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
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 10 },
  tab: { width: "48%", flexGrow: 1, backgroundColor: "#1E293B", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  tabOn: { backgroundColor: "#D4AF37" },
  tabText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13, textAlign: "center" },
  tabTextOn: { color: "#0F172A" },
  helper: { color: "#64748B", fontSize: 12, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  avatar: { marginRight: 12 },
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
