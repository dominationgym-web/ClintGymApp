import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ChatThread from "@/components/chat/ChatThread";
import ClientAvatar, { signAvatarUrls } from "@/components/ClientAvatar";
import CheckInNudgeCard from "@/components/chat/CheckInNudgeCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { chatDayLabel, chatPreview, chatTime, firstName } from "@/lib/chat";
import { trainerDisplayName } from "@/lib/trainers";
import type { TrainerStackParamList } from "@/navigation/types";
import type { TrainerChatRow } from "@/types/database";

// Trainer-client chat (0152). The client has one chat, with their coach; the
// trainer has a list of clients (Messages) and a chat with each.

/** The client's chat with their coach. */
export function ClientChatScreen() {
  const { client } = useAuth();
  const [coachName, setCoachName] = useState("your coach");
  const trainerId = client?.trainer_id;

  useEffect(() => {
    if (!trainerId) return;
    supabase
      .from("trainers")
      .select("name, business_name")
      .eq("id", trainerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCoachName(trainerDisplayName(data));
      });
  }, [trainerId]);

  if (!client || !trainerId) return null;
  return <ChatThread clientId={client.id} trainerId={trainerId} me="client" otherName={coachName} />;
}

/** The trainer's chat with one client. */
export function TrainerChatScreen() {
  const { trainer } = useAuth();
  const route = useRoute<RouteProp<TrainerStackParamList, "Chat">>();
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const { clientId, name: givenName } = route.params;
  const [name, setName] = useState(givenName ?? "");

  // Opened from a notification, which only carries the client's id.
  useEffect(() => {
    if (givenName) return;
    supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name);
        navigation.setOptions({ title: data.name });
      });
  }, [clientId, givenName, navigation]);

  if (!trainer) return null;
  return <ChatThread clientId={clientId} trainerId={trainer.id} me="trainer" otherName={firstName(name)} />;
}

/** The trainer's chat list: unread first in time order, then everyone else. */
export function TrainerMessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [rows, setRows] = useState<TrainerChatRow[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("trainer_chat_list");
    const list = data ?? [];
    setRows(list);
    setLoading(false);
    setAvatars(await signAvatarUrls(list.map((r) => r.avatar_path ?? "").filter(Boolean)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_GOLD} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(r) => r.client_id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={<CheckInNudgeCard />}
      ListEmptyComponent={<Text style={styles.empty}>Your active clients show here. Tap one to chat.</Text>}
      renderItem={({ item }) => {
        const unread = item.unread > 0;
        const when = item.last_at
          ? chatDayLabel(item.last_at) === "Today"
            ? chatTime(item.last_at)
            : chatDayLabel(item.last_at)
          : "";
        return (
          <Pressable style={styles.row} onPress={() => navigation.navigate("Chat", { clientId: item.client_id, name: item.name })}>
            <ClientAvatar name={item.name} url={item.avatar_path ? avatars[item.avatar_path] ?? null : null} size={44} />
            <View style={styles.rowMiddle}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.when, unread && styles.whenUnread]}>{when}</Text>
              </View>
              <View style={styles.rowTop}>
                <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                  {item.last_at
                    ? `${item.last_from_trainer ? "You: " : ""}${chatPreview({ kind: item.last_kind, body: item.last_body })}`
                    : "No messages yet"}
                </Text>
                {unread ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F172A" },
  list: { padding: 12 },
  empty: { color: "#94A3B8", textAlign: "center", marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  rowMiddle: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#fff", fontSize: 16, flex: 1 },
  bold: { fontWeight: "700" },
  when: { color: "#64748B", fontSize: 12 },
  whenUnread: { color: BRAND_GOLD },
  preview: { color: "#94A3B8", flex: 1 },
  previewUnread: { color: "#E2E8F0" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: BRAND_GOLD, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
});
