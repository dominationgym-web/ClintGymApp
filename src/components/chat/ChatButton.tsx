import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";

// The chat bubble in the header, next to search (0152), with a gold count of
// unread messages. A client goes to their chat with their coach; a trainer to
// their Messages list.
export default function ChatButton() {
  const { role, client, trainer } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<{ Chat: undefined; Messages: undefined }>>();
  const [unread, setUnread] = useState(0);
  const me = role === "trainer" ? trainer?.id : client?.id;

  const count = useCallback(async () => {
    if (!me) return;
    let query = supabase.from("chat_messages").select("id", { count: "exact", head: true }).is("read_at", null);
    query = role === "trainer" ? query.eq("trainer_id", me).eq("from_trainer", false) : query.eq("client_id", me).eq("from_trainer", true);
    const { count: n } = await query;
    setUnread(n ?? 0);
  }, [me, role]);

  useEffect(() => {
    count();
    return navigation.addListener("focus", count);
  }, [navigation, count]);

  // Live: a new message adds to the count, opening the chat clears it.
  useEffect(() => {
    if (!me) return;
    const column = role === "trainer" ? "trainer_id" : "client_id";
    const channel = supabase
      .channel(`chat-count-${me}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `${column}=eq.${me}` }, () => count())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, role, count]);

  if (!me) return null;
  return (
    <Pressable
      onPress={() => navigation.navigate(role === "trainer" ? "Messages" : "Chat")}
      hitSlop={10}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Chat, ${unread} unread` : "Chat"}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={23} color="#fff" />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginRight: 16, paddingVertical: 2 },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND_GOLD,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#0F172A", fontSize: 10, fontWeight: "800" },
});
