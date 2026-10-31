import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { CHALLENGE_NUDGE_DAYS, monthName, monthStart } from "@/lib/challenges";
import { clientsWhoTrainedYesterday, loadRecoveryCheck } from "@/lib/recoveryQueries";
import { recoveryHandled } from "@/lib/recovery";
import { clientPriority } from "@/lib/clientFlags";
import { problemColor, problemLevel, problemLine, unfixedByClient, type ProblemLevel } from "@/lib/clientProblems";
import { BRAND_GOLD } from "@/lib/brand";
import NotificationsPrompt from "@/components/NotificationsPrompt";
import ReplyToClientModal from "@/components/ReplyToClientModal";
import HabitWinsCard from "@/components/HabitWinsCard";
import CheckInNudgeCard from "@/components/CheckInNudgeCard";
import { scheduleSuggestionBoxReminder } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import { clientGroup } from "@/lib/clientGroups";
import { checkinClock, checkinDay, isUpcoming } from "@/lib/videoCheckins";
import type { Checkin, Client, ClientProblem, VideoCheckin } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

type Props = TrainerTabScreenProps<"Dashboard">;

interface ClientStatus {
  client: Client;
  todaysCheckin: Checkin | null;
  // A workout done today, in full or in part (0076).
  trainedToday: boolean;
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
    // A live client never checks in, so they don't jump up the list as "not checked in".
    hasCheckedInToday: r.todaysCheckin !== null || !!r.client.live_only,
  });

// New videos counted per client, in the order they first appear (newest first).
function videosByClient(videos: { clientId: string; name: string }[]) {
  const out = new Map<string, { clientId: string; name: string; count: number }>();
  for (const v of videos) {
    const row = out.get(v.clientId) ?? { clientId: v.clientId, name: v.name, count: 0 };
    row.count += 1;
    out.set(v.clientId, row);
  }
  return [...out.values()];
}

