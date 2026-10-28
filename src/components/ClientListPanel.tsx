import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { problemColor, problemLevel, unfixedByClient, type ProblemLevel } from "@/lib/clientProblems";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { renewedPlanDates } from "@/lib/planRenewal";
import { bringBackChanges } from "@/lib/comeback";
import { CLIENT_GROUPS, clientGroup, type ClientGroup } from "@/lib/clientGroups";
import { useAuth } from "@/context/AuthContext";
import ClientAvatar, { signAvatarUrls } from "@/components/ClientAvatar";
import PaymentProofModal from "@/components/PaymentProofModal";
import WeighInPicker from "@/components/WeighInPicker";
import BulkWeighInModal from "@/components/BulkWeighInModal";
import type { WeighInEvery } from "@/lib/progress";
import { waitingByPerson } from "@/lib/paymentProofs";
import type { AccessStatus, Client, PaymentProof } from "@/types/database";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

const STATUS_LABEL: Record<AccessStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

// The trainer's client list: Active / Waiting approval / Awaiting payment /
// Dormant, with Activate, Renew and Bring back. The whole Clients tab on a
// phone; on a laptop it stays down the side next to the client's page
// (GRIZZ, 2026-10-27). Loads again whenever reloadKey changes.
export default function ClientListPanel({
  onOpen,
  selectedId,
  reloadKey = 0,
}: {
  onOpen: (clientId: string) => void;
  selectedId?: string;
  reloadKey?: number;
}) {
  const { trainer } = useAuth();
  const [allClients, setClients] = useState<Client[]>([]);
  // Four tabs: Active / Waiting approval / Awaiting payment / Dormant (archived
  // clients from 0097 land under Dormant).
  const [group, setGroup] = useState<ClientGroup>("active");
  const [askWeighIn, setAskWeighIn] = useState<Client | null>(null);
  const [bulkWeighIn, setBulkWeighIn] = useState(false);
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
  // Proof of payment sent through the app and not checked yet (0117), by client.
  const [proofs, setProofs] = useState<Record<string, PaymentProof>>({});
  const [viewing, setViewing] = useState<PaymentProof | null>(null);

  const loadProofs = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("payment_proofs")
      .select("*")
      .eq("trainer_id", trainer.id)
      .eq("to_owner", false)
      .eq("status", "new");
    setProofs(waitingByPerson((data as PaymentProof[] | null) ?? []));
  }, [trainer]);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainer.id).neq("id", trainer.id)
      .order("plan_expires_at", { ascending: true, nullsFirst: true });
    const list = data ?? [];
    setClients(list);
    loadProofs();
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
  }, [load, reloadKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Payment received: set the plan dates and open access. Paying early adds the
  // new plan on from the current end date (renewedPlanDates).
  const activateNow = async (client: Client) => {
    const updates = renewedPlanDates(client, new Date());
    if (!updates) {
      Alert.alert("Error", "No plan type selected for this client.");
      return;
    }
    const { error } = await supabase.from("clients").update(updates).eq("id", client.id);
    if (!error) {
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...updates } : c)));
      // A client with no weigh-in schedule yet: ask how often they weigh and measure.
      if (!client.weigh_in_every && client.id !== trainer?.id) setAskWeighIn(client);
    } else {
      Alert.alert("Error", "Failed to update the client's plan.");
    }
  };

  const pickWeighIn = async (key: WeighInEvery | null) => {
    const who = askWeighIn;
    setAskWeighIn(null);
    if (!who || !key) return;
    const { error } = await supabase.from("clients").update({ weigh_in_every: key, weigh_in_reminded_on: null }).eq("id", who.id);
    if (error) return Alert.alert("Couldn't save it", error.message);
    setClients((prev) => prev.map((c) => (c.id === who.id ? { ...c, weigh_in_every: key } : c)));
  };

  const applyBulkWeighIn = async (ids: string[], key: WeighInEvery) => {
    const { error } = await supabase.from("clients").update({ weigh_in_every: key, weigh_in_reminded_on: null }).in("id", ids);
    if (error) return Alert.alert("Couldn't save it", error.message);
    setClients((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, weigh_in_every: key } : c)));
    setBulkWeighIn(false);
    Alert.alert("Saved", `${ids.length} client${ids.length === 1 ? "" : "s"} set. They'll be reminded when it's due.`);
  };

  // With a proof of payment waiting, Activate / Renew opens it so it can be checked first.
  const activateClient = async (client: Client) => {
    if (proofs[client.id]) {
      setViewing(proofs[client.id]);
      return;
    }
    const renewing = client.access_status !== "expired";
    const next = renewedPlanDates(client, new Date());
    const until = next ? ` Their plan will run to ${parseIsoDate(next.plan_expires_at).toLocaleDateString()}.` : "";
    Alert.alert(
      renewing ? "Renew plan?" : "Activate client?",
      renewing
        ? `Confirm payment received for ${client.name}. The new plan starts when the current one ends.${until}`
        : `Confirm payment received for ${client.name}. Their access will activate now.${until}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: renewing ? "Renew" : "Activate", style: "default", onPress: () => activateNow(client) },
      ]
    );
  };
  const viewingClient = viewing ? allClients.find((c) => c.id === viewing.client_id) ?? null : null;

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
        <ActivityIndicator color={themeText("#22C55E")} />
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
      <Pressable style={styles.bulkButton} onPress={() => setBulkWeighIn(true)} accessibilityRole="button">
        <Text style={styles.bulkText}>⚖️ Set weigh-ins for several clients</Text>
      </Pressable>
      <FlatList
        data={clients}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const score = scores[item.id];
          const isLeader = score !== undefined && score > 0 && score === topScore;
          return (
            <Pressable
              style={[styles.row, item.id === selectedId && styles.rowOn]}
              onPress={() => onOpen(item.id)}
            >
              <View style={styles.avatar}>
                <ClientAvatar name={item.name} url={item.avatar_path ? avatarUrls[item.avatar_path] : null} size={44} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  {problemLevels[item.id] && (
                    <View style={[styles.flagDot, { backgroundColor: themeBg(problemColor(problemLevels[item.id])) }]} />
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
                {proofs[item.id] && (
                  <Pressable onPress={() => setViewing(proofs[item.id])} hitSlop={6} style={styles.proofChip}>
                    <Text style={styles.proofChipText}>🧾 Proof of payment sent · View</Text>
                  </Pressable>
                )}
              </View>
              {item.archived_at ? (
                <Pressable style={styles.actionButton} onPress={() => bringBack(item)}>
                  <Text style={styles.actionButtonText}>Bring back</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.actionButton} onPress={() => activateClient(item)}>
                  <Text style={styles.actionButtonText}>{item.access_status === "expired" ? "Activate" : "Renew"}</Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.helper}>{current.empty}</Text>}
      />
      <BulkWeighInModal
        clients={allClients.filter((c) => !c.archived_at && c.access_status !== "expired")}
        visible={bulkWeighIn}
        onApply={applyBulkWeighIn}
        onClose={() => setBulkWeighIn(false)}
      />
      <WeighInPicker name={askWeighIn?.name ?? "your client"} visible={!!askWeighIn} onPick={pickWeighIn} />
      <PaymentProofModal
        proof={viewing}
        from={viewingClient?.name ?? "your client"}
        confirmLabel={viewingClient?.access_status === "expired" ? "✓ Paid, activate them" : "✓ Paid, renew their plan"}
        onConfirm={() => {
          if (viewingClient && !viewingClient.archived_at) activateNow(viewingClient);
          setViewing(null);
        }}
        onReviewed={loadProofs}
        onClose={() => setViewing(null)}
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

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 10 },
  tab: { width: "48%", flexGrow: 1, backgroundColor: "#1E293B", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  tabOn: { backgroundColor: "#D4AF37" },
  tabText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13, textAlign: "center" },
  tabTextOn: { color: "#0F172A" },
  helper: { color: "#64748B", fontSize: 12, marginBottom: 16 },
  bulkButton: { borderWidth: 1, borderColor: "#D4AF37", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  bulkText: { color: "#D4AF37", fontWeight: "700", fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowOn: { borderWidth: 1, borderColor: "#D4AF37" },
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
  proofChip: { alignSelf: "flex-start", backgroundColor: "#3A2F0B", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  proofChipText: { color: "#D4AF37", fontWeight: "700", fontSize: 12 },
});
