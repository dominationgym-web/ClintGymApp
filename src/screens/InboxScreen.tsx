import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import Pressable from "@/components/Pressable";
import { ScrollView } from "@/components/ScrollView";
import FoldSection from "@/components/FoldSection";
import { ProblemReplyBox } from "@/components/CoachMessages";
import { useAuth } from "@/context/AuthContext";
import { useStepBack } from "@/hooks/useStepBack";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { headingFont } from "@/lib/fonts";
import { notificationRoute } from "@/lib/notificationRoutes";
import { whatsappLink } from "@/lib/videoCheckins";
import { openRoute } from "@/navigation/openNotificationRoute";
import { navigationRef } from "@/navigation/navigationRef";
import {
  inboxTitle,
  isCoachMessage,
  loadInbox,
  markInboxRead,
  onInboxChanged,
  splitInbox,
  timeAgo,
  type InboxItem,
} from "@/lib/inbox";
import type { CoachMessage } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// The 🔔 inbox (0232, GRIZZ 2026-11-21: "messages get lost and can't be
// found"). Everything the app has told you, newest first: new ones on top, the
// rest behind "Earlier". Tap one to go straight to what it's about. A message
// from the coach opens on its own page, in full, with Reply on WhatsApp.
export default function InboxScreen() {
  const { session, role, client } = useAuth();
  const me = session?.user?.id;
  const route = useRoute<RouteProp<{ Inbox: { messageId?: string } | undefined }, "Inbox">>();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The coach message open on its own page.
  const [openMessage, setOpenMessage] = useState<{ item: InboxItem | null; messageId: string } | null>(null);
  useStepBack(!!openMessage, () => setOpenMessage(null));

  const load = useCallback(async () => {
    if (!me) return;
    setItems(await loadInbox(me));
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => onInboxChanged(() => load()), [load]);

  // Arriving from a tapped coach-message notification: open that message.
  const askedFor = route.params?.messageId;
  useEffect(() => {
    if (!askedFor || items === null) return;
    const item = items.find((i) => i.data?.messageId === askedFor) ?? null;
    setOpenMessage({ item, messageId: askedFor });
    if (item && !item.read_at) markInboxRead(item.id).catch(() => undefined);
    navigationRef.setParams({ messageId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askedFor, items === null]);

  const markLocal = (id: string) =>
    setItems((prev) => prev?.map((i) => (i.id === id && !i.read_at ? { ...i, read_at: new Date().toISOString() } : i)) ?? prev);

  const tap = (item: InboxItem) => {
    if (!item.read_at) {
      markLocal(item.id);
      markInboxRead(item.id).catch(() => undefined);
    }
    if (isCoachMessage(item)) {
      const messageId = typeof item.data.messageId === "string" ? item.data.messageId : "";
      setOpenMessage({ item, messageId });
      return;
    }
    const where = notificationRoute(item.data, role === "trainer" || role === "client" ? role : null);
    if (where) openRoute(where);
    else setExpanded(expanded === item.id ? null : item.id);
  };

  const markAll = () => {
    setItems((prev) => prev?.map((i) => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })) ?? prev);
    markInboxRead().catch(() => undefined);
  };

  if (openMessage) {
    return <CoachMessagePage item={openMessage.item} messageId={openMessage.messageId} trainerId={client?.trainer_id} onBack={() => setOpenMessage(null)} />;
  }

  if (items === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={themeText(BRAND_GOLD)} />
      </View>
    );
  }

  const { fresh, earlier } = splitInbox(items);
  const row = (item: InboxItem) => <InboxRow key={item.id} item={item} expanded={expanded === item.id} onPress={() => tap(item)} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>
            {role === "client"
              ? "Messages from your coach and the app's notifications will wait here, so you can always find them again."
              : "Your clients' alerts, replies and the app's notifications will wait here, so you can always find them again."}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Text style={styles.heading}>{fresh.length ? `New (${fresh.length})` : "You're all caught up ✓"}</Text>
            {fresh.length > 1 ? (
              <Pressable onPress={markAll} hitSlop={8} accessibilityRole="button">
                <Text style={styles.markAll}>Mark all as read</Text>
              </Pressable>
            ) : null}
          </View>
          {fresh.map(row)}
          {earlier.length > 0 ? (
            // Opened already when nothing is new, so there's no extra tap.
            fresh.length === 0 ? (
              <>
                <Text style={[styles.heading, styles.earlierHeading]}>Earlier</Text>
                {earlier.map(row)}
              </>
            ) : (
              <View style={styles.earlierFold}>
                <FoldSection icon="🕒" title={`Earlier (${earlier.length})`} open={earlierOpen} onToggle={() => setEarlierOpen(!earlierOpen)}>
                  {earlier.map(row)}
                </FoldSection>
              </View>
            )
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function InboxRow({ item, expanded, onPress }: { item: InboxItem; expanded: boolean; onPress: () => void }) {
  const unread = !item.read_at;
  const { icon, title } = inboxTitle(item);
  return (
    <Pressable
      style={[styles.row, unread && styles.rowUnread]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "New. " : ""}${item.title}. ${item.body}`}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={expanded ? undefined : 2}>
          {title}
        </Text>
        {item.body ? (
          <Text style={styles.rowBody} numberOfLines={expanded ? undefined : 2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
      </View>
      {unread ? <View style={styles.dot} /> : <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

// One message from the coach, in full: what it's about, the next-day problem
// check's reply buttons, and Reply on WhatsApp (chat lives on WhatsApp,
// GRIZZ 2026-10-25).
function CoachMessagePage({
  item,
  messageId,
  trainerId,
  onBack,
}: {
  item: InboxItem | null;
  messageId: string;
  trainerId: string | null | undefined;
  onBack: () => void;
}) {
  const [message, setMessage] = useState<CoachMessage | null | undefined>(undefined);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    if (!messageId) {
      setMessage(null);
      return;
    }
    supabase
      .from("coach_messages")
      .select("*")
      .eq("id", messageId)
      .maybeSingle()
      .then(({ data }) => {
        setMessage(data ?? null);
        // Read here, read on the Today card too.
        if (data && !data.read_at && !item) supabase.rpc("mark_coach_messages_read").then(() => undefined);
      });
  }, [messageId, item]);

  useEffect(() => {
    if (!trainerId) return;
    supabase
      .from("video_checkin_settings")
      .select("whatsapp")
      .eq("trainer_id", trainerId)
      .maybeSingle()
      .then(({ data }) => setWhatsapp(whatsappLink(data?.whatsapp)));
  }, [trainerId]);

  const body = message?.body ?? item?.body ?? "";
  const when = message?.created_at ?? item?.created_at;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>‹ All messages</Text>
      </Pressable>
      {message === undefined && !item ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} />
      ) : (
        <View style={styles.messageCard}>
          <Text style={styles.messageFrom}>{item?.title ?? "Message from your coach"}</Text>
          {message?.video_id ? <Text style={styles.about}>Feedback on your form video</Text> : null}
          <Text style={styles.messageBody} selectable>
            {body || "This message is no longer available."}
          </Text>
          {when ? <Text style={styles.rowTime}>{new Date(when).toLocaleString()}</Text> : null}
          {message?.problem_id ? <ProblemReplyBox problemId={message.problem_id} /> : null}
        </View>
      )}
      {whatsapp ? (
        <Pressable style={styles.whatsapp} onPress={() => Linking.openURL(whatsapp).catch(() => undefined)} accessibilityRole="button">
          <Text style={styles.whatsappText}>Reply on WhatsApp</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  heading: { color: "#94A3B8", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  earlierHeading: { marginTop: 16, marginBottom: 8 },
  earlierFold: { marginTop: 12 },
  markAll: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#1E293B",
  },
  rowUnread: { borderLeftColor: BRAND_GOLD },
  rowIcon: { fontSize: 22, marginRight: 12 },
  rowMain: { flex: 1 },
  rowTitle: { color: "#CBD5E1", fontSize: 15, fontWeight: "600" },
  rowTitleUnread: { color: "#FFFFFF", fontWeight: "800" },
  rowBody: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  rowTime: { color: "#64748B", fontSize: 11, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND_GOLD, marginLeft: 8 },
  chevron: { color: "#64748B", fontSize: 20, marginLeft: 8 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { ...headingFont(18), color: "#FFFFFF", marginBottom: 6 },
  emptyText: { color: "#94A3B8", textAlign: "center", lineHeight: 20 },
  back: { marginBottom: 12, alignSelf: "flex-start" },
  backText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  messageCard: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: BRAND_GOLD },
  messageFrom: { ...headingFont(17), color: "#FFFFFF", marginBottom: 8 },
  about: { color: "#94A3B8", fontSize: 12, marginBottom: 6 },
  messageBody: { color: "#E2E8F0", fontSize: 16, lineHeight: 23 },
  whatsapp: { marginTop: 16, backgroundColor: "#25D366", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  whatsappText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
});
