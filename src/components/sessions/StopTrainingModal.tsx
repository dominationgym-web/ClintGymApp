import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { clockLabel, dayKey, dayLabel, monthGrid, monthLabel, monthStart, shiftMonth } from "@/lib/liveSessions";
import { diaryKey } from "@/lib/calendarRegular";
import type { ClientStop, LiveSession } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";
import SafeBottom from "@/components/SafeBottom";
import { sessionsOf, type AwayWho } from "@/components/sessions/AwayModal";

const HEAD = ["M", "T", "W", "T", "F", "S", "S"];

/** "Fri 14 Nov" for "2026-11-14". */
const dayText = (key: string) => dayLabel(`${key}T12:00:00`);

/** Their stop (0207), if they've stopped training and it isn't undone. */
export function stopOf(stops: ClientStop[], who: AwayWho): ClientStop | null {
  return (
    stops
      .filter((s) => !s.undone_at && (who.clientId ? s.client_id === who.clientId : !s.client_id && s.guest_key === diaryKey(who.name)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/** Would this upcoming session come off when they stop from that moment? Same rule as stop_client_training. */
const comesOff = (s: LiveSession, fromMs: number) =>
  new Date(s.starts_at).getTime() >= fromMs && (s.status === "booked" || (s.status === "cancelled" && !!s.away_id));

// A client stops training with the coach (GRIZZ, 2026-11-10: "remove a client
// from the calendar if they stop training with you. Then replace with
// available and turn green"). Tap the first day they don't train any more:
// every session of theirs from then on comes off (weekly ones too) and the
// times show green, Available. Past sessions and invoices stay.
export default function StopTrainingModal({
  visible,
  who,
  sessions,
  stop,
  onClose,
  onDone,
}: {
  visible: boolean;
  who: AwayWho | null;
  sessions: LiveSession[];
  /** Already stopped: show the day and Undo. */
  stop: ClientStop | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = dayKey(new Date());
  const tomorrow = (() => {
    const d = new Date();
    return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  })();
  const [month, setMonth] = useState(monthStart(new Date()));
  const [from, setFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setMonth(monthStart(new Date()));
    setFrom(null);
  }, [visible]);

  const first = (who?.name ?? "They").trim().split(/\s+/)[0] || "They";
  const mine = useMemo(() => (who ? sessionsOf(sessions, who).filter((s) => s.status !== "removed") : []), [sessions, who]);
  const days = useMemo(() => new Set(mine.filter((s) => new Date(s.starts_at).getTime() > Date.now()).map((s) => dayKey(s.starts_at))), [mine]);
  const hit = useMemo(() => {
    if (!from) return [];
    const [y, m, d] = from.split("-").map(Number);
    const fromMs = Math.max(Date.now(), new Date(y, m - 1, d).getTime());
    return mine.filter((s) => comesOff(s, fromMs));
  }, [mine, from]);
  // Catch-ups still owed to them: the coach decides those (credit or book).
  const owed = mine.filter((s) => s.charge === "makeup" && !s.makeup_session_id && (s.status === "cancelled" || s.status === "no_show")).length;

  if (!who) return null;

  const save = async () => {
    if (!from) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("stop_client_training", {
      p_client: who.clientId,
      p_guest: who.clientId ? null : who.name,
      p_from: from,
    });
    setBusy(false);
    if (error) return Alert.alert("Couldn't do that", error.message);
    onDone();
    const n = data?.removed ?? 0;
    Alert.alert(
      `🛑 ${first} is off your calendar`,
      `${n ? `${n} session${n === 1 ? "" : "s"} from ${dayText(from)} came off.` : `Nothing of theirs was booked from ${dayText(from)}.`} Those times show green: Available. Their weekly times won't come back. Past sessions and invoices stay.${
        owed ? `\n\n${first} still has ${owed} catch-up${owed === 1 ? "" : "s"} owed: on Today › Catch-ups, tap Can't do one: Credit, or book it.` : ""
      }\n\nTapped by mistake? Open ${first} again and tap Undo.`
    );
  };

  const undo = () =>
    Alert.alert(`Is ${first} training again?`, "Their sessions come back on your calendar, and their weekly times carry on.", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, put them back",
        onPress: async () => {
          if (!stop) return;
          setBusy(true);
          const { data, error } = await supabase.rpc("undo_client_stop", { p_id: stop.id });
          setBusy(false);
          if (error) return Alert.alert("Couldn't do that", error.message);
          onDone();
          const taken = (data?.taken ?? []).map((t) => `${dayLabel(t)}, ${clockLabel(t)}`);
          Alert.alert(
            `${first} is back on your calendar ✅`,
            taken.length
              ? `Their sessions are booked again, except ${taken.join("; ")}: you gave ${taken.length === 1 ? "that slot" : "those slots"} to someone else.`
              : "Their sessions are booked again."
          );
        },
      },
    ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }}>
          <Text style={styles.title}>🛑 {who.name} stopped training</Text>
          {stop ? (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>Stopped from {dayText(stop.from_on)}</Text>
              <Text style={styles.meta}>Their sessions from then on are off your calendar. Those times show green: Available.</Text>
              <Pressable style={styles.button} onPress={undo} disabled={busy}>
                {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Undo: they're training again</Text>}
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.helper}>
                Every session of {first}'s from that day comes off your calendar, weekly ones too. The times turn green: Available. Past sessions and invoices stay.
              </Text>
              <Text style={styles.label}>First day they don't train</Text>
              <View style={styles.quick}>
                <Pressable style={[styles.chip, from === today && styles.chipOn]} onPress={() => setFrom(today)}>
                  <Text style={[styles.chipText, from === today && styles.chipTextOn]}>From today</Text>
                </Pressable>
                <Pressable style={[styles.chip, from === tomorrow && styles.chipOn]} onPress={() => setFrom(tomorrow)}>
                  <Text style={[styles.chipText, from === tomorrow && styles.chipTextOn]}>From tomorrow</Text>
                </Pressable>
              </View>
              <Text style={styles.meta}>Or tap a day:</Text>
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
                    const after = !!from && day >= from;
                    return (
                      <Pressable
                        key={di}
                        disabled={past}
                        style={[styles.cell, styles.day, past && { opacity: 0.3 }, after && styles.inside, day === from && styles.picked]}
                        onPress={() => setFrom(day)}
                      >
                        <Text style={[styles.num, after && styles.numInside]}>{Number(day.slice(8))}</Text>
                        {days.has(day) ? <View style={[styles.dot, after && styles.dotInside]} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <Text style={styles.meta}>A dot is a day they train.</Text>

              {from ? (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>From {dayText(from)}</Text>
                  <Text style={styles.meta}>
                    {hit.length
                      ? `${hit.length} session${hit.length === 1 ? "" : "s"} come${hit.length === 1 ? "s" : ""} off and turn${hit.length === 1 ? "s" : ""} green, Available: ${hit
                          .slice(0, 6)
                          .map((s) => `${dayLabel(s.starts_at)} ${clockLabel(s.starts_at)}`)
                          .join(", ")}${hit.length > 6 ? " and more" : ""}.`
                      : "Nothing of theirs is booked from that day."}{" "}
                    Their weekly times stop too.
                  </Text>
                </View>
              ) : null}

              <Pressable style={[styles.danger, (!from || busy) && { opacity: 0.5 }]} onPress={save} disabled={!from || busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.dangerText}>{from ? `🛑 Take ${first} off from ${dayText(from)}` : "Pick the first day they don't train"}</Text>
                )}
              </Pressable>
            </>
          )}

          <Pressable style={styles.outline} onPress={onClose}>
            <Text style={styles.outlineText}>Close</Text>
          </Pressable>
          <SafeBottom />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  title: { color: "#fff", fontSize: 19, fontWeight: "800", marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 17 },
  quick: { flexDirection: "row", gap: 8, marginBottom: 4 },
  chip: { flex: 1, borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  chipTextOn: { color: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 6 },
  arrow: { paddingHorizontal: 14, paddingVertical: 4 },
  arrowText: { color: BRAND_GOLD, fontSize: 28, fontWeight: "700" },
  monthTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row" },
  head: { flex: 1, textAlign: "center", color: "#64748B", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cell: { flex: 1, aspectRatio: 1, margin: 2 },
  day: { backgroundColor: "#1E293B", borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1E293B" },
  inside: { backgroundColor: "#14532D", borderColor: "#22C55E" },
  picked: { borderColor: BRAND_GOLD, borderWidth: 2 },
  num: { color: "#CBD5E1", fontSize: 14, fontWeight: "600" },
  numInside: { color: "#fff", fontWeight: "800" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#94A3B8", marginTop: 3 },
  dotInside: { backgroundColor: "#22C55E" },
  preview: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginTop: 14, borderLeftWidth: 4, borderLeftColor: "#22C55E" },
  previewTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  danger: { backgroundColor: "#B91C1C", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  dangerText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  // White on red in light mode too.
}, ["danger", "dangerText"]);
