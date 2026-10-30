import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import {
  PROBLEM_AREAS,
  PROBLEM_MAX_LENGTH,
  PROBLEM_STATUS_COLOR,
  PROBLEM_STATUS_FOR_TRAINER,
  PROBLEM_STATUS_LABEL,
  problemAreaLabel,
  problemWhen,
  problemsWithStatus,
} from "@/lib/trainerProblems";
import { trainerDisplayName } from "@/lib/trainers";
import type { TrainerStackParamList } from "@/navigation/types";
import type { Trainer, TrainerProblem, TrainerProblemArea, TrainerProblemMessage, TrainerProblemStatus } from "@/types/database";
import { themeBorder, themeText, themedStyles } from "@/lib/theme";

const INBOX_TABS: TrainerProblemStatus[] = ["new", "fixing", "fixed"];

// Trainer problems (0151, GRIZZ 2026-10-24). A trainer reports a problem here
// instead of by email; it goes straight to the app owner with a notification,
// linked to them. The owner sees every problem, who sent it and how to reach
// them, replies, and marks it Busy fixing or Fixed. Each problem opens on its
// own page (no long scroll), with the talk on it and a reply box.
export default function TrainerProblemsScreen() {
  const { trainer } = useAuth();
  const isOwner = !!trainer?.is_owner;
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const route = useRoute<RouteProp<TrainerStackParamList, "TrainerProblems">>();
  const [list, setList] = useState<TrainerProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TrainerProblemStatus>("new");
  const [openId, setOpenId] = useState<string | null>(route.params?.problemId ?? null);
  // New problem form (trainers).
  const [area, setArea] = useState<TrainerProblemArea>("app");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("trainer_problems").select("*").order("updated_at", { ascending: false });
    if (error) Alert.alert("Couldn't load problems", error.message);
    setList(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A notification tapped while this page is already open.
  useEffect(() => {
    if (route.params?.problemId) {
      setOpenId(route.params.problemId);
      load();
    }
  }, [route.params?.problemId, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { data, error } = await supabase.from("trainer_problems").insert({ area, body }).select().single();
    setSending(false);
    if (error || !data) {
      Alert.alert("Couldn't send", error?.message ?? "Please try again.");
      return;
    }
    setText("");
    setArea("app");
    setList((prev) => [data, ...prev]);
    Alert.alert("Sent 🛠", "It's gone straight to the app owner. You'll get a notification when they answer.");
  };

  const open = openId ? list.find((p) => p.id === openId) : null;
  if (open) {
    return (
      <ProblemPage
        problem={open}
        isOwner={isOwner}
        onBack={() => {
          setOpenId(null);
          navigation.setParams({ problemId: undefined });
        }}
        onChanged={(changes) => setList((prev) => prev.map((p) => (p.id === open.id ? { ...p, ...changes } : p)))}
        onSeeClients={(trainerId) => navigation.navigate("TrainerTabs", { screen: "Trainers", params: { openId: trainerId } })}
      />
    );
  }

  const shown = isOwner ? problemsWithStatus(list, tab) : list;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeText(BRAND_GOLD)} />}
    >
      {!isOwner && (
        <View style={styles.card}>
          <Text style={styles.heading}>Something not working? 🛠</Text>
          <Text style={styles.helper}>
            Tell the app owner here. It goes straight to them with your name on it, and their answer comes back on this page.
          </Text>
          <Text style={styles.label}>What is it about?</Text>
          <View style={styles.chips}>
            {PROBLEM_AREAS.map((a) => (
              <Pressable key={a.key} style={[styles.chip, area === a.key && styles.chipOn]} onPress={() => setArea(a.key)}>
                <Text style={[styles.chipText, area === a.key && styles.chipTextOn]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="What happened, and what were you trying to do? e.g. My client's workout won't save"
            placeholderTextColor="#64748B"
            multiline
            maxLength={PROBLEM_MAX_LENGTH}
            textAlignVertical="top"
          />
          <Pressable style={[styles.button, !text.trim() && { opacity: 0.5 }]} onPress={send} disabled={sending || !text.trim()}>
            {sending ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Send to the app owner</Text>}
          </Pressable>
        </View>
      )}

      <Text style={styles.sectionTitle}>{isOwner ? "Problems from your trainers" : "Your problems"}</Text>
      {isOwner && (
        <View style={styles.chips}>
          {INBOX_TABS.map((t) => (
            <Pressable key={t} style={[styles.chip, tab === t && styles.chipOn]} onPress={() => setTab(t)}>
              <Text style={[styles.chipText, tab === t && styles.chipTextOn]}>
                {PROBLEM_STATUS_LABEL[t]} ({problemsWithStatus(list, t).length})
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 16 }} />
      ) : shown.length === 0 ? (
        <Text style={styles.helper}>
          {isOwner ? (tab === "new" ? "No new problems. 👍" : "Nothing here.") : "You haven't reported any problems."}
        </Text>
      ) : (
        shown.map((p) => (
          <Pressable key={p.id} style={styles.row} onPress={() => setOpenId(p.id)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {isOwner ? p.trainer_name || "A trainer" : problemAreaLabel(p.area)}
              </Text>
              <Text style={styles.rowBody} numberOfLines={1}>
                {p.body}
              </Text>
              <Text style={[styles.meta, { color: themeText(PROBLEM_STATUS_COLOR[p.status]) }]}>
                {isOwner ? `${problemAreaLabel(p.area)} · ${problemWhen(p.created_at)}` : PROBLEM_STATUS_FOR_TRAINER[p.status]}
              </Text>
            </View>
            <Text style={styles.chevron}>▸</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function ProblemPage({
  problem,
  isOwner,
  onBack,
  onChanged,
  onSeeClients,
}: {
  problem: TrainerProblem;
  isOwner: boolean;
  onBack: () => void;
  onChanged: (changes: Partial<TrainerProblem>) => void;
  onSeeClients: (trainerId: string) => void;
}) {
  const { trainer: me } = useAuth();
  const [messages, setMessages] = useState<TrainerProblemMessage[] | null>(null);
  const [sender, setSender] = useState<Trainer | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  // The owner's own test report is answered from the trainer side.
  const ownerView = isOwner && problem.trainer_id !== me?.id;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trainer_problem_messages")
      .select("*")
      .eq("problem_id", problem.id)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setMessages(data ?? []);
      });
    if (ownerView) {
      supabase
        .from("trainers")
        .select("*")
        .eq("id", problem.trainer_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setSender(data);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [problem.id, problem.trainer_id, ownerView]);

  const sendReply = async () => {
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("send_trainer_problem_message", { p_problem: problem.id, p_body: body });
    setBusy(false);
    if (error || !data) {
      Alert.alert("Couldn't send", error?.message ?? "Please try again.");
      return;
    }
    setReply("");
    setMessages((prev) => [...(prev ?? []), data]);
    onChanged({ updated_at: data.created_at, ...(!ownerView && problem.status === "fixed" ? { status: "new" } : {}) });
  };

  const setStatus = async (status: TrainerProblemStatus) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_trainer_problem_status", { p_problem: problem.id, p_status: status });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    onChanged({ status });
  };

  const phone = sender?.phone || sender?.pop_whatsapp;
  const whatsapp = phone ? phone.replace(/[^\d]/g, "").replace(/^0/, "27") : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button">
        <Text style={styles.back}>‹ All problems</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.heading}>{ownerView ? problem.trainer_name || "A trainer" : problemAreaLabel(problem.area)}</Text>
        <Text style={[styles.meta, { color: themeText(PROBLEM_STATUS_COLOR[problem.status]) }]}>
          {ownerView ? `${problemAreaLabel(problem.area)} · ` : ""}
          {problemWhen(problem.created_at)} · {ownerView ? PROBLEM_STATUS_LABEL[problem.status] : PROBLEM_STATUS_FOR_TRAINER[problem.status]}
        </Text>
        <Text style={[styles.body, { marginTop: 10 }]}>{problem.body}</Text>
      </View>

      {ownerView && (
        <View style={styles.card}>
          <Text style={styles.label}>Sent by</Text>
          {sender ? (
            <>
              <Text style={styles.body}>{trainerDisplayName(sender)}</Text>
              {sender.business_name ? <Text style={styles.helper}>{sender.name}</Text> : null}
              <Pressable onPress={() => Linking.openURL(`mailto:${sender.email}`)} hitSlop={6}>
                <Text style={styles.link}>✉️ {sender.email}</Text>
              </Pressable>
              {phone ? (
                <View style={styles.actions}>
                  <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} hitSlop={6}>
                    <Text style={styles.link}>📞 {phone}</Text>
                  </Pressable>
                  {whatsapp ? (
                    <Pressable onPress={() => Linking.openURL(`https://wa.me/${whatsapp}`)} hitSlop={6}>
                      <Text style={styles.link}>💬 WhatsApp</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Pressable style={styles.outline} onPress={() => onSeeClients(problem.trainer_id)} accessibilityRole="button">
                <Text style={styles.outlineText}>👥 See {trainerDisplayName(sender)}'s clients</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={themeText(BRAND_GOLD)} />
          )}
        </View>
      )}

      {ownerView && (
        <View style={styles.actions}>
          {problem.status !== "fixing" && (
            <Pressable style={styles.outline} onPress={() => setStatus("fixing")} disabled={busy}>
              <Text style={styles.outlineText}>🛠 Busy fixing</Text>
            </Pressable>
          )}
          {problem.status !== "fixed" && (
            <Pressable style={[styles.outline, { borderColor: themeBorder("#22C55E") }]} onPress={() => setStatus("fixed")} disabled={busy}>
              <Text style={[styles.outlineText, { color: themeText("#22C55E") }]}>✅ Fixed</Text>
            </Pressable>
          )}
          {problem.status !== "new" && (
            <Pressable style={[styles.outline, { borderColor: themeBorder("#334155") }]} onPress={() => setStatus("new")} disabled={busy}>
              <Text style={[styles.outlineText, { color: themeText("#94A3B8") }]}>Back to New</Text>
            </Pressable>
          )}
        </View>
      )}

      {messages === null ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 16 }} />
      ) : (
        messages.map((m) => {
          const mine = m.author_id === me?.id;
          return (
            <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={styles.body}>{m.body}</Text>
              <Text style={styles.meta}>
                {mine ? "You" : m.from_owner ? "App owner" : problem.trainer_name || "Trainer"} · {problemWhen(m.created_at)}
              </Text>
            </View>
          );
        })
      )}

      <TextInput
        style={styles.input}
        value={reply}
        onChangeText={setReply}
        placeholder={ownerView ? `Reply to ${problem.trainer_name || "the trainer"}` : "Add more or reply"}
        placeholderTextColor="#64748B"
        multiline
        maxLength={PROBLEM_MAX_LENGTH}
        textAlignVertical="top"
      />
      <Pressable style={[styles.button, !reply.trim() && { opacity: 0.5 }]} onPress={sendReply} disabled={busy || !reply.trim()}>
        {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Send</Text>}
      </Pressable>
      {!ownerView && problem.status === "fixed" ? (
        <Text style={[styles.helper, { marginTop: 8 }]}>Still not right? Send a message and it opens again.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 12, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 16, marginBottom: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  rowBody: { color: "#CBD5E1", fontSize: 14, marginTop: 2 },
  chevron: { color: BRAND_GOLD, fontSize: 18, fontWeight: "700" },
  body: { color: "#fff", fontSize: 15, lineHeight: 21 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 4 },
  back: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15, marginBottom: 12 },
  link: { color: BRAND_GOLD, fontWeight: "600", fontSize: 14, marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, alignSelf: "flex-start" },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  bubble: { borderRadius: 10, padding: 12, marginBottom: 8, maxWidth: "88%" },
  bubbleMine: { backgroundColor: "#334155", alignSelf: "flex-end" },
  bubbleTheirs: { backgroundColor: "#1E293B", alignSelf: "flex-start" },
});
