import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import {
  BUILT_IN_CHALLENGES,
  CHALLENGE_SUMMARY_MAX,
  CHALLENGE_TARGET_MAX,
  CHALLENGE_TASK_MAX,
  CHALLENGE_TITLE_MAX,
  challengeFormProblem,
} from "@/lib/challenges";
import { problemWhen } from "@/lib/trainerProblems";
import type { TrainerStackParamList } from "@/navigation/types";
import type { ChallengeLibraryItem } from "@/types/database";
import { themeBorder, themeText, themedStyles } from "@/lib/theme";

type Form = { emoji: string; title: string; daily_task: string; summary: string; target: string };
const EMPTY: Form = { emoji: "🏆", title: "", daily_task: "", summary: "", target: "20" };

// The app owner's challenges (Profile > Challenges, 0153, GRIZZ 2026-10-25):
// add a challenge, then share it with every trainer, who get a notification
// and can use it for their clients any month they like.
export default function OwnerChallenges() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [list, setList] = useState<ChallengeLibraryItem[] | null>(null);
  // null: the list; "new": the add form; an id: editing that one.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("challenge_library").select("*").order("created_at", { ascending: false });
    if (error) Alert.alert("Couldn't load challenges", error.message);
    setList(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (c: ChallengeLibraryItem | null) => {
    setForm(
      c
        ? { emoji: c.emoji, title: c.title, daily_task: c.daily_task, summary: c.summary, target: String(c.target_days) }
        : EMPTY
    );
    setEditing(c ? c.id : "new");
  };

  const save = async () => {
    const values = {
      emoji: form.emoji.trim() || "🏆",
      title: form.title.trim(),
      daily_task: form.daily_task.trim(),
      summary: form.summary.trim(),
      target_days: Number(form.target),
    };
    const problem = challengeFormProblem(values);
    if (problem) {
      Alert.alert("Almost there", problem);
      return;
    }
    setBusy(true);
    const { error } =
      editing === "new"
        ? await supabase.from("challenge_library").insert(values)
        : await supabase.from("challenge_library").update(values).eq("id", editing ?? "");
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    setEditing(null);
    load();
  };

  const share = (c: ChallengeLibraryItem) =>
    Alert.alert(`Share ${c.title}?`, "Every trainer gets a notification and can use it for their clients any month they like.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Share",
        onPress: async () => {
          const { error } = await supabase.rpc("share_challenge", { p_id: c.id });
          if (error) Alert.alert("Couldn't share", error.message);
          else Alert.alert("📣 Shared", "Your trainers have been told.");
          load();
        },
      },
    ]);

  const remove = (c: ChallengeLibraryItem) =>
    Alert.alert(
      `Remove ${c.title}?`,
      c.shared_at
        ? "Trainers can't pick it any more. Trainers already using it this month keep it."
        : "It's only on your list, so nobody else is affected.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("challenge_library").delete().eq("id", c.id);
            if (error) Alert.alert("Couldn't remove", error.message);
            load();
          },
        },
      ]
    );

  if (editing) {
    return (
      <>
        <Pressable onPress={() => setEditing(null)} hitSlop={8}>
          <Text style={styles.back}>‹ Your challenges</Text>
        </Pressable>
        <Text style={styles.heading}>{editing === "new" ? "Add a challenge" : "Change challenge"}</Text>
        <Text style={styles.label}>Emoji</Text>
        <TextInput style={[styles.input, { width: 80 }]} value={form.emoji} onChangeText={(emoji) => setForm({ ...form, emoji })} maxLength={16} />
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(title) => setForm({ ...form, title })}
          placeholder="e.g. Stairs, not the lift"
          placeholderTextColor="#64748B"
          maxLength={CHALLENGE_TITLE_MAX}
        />
        <Text style={styles.label}>What clients tick off each day</Text>
        <TextInput
          style={styles.input}
          value={form.daily_task}
          onChangeText={(daily_task) => setForm({ ...form, daily_task })}
          placeholder="e.g. Take the stairs every time today"
          placeholderTextColor="#64748B"
          maxLength={CHALLENGE_TASK_MAX}
        />
        <Text style={styles.label}>How it works and why it helps</Text>
        <TextInput
          style={[styles.input, { minHeight: 90 }]}
          value={form.summary}
          onChangeText={(summary) => setForm({ ...form, summary })}
          placeholder="A few short lines clients read when they open the challenge"
          placeholderTextColor="#64748B"
          multiline
          textAlignVertical="top"
          maxLength={CHALLENGE_SUMMARY_MAX}
        />
        <Text style={styles.label}>Days to win (1 to {CHALLENGE_TARGET_MAX})</Text>
        <TextInput
          style={[styles.input, { width: 80 }]}
          value={form.target}
          onChangeText={(target) => setForm({ ...form, target: target.replace(/[^\d]/g, "") })}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Pressable style={styles.button} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Save</Text>}
        </Pressable>
        <Text style={[styles.hint, { marginTop: 8 }]}>Saving doesn't share it. You share it from your list when it's ready.</Text>
      </>
    );
  }

  return (
    <>
      <Text style={styles.heading}>Challenges for all trainers 🏆</Text>
      <Text style={styles.hint}>
        Every trainer already has {BUILT_IN_CHALLENGES.length} ready-made monthly challenges. Add your own here, then tap Share
        with all trainers. They get a notification and can use it for their clients if they wish.
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => startEdit(null)}>
          <Text style={styles.buttonText}>+ Add a challenge</Text>
        </Pressable>
        <Pressable style={styles.outline} onPress={() => navigation.navigate("Challenges")}>
          <Text style={styles.outlineText}>Your clients' challenge ›</Text>
        </Pressable>
      </View>

      {list === null ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 16 }} />
      ) : list.length === 0 ? (
        <Text style={[styles.hint, { marginTop: 16 }]}>You haven't added any challenges yet.</Text>
      ) : (
        list.map((c) => (
          <View key={c.id} style={styles.row}>
            <Text style={styles.rowTitle}>
              {c.emoji} {c.title}
            </Text>
            <Text style={styles.rowTask}>
              {c.daily_task} · {c.target_days} days
            </Text>
            <Text style={[styles.status, { color: themeText(c.shared_at ? "#22C55E" : "#F59E0B") }]}>
              {c.shared_at ? `📣 Shared with all trainers, ${problemWhen(c.shared_at)}` : "Not shared yet"}
            </Text>
            <View style={styles.actions}>
              {!c.shared_at && (
                <Pressable style={styles.outline} onPress={() => share(c)}>
                  <Text style={styles.outlineText}>📣 Share with all trainers</Text>
                </Pressable>
              )}
              <Pressable style={[styles.outline, { borderColor: themeBorder("#334155") }]} onPress={() => startEdit(c)}>
                <Text style={[styles.outlineText, { color: themeText("#CBD5E1") }]}>Change</Text>
              </Pressable>
              <Pressable style={[styles.outline, { borderColor: themeBorder("#334155") }]} onPress={() => remove(c)}>
                <Text style={[styles.outlineText, { color: themeText("#94A3B8") }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </>
  );
}

const styles = themedStyles({
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 6 },
  hint: { color: "#94A3B8", fontSize: 13, lineHeight: 19 },
  back: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15, marginBottom: 12 },
  label: { color: "#94A3B8", fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, fontSize: 15 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 12 },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  rowTask: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  status: { fontSize: 12, fontWeight: "600", marginTop: 6 },
});
