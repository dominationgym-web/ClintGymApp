import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import KeyboardSafe from "@/components/KeyboardSafe";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { useAuth } from "@/context/AuthContext";
import { dayKey, monthGrid, monthLabel, monthStart, shiftMonth } from "@/lib/liveSessions";
import { holidayLength, holidaySpan } from "@/lib/holidays";
import type { LiveSession } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";
import SafeBottom from "@/components/SafeBottom";

const HEAD = ["M", "T", "W", "T", "F", "S", "S"];

// What the clients read, one tap each (the coach can add their own words).
const REASONS = [
  { key: "holiday", label: "🌴 On holiday", text: "I'm away on holiday." },
  { key: "course", label: "📚 On a course", text: "I'm away on a course." },
  { key: "family", label: "👨‍👩‍👧 Family time", text: "I'm away for family time." },
  { key: "sick", label: "🤒 Not well", text: "I'm not well and need a few days to recover." },
];

// The trainer's holiday button (GRIZZ, 2026-11-09): tap the first day away,
// then the last. Every client is told and sees it on their app until the
// holiday is over, with a reminder the day before. 1 on 1 sessions in it are
// cancelled free and every one goes on the catch-up list, where the coach
// books a catch-up or taps Credit.
export default function HolidayModal({
  visible,
  firstDay,
  onClose,
  onDone,
}: {
  visible: boolean;
  /** Start on this day (from the 1 on 1 calendar), or nothing picked yet. */
  firstDay?: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { trainer } = useAuth();
  const today = dayKey(new Date());
  const [month, setMonth] = useState(monthStart(new Date()));
  const [from, setFrom] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [reason, setReason] = useState("holiday");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<Pick<LiveSession, "id" | "starts_at" | "client_id" | "guest_name">[]>([]);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = firstDay && firstDay >= today ? firstDay : null;
    setMonth(monthStart(start ? new Date(`${start}T12:00:00`) : new Date()));
    setFrom(start);
    setUntil(null);
    setReason("holiday");
    setExtra("");
  }, [visible, firstDay, today]);

  // Booked sessions from today on (to show what a holiday cancels) and how many clients hear about it.
  useEffect(() => {
    if (!visible || !trainer) return;
    supabase
      .from("live_sessions")
      .select("id, starts_at, client_id, guest_name")
      .eq("trainer_id", trainer.id)
      .eq("status", "booked")
      .gte("starts_at", new Date().toISOString())
      .lt("starts_at", new Date(Date.now() + 100 * 86400000).toISOString())
      .then(({ data }) => setSessions(data ?? []));
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainer.id)
      .neq("access_status", "expired")
      .is("archived_at", null)
      .then(({ count }) => setClientCount(count ?? 0));
  }, [visible, trainer]);

  const hit = useMemo(() => {
    if (!from || !until) return [];
    return sessions.filter((s) => {
      const d = dayKey(s.starts_at);
      return d >= from && d <= until;
    });
  }, [sessions, from, until]);
  const days = useMemo(() => new Set(sessions.map((s) => dayKey(s.starts_at))), [sessions]);

  // First tap is the first day, second tap the last day; a third tap starts again.
  const pick = (day: string) => {
    if (!from || until || day < from) {
      setFrom(day);
      setUntil(null);
    } else setUntil(day);
  };

  const tooLong = !!from && !!until && holidayLength(from, until) > 92;
  const words = `${REASONS.find((r) => r.key === reason)?.text ?? ""}${extra.trim() ? ` ${extra.trim()}` : ""}`.trim();
  const span = from && until ? holidaySpan({ holiday_from: from, holiday_until: until }) : "";

  const save = async () => {
    if (!from || !until || tooLong) return;
    setBusy(true);
    const { error } = await supabase.rpc("add_trainer_holiday", { p_first: from, p_last: until, p_reason: words });
    setBusy(false);
    if (error) return Alert.alert("Couldn't save the holiday", error.message);
    onDone();
    Alert.alert(
      `🌴 Away ${span}`,
      `Your clients have been told and see it on their app until you're back. They get a reminder the day before.${
        hit.length ? ` ${hit.length} session${hit.length === 1 ? " is" : "s are"} on your catch-up list (1 on 1 › Today): book a catch-up or tap Credit for each.` : ""
      }`
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>🌴 Add a holiday</Text>
            <Text style={styles.helper}>Your clients see it on their app, so they don't forget.</Text>

            <Text style={styles.label}>{!from ? "Tap your first day away" : !until ? "Now tap your last day away" : "Picked. Tap a day to start again"}</Text>
            <View style={styles.header}>
              <Pressable
                onPress={() => setMonth(shiftMonth(month, -1))}
                hitSlop={12}
                style={[styles.arrow, month <= monthStart(new Date()) && { opacity: 0.3 }]}
                disabled={month <= monthStart(new Date())}
              >
                <Text style={styles.arrowText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
              <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12} style={styles.arrow}>
                <Text style={styles.arrowText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              {HEAD.map((h, i) => (
                <Text key={i} style={styles.head}>
                  {h}
                </Text>
              ))}
            </View>
            {monthGrid(month).map((week, wi) => (
              <View key={wi} style={styles.row}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={styles.cell} />;
                  const past = day < today;
                  const inside = !!from && (until ? day >= from && day <= until : day === from);
                  return (
                    <Pressable
                      key={di}
                      disabled={past}
                      style={[styles.cell, styles.day, past && { opacity: 0.3 }, inside && styles.inside, (day === from || day === until) && styles.picked]}
                      onPress={() => pick(day)}
                    >
                      <Text style={[styles.num, inside && styles.numInside]}>{Number(day.slice(8))}</Text>
                      {days.has(day) ? <View style={styles.dot} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Text style={styles.meta}>A dot is a day with 1 on 1 sessions booked.</Text>

            <Text style={styles.label}>What your clients read</Text>
            <View style={styles.chips}>
              {REASONS.map((r) => (
                <Pressable key={r.key} style={[styles.chip, reason === r.key && styles.chipOn]} onPress={() => setReason(r.key)}>
                  <Text style={[styles.chipText, reason === r.key && styles.chipTextOn]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={extra}
              onChangeText={setExtra}
              placeholder="Add your own words (optional)"
              maxLength={200}
            />

            {from && until ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Away {span}</Text>
                <Text style={styles.meta}>"{words}"</Text>
                {tooLong ? (
                  <Text style={[styles.meta, { color: themeText("#F87171") }]}>At most three months at a time. Add the rest as a second holiday.</Text>
                ) : (
                  <>
                    <Text style={styles.meta}>
                      {clientCount === 1 ? "Your client gets a message now and a reminder the day before." : clientCount ? `All ${clientCount} of your clients get a message now and a reminder the day before.` : "Your clients see it on their app."}
                    </Text>
                    <Text style={styles.meta}>
                      {hit.length
                        ? `${hit.length} 1 on 1 session${hit.length === 1 ? "" : "s"} in that time ${hit.length === 1 ? "is" : "are"} cancelled free and go on your catch-up list. You decide who gets a catch-up and who gets credited.`
                        : "No 1 on 1 sessions booked in those days."}
                    </Text>
                  </>
                )}
              </View>
            ) : null}

            <Pressable style={[styles.button, (!from || !until || busy || tooLong) && { opacity: 0.5 }]} onPress={save} disabled={!from || !until || busy || tooLong}>
              {busy ? (
                <ActivityIndicator color={themeText("#0F172A")} />
              ) : (
                <Text style={styles.buttonText}>{from && until ? "🌴 Save and tell my clients" : from ? "Now tap your last day away" : "Tap your first day away"}</Text>
              )}
            </Pressable>
            <Pressable style={styles.outline} onPress={onClose}>
              <Text style={styles.outlineText}>Cancel</Text>
            </Pressable>
            <SafeBottom />
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  title: { color: "#fff", fontSize: 19, fontWeight: "800", marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 17 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 6 },
  arrow: { paddingHorizontal: 14, paddingVertical: 4 },
  arrowText: { color: BRAND_GOLD, fontSize: 28, fontWeight: "700" },
  monthTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row" },
  head: { flex: 1, textAlign: "center", color: "#64748B", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cell: { flex: 1, aspectRatio: 1, margin: 2 },
  day: { backgroundColor: "#1E293B", borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1E293B" },
  inside: { backgroundColor: "#0C2A3D", borderColor: "#38BDF8" },
  picked: { borderColor: BRAND_GOLD, borderWidth: 2 },
  num: { color: "#CBD5E1", fontSize: 14, fontWeight: "600" },
  numInside: { color: "#fff", fontWeight: "800" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#94A3B8", marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#1E293B" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  input: { backgroundColor: "#F8FAFC", color: "#0F172A", borderRadius: 10, padding: 10, fontSize: 15, marginTop: 10 },
  preview: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginTop: 14, borderLeftWidth: 4, borderLeftColor: "#38BDF8" },
  previewTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
});
