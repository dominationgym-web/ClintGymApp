import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TextInput from "@/components/TextInput";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import {
  CALL_LENGTHS,
  SLOT_TIMES,
  WEEKDAYS,
  WEEK_ORDER,
  canCancel,
  canJoin,
  checkinClock,
  checkinDay,
  isUpcoming,
  phoneTimeZone,
  setupReady,
  slotTime,
  slotsForDay,
  whatsappDigits,
  whatsappLink,
} from "@/lib/videoCheckins";
import type { VideoCheckin, VideoCheckinSettings, VideoCheckinSlot } from "@/types/database";

type Tab = "bookings" | "times" | "setup";
type ClientInfo = { id: string; name: string; phone: string | null };

// Weekly video check-ins (0152, GRIZZ 2026-10-25). Three tabs instead of one
// long page: the bookings to confirm and coming up, the times the trainer is
// free each week (tap a day, tap times on or off), and the WhatsApp number
// and call length. The call itself happens on WhatsApp.
export default function VideoCheckInsScreen() {
  const { trainer } = useAuth();
  const [tab, setTab] = useState<Tab>("bookings");
  const [settings, setSettings] = useState<VideoCheckinSettings | null>(null);
  const [slots, setSlots] = useState<VideoCheckinSlot[]>([]);
  const [bookings, setBookings] = useState<VideoCheckin[]>([]);
  const [clients, setClients] = useState<Record<string, ClientInfo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!trainer) return;
    setNow(new Date());
    const since = new Date(Date.now() - 3 * 3600000).toISOString();
    const [s, sl, b] = await Promise.all([
      supabase.from("video_checkin_settings").select("*").eq("trainer_id", trainer.id).maybeSingle(),
      supabase.from("video_checkin_slots").select("*").eq("trainer_id", trainer.id),
      supabase
        .from("video_checkins")
        .select("*")
        .eq("trainer_id", trainer.id)
        .in("status", ["requested", "confirmed"])
        .gte("starts_at", since)
        .order("starts_at"),
    ]);
    setSettings(s.data ?? null);
    setSlots(sl.data ?? []);
    const rows = (b.data ?? []).filter((v) => isUpcoming(v));
    setBookings(rows);
    const ids = [...new Set(rows.map((v) => v.client_id))];
    if (ids.length) {
      const { data } = await supabase.from("clients").select("id, name, phone").in("id", ids);
      setClients(Object.fromEntries((data ?? []).map((c) => [c.id, c as ClientInfo])));
    }
    setLoading(false);
  }, [trainer]);

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

  // Makes sure there's a settings row (with the phone's time zone) before the
  // first time is added, so clients can book straight away.
  const ensureSettings = async (): Promise<VideoCheckinSettings | null> => {
    if (settings) return settings;
    if (!trainer) return null;
    const { data, error } = await supabase
      .from("video_checkin_settings")
      .upsert({ trainer_id: trainer.id, whatsapp: trainer.phone || trainer.pop_whatsapp || null, time_zone: phoneTimeZone() })
      .select()
      .single();
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return null;
    }
    setSettings(data);
    return data;
  };

  const tabs: ScreenTab<Tab>[] = [
    { key: "bookings", label: "Bookings", icon: "calendar", dot: bookings.some((v) => v.status === "requested") ? "#F59E0B" : null },
    { key: "times", label: "My times", icon: "time" },
    { key: "setup", label: "Call setup", icon: "videocam", dot: setupReady(settings, slots) ? null : "#F59E0B" },
  ];

  return (
    <View style={styles.container}>
      <ScreenTabBar tabs={tabs} current={tab} onChange={setTab} position="top" />
      {loading ? (
        <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GOLD} />}
        >
          {tab === "bookings" && (
            <Bookings
              bookings={bookings}
              clients={clients}
              settings={settings}
              ready={setupReady(settings, slots)}
              now={now}
              onChanged={load}
              onGo={setTab}
            />
          )}
          {tab === "times" && (
            <Times slots={slots} settings={settings} ensureSettings={ensureSettings} onSlots={setSlots} trainerId={trainer?.id ?? ""} />
          )}
          {tab === "setup" && <Setup settings={settings} onSaved={setSettings} />}
        </ScrollView>
      )}
    </View>
  );
}

