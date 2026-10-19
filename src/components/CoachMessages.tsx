import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { registerForCoachMessages } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import { QUICK_REPLIES } from "@/lib/clientProblems";
import type { CoachMessage } from "@/types/database";

// Messages from the trainer (0034), usually answering a red or orange flag.

/**
 * Unread messages, shown at the top of the check-in screen until the client
 * taps "Got it". Arrives live while the app is open; in the installed app a
 * phone notification also brings the client here.
 */
export function CoachMessageCard() {
  const { client } = useAuth();
  const [unread, setUnread] = useState<CoachMessage[]>([]);

  const load = useCallback(async () => {
    if (!client) return;
    const { data } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("client_id", client.id)
      .is("read_at", null)
      .order("created_at", { ascending: true });
    setUnread(data ?? []);
  }, [client?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!client) return;
    registerForCoachMessages();
    const channel = supabase
      .channel(`coach-messages-${client.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coach_messages", filter: `client_id=eq.${client.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [client?.id, load]);

  const markRead = async () => {
    setUnread([]);
    const { error } = await supabase.rpc("mark_coach_messages_read");
    if (error) load();
  };

  if (unread.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>💬 {unread.length === 1 ? "Message from your coach" : "Messages from your coach"}</Text>
      {unread.map((m) => (
        <View key={m.id} style={styles.message}>
          {m.video_id ? <Text style={styles.time}>🎥 Feedback on your form video</Text> : null}
          <Text style={styles.text}>{m.body}</Text>
          <Text style={styles.time}>{new Date(m.created_at).toLocaleString()}</Text>
          {m.problem_id && <ProblemReplyBox problemId={m.problem_id} />}
        </View>
      ))}
      <Pressable style={styles.button} onPress={markRead}>
        <Text style={styles.buttonText}>Got it</Text>
      </Pressable>
    </View>
  );
}

/**
 * Under the app's next-day check-in about a problem (0075): the client answers
 * in their own words, or taps a quick answer, and their coach is told.
 */
function ProblemReplyBox({ problemId }: { problemId: string }) {
  const [sentReply, setSentReply] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase
      .from("client_problems")
      .select("client_reply")
      .eq("id", problemId)
      .maybeSingle()
      .then(({ data }) => setSentReply(data?.client_reply ?? null));
  }, [problemId]);

  if (sentReply === undefined) return null;
  if (sentReply) return <Text style={styles.sent}>✓ You replied: {sentReply}</Text>;

  const send = async () => {
    const reply = text.trim();
    if (!reply) return;
    setSending(true);
    const { error } = await supabase.rpc("reply_to_client_problem", { p_problem: problemId, p_reply: reply });
    setSending(false);
    if (error) {
      Alert.alert("Couldn't send", error.message);
      return;
    }
    setSentReply(reply);
  };

  return (
    <View style={styles.replyBox}>
      <View style={styles.chips}>
        {QUICK_REPLIES.map((q) => (
          <Pressable key={q} style={[styles.chip, text === q && styles.chipOn]} onPress={() => setText(q)}>
            <Text style={[styles.chipText, text === q && styles.chipTextOn]}>{q}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        multiline
        maxLength={1000}
        placeholder="Tell your coach how it's going, and anything that needs adjusting"
        placeholderTextColor="#64748B"
        value={text}
        onChangeText={setText}
      />
      <Pressable style={[styles.button, !text.trim() && styles.disabled]} onPress={send} disabled={!text.trim() || sending}>
        {sending ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Reply</Text>}
      </Pressable>
    </View>
  );
}

/** Every recent message, read or not, for the client's profile page. */
// `bare` drops the heading, for use inside a tap-to-open heading.
export function CoachMessageHistory({ bare = false }: { bare?: boolean }) {
  const { client } = useAuth();
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!client) return;
      supabase
        .from("coach_messages")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => setMessages(data ?? []));
    }, [client?.id])
  );

  if (messages.length === 0) return bare ? <Text style={styles.time}>No messages yet.</Text> : null;
  return (
    <View>
      {!bare && <Text style={styles.heading}>Messages from your coach</Text>}
      {messages.map((m) => (
        <View key={m.id} style={styles.historyRow}>
          {m.video_id ? <Text style={styles.time}>🎥 Feedback on your form video</Text> : null}
          <Text style={styles.text}>{m.body}</Text>
          <Text style={styles.time}>{new Date(m.created_at).toLocaleString()}</Text>
          {m.problem_id && <ProblemReplyBox problemId={m.problem_id} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 16 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 6 },
  message: { marginBottom: 8 },
  text: { color: "#E2E8F0" },
  time: { color: "#64748B", fontSize: 11, marginTop: 2 },
  button: { alignSelf: "flex-start", backgroundColor: BRAND_GOLD, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 14 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  replyBox: { marginTop: 8, gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#475569", borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#E2E8F0", fontSize: 12 },
  chipTextOn: { color: "#0F172A", fontWeight: "700" },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 10, minHeight: 60, textAlignVertical: "top" },
  disabled: { opacity: 0.5 },
  sent: { color: "#86EFAC", fontSize: 13, marginTop: 6 },
  heading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 6 },
  historyRow: { backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginBottom: 6 },
});
