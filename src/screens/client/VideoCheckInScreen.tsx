import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import {
  STATUS_LABEL,
  canCancel,
  canJoin,
  checkinClock,
  checkinDay,
  checkinWhen,
  groupByDay,
  isUpcoming,
  splitWeeks,
  weekKey,
  whatsappLink,
} from "@/lib/videoCheckins";
import type { OpenVideoSlot, VideoCheckin, VideoCheckinSettings } from "@/types/database";

// Weekly video check-in (0155, GRIZZ 2026-10-25). The client books one of the
// times their coach is free, at most one a week, and can keep the same time
// every week. Their coach confirms it, and both get a reminder the day before
// and 15 minutes before, plus a pop-up on the day (VideoCheckInDayPopup). The
// call itself happens on WhatsApp.
export default function VideoCheckInScreen() {
  const { client } = useAuth();
  const [settings, setSettings] = useState<VideoCheckinSettings | null>(null);
  const [bookings, setBookings] = useState<VideoCheckin[]>([]);
  const [lastEnded, setLastEnded] = useState<VideoCheckin | null>(null);
  const [open, setOpen] = useState<OpenVideoSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [week, setWeek] = useState<"this" | "next">("this");
  const [picked, setPicked] = useState<OpenVideoSlot | null>(null);
  const [topic, setTopic] = useState("");
  const [repeat, setRepeat] = useState(true);
  const [busy, setBusy] = useState(false);
  // Re-renders the Join button as the time comes.
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!client) return;
    setNow(new Date());
    const since = new Date(Date.now() - 3 * 3600000).toISOString();
    const [s, b, o] = await Promise.all([
      supabase.from("video_checkin_settings").select("*").eq("trainer_id", client.trainer_id).maybeSingle(),
      supabase.from("video_checkins").select("*").eq("client_id", client.id).gte("starts_at", since).order("starts_at"),
      supabase.rpc("open_video_slots"),
    ]);
    setSettings(s.data ?? null);
    const rows = b.data ?? [];
    setBookings(rows.filter((v) => isUpcoming(v)));
    // A coach's "can't make it" or cancel stays in view until the client books again.
    const ended = rows.filter((v) => (v.status === "declined" || v.status === "cancelled") && v.cancelled_by !== "client");
    setLastEnded(ended.length ? ended[ended.length - 1] : null);
    setOpen(o.data ?? []);
    setLoading(false);
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(() => setNow(new Date()), 30000);
      return () => clearInterval(t);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const book = async () => {
    if (!picked) return;
    setBusy(true);
    const { error } = await supabase.rpc("book_video_checkin", {
      p_slot: picked.slot_id,
      p_starts_at: picked.starts_at,
      p_repeat: repeat,
      p_topic: topic.trim() || null,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't book", error.message);
      load();
      return;
    }
    setPicked(null);
    setTopic("");
    Alert.alert("Booked 📹", "Your coach has been told. You'll get a notification when they confirm, and reminders the day before and 15 minutes before.");
    load();
  };

  const cancel = (v: VideoCheckin) => {
    Alert.alert("Cancel this video check-in?", `${checkinWhen(v.starts_at)}. Your coach will be told.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel it",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("cancel_video_checkin", { p_id: v.id });
          if (error) Alert.alert("Couldn't cancel", error.message);
          load();
        },
      },
    ]);
  };

  const setRepeatFor = async (v: VideoCheckin, value: boolean) => {
    setBookings((prev) => prev.map((b) => (b.id === v.id ? { ...b, repeat_weekly: value } : b)));
    const { error } = await supabase.rpc("set_video_checkin_repeat", { p_id: v.id, p_repeat: value });
    if (error) {
      Alert.alert("Couldn't change it", error.message);
      load();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={BRAND_GOLD} />
      </View>
    );
  }

  // Weeks that already have a booking can't take another.
  const bookedWeeks = new Set(bookings.map((v) => weekKey(v.starts_at)));
  const free = open.filter((o) => !bookedWeeks.has(weekKey(o.starts_at)));
  const { thisWeek, nextWeek } = splitWeeks(free, now);
  const shown = week === "this" ? thisWeek : nextWeek;
  const whatsapp = whatsappLink(settings?.whatsapp);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GOLD} />}
    >
      {bookings.map((v) => (
        <View key={v.id} style={[styles.card, v.status === "confirmed" && styles.cardConfirmed]}>
          <Text style={styles.label}>📹 Your video check-in</Text>
          <Text style={styles.when}>
            {checkinDay(v.starts_at, now)}, {checkinClock(v.starts_at)}
          </Text>
          <Text style={[styles.status, v.status === "confirmed" ? { color: "#22C55E" } : { color: "#F59E0B" }]}>
            {STATUS_LABEL[v.status]} · {v.minutes} min
          </Text>
          {v.topic ? <Text style={styles.helper}>To talk about: {v.topic}</Text> : null}
          {v.status === "confirmed" && (
            <Text style={styles.helper}>Your coach will video call you on WhatsApp. We'll remind you the day before and 15 minutes before.</Text>
          )}
          {whatsapp && (
            <Pressable style={canJoin(v, now) ? styles.button : styles.outline} onPress={() => Linking.openURL(whatsapp)}>
              <Text style={canJoin(v, now) ? styles.buttonText : styles.outlineText}>💬 WhatsApp your coach</Text>
            </Pressable>
          )}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Same time every week</Text>
            <Switch
              value={v.repeat_weekly}
              onValueChange={(value) => setRepeatFor(v, value)}
              trackColor={{ true: BRAND_GOLD, false: "#334155" }}
              thumbColor="#fff"
            />
          </View>
          {canCancel(v, now) && (
            <Pressable onPress={() => cancel(v)} hitSlop={6}>
              <Text style={styles.cancel}>Cancel this check-in</Text>
            </Pressable>
          )}
        </View>
      ))}

      {lastEnded && bookings.length === 0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {lastEnded.status === "declined" ? "Your coach can't make" : "Your coach cancelled"} {checkinWhen(lastEnded.starts_at)}
            {lastEnded.reason ? `: ${lastEnded.reason}` : ""}. Please pick another time.
          </Text>
        </View>
      )}

      {open.length === 0 && bookings.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Video check-ins 📹</Text>
          <Text style={styles.helper}>
            {settings && !settings.paused
              ? "Your coach has no open times in the next two weeks. Check again soon, or send them a message."
              : "Your coach hasn't opened times for video check-ins yet. When they do, you can book one here."}
          </Text>
        </View>
      ) : free.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.heading}>{bookings.length ? "Book another week" : "Book a video check-in"}</Text>
          <Text style={styles.helper}>A short video call with your coach, once a week. Pick a time that suits you.</Text>
          <View style={styles.chips}>
            {(["this", "next"] as const).map((w) => (
              <Pressable
                key={w}
                style={[styles.chip, week === w && styles.chipOn]}
                onPress={() => {
                  setWeek(w);
                  setPicked(null);
                }}
              >
                <Text style={[styles.chipText, week === w && styles.chipTextOn]}>
                  {w === "this" ? `This week (${thisWeek.length})` : `Next week (${nextWeek.length})`}
                </Text>
              </Pressable>
            ))}
          </View>
          {shown.length === 0 ? (
            <Text style={styles.helper}>
              {week === "this" ? "No open times left this week. Try next week." : "No open times next week yet."}
            </Text>
          ) : (
            groupByDay(shown, now).map((g) => (
              <View key={g.day} style={{ marginTop: 8 }}>
                <Text style={styles.dayTitle}>{g.day}</Text>
                <View style={styles.chips}>
                  {g.rows.map((o) => {
                    const on = picked?.starts_at === o.starts_at;
                    return (
                      <Pressable key={o.starts_at} style={[styles.chip, on && styles.chipOn]} onPress={() => setPicked(on ? null : o)}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{checkinClock(o.starts_at)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          {picked && (
            <>
              <Text style={styles.label}>
                {checkinWhen(picked.starts_at)} · {picked.minutes} min
              </Text>
              <TextInput
                style={styles.input}
                value={topic}
                onChangeText={setTopic}
                placeholder="Anything you want to talk about? (optional)"
                placeholderTextColor="#64748B"
                maxLength={300}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Same time every week</Text>
                <Switch value={repeat} onValueChange={setRepeat} trackColor={{ true: BRAND_GOLD, false: "#334155" }} thumbColor="#fff" />
              </View>
              <Pressable style={styles.button} onPress={book} disabled={busy}>
                {busy ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Book this time</Text>}
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardConfirmed: { borderWidth: 1, borderColor: "#22C55E" },
  heading: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 12, marginBottom: 4 },
  when: { color: "#fff", fontSize: 22, fontWeight: "800" },
  status: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  dayTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#0F172A" },
  input: {
    backgroundColor: "#0F172A",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  switchText: { color: "#fff", fontSize: 15 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 6 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 12 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  cancel: { color: "#F87171", fontWeight: "600", fontSize: 14, marginTop: 14 },
  notice: { backgroundColor: "#3B2F0B", borderRadius: 10, padding: 12, marginBottom: 12 },
  noticeText: { color: "#FDE68A", fontSize: 14, lineHeight: 20 },
});
