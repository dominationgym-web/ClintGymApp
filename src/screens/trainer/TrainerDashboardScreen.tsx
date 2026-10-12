import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { clientsWhoTrainedYesterday, loadRecoveryCheck } from "@/lib/recoveryQueries";
import { recoveryHandled } from "@/lib/recovery";
import { clientPriority } from "@/lib/clientFlags";
import { problemColor, problemLevel, problemLine, unfixedByClient, type ProblemLevel } from "@/lib/clientProblems";
import { BRAND_GOLD } from "@/lib/brand";
import NotificationsPrompt from "@/components/NotificationsPrompt";
import ReplyToClientModal from "@/components/ReplyToClientModal";
import { scheduleSuggestionBoxReminder } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import type { Checkin, Client, ClientProblem } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";

type Props = TrainerTabScreenProps<"Dashboard">;

interface ClientStatus {
  client: Client;
  todaysCheckin: Checkin | null;
  distressFlag: boolean;
  // Problems not yet fixed (0075), and the dot they give: red while one is
  // open, orange while they're all being fixed.
  problems: ClientProblem[];
  level: ProblemLevel;
}

const priority = (r: ClientStatus): number =>
  clientPriority({
    statusFlag: r.level ?? "green",
    distressFlag: r.distressFlag,
    hasCheckedInToday: r.todaysCheckin !== null,
  });