function Bookings({
  bookings,
  clients,
  settings,
  ready,
  now,
  onChanged,
  onGo,
}: {
  bookings: VideoCheckin[];
  clients: Record<string, ClientInfo>;
  settings: VideoCheckinSettings | null;
  ready: boolean;
  now: Date;
  onChanged: () => void;
  onGo: (tab: Tab) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const toConfirm = bookings.filter((v) => v.status === "requested");
  const confirmed = bookings.filter((v) => v.status === "confirmed");
  const first = (id: string) => clients[id]?.name.split(" ")[0] ?? "Client";

  const respond = async (v: VideoCheckin, confirm: boolean) => {
    setBusyId(v.id);
    const { error } = await supabase.rpc("respond_video_checkin", { p_id: v.id, p_confirm: confirm });
    setBusyId(null);
    if (error) Alert.alert("Couldn't save", error.message);
    onChanged();
  };

  const decline = (v: VideoCheckin) => {
    Alert.alert(`Can't make ${checkinDay(v.starts_at, now)} at ${checkinClock(v.starts_at)}?`, `${first(v.client_id)} will be asked to pick another time.`, [
      { text: "Back", style: "cancel" },
      { text: "Can't make it", style: "destructive", onPress: () => respond(v, false) },
    ]);
  };

  const cancel = (v: VideoCheckin) => {
    Alert.alert(`Cancel ${first(v.client_id)}'s check-in?`, `${checkinDay(v.starts_at, now)} at ${checkinClock(v.starts_at)}. They'll be told and asked to pick another time.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel it",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("cancel_video_checkin", { p_id: v.id });
          if (error) Alert.alert("Couldn't cancel", error.message);
          onChanged();
        },
      },
    ]);
  };

  return (
    <>
      {!ready && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {settings?.paused
              ? "Bookings are paused, so clients can't book. Switch them back on under Call setup."
              : "Clients can't book yet. Add the times you're free under My times, and your WhatsApp number under Call setup."}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.outline} onPress={() => onGo("times")}>
              <Text style={styles.outlineText}>My times</Text>
            </Pressable>
            <Pressable style={styles.outline} onPress={() => onGo("setup")}>
              <Text style={styles.outlineText}>Call setup</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>To confirm</Text>
      {toConfirm.length === 0 ? (
        <Text style={styles.helper}>Nothing waiting. 👍</Text>
      ) : (
        toConfirm.map((v) => (
          <View key={v.id} style={styles.row}>
            <Text style={styles.rowTitle}>
              {clients[v.client_id]?.name ?? "Client"} · {checkinDay(v.starts_at, now)}, {checkinClock(v.starts_at)}
            </Text>
            {v.topic ? <Text style={styles.rowBody}>To talk about: {v.topic}</Text> : null}
            {v.repeat_weekly ? <Text style={styles.meta}>Wants the same time every week</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.smallButton} onPress={() => respond(v, true)} disabled={busyId === v.id}>
                {busyId === v.id ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.smallButtonText}>Confirm</Text>}
              </Pressable>
              <Pressable style={styles.outline} onPress={() => decline(v)} disabled={busyId === v.id}>
                <Text style={styles.outlineText}>Can't make it</Text>
              </Pressable>
              <WhatsAppButton phone={clients[v.client_id]?.phone} />
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Coming up</Text>
      {confirmed.length === 0 ? (
        <Text style={styles.helper}>No confirmed check-ins yet.</Text>
      ) : (
        confirmed.map((v) => {
          return (
            <View key={v.id} style={[styles.row, canJoin(v, now) && styles.rowNow]}>
              <Text style={styles.rowTitle}>
                {clients[v.client_id]?.name ?? "Client"} · {checkinDay(v.starts_at, now)}, {checkinClock(v.starts_at)}
              </Text>
              <Text style={styles.meta}>
                {v.minutes} min{v.repeat_weekly ? " · every week" : ""}
              </Text>
              {v.topic ? <Text style={styles.rowBody}>To talk about: {v.topic}</Text> : null}
              <View style={styles.actions}>
                <WhatsAppButton phone={clients[v.client_id]?.phone} strong={canJoin(v, now)} />
                {canCancel(v, now) && (
                  <Pressable style={styles.outline} onPress={() => cancel(v)}>
                    <Text style={styles.outlineText}>Cancel</Text>
                  </Pressable>
                )}
              </View>
              {canJoin(v, now) ? (
                <Text style={styles.meta}>
                  {whatsappLink(clients[v.client_id]?.phone)
                    ? "It's time: tap WhatsApp, then the video button to call them."
                    : "This client has no phone number saved. Call them another way."}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </>
  );
}

// Opens WhatsApp with the client (GRIZZ, 2026-10-25: tap their number and go
// straight to WhatsApp). Nothing when they have no number saved.
function WhatsAppButton({ phone, strong }: { phone: string | null | undefined; strong?: boolean }) {
  const link = whatsappLink(phone);
  if (!link) return null;
  return (
    <Pressable style={strong ? styles.smallButton : styles.outline} onPress={() => Linking.openURL(link)}>
      <Text style={strong ? styles.smallButtonText : styles.outlineText}>💬 WhatsApp</Text>
    </Pressable>
  );
}

function Times({
  slots,
  settings,
  ensureSettings,
  onSlots,
  trainerId,
}: {
  slots: VideoCheckinSlot[];
  settings: VideoCheckinSettings | null;
  ensureSettings: () => Promise<VideoCheckinSettings | null>;
  onSlots: (slots: VideoCheckinSlot[]) => void;
  trainerId: string;
}) {
  const [day, setDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const dayTimes = new Set(slotsForDay(slots, day).map((s) => slotTime(s.start_time)));

  // Switches times on (adding or re-opening the slot) or off for the given days.
  const setTimes = async (days: number[], times: string[], on: boolean) => {
    if (!(await ensureSettings())) return;
    setSaving(true);
    const rows = days.flatMap((weekday) => times.map((t) => ({ trainer_id: trainerId, weekday, start_time: `${t}:00`, active: on })));
    const { data, error } = await supabase
      .from("video_checkin_slots")
      .upsert(rows, { onConflict: "trainer_id,weekday,start_time" })
      .select();
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    const changed = new Map((data ?? []).map((s) => [s.id, s]));
    const kept = slots.filter((s) => !changed.has(s.id));
    onSlots([...kept, ...changed.values()]);
  };

  const copyToWeekdays = () => {
    const times = [...dayTimes];
    const others = [1, 2, 3, 4, 5].filter((d) => d !== day);
    Alert.alert(
      `Same times Monday to Friday?`,
      times.length ? `${times.join(", ")} on every weekday. Times already on other days stay.` : "Pick some times first.",
      times.length
        ? [
            { text: "Back", style: "cancel" },
            { text: "Copy", onPress: () => setTimes(others, times, true) },
          ]
        : [{ text: "OK" }]
    );
  };

  return (
    <>
      <Text style={styles.helper}>
        Tap a day, then tap the times you're free for a video check-in. Clients book from these times, up to two weeks ahead, and you confirm each one.
        {settings ? ` Calls are ${settings.minutes} minutes (change it under Call setup).` : ""}
      </Text>
      <View style={styles.chips}>
        {WEEK_ORDER.map((d) => {
          const count = slotsForDay(slots, d).length;
          return (
            <Pressable key={d} style={[styles.chip, day === d && styles.chipOn]} onPress={() => setDay(d)}>
              <Text style={[styles.chipText, day === d && styles.chipTextOn]}>
                {WEEKDAYS[d].slice(0, 3)}
                {count ? ` · ${count}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.sectionTitle}>{WEEKDAYS[day]}</Text>
      <View style={styles.chips}>
        {SLOT_TIMES.map((t) => {
          const on = dayTimes.has(t);
          return (
            <Pressable key={t} style={[styles.timeChip, on && styles.chipOn]} onPress={() => setTimes([day], [t], !on)} disabled={saving}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
      {day >= 1 && day <= 5 && dayTimes.size > 0 && (
        <Pressable style={styles.outline} onPress={copyToWeekdays}>
          <Text style={styles.outlineText}>Same times Monday to Friday</Text>
        </Pressable>
      )}
      <Text style={styles.meta}>Switching a time off doesn't cancel check-ins already booked at it. Cancel those on the Bookings tab.</Text>
    </>
  );
}

function Setup({ settings, onSaved }: { settings: VideoCheckinSettings | null; onSaved: (s: VideoCheckinSettings) => void }) {
  const { trainer } = useAuth();
  const [whatsapp, setWhatsapp] = useState(settings?.whatsapp ?? trainer?.phone ?? trainer?.pop_whatsapp ?? "");
  const [minutes, setMinutes] = useState(settings?.minutes ?? 20);
  const [paused, setPaused] = useState(settings?.paused ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setWhatsapp(settings.whatsapp ?? "");
    setMinutes(settings.minutes);
    setPaused(settings.paused);
  }, [settings]);

  const save = async () => {
    if (!trainer) return;
    if (!whatsappDigits(whatsapp)) {
      Alert.alert("Add your WhatsApp number", "Clients tap it to open WhatsApp with you, e.g. 082 123 4567.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("video_checkin_settings")
      .upsert({
        trainer_id: trainer.id,
        whatsapp: whatsapp.trim(),
        minutes,
        paused,
        time_zone: phoneTimeZone(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      return;
    }
    onSaved(data);
    Alert.alert("Saved ✅", paused ? "Bookings are paused." : "Clients can book your open times.");
  };

  return (
    <>
      <Text style={styles.helper}>
        Calls happen on WhatsApp. At the booked time, tap WhatsApp on the Bookings tab: it opens the chat with your client, then tap the video button to call them.
      </Text>
      <Text style={styles.label}>Your WhatsApp number</Text>
      <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="082 123 4567" placeholderTextColor="#64748B" />

      <Text style={styles.label}>How long is a call?</Text>
      <View style={styles.chips}>
        {CALL_LENGTHS.map((m) => (
          <Pressable key={m} style={[styles.chip, minutes === m && styles.chipOn]} onPress={() => setMinutes(m)}>
            <Text style={[styles.chipText, minutes === m && styles.chipTextOn]}>{m} min</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchText}>Taking bookings</Text>
          <Text style={styles.meta}>Switch off when you're away. Check-ins already booked stay.</Text>
        </View>
        <Switch value={!paused} onValueChange={(v) => setPaused(!v)} trackColor={{ true: BRAND_GOLD, false: "#334155" }} thumbColor="#fff" />
      </View>

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 4 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  timeChip: { backgroundColor: "#1E293B", borderRadius: 8, width: 68, alignItems: "center", paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#0F172A" },
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  switchText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  rowNow: { borderWidth: 1, borderColor: "#22C55E" },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  rowBody: { color: "#CBD5E1", fontSize: 14, marginTop: 4 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 },
  smallButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, minWidth: 90, alignItems: "center" },
  smallButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  notice: { backgroundColor: "#3B2F0B", borderRadius: 10, padding: 12, marginBottom: 4 },
  noticeText: { color: "#FDE68A", fontSize: 14, lineHeight: 20 },
});