export default function TrainerDashboardScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  const [rows, setRows] = useState<ClientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ClientStatus | null>(null);
  // The owner's suggestion box: a banner while there are unread ones, and a
  // weekly phone reminder in the installed app (Expo Go only gets the banner).
  const [newSuggestions, setNewSuggestions] = useState(0);
  // New problems from trainers (0151); the installed app also gets a push for each.
  const [newProblems, setNewProblems] = useState(0);
  // No monthly challenge on in the first week of the month (0153).
  const [noChallenge, setNoChallenge] = useState(false);
  const isOwner = !!trainer?.is_owner;

  useEffect(() => {
    if (!isOwner) return;
    scheduleSuggestionBoxReminder();
  }, [isOwner]);

  // Clients waiting to be activated: new sign-ups and returning clients (the
  // Clients tab's "Waiting approval" group). 0056 also sends the trainer a
  // phone notification when one signs up.
  const [waitingSignups, setWaitingSignups] = useState(0);

  const loadWaitingSignups = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("clients")
      .select("access_status, archived_at, plan_started_at, plan_expires_at, returned_at")
      .eq("trainer_id", trainer.id).neq("id", trainer.id).is("archived_at", null)
      .eq("access_status", "expired");
    const today = todayIso();
    setWaitingSignups((data ?? []).filter((c) => clientGroup(c, today) === "approval").length);
  }, [trainer]);

  // Proof of payment slips not checked yet (0117): from clients, and for the
  // owner from trainers too, plus trainers waiting for approval.
  const [proofCount, setProofCount] = useState(0);
  const [trainerProofCount, setTrainerProofCount] = useState(0);
  const [trainersToApprove, setTrainersToApprove] = useState(0);

  const loadOwed = useCallback(async () => {
    if (!trainer) return;
    const { count } = await supabase
      .from("payment_proofs")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainer.id)
      .eq("to_owner", false)
      .eq("status", "new");
    setProofCount(count ?? 0);
    if (!isOwner) return;
    const [{ count: fromTrainers }, { count: applicants }] = await Promise.all([
      supabase.from("payment_proofs").select("id", { count: "exact", head: true }).eq("to_owner", true).eq("status", "new"),
      // approved_at stays set on a blocked trainer, so this counts only new applicants.
      supabase.from("trainers").select("id", { count: "exact", head: true }).eq("approved", false).is("approved_at", null),
    ]);
    setTrainerProofCount(fromTrainers ?? 0);
    setTrainersToApprove(applicants ?? 0);
  }, [trainer, isOwner]);

  useEffect(() => {
    loadOwed();
    return navigation.addListener("focus", loadOwed);
  }, [navigation, loadOwed]);

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
    const { data: mine } = await supabase.from("clients").select("id, name").eq("trainer_id", trainer.id).neq("id", trainer.id).is("archived_at", null);
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

  // Form videos the trainer hasn't watched yet (0081).
  const [newVideos, setNewVideos] = useState<{ clientId: string; name: string }[]>([]);

  const loadNewVideos = useCallback(async () => {
    if (!trainer) return;
    const { data: mine } = await supabase.from("clients").select("id, name").eq("trainer_id", trainer.id).neq("id", trainer.id).is("archived_at", null);
    const ids = (mine ?? []).map((c) => c.id);
    if (ids.length === 0) return setNewVideos([]);
    const { data } = await supabase
      .from("videos")
      .select("client_id")
      .in("client_id", ids)
      .is("viewed_at", null)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false });
    const names = new Map((mine ?? []).map((c) => [c.id, c.name]));
    setNewVideos((data ?? []).map((v) => ({ clientId: v.client_id, name: names.get(v.client_id) ?? "" })));
  }, [trainer]);

  useEffect(() => {
    loadNewVideos();
    return navigation.addListener("focus", loadNewVideos);
  }, [navigation, loadNewVideos]);

  // Clients waiting on a foundation program decision (0087).
  const [foundationWaiting, setFoundationWaiting] = useState<{ id: string; name: string }[]>([]);

  const loadFoundationWaiting = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("trainer_id", trainer.id).neq("id", trainer.id).is("archived_at", null)
      .eq("foundation_status", "suggested")
      .order("created_at", { ascending: false });
    setFoundationWaiting(data ?? []);
  }, [trainer]);

  useEffect(() => {
    loadFoundationWaiting();
    return navigation.addListener("focus", loadFoundationWaiting);
  }, [navigation, loadFoundationWaiting]);

  const loadSuggestionCount = useCallback(async () => {
    if (!isOwner) return;
    const { count } = await supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "new");
    setNewSuggestions(count ?? 0);
    const problems = await supabase
      .from("trainer_problems")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .neq("trainer_id", trainer?.id ?? "");
    setNewProblems(problems.count ?? 0);
  }, [isOwner, trainer?.id]);

  const loadChallenge = useCallback(async () => {
    const today = todayIso();
    if (!trainer || Number(today.slice(8, 10)) > CHALLENGE_NUDGE_DAYS) {
      setNoChallenge(false);
      return;
    }
    const { count } = await supabase
      .from("trainer_challenges")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainer.id)
      .eq("month", monthStart(today));
    setNoChallenge((count ?? 0) === 0);
  }, [trainer]);

  useEffect(() => {
    loadChallenge();
    return navigation.addListener("focus", loadChallenge);
  }, [navigation, loadChallenge]);

  useEffect(() => {
    // Recount whenever the dashboard comes back into view, e.g. after reading them.
    loadSuggestionCount();
    return navigation.addListener("focus", loadSuggestionCount);
  }, [navigation, loadSuggestionCount]);

  // Video check-ins (0155): ones to confirm, and today's confirmed ones.
  const [videoCheckins, setVideoCheckins] = useState<(VideoCheckin & { name: string })[]>([]);
  const loadVideoCheckins = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("video_checkins")
      .select("*")
      .eq("trainer_id", trainer.id)
      .in("status", ["requested", "confirmed"])
      .gte("starts_at", new Date(Date.now() - 3 * 3600000).toISOString())
      .order("starts_at");
    const now = new Date();
    const shown = (data ?? []).filter(
      (v) => isUpcoming(v, now) && (v.status === "requested" || checkinDay(v.starts_at, now) === "Today")
    );
    if (shown.length === 0) {
      setVideoCheckins([]);
      return;
    }
    const { data: names } = await supabase.from("clients").select("id, name").in("id", [...new Set(shown.map((v) => v.client_id))]);
    const byId = new Map((names ?? []).map((c) => [c.id, c.name]));
    setVideoCheckins(shown.map((v) => ({ ...v, name: byId.get(v.client_id) ?? "Client" })));
  }, [trainer]);

  useEffect(() => {
    loadVideoCheckins();
    return navigation.addListener("focus", loadVideoCheckins);
  }, [navigation, loadVideoCheckins]);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data: clients } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainer.id).neq("id", trainer.id).is("archived_at", null)
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

    const { data: sessionRows } = await supabase
      .from("workout_sessions")
      .select("client_id, status")
      .eq("session_date", todayIso())
      .in("client_id", clients.map((c) => c.id));
    const trained = new Set((sessionRows ?? []).filter((r) => r.status !== "missed").map((r) => r.client_id));

    const checkinByClient = new Map((checkins ?? []).map((c) => [c.client_id, c]));
    const problemsByClient = unfixedByClient(problemRows ?? []);

    const result: ClientStatus[] = clients.map((client) => {
      const todaysCheckin = checkinByClient.get(client.id) ?? null;
      const problems = problemsByClient.get(client.id) ?? [];
      const level = problemLevel(problems);
      // Today's report only lifts the client up the list while it's still new.
      return { client, todaysCheckin, trainedToday: trained.has(client.id), problems, level, distressFlag: level === "red" && (todaysCheckin?.distress_flag ?? false) };
    });

    result.sort((a, b) => priority(a) - priority(b));

    setRows(result);
  }, [trainer]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    // Reload on coming back, e.g. after marking a problem Fixed inside a client.
    return navigation.addListener("focus", () => {
      load();
    });
  }, [navigation, load]);

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
    loadNewVideos();
    loadFoundationWaiting();
    loadSuggestionCount();
    loadOwed();
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={themeText("#22C55E")} />
      </View>
    );
  }

  // Everything waiting on the trainer, in one card instead of a banner each.
  const needsYou = [
    waitingSignups > 0 && {
      key: "signups",
      text: `🆕 ${waitingSignups} client${waitingSignups === 1 ? "" : "s"} to activate`,
      link: "Open",
      onPress: () => navigation.navigate("Clients"),
    },
    proofCount > 0 && {
      key: "proofs",
      text: `🧾 ${proofCount} proof${proofCount === 1 ? "" : "s"} of payment to check`,
      link: "Open",
      onPress: () => navigation.navigate("Clients"),
    },
    trainersToApprove > 0 && {
      key: "trainers",
      text: `🧑‍🏫 ${trainersToApprove} trainer${trainersToApprove === 1 ? "" : "s"} to approve`,
      link: "Open",
      onPress: () => navigation.navigate("Trainers"),
    },
    trainerProofCount > 0 && {
      key: "trainerProofs",
      text: `🧾 ${trainerProofCount} trainer payment${trainerProofCount === 1 ? "" : "s"} to record`,
      link: "Open",
      onPress: () => navigation.navigate("Billing"),
    },
    // One line per client, so each link opens the right client.
    ...recoveryClients.map((c) => ({
      key: `recovery-${c.id}`,
      text: `⚠️ ${c.name.split(" ")[0]}: same muscles as yesterday`,
      link: "Open",
      onPress: () => navigation.navigate("ClientDetail", { clientId: c.id, tab: "training" }),
    })),
    ...videosByClient(newVideos).map((v) => ({
      key: `videos-${v.clientId}`,
      text: `🎥 ${v.count} new form video${v.count === 1 ? "" : "s"} from ${v.name.split(" ")[0]}`,
      link: "Watch",
      onPress: () => navigation.navigate("ClientDetail", { clientId: v.clientId, tab: "training", open: "videos" }),
    })),
    ...foundationWaiting.map((c) => ({
      key: `foundation-${c.id}`,
      text: `🌱 Approve a foundation program for ${c.name.split(" ")[0]}`,
      link: "Open",
      onPress: () => navigation.navigate("ClientDetail", { clientId: c.id, tab: "training" }),
    })),
    noChallenge && {
      key: "challenge",
      text: `🏆 Pick ${monthName(todayIso())}'s challenge for your clients`,
      link: "Pick",
      onPress: () => navigation.navigate("Challenges"),
    },
    ...videoCheckins.map((v) => ({
      key: `video-${v.id}`,
      text:
        v.status === "requested"
          ? `📹 Confirm ${v.name.split(" ")[0]}'s video check-in · ${checkinDay(v.starts_at)} ${checkinClock(v.starts_at)}`
          : `📹 Video check-in with ${v.name.split(" ")[0]} today at ${checkinClock(v.starts_at)}`,
      link: "Open",
      onPress: () => navigation.navigate("VideoCheckIns"),
    })),
    newProblems > 0 && {
      key: "problems",
      text: `🛠 ${newProblems} new problem${newProblems === 1 ? "" : "s"} from trainers`,
      link: "Open",
      onPress: () => navigation.navigate("TrainerProblems"),
    },
    newSuggestions > 0 && {
      key: "suggestions",
      text: `💡 ${newSuggestions} new suggestion${newSuggestions === 1 ? "" : "s"}`,
      link: "Read",
      onPress: () => navigation.navigate("SuggestionBox"),
    },
  ].filter((item): item is { key: string; text: string; link: string; onPress: () => void } => !!item);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's compliance</Text>
      <NotificationsPrompt who="trainer" />
      <FlatList
        data={rows}
        // Needs you and Habit wins scroll with the list, so a small phone still
        // has room for the clients (review 2026-10-18).
        ListHeaderComponent={
          <>
            {needsYou.length > 0 && (
              <View style={styles.needsCard}>
                <Text style={styles.needsTitle}>Needs you</Text>
                {needsYou.map((item, i) => (
                  <Pressable key={item.key} style={[styles.needsRow, i > 0 && styles.needsRowLine]} onPress={item.onPress}>
                    <Text style={styles.suggestionBannerText}>{item.text}</Text>
                    <Text style={styles.suggestionBannerLink}>{item.link} ›</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <CheckInNudgeCard />
            {trainer && <HabitWinsCard trainerId={trainer.id} />}
          </>
        }
        keyExtractor={(r) => r.client.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const borderColor = problemColor(item.level);
          return (
            <Pressable
              style={[styles.row, borderColor && { borderWidth: 1.5, borderColor: themeBorder(borderColor) }]}
              // A client with a problem opens on Overview, where the problem is.
              onPress={() => navigation.navigate("ClientDetail", { clientId: item.client.id, tab: borderColor ? "overview" : undefined })}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  {borderColor && <View style={[styles.flagDot, { backgroundColor: themeBg(borderColor) }]} />}
                  <Text style={styles.name}>{item.client.name}</Text>
                </View>
                {item.problems.map((p) => (
                  <Text
                    key={p.id}
                    style={[styles.flagText, { color: themeText(p.status === "fixing" ? "#FBBF24" : "#F87171") }]}
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
              {/* Labelled, so it's clear what the dot means; plus who trained today. */}
              <View style={styles.statusCol}>
                {item.client.live_only ? (
                  // A live client doesn't check in in the app (0169).
                  <Text style={styles.statusText}>🤝 Live client</Text>
                ) : (
                  <View style={styles.statusLine}>
                    <View style={[styles.statusDot, item.todaysCheckin ? styles.dotGreen : styles.dotRed]} />
                    <Text style={styles.statusText}>{item.todaysCheckin ? "Checked in" : "No check-in yet"}</Text>
                  </View>
                )}
                {item.trainedToday && <Text style={styles.trainedText}>🏋️ Trained today</Text>}
              </View>
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

const styles = themedStyles({
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
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 },
  needsCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  needsTitle: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13, marginBottom: 4 },
  needsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  needsRowLine: { borderTopWidth: 1, borderTopColor: "#334155" },
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
  statusCol: { alignItems: "flex-end", gap: 4, marginLeft: 8 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },
  trainedText: { color: "#22C55E", fontSize: 11, fontWeight: "700" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: "#22C55E" },
  dotRed: { backgroundColor: "#EF4444" },
  helper: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
