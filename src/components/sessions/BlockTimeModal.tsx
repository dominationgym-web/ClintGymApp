import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import KeyboardSafe from "@/components/KeyboardSafe";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { cleanTime, clockLabel, dayKey, dayLabel, sessionMoney } from "@/lib/liveSessions";
import { useAuth } from "@/context/AuthContext";
import { blockRanges, sessionsInBlock } from "@/lib/timeOff";
import type { BillingCurrency, LiveSession, TrainerTimeOff } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

const LENGTHS = [1, 2, 3, 5, 7, 14];

// Block out time (GRIZZ, 2026-11-01): when the coach is away or misses
// sessions. Every booked session in it is cancelled by the coach (never
// charged), each client gets the reason, and the app shows the sessions and
// money missed.
export default function BlockTimeModal({
  visible,
  firstDay,
  sessions,
  currency,
  name,
  onClose,
  onDone,
}: {
  visible: boolean;
  /** The day picked on the calendar, "2026-11-04". */
  firstDay: string;
  sessions: LiveSession[];
  currency: BillingCurrency;
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [days, setDays] = useState(1);
  const [partDay, setPartDay] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setDays(1);
    setPartDay(false);
    setFrom("");
    setTo("");
    setReason("");
  }, [visible]);

  const range = useMemo(() => blockRanges(firstDay, days, cleanTime(from), cleanTime(to), partDay), [firstDay, days, from, to, partDay]);
  const hit = useMemo(() => (range ? sessionsInBlock(sessions, range) : []), [sessions, range]);
  const lost = hit.reduce((n, s) => n + (Number(s.fee) || 0), 0);
  const people = [...new Set(hit.map((s) => name(s)))];
  const [fy, fm, fd] = firstDay.split("-").map(Number);
  const lastDay = dayLabel(new Date(fy, fm - 1, fd + days - 1, 12));

  const save = async () => {
    if (!range) return Alert.alert("Check the times", "Type a start and end time like 06:00 and 09:00.");
    if (!reason.trim()) return Alert.alert("Add a reason", "Your clients see it, e.g. \"I'm away on holiday\" or \"I'm sick today\".");
    setBusy(true);
    // One block per stretch: some hours over several days is a block a day.
    for (const r of range) {
      const { error } = await supabase.rpc("block_trainer_time", { p_from: r.from.toISOString(), p_to: r.to.toISOString(), p_reason: reason.trim() });
      if (error) {
        setBusy(false);
        return Alert.alert("Couldn't block it out", error.message);
      }
    }
    setBusy(false);
    onDone();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>🚫 Block out time</Text>
            <Text style={styles.helper}>For when you're away or can't train. Booked sessions are cancelled, your clients aren't charged, and each one gets your reason.</Text>

            <Text style={styles.label}>From {dayLabel(`${firstDay}T12:00:00`)}, for</Text>
            <View style={styles.chips}>
              {LENGTHS.map((n) => (
                <Pressable key={n} style={[styles.chip, days === n && styles.chipOn]} onPress={() => setDays(n)}>
                  <Text style={[styles.chipText, days === n && styles.chipTextOn]}>{n === 1 ? "Just this day" : n === 7 ? "A week" : n === 14 ? "2 weeks" : `${n} days`}</Text>
                </Pressable>
              ))}
            </View>
            {days > 1 ? <Text style={styles.meta}>Up to and including {lastDay}.</Text> : null}

            <Text style={styles.label}>Which part of the day?</Text>
            <View style={styles.chips}>
              <Pressable style={[styles.chip, !partDay && styles.chipOn]} onPress={() => setPartDay(false)}>
                <Text style={[styles.chipText, !partDay && styles.chipTextOn]}>The whole day</Text>
              </Pressable>
              <Pressable style={[styles.chip, partDay && styles.chipOn]} onPress={() => setPartDay(true)}>
                <Text style={[styles.chipText, partDay && styles.chipTextOn]}>Only some hours</Text>
              </Pressable>
            </View>
            {partDay ? (
              <View style={styles.timeRow}>
                <TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="From 06:00" keyboardType="numbers-and-punctuation" />
                <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="To 09:00" keyboardType="numbers-and-punctuation" />
              </View>
            ) : null}
            {partDay && days > 1 ? <Text style={styles.meta}>Those hours on each day.</Text> : null}

            <Text style={styles.label}>Reason (your clients see this)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. I'm away on holiday, back on Monday."
              multiline
              maxLength={300}
            />

            <View style={styles.preview}>
              {range ? (
                hit.length ? (
                  <>
                    <Text style={styles.previewTitle}>
                      {hit.length} session{hit.length === 1 ? "" : "s"} missed · {sessionMoney(lost, currency)} not earned
                    </Text>
                    <Text style={styles.meta}>{people.join(", ")}</Text>
                  </>
                ) : (
                  <Text style={styles.previewTitle}>No sessions booked in that time.</Text>
                )
              ) : (
                <Text style={styles.meta}>Type both times to see which sessions it cancels.</Text>
              )}
            </View>

            <Pressable style={[styles.button, (busy || !range || !reason.trim()) && { opacity: 0.5 }]} onPress={save} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={themeText("#0F172A")} />
              ) : (
                <Text style={styles.buttonText}>{hit.length ? "Block out and tell my clients" : "Block out"}</Text>
              )}
            </Pressable>
            <Pressable style={styles.outline} onPress={onClose}>
              <Text style={styles.outlineText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

// "When" for a block: "Mon 2 Nov" / "Mon 2 Nov – Fri 6 Nov" / "Mon 2 Nov, 06:00–09:00".
function blockWhen(b: Pick<TrainerTimeOff, "starts_at" | "ends_at">): string {
  const from = new Date(b.starts_at);
  const to = new Date(b.ends_at);
  const wholeDays = from.getHours() === 0 && from.getMinutes() === 0 && to.getHours() === 0 && to.getMinutes() === 0;
  if (!wholeDays) return `${dayLabel(from)}, ${clockLabel(from)}–${clockLabel(to)}`;
  const last = new Date(to.getTime() - 1);
  return dayKey(last) === dayKey(from) ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(last)}`;
}

// On the 1 on 1 calendar under the day: the block on that day (if any), the
// Block out button, and the time off coming up with what it cost.
export function TimeOffSection({
  day,
  sessions,
  currency,
  name,
  onChanged,
}: {
  day: string;
  sessions: LiveSession[];
  currency: BillingCurrency;
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  onChanged: () => void;
}) {
  const { trainer } = useAuth();
  const [blocks, setBlocks] = useState<TrainerTimeOff[]>([]);
  const [blocking, setBlocking] = useState(false);
  const load = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("trainer_time_off")
      .select("*")
      .eq("trainer_id", trainer.id)
      .is("removed_at", null)
      .gte("ends_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("starts_at");
    setBlocks(data ?? []);
  }, [trainer]);
  useEffect(() => {
    load();
  }, [load]);
  const [y, m, d] = day.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d).getTime();
  const dayEnd = new Date(y, m - 1, d + 1).getTime();
  const onDay = blocks.filter((b) => new Date(b.starts_at).getTime() < dayEnd && new Date(b.ends_at).getTime() > dayStart);
  const coming = blocks.filter((b) => new Date(b.ends_at).getTime() > Date.now());
  const takeOff = (b: TrainerTimeOff) =>
    Alert.alert(
      "Take this off your calendar?",
      "The sessions it cancelled stay cancelled: book them again if you need to. Weekly sessions fill that time again from tonight.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Take it off",
          onPress: async () => {
            const { error } = await supabase.rpc("remove_trainer_time_off", { p_id: b.id });
            if (error) return Alert.alert("Couldn't take it off", error.message);
            load();
          },
        },
      ]
    );
  return (
    <>
      {onDay.map((b) => (
        <View key={b.id} style={styles.blockNote}>
          <Text style={styles.previewTitle}>🚫 Blocked out · {blockWhen(b)}</Text>
          <Text style={styles.meta}>{b.reason}</Text>
        </View>
      ))}
      <Pressable style={styles.outline} onPress={() => setBlocking(true)}>
        <Text style={styles.outlineText}>🚫 Block out time from {dayLabel(`${day}T12:00:00`)}</Text>
      </Pressable>
      {coming.length ? <Text style={styles.label}>Your time off</Text> : null}
      {coming.map((b) => (
        <View key={b.id} style={styles.blockRow}>
          <Text style={styles.previewTitle}>{blockWhen(b)}</Text>
          <Text style={styles.meta}>{b.reason}</Text>
          <Text style={styles.meta}>
            {b.missed ? `${b.missed} session${b.missed === 1 ? "" : "s"} missed · ${sessionMoney(Number(b.missed_fees), currency)} not earned` : "No sessions were booked"}
          </Text>
          <Pressable onPress={() => takeOff(b)} hitSlop={8}>
            <Text style={[styles.outlineText, { marginTop: 6 }]}>Take off the calendar</Text>
          </Pressable>
        </View>
      ))}
      <BlockTimeModal
        visible={blocking}
        firstDay={day}
        sessions={sessions}
        currency={currency}
        name={name}
        onClose={() => setBlocking(false)}
        onDone={() => {
          setBlocking(false);
          load();
          onChanged();
        }}
      />
    </>
  );
}

const styles = themedStyles({
  blockNote: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#3B82F6" },
  blockRow: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  title: { color: "#fff", fontSize: 19, fontWeight: "800", marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#1E293B" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  timeRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: { flex: 1, backgroundColor: "#F8FAFC", color: "#0F172A", borderRadius: 10, padding: 10, fontSize: 15 },
  preview: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginTop: 16, borderLeftWidth: 4, borderLeftColor: "#3B82F6" },
  previewTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
});
