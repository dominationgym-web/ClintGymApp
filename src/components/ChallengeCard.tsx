import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import {
  challengeProgress,
  daysLeftInMonth,
  monthEnd,
  monthName,
  monthStart,
  progressLine,
  yesterdayInMonth,
} from "@/lib/challenges";
import type { TrainerChallenge } from "@/types/database";

// The client's side of this month's challenge (0153): what to do, a tick for
// today (and yesterday, if they forgot), and how close they are to winning.
// Shows nothing when their coach hasn't switched one on.
export default function ChallengeCard({ clientId, trainerId }: { clientId: string; trainerId: string }) {
  const [challenge, setChallenge] = useState<TrainerChallenge | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayIso();

  const load = useCallback(async () => {
    const month = monthStart(todayIso());
    const { data } = await supabase
      .from("trainer_challenges")
      .select("*")
      .eq("trainer_id", trainerId)
      .eq("month", month)
      .maybeSingle();
    setChallenge(data);
    if (!data) return;
    const { data: ticks } = await supabase
      .from("challenge_days")
      .select("day")
      .eq("challenge_id", data.id)
      .eq("client_id", clientId)
      .lte("day", monthEnd(month));
    setDays((ticks ?? []).map((t) => t.day));
  }, [clientId, trainerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!challenge) return null;

  const progress = challengeProgress(challenge, days, today);
  const yesterday = yesterdayInMonth(today);
  const left = daysLeftInMonth(today);

  const toggle = async (day: string) => {
    const ticked = days.includes(day);
    setBusy(true);
    // Shown straight away; put back if the save fails.
    setDays((prev) => (ticked ? prev.filter((d) => d !== day) : [...prev, day]));
    const { error } = ticked
      ? await supabase.from("challenge_days").delete().eq("challenge_id", challenge.id).eq("client_id", clientId).eq("day", day)
      : await supabase.from("challenge_days").insert({ challenge_id: challenge.id, day });
    setBusy(false);
    if (error) {
      setDays((prev) => (ticked ? [...prev, day] : prev.filter((d) => d !== day)));
      Alert.alert("Couldn't save", error.message);
      return;
    }
    if (!ticked && days.length + 1 === challenge.target_days) {
      Alert.alert("🏆 You did it!", `${challenge.target_days} days of ${challenge.title}. Your coach has been told. Keep it going to the end of the month!`);
    }
  };

  return (
    <View style={[styles.card, progress.won && styles.cardWon]}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.emoji}>{challenge.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{monthName(challenge.month)} challenge</Text>
          <Text style={styles.title}>{challenge.title}</Text>
        </View>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      <Text style={styles.task}>{challenge.daily_task}</Text>
      {open ? (
        <>
          {challenge.summary ? <Text style={styles.summary}>{challenge.summary}</Text> : null}
          <Text style={styles.summary}>To win: do it on {challenge.target_days} days this month.</Text>
        </>
      ) : null}

      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min(100, (progress.done / progress.target) * 100)}%` },
            progress.won && { backgroundColor: "#22C55E" },
          ]}
        />
      </View>
      <Text style={[styles.progress, progress.won && { color: "#22C55E" }]}>
        {progressLine(progress)}
        {progress.won ? "" : ` · ${left} day${left === 1 ? "" : "s"} left`}
      </Text>
      {!progress.won && !progress.canStillWin ? (
        <Text style={styles.summary}>Not enough days left to reach {progress.target}, but every day still counts. Keep going!</Text>
      ) : null}

      <Pressable
        style={[styles.button, progress.doneToday && styles.buttonDone]}
        onPress={() => toggle(today)}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={progress.doneToday ? BRAND_GOLD : "#0F172A"} />
        ) : (
          <Text style={[styles.buttonText, progress.doneToday && { color: BRAND_GOLD }]}>
            {progress.doneToday ? "✓ Done today (tap to undo)" : "I did it today"}
          </Text>
        )}
      </Pressable>
      {yesterday && !days.includes(yesterday) ? (
        <Pressable onPress={() => toggle(yesterday)} disabled={busy} hitSlop={6}>
          <Text style={styles.link}>Forgot to tick yesterday? Tick it here</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: BRAND_GOLD },
  cardWon: { borderColor: "#22C55E" },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 28 },
  kicker: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  title: { color: "#fff", fontSize: 17, fontWeight: "700" },
  chevron: { color: "#94A3B8", fontSize: 18 },
  task: { color: "#E2E8F0", fontSize: 15, marginTop: 10, lineHeight: 21 },
  summary: { color: "#94A3B8", fontSize: 14, marginTop: 8, lineHeight: 20 },
  barTrack: { height: 8, backgroundColor: "#0F172A", borderRadius: 4, marginTop: 12, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: BRAND_GOLD, borderRadius: 4 },
  progress: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 6 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 12 },
  buttonDone: { backgroundColor: "transparent", borderWidth: 1, borderColor: BRAND_GOLD },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  link: { color: "#94A3B8", fontSize: 13, textDecorationLine: "underline", marginTop: 10, textAlign: "center" },
});
