import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import {
  CHALLENGE_KINDS,
  challengeChoices,
  daysLeftInMonth,
  monthName,
  monthStart,
  nextMonthStart,
  rankClients,
  type ChallengeIdea,
  type ChallengeKind,
  type ClientChallengeRow,
} from "@/lib/challenges";
import type { TrainerStackParamList } from "@/navigation/types";
import type { ChallengeLibraryItem, TrainerChallenge } from "@/types/database";

type MonthTab = "this" | "next";
type KindFilter = ChallengeKind | "all" | "shared";

// Monthly challenges (0153, GRIZZ 2026-10-25). The trainer picks one challenge
// a month for all their clients, from the 20 built in plus any the app owner
// shared, and sees who's ticked off the most days. Next month's can be picked
// ahead; clients hear about it on the 1st.
export default function ChallengesScreen() {
  const { trainer } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const today = todayIso();
  const months: Record<MonthTab, string> = { this: monthStart(today), next: nextMonthStart(today) };
  const tabs: ScreenTab<MonthTab>[] = [
    { key: "this", label: monthName(months.this), icon: "trophy" },
    { key: "next", label: monthName(months.next), icon: "calendar" },
  ];
  const [tab, setTab] = useState<MonthTab>("this");
  const [challenges, setChallenges] = useState<TrainerChallenge[]>([]);
  const [shared, setShared] = useState<ChallengeIdea[]>([]);
  const [rows, setRows] = useState<ClientChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<ChallengeIdea | null>(null);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!trainer) return;
    const [{ data: mine, error }, { data: lib }] = await Promise.all([
      supabase.from("trainer_challenges").select("*").eq("trainer_id", trainer.id).gte("month", monthStart(todayIso())),
      supabase.from("challenge_library").select("*").order("created_at", { ascending: false }),
    ]);
    if (error) Alert.alert("Couldn't load challenges", error.message);
    const list = mine ?? [];
    setChallenges(list);
    setShared(
      (lib ?? []).map((c: ChallengeLibraryItem) => ({
        key: c.id,
        emoji: c.emoji,
        title: c.title,
        badge: c.shared_at ? "⭐ From the app team" : "Only you see this until you share it (Profile > Challenges)",
        daily_task: c.daily_task,
        summary: c.summary,
        target_days: c.target_days,
      }))
    );
    const current = list.find((c) => c.month === monthStart(todayIso()));
    if (current) {
      const [{ data: clients }, { data: days }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .eq("trainer_id", trainer.id)
          .neq("id", trainer.id)
          .is("archived_at", null)
          .neq("access_status", "expired"),
        supabase.from("challenge_days").select("client_id, day").eq("challenge_id", current.id),
      ]);
      setRows(rankClients(clients ?? [], days ?? [], current.target_days));
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [trainer]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const month = months[tab];
  const challenge = challenges.find((c) => c.month === month) ?? null;

  const switchTab = (t: MonthTab) => {
    setTab(t);
    setPicking(false);
    setPreview(null);
  };

  const use = async (idea: ChallengeIdea) => {
    if (!trainer) return;
    setBusy(true);
    // Swapping a challenge starts it fresh: the old one and its ticks go.
    if (challenge) {
      const { error: removeError } = await supabase.from("trainer_challenges").delete().eq("id", challenge.id);
      if (removeError) {
        setBusy(false);
        Alert.alert("Couldn't change it", removeError.message);
        return;
      }
    }
    const { data, error } = await supabase
      .from("trainer_challenges")
      .insert({
        month,
        source: idea.key,
        emoji: idea.emoji,
        title: idea.title,
        daily_task: idea.daily_task,
        summary: idea.summary,
        target_days: idea.target_days,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      load();
      return;
    }
    setPicking(false);
    setPreview(null);
    await load();
    Alert.alert(
      `${data.emoji} ${data.title} is on`,
      tab === "this"
        ? "Your clients have been told and can tick it off on their Habits tab. You'll get a notification each time one of them finishes it."
        : `Your clients will be told on 1 ${monthName(month)}.`
    );
  };

  const confirmUse = (idea: ChallengeIdea) => {
    const ticked = tab === "this" && rows.some((r) => r.done > 0);
    if (!challenge) return use(idea);
    Alert.alert(
      `Change ${monthName(month)}'s challenge?`,
      ticked
        ? `${challenge.title} goes, and the days your clients already ticked off go with it. ${idea.title} starts fresh.`
        : `${challenge.title} is swapped for ${idea.title}.`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "Change", style: "destructive", onPress: () => use(idea) },
      ]
    );
  };

  const remove = () => {
    if (!challenge) return;
    Alert.alert(`Stop ${monthName(month)}'s challenge?`, "Your clients won't see it any more, and the days they ticked off go.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Stop it",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("trainer_challenges").delete().eq("id", challenge.id);
          if (error) Alert.alert("Couldn't stop it", error.message);
          load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={BRAND_GOLD} />
      </View>
    );
  }

  const choices = challengeChoices(shared);
  const sharedKeys = new Set(shared.map((s) => s.key));
  const shown = choices.filter((c) =>
    filter === "all" ? true : filter === "shared" ? sharedKeys.has(c.key) : c.kind === filter
  );
  const filters: { key: KindFilter; label: string }[] = [
    { key: "all", label: "All" },
    ...(shared.length > 0 ? [{ key: "shared" as const, label: "⭐ From the app team" }] : []),
    ...CHALLENGE_KINDS,
  ];

  return (
    <View style={styles.container}>
      <ScreenTabBar tabs={tabs} current={tab} onChange={switchTab} position="top" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GOLD} />}
      >
        {preview ? (
          <>
            <Pressable onPress={() => setPreview(null)} hitSlop={8}>
              <Text style={styles.back}>‹ All challenges</Text>
            </Pressable>
            <ChallengeDetails idea={preview} />
            <Pressable style={styles.button} onPress={() => confirmUse(preview)} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.buttonText}>Use for {monthName(month)}</Text>
              )}
            </Pressable>
            <Text style={[styles.helper, { marginTop: 8 }]}>
              {tab === "this"
                ? "All your active clients get a notification and see it on their Habits tab."
                : `Your clients are told on 1 ${monthName(month)}.`}
            </Text>
          </>
        ) : challenge && !picking ? (
          <>
            <ChallengeDetails idea={{ ...challenge, key: challenge.source }} />
            {tab === "this" ? (
              <>
                <Text style={styles.sectionTitle}>How your clients are doing</Text>
                <Text style={styles.helper}>
                  {daysLeftInMonth(today)} day{daysLeftInMonth(today) === 1 ? "" : "s"} left. A quick personal well done goes a
                  long way. Tap a client to open them.
                </Text>
                {rows.length === 0 ? (
                  <Text style={[styles.helper, { marginTop: 10 }]}>No active clients yet.</Text>
                ) : (
                  rows.map((r) => (
                    <Pressable
                      key={r.id}
                      style={styles.clientRow}
                      onPress={() => navigation.navigate("ClientDetail", { clientId: r.id })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clientName}>
                          {r.won ? "🏆 " : ""}
                          {r.name}
                        </Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${Math.min(100, (r.done / challenge.target_days) * 100)}%` },
                              r.won && { backgroundColor: "#22C55E" },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={[styles.clientDays, r.won && { color: "#22C55E" }]}>
                        {r.done}/{challenge.target_days}
                      </Text>
                    </Pressable>
                  ))
                )}
              </>
            ) : (
              <Text style={[styles.helper, { marginTop: 10 }]}>Your clients are told about it on 1 {monthName(month)}.</Text>
            )}
            <View style={styles.actions}>
              <Pressable style={styles.outline} onPress={() => setPicking(true)}>
                <Text style={styles.outlineText}>Change challenge</Text>
              </Pressable>
              <Pressable style={[styles.outline, { borderColor: "#334155" }]} onPress={remove}>
                <Text style={[styles.outlineText, { color: "#94A3B8" }]}>Stop it</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {picking ? (
              <Pressable onPress={() => setPicking(false)} hitSlop={8}>
                <Text style={styles.back}>‹ Back to {challenge?.title ?? "your challenge"}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.heading}>Pick {monthName(month)}'s challenge 🏆</Text>
            <Text style={styles.helper}>
              One challenge for all your clients. They tick it off each day they do it on their Habits tab, and win by reaching
              the target days. Tap one to see how it works.
            </Text>
            <View style={styles.chips}>
              {filters.map((f) => (
                <Pressable key={f.key} style={[styles.chip, filter === f.key && styles.chipOn]} onPress={() => setFilter(f.key)}>
                  <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
            {shown.map((c) => (
              <Pressable key={c.key} style={styles.pickRow} onPress={() => setPreview(c)}>
                <Text style={styles.pickEmoji}>{c.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickTitle}>
                    {sharedKeys.has(c.key) ? "⭐ " : ""}
                    {c.title}
                  </Text>
                  <Text style={styles.pickTask} numberOfLines={1}>
                    {c.daily_task} · {c.target_days} days
                  </Text>
                </View>
                <Text style={styles.chevron}>▸</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ChallengeDetails({ idea }: { idea: ChallengeIdea }) {
  return (
    <View style={styles.card}>
      <Text style={styles.bigEmoji}>{idea.emoji}</Text>
      <Text style={styles.heading}>{idea.title}</Text>
      {idea.badge ? <Text style={styles.helper}>{idea.badge}</Text> : null}
      <Text style={styles.label}>Each day</Text>
      <Text style={styles.body}>{idea.daily_task}</Text>
      <Text style={styles.label}>To win</Text>
      <Text style={styles.body}>Do it on {idea.target_days} days in the month.</Text>
      {idea.summary ? (
        <>
          <Text style={styles.label}>How it works</Text>
          <Text style={styles.body}>{idea.summary}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  bigEmoji: { fontSize: 36, marginBottom: 4 },
  heading: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 12, marginBottom: 4 },
  body: { color: "#fff", fontSize: 15, lineHeight: 21 },
  back: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15, marginBottom: 12 },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  pickEmoji: { fontSize: 24 },
  pickTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pickTask: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  chevron: { color: BRAND_GOLD, fontSize: 18, fontWeight: "700" },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  clientName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  clientDays: { color: BRAND_GOLD, fontSize: 15, fontWeight: "800" },
  barTrack: { height: 6, backgroundColor: "#0F172A", borderRadius: 3, marginTop: 6, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: BRAND_GOLD, borderRadius: 3 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
});
