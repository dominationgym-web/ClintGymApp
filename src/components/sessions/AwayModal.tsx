import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { clockLabel, dayKey, dayLabel, monthGrid, monthLabel, monthStart, shiftMonth } from "@/lib/liveSessions";
import { diaryKey } from "@/lib/calendarRegular";
import type { ClientAway, LiveSession } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";
import SafeBottom from "@/components/SafeBottom";

const HEAD = ["M", "T", "W", "T", "F", "S", "S"];

/** Who is away: an app client by id, or a diary-only name. */
export type AwayWho = { clientId: string | null; name: string };

/** This person's sessions (an app client's, or a diary name's). */
export function sessionsOf(sessions: LiveSession[], who: AwayWho): LiveSession[] {
  return sessions.filter((s) => (who.clientId ? s.client_id === who.clientId : !s.client_id && diaryKey(s.guest_name) === diaryKey(who.name)));
}

/** Their current (or next) away, if any. */
export function awayOf(aways: ClientAway[], who: AwayWho): ClientAway | null {
  const now = Date.now();
  return (
    aways
      .filter(
        (a) =>
          !a.ended_at &&
          !a.unpaid &&
          new Date(a.until_at).getTime() > now &&
          (who.clientId ? a.client_id === who.clientId : !a.client_id && a.guest_key === diaryKey(who.name))
      )
      .sort((a, b) => a.until_on.localeCompare(b.until_on))[0] ?? null
  );
}

/** Their hold for not paying (0203), if any. */
export function holdOf(aways: ClientAway[], who: AwayWho): ClientAway | null {
  return (
    aways.find(
      (a) => !a.ended_at && !!a.unpaid && (who.clientId ? a.client_id === who.clientId : !a.client_id && a.guest_key === diaryKey(who.name))
    ) ?? null
  );
}

/** "Fri 14 Nov" for "2026-11-14". */
const dayText = (key: string) => dayLabel(`${key}T12:00:00`);

/** "Mon 9 Nov to Fri 13 Nov", or "till Fri 13 Nov" for an away from 0184. */
export function awaySpan(a: Pick<ClientAway, "from_on" | "until_on">): string {
  if (!a.from_on) return `till ${dayText(a.until_on)}`;
  if (a.from_on === a.until_on) return `on ${dayText(a.until_on)}`;
  return `${dayText(a.from_on)} to ${dayText(a.until_on)}`;
}

