import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import {
  SUGGESTION_MAX_LENGTH,
  SUGGESTION_STATUS_FOR_AUTHOR,
  SUGGESTION_STATUS_LABEL,
  suggestionByline,
  suggestionsWithStatus,
} from "@/lib/suggestions";
import type { Suggestion, SuggestionStatus } from "@/types/database";

const INBOX_TABS: SuggestionStatus[] = ["new", "good_idea", "not_now"];

// Suggestion box (0046), for clients and trainers. Everyone can send ideas and
// see what happened to their own. The app owner also gets the inbox of every
// suggestion and sorts each into "Good idea" or "Not for now".
export default function SuggestionBoxScreen() {
  const { trainer } = useAuth();
  const isOwner = !!trainer?.is_owner;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [list, setList] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SuggestionStatus>("new");

  const load = useCallback(async () => {
    const { data } = await supabase.from("suggestions").select("*").order("created_at", { ascending: false });
    setList(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { data, error } = await supabase.from("suggestions").insert({ body }).select().single();
    setSending(false);
    if (error || !data) {
      Alert.alert("Couldn't send", error?.message ?? "Please try again.");
      return;
    }
    setText("");
    setList((prev) => [data, ...prev]);
    Alert.alert("Thank you! 🙌", "Your suggestion has been sent.");
  };

  const setStatus = async (s: Suggestion, status: SuggestionStatus) => {
    setList((prev) => prev.map((x) => (x.id === s.id ? { ...x, status } : x)));
    const { error } = await supabase.from("suggestions").update({ status }).eq("id", s.id);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      load();
    }
  };

  const shown = isOwner ? suggestionsWithStatus(list, tab) : list;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.heading}>Got an idea? 💡</Text>
        <Text style={styles.helper}>Tell us anything that would make the app better for you. Every suggestion gets read.</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="e.g. I'd love a dark/light mode switch"
          placeholderTextColor="#64748B"
          multiline
          maxLength={SUGGESTION_MAX_LENGTH}
          textAlignVertical="top"
        />
        <Pressable style={[styles.button, !text.trim() && { opacity: 0.5 }]} onPress={send} disabled={sending || !text.trim()}>
          {sending ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Send suggestion</Text>}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{isOwner ? "Suggestion inbox" : "Your suggestions"}</Text>
      {isOwner && (
        <View style={styles.tabs}>
          {INBOX_TABS.map((t) => (
            <Pressable key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {SUGGESTION_STATUS_LABEL[t]} ({suggestionsWithStatus(list, t).length})
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 16 }} />
      ) : shown.length === 0 ? (
        <Text style={styles.helper}>{isOwner ? "Nothing here." : "You haven't sent any suggestions yet."}</Text>
      ) : (
        shown.map((s) => (
          <View key={s.id} style={styles.item}>
            <Text style={styles.body}>{s.body}</Text>
            <Text style={styles.meta}>{isOwner ? suggestionByline(s) : SUGGESTION_STATUS_FOR_AUTHOR[s.status]}</Text>
            {isOwner && (
              <View style={styles.actions}>
                {s.status !== "good_idea" && (
                  <Pressable style={[styles.action, styles.actionGood]} onPress={() => setStatus(s, "good_idea")}>
                    <Text style={styles.actionGoodText}>👍 Good idea</Text>
                  </Pressable>
                )}
                {s.status !== "not_now" && (
                  <Pressable style={styles.action} onPress={() => setStatus(s, "not_now")}>
                    <Text style={styles.actionText}>Not for now</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16 },
  heading: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: "#0F172A",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 110,
    marginTop: 12,
  },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 28, marginBottom: 10 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tab: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabOn: { backgroundColor: BRAND_GOLD },
  tabText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  tabTextOn: { color: "#0F172A" },
  item: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 10 },
  body: { color: "#fff", fontSize: 15, lineHeight: 21 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  action: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  actionText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  actionGood: { borderColor: BRAND_GOLD },
  actionGoodText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
});
