import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { registerForCoachMessages } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
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
          <Text style={styles.text}>{m.body}</Text>
          <Text style={styles.time}>{new Date(m.created_at).toLocaleString()}</Text>
        </View>
      ))}
      <Pressable style={styles.button} onPress={markRead}>
        <Text style={styles.buttonText}>Got it</Text>
      </Pressable>
    </View>
  );
}

/** Every recent message, read or not, for the client's profile page. */
export function CoachMessageHistory() {
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

  if (messages.length === 0) return null;
  return (
    <View>
      <Text style={styles.heading}>Messages from your coach</Text>
      {messages.map((m) => (
        <View key={m.id} style={styles.historyRow}>
          <Text style={styles.text}>{m.body}</Text>
          <Text style={styles.time}>{new Date(m.created_at).toLocaleString()}</Text>
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
  heading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 6 },
  historyRow: { backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginBottom: 6 },
});