// A client going away (GRIZZ, 2026-11-02): tap the last day they're away on a
// month calendar. Every session of theirs until then stays on the calendar
// with their name, in green: free to book someone else in.
export default function AwayModal({
  visible,
  who,
  sessions,
  away,
  onClose,
  onDone,
}: {
  visible: boolean;
  who: AwayWho | null;
  sessions: LiveSession[];
  /** Already away: show the date, Back early and Change the date. */
  away: ClientAway | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = dayKey(new Date());
  const [month, setMonth] = useState(monthStart(new Date()));
  // Tap the first day away, then the last (GRIZZ, 2026-11-02: "must select
  // day to start and day to finish").
  const [from, setFrom] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  // A week or more away: catch-ups or credit? (GRIZZ, 2026-11-13: "Most won't
  // be able to catchup 2 weeks worth. But give the trainer the option.")
  const [bank, setBank] = useState<"catchup" | "credit" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setMonth(monthStart(new Date()));
    setFrom(null);
    setUntil(null);
    setChanging(false);
    setBank(null);
  }, [visible]);

  const first = (who?.name ?? "They").split(" ")[0];
  const mine = useMemo(() => (who ? sessionsOf(sessions, who).filter((s) => s.status !== "removed") : []), [sessions, who]);
  const days = useMemo(() => new Set(mine.filter((s) => new Date(s.starts_at).getTime() > Date.now()).map((s) => dayKey(s.starts_at))), [mine]);
  // What turns green: their booked sessions from the first day to the end of the last.
  const hit = useMemo(() => {
    if (!from || !until) return [];
    const now = Date.now();
    return mine.filter((s) => {
      const d = dayKey(s.starts_at);
      return (s.status === "booked" || (s.status === "cancelled" && !!s.away_id)) && new Date(s.starts_at).getTime() > now && d >= from && d <= until;
    });
  }, [mine, from, until]);
  // First tap is the first day, second tap the last day; a third tap starts again.
  const pick = (day: string) => {
    setBank(null);
    if (!from || until || day < from) {
      setFrom(day);
      setUntil(null);
    } else setUntil(day);
  };

  if (!who) return null;
  const showCalendar = !away || changing;

  const long = !!from && !!until && daysBetween(from, until) >= 6;
  const credit = long && bank === "credit";
  const span = from && until ? (from === until ? `on ${dayText(from)}` : `${dayText(from)} to ${dayText(until)}`) : "";
  const save = async () => {
    if (!from || !until) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_client_away", {
      p_client: who.clientId,
      p_guest: who.clientId ? null : who.name,
      p_from: from,
      p_until: until,
      p_replace: away?.id ?? null,
      p_credit: credit,
    });
    setBusy(false);
    if (error) return Alert.alert("Couldn't mark them away", error.message);
    onDone();
    if (credit)
      return Alert.alert(
        `✈️ ${first} is away ${span}`,
        `Their sessions in that time are green on your calendar: free to book. Their name stays on each one. No catch-ups: they're credited and not charged.${who.clientId ? ` ${first} gets a message.` : ""}`
      );
    Alert.alert(
      `✈️ ${first} is away ${span}`,
      `Their sessions in that time are green on your calendar: free to book. Their name stays on each one, and they go on your catch-up list. Can't fit one in? Tap Can't do one: Credit there. Not caught up by month end? You pick Credit or Next month.${who.clientId ? ` ${first} gets a message.` : ""}`
    );
  };

  const backEarly = () =>
    Alert.alert(`Is ${first} back?`, "Their sessions from now on go back to booked.", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, they're back",
        onPress: async () => {
          if (!away) return;
          setBusy(true);
          const { data, error } = await supabase.rpc("end_client_away", { p_id: away.id });
          setBusy(false);
          if (error) return Alert.alert("Couldn't do that", error.message);
          onDone();
          const taken = ((data as { taken?: string[] } | null)?.taken ?? []).map((t) => `${dayLabel(t)}, ${clockLabel(t)}`);
          Alert.alert(
            `Welcome back, ${first}`,
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
          <Text style={styles.title}>✈️ {who.name} is away</Text>
          {away ? (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>Away {awaySpan(away)}</Text>
              <Text style={styles.meta}>Their sessions in that time are green on your calendar, free to book.</Text>
              <Pressable style={styles.button} onPress={backEarly} disabled={busy}>
                {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Back early: book their sessions again</Text>}
              </Pressable>
              {changing ? null : (
                <Pressable style={styles.outline} onPress={() => setChanging(true)}>
                  <Text style={styles.outlineText}>Change the date</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.helper}>Tap the first day away, then the last. Their sessions turn green: free to book.</Text>
          )}

          {showCalendar ? (
            <>
              <Text style={styles.label}>{!from ? "Tap the first day they're away" : !until ? "Now tap the last day they're away" : "Picked. Tap a day to start again"}</Text>
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
                        {days.has(day) ? <View style={[styles.dot, inside && styles.dotInside]} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <Text style={styles.meta}>A dot is a day they train.</Text>

              {from && until ? (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>Away {span}</Text>
                  <Text style={styles.meta}>
                    {hit.length
                      ? `${hit.length} session${hit.length === 1 ? "" : "s"} turn${hit.length === 1 ? "s" : ""} green, free to book: ${hit
                          .slice(0, 6)
                          .map((s) => `${dayLabel(s.starts_at)} ${clockLabel(s.starts_at)}`)
                          .join(", ")}${hit.length > 6 ? " ..." : ""}.${long ? "" : " They go on your catch-up list."}`
                      : "No sessions of theirs on your calendar in those days. Weekly sessions that fill in later turn green too."}
                  </Text>
                </View>
              ) : null}

              {long ? (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>Add them to the catch-up bank?</Text>
                  <Text style={styles.meta}>That's a long time away. Most clients can't catch up that many sessions.</Text>
                  <View style={styles.choices}>
                    <Pressable style={[styles.choice, bank === "catchup" && styles.choiceOn]} onPress={() => setBank("catchup")}>
                      <Text style={[styles.choiceText, bank === "catchup" && styles.choiceTextOn]}>🔁 Yes, catch-ups</Text>
                    </Pressable>
                    <Pressable style={[styles.choice, bank === "credit" && styles.choiceOn]} onPress={() => setBank("credit")}>
                      <Text style={[styles.choiceText, bank === "credit" && styles.choiceTextOn]}>🟢 No, credit them</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.meta}>
                    {bank === "catchup"
                      ? "Their sessions go on your catch-up list. Charged as usual, and you book catch-ups."
                      : bank === "credit"
                        ? "No catch-ups: they aren't charged for these sessions."
                        : "Tap one."}
                  </Text>
                </View>
              ) : null}

              <Pressable
                style={[styles.button, (!from || !until || busy || (long && !bank)) && { opacity: 0.5 }]}
                onPress={save}
                disabled={!from || !until || busy || (long && !bank)}
              >
                {busy ? (
                  <ActivityIndicator color={themeText("#0F172A")} />
                ) : (
                  <Text style={styles.buttonText}>{from && until && long && !bank ? "Pick catch-ups or credit first" : from && until ? `✈️ Away ${span}` : from ? "Now tap their last day away" : "Tap their first day away"}</Text>
                )}
              </Pressable>
            </>
          ) : null}

          <Pressable style={styles.outline} onPress={onClose}>
            <Text style={styles.outlineText}>Close</Text>
          </Pressable>
          <SafeBottom />
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Whole days from one "2026-11-14" to another. */
const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

const styles = themedStyles({
  choices: { flexDirection: "row", gap: 8, marginTop: 10 },
  choice: { flex: 1, borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  choiceOn: { backgroundColor: BRAND_GOLD },
  choiceText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  choiceTextOn: { color: "#0F172A" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  title: { color: "#fff", fontSize: 19, fontWeight: "800", marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 10 },
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
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
});