export default function TrainerDashboardScreen({ navigation }: Props) {
  const { trainer, signOut } = useAuth();
  const [rows, setRows] = useState<ClientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ClientStatus | null>(null);
  // The owner's suggestion box: a banner while there are unread ones, and a
  // weekly phone reminder in the installed app (Expo Go only gets the banner).
  const [newSuggestions, setNewSuggestions] = useState(0);
  const isOwner = !!trainer?.is_owner;

  useEffect(() => {
    if (!isOwner) return;
    scheduleSuggestionBoxReminder();
  }, [isOwner]);

  // New clients who signed up and are waiting to be activated (0056 also sends
  // the trainer a phone notification when one signs up).
  const [waitingSignups, setWaitingSignups] = useState(0);

  const loadWaitingSignups = useCallback(async () => {
    if (!trainer) return;
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainer.id)
      .eq("access_status", "expired")
      .is("plan_started_at", null);
    setWaitingSignups(count ?? 0);
  }, [trainer]);

  useEffect(() => {
    loadWaitingSignups();
    return navigation.addListener("focus", loadWaitingSignups);
  }, [navigation, loadWaitingSignups]);

  // Recovery check: clients whose session today works muscles they trained
  // hard yesterday, and the trainer hasn't dealt with it yet.
  const [recoveryClients, setRecoveryClients] = useState<{ id: string; name: string }[]>([]);

  const loadRecoveryClients = useCallback(async () => {
    if (!trainer) return;
    const today = todayIso();
    const { data: mine } = await supabase.from("clients").select("id, name").eq("trainer_id", trainer.id);
    const trained = await clientsWhoTrainedYesterday((mine ?? []).map((c) => c.id), today);
    const checks = await Promise.all(trained.map((id) => loadRecoveryCheck(id, today)));
    setRecoveryClients(
      (mine ?? []).filter((c) => {
        const check = checks[trained.indexOf(c.id)];
        return check && !recoveryHandled(check.active.assignment, today);
      }),
    );
  }, [trainer]);

  useEffect(() => {
    loadRecoveryClients();
    return navigation.addListener("focus", loadRecoveryClients);
  }, [navigation, loadRecoveryClients]);

  const loadSuggestionCount = useCallback(async () => {
    if (!isOwner) return;
    const { count } = await supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "new");
    setNewSuggestions(count ?? 0);
  }, [isOwner]);

  useEffect(() => {
    // Recount whenever the dashboard comes back into view, e.g. after reading them.
    loadSuggestionCount();
    return navigation.addListener("focus", loadSuggestionCount);
  }, [navigation, loadSuggestionCount]);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data: clients } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainer.id)
      // Everyone who still has access, which includes `expiring_soon` - those
      // are paid-up clients inside their renewal window, and filtering on
      // 'active' alone dropped them (and any red flag they had raised) off the
      // dashboard entirely for the last week of every plan.
      .neq("access_status", "expired");

    if (!clients) {
      setRows([]);
      return;
    }

    const { data: checkins } = await supabase
      .from("checkins")
      .select("*")
      .eq("checkin_date", todayIso())
      .in("client_id", clients.map((c) => c.id));

    const { data: problemRows } = await supabase
      .from("client_problems")
      .select("*")
      .neq("status", "fixed")
      .in("client_id", clients.map((c) => c.id))
      .order("created_at", { ascending: true });

    const checkinByClient = new Map((checkins ?? []).map((c) => [c.client_id, c]));
    const problemsByClient = unfixedByClient(problemRows ?? []);

    const result: ClientStatus[] = clients.map((client) => {
      const todaysCheckin = checkinByClient.get(client.id) ?? null;
      const problems = problemsByClient.get(client.id) ?? [];
      const level = problemLevel(problems);
      // Today's report only lifts the client up the list while it's still new.
      return { client, todaysCheckin, problems, level, distressFlag: level === "red" && (todaysCheckin?.distress_flag ?? false) };
    });

    result.sort((a, b) => priority(a) - priority(b));

    setRows(result);
  }, [trainer]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // The row's buttons move all of the client's problems at once; the
  // client's page has a button per problem.
  const [updating, setUpdating] = useState<string | null>(null);
  const setProblemStatus = async (clientId: string, status: "fixing" | "fixed") => {
    setUpdating(clientId);
    const { error } = await supabase.rpc("set_client_problem_status", { p_client: clientId, p_status: status });
    if (error) Alert.alert("Couldn't update", error.message);
    await load();
    setUpdating(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    loadWaitingSignups();
    loadRecoveryClients();
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Today's compliance</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.logoutLink}>Log out</Text>
        </Pressable>
      </View>
      <NotificationsPrompt who="trainer" />
      {waitingSignups > 0 && (
        <Pressable style={styles.suggestionBanner} onPress={() => navigation.navigate("Clients")}>
          <Text style={styles.suggestionBannerText}>
            🆕 {waitingSignups} new client{waitingSignups === 1 ? "" : "s"} waiting to be activated
          </Text>
          <Text style={styles.suggestionBannerLink}>Open ›</Text>
        </Pressable>
      )}
      {recoveryClients.length > 0 && (
        <Pressable
          style={styles.suggestionBanner}
          onPress={() => navigation.navigate("ClientDetail", { clientId: recoveryClients[0].id, tab: "training" })}
        >
          <Text style={styles.suggestionBannerText}>
            ⚠️ Recovery check:{" "}
            {recoveryClients.length === 1
              ? `${recoveryClients[0].name} is training the same muscles as yesterday`
              : `${recoveryClients.map((c) => c.name.split(" ")[0]).join(", ")} are training the same muscles as yesterday`}
          </Text>
          <Text style={styles.suggestionBannerLink}>Open ›</Text>
        </Pressable>
      )}
      {newSuggestions > 0 && (
        <Pressable style={styles.suggestionBanner} onPress={() => navigation.navigate("SuggestionBox")}>
          <Text style={styles.suggestionBannerText}>
            💡 {newSuggestions} new suggestion{newSuggestions === 1 ? "" : "s"} in the suggestion box
          </Text>
          <Text style={styles.suggestionBannerLink}>Read ›</Text>
        </Pressable>
      )}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.client.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const borderColor = problemColor(item.level);
          return (
            <Pressable
              style={[styles.row, borderColor && { borderWidth: 1.5, borderColor }]}
              onPress={() => navigation.navigate("ClientDetail", { clientId: item.client.id })}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  {borderColor && <View style={[styles.flagDot, { backgroundColor: borderColor }]} />}
                  <Text style={styles.name}>{item.client.name}</Text>
                </View>
                {item.problems.map((p) => (
                  <Text
                    key={p.id}
                    style={[styles.flagText, { color: p.status === "fixing" ? "#FBBF24" : "#F87171" }]}
                    numberOfLines={2}
                  >
                    {problemLine(p)}
                  </Text>
                ))}
                {item.problems.some((p) => p.client_reply) && (
                  <Text style={styles.replyNote} numberOfLines={2}>
                    💬 They replied: {item.problems.find((p) => p.client_reply)?.client_reply}
                  </Text>
                )}
                {item.problems.length > 0 && (
                  <View style={styles.actions}>
                    <Pressable style={styles.replyButton} onPress={() => setReplyingTo(item)} hitSlop={6}>
                      <Text style={styles.replyText}>💬 Reply</Text>
                    </Pressable>
                    {item.level === "red" && (
                      <Pressable
                        style={[styles.replyButton, styles.fixingButton]}
                        onPress={() => setProblemStatus(item.client.id, "fixing")}
                        disabled={updating === item.client.id}
                        hitSlop={6}
                      >
                        <Text style={styles.fixingText}>🟠 Busy fixing</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.replyButton, styles.fixedButton]}
                      onPress={() => setProblemStatus(item.client.id, "fixed")}
                      disabled={updating === item.client.id}
                      hitSlop={6}
                    >
                      <Text style={styles.fixedText}>✅ Fixed</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <View style={[styles.statusDot, item.todaysCheckin ? styles.dotGreen : styles.dotRed]} />
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.helper}>No active clients yet.</Text>}
      />
      {trainer && (
        <ReplyToClientModal
          client={replyingTo?.client ?? null}
          trainerId={trainer.id}
          distressFlag={replyingTo?.distressFlag}
          onClose={() => setReplyingTo(null)}
          onSent={() => load()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: BRAND_GOLD,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  suggestionBannerText: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1 },
  suggestionBannerLink: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  logoutLink: { color: "#64748B", fontSize: 13, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flagDot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: "#fff", fontWeight: "600", fontSize: 15 },
  flagText: { fontSize: 12, marginTop: 4, fontWeight: "600" },
  replyButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND_GOLD,
  },
  replyText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fixingButton: { borderColor: "#F59E0B" },
  fixingText: { color: "#F59E0B", fontWeight: "700", fontSize: 13 },
  fixedButton: { borderColor: "#22C55E" },
  fixedText: { color: "#22C55E", fontWeight: "700", fontSize: 13 },
  replyNote: { color: "#86EFAC", fontSize: 12, marginTop: 4 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  dotGreen: { backgroundColor: "#22C55E" },
  dotRed: { backgroundColor: "#EF4444" },
  helper: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
