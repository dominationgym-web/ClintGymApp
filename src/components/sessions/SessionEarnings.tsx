import React, { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import ModalSafeArea from "@/components/ModalSafeArea";
import { BRAND_GOLD } from "@/lib/brand";
import { KIND_STYLE, clockLabel, dayKey, dayLabel, sessionKind, sessionMoney } from "@/lib/liveSessions";
import { shiftWeek, takings, takingsByPerson, weekLabel, weekStart, weekTakings, type Takings } from "@/lib/sessionEarnings";
import type { BillingCurrency, LiveSession } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

type Who = (s: Pick<LiveSession, "client_id" | "guest_name">) => string;

// What each kind of session did to the day's money, for a session line.
function moneyNote(s: LiveSession, currency: BillingCurrency, now: Date): { text: string; colour: string } {
  const kind = sessionKind(s, now);
  const fee = sessionMoney(Number(s.fee) || 0, currency);
  if (kind === "done" || kind === "unconfirmed") return { text: `+${fee}`, colour: "#22C55E" };
  if (kind === "late" || kind === "no_show" || kind === "makeup") return { text: `+${fee} charged`, colour: "#22C55E" };
  if (kind === "trainer") return { text: "R0 · you cancelled", colour: "#3B82F6" };
  if (kind === "notice" || kind === "excused") return { text: "R0 · credited", colour: "#94A3B8" };
  if (kind === "decide") return { text: "charge or credit?", colour: "#F59E0B" };
  return { text: fee, colour: "#94A3B8" };
}

// The lines under a total: how it was made and what was lost.
function TakingsLines({ t, currency }: { t: Takings; currency: BillingCurrency }) {
  const lines: { text: string; colour: string }[] = [];
  if (t.trained) lines.push({ text: `✓ ${t.trained} trained · ${sessionMoney(t.made - t.fromCancellations, currency)}`, colour: "#CBD5E1" });
  if (t.charged) lines.push({ text: `✕ ${t.charged} late cancel / no-show charged · ${sessionMoney(t.fromCancellations, currency)}`, colour: "#EF4444" });
  if (t.creditedCount) lines.push({ text: `↺ ${t.creditedCount} cancelled in time, not charged · ${sessionMoney(t.credited, currency)} lost`, colour: "#22C55E" });
  if (t.byCoachCount) lines.push({ text: `🔵 ${t.byCoachCount} you cancelled or blocked out · ${sessionMoney(t.byCoach, currency)} lost`, colour: "#3B82F6" });
  if (t.undecidedCount) lines.push({ text: `! ${t.undecidedCount} still to decide: charge or credit? · ${sessionMoney(t.undecided, currency)}`, colour: "#F59E0B" });
  if (t.toComeCount) lines.push({ text: `• ${t.toComeCount} still to come · ${sessionMoney(t.toCome, currency)}`, colour: "#94A3B8" });
  if (!lines.length) lines.push({ text: "No sessions.", colour: "#94A3B8" });
  return (
    <>
      {lines.map((l) => (
        <Text key={l.text} style={[styles.line, { color: themeText(l.colour) }]}>
          {l.text}
        </Text>
      ))}
    </>
  );
}

// "💰 Today you made R1 400" on the 1 on 1 Today tab, with the week under it.
export function TodayMoneyCard({ sessions, currency, onWeek }: { sessions: LiveSession[]; currency: BillingCurrency; onWeek: () => void }) {
  const now = new Date();
  const today = dayKey(now);
  const t = takings(sessions.filter((s) => s.status !== "removed" && dayKey(s.starts_at) === today), now);
  const week = weekTakings(sessions, weekStart(now), now).total;
  const done = t.toComeCount === 0;
  const isSunday = now.getDay() === 0;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>💰 {done ? "Today you made" : "Made so far today"}</Text>
      <Text style={styles.big}>{sessionMoney(t.made, currency)}</Text>
      <TakingsLines t={t} currency={currency} />
      <Pressable style={styles.weekButton} onPress={onWeek} accessibilityRole="button">
        <Text style={styles.weekText}>
          📊 {isSunday ? "This week you made" : "This week so far"}: {sessionMoney(week.made, currency)}
        </Text>
        <Text style={styles.weekLink}>See the breakdown ›</Text>
      </Pressable>
    </View>
  );
}

// The week's money: total, each day (tap to open) and each client.
export function WeekMoneyModal({
  visible,
  sessions,
  currency,
  name,
  onClose,
}: {
  visible: boolean;
  sessions: LiveSession[];
  currency: BillingCurrency;
  name: Who;
  onClose: () => void;
}) {
  const now = new Date();
  const thisWeek = weekStart(now);
  const [monday, setMonday] = useState(thisWeek);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [view, setView] = useState<"days" | "clients">("days");
  const week = useMemo(() => weekTakings(sessions, monday), [sessions, monday]);
  const inWeek = useMemo(() => {
    const days = new Set(week.days.map((d) => d.day));
    return sessions.filter((s) => s.status !== "removed" && days.has(dayKey(s.starts_at)));
  }, [sessions, week]);
  const people = useMemo(() => takingsByPerson(inWeek, name), [inWeek, name]);
  // The screen keeps about three months of sessions.
  const earliest = shiftWeek(thisWeek, -12);
  const go = (by: number) => {
    setOpenDay(null);
    setMonday((m) => shiftWeek(m, by));
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Week's money</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.weekNav}>
          <Pressable onPress={() => go(-1)} disabled={monday <= earliest} hitSlop={12} accessibilityLabel="Week before">
            <Text style={[styles.arrow, monday <= earliest && styles.off]}>‹</Text>
          </Pressable>
          <Text style={styles.weekTitle}>{monday === thisWeek ? "This week" : weekLabel(monday)}</Text>
          <Pressable onPress={() => go(1)} disabled={monday >= thisWeek} hitSlop={12} accessibilityLabel="Next week">
            <Text style={[styles.arrow, monday >= thisWeek && styles.off]}>›</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{monday === thisWeek && now.getDay() !== 0 ? "Made so far" : "Made this week"}</Text>
            <Text style={styles.big}>{sessionMoney(week.total.made, currency)}</Text>
            <TakingsLines t={week.total} currency={currency} />
          </View>

          <View style={styles.switchRow}>
            {(["days", "clients"] as const).map((v) => (
              <Pressable key={v} style={[styles.chip, view === v && styles.chipOn]} onPress={() => setView(v)}>
                <Text style={[styles.chipText, view === v && styles.chipTextOn]}>{v === "days" ? "By day" : "By client"}</Text>
              </Pressable>
            ))}
          </View>

          {view === "days"
            ? week.days.map((d) => {
                const open = openDay === d.day;
                const list = inWeek.filter((s) => dayKey(s.starts_at) === d.day);
                return (
                  <View key={d.day} style={styles.dayBox}>
                    <Pressable style={styles.dayRow} onPress={() => setOpenDay(open ? null : d.day)} disabled={!d.sessions}>
                      <Text style={[styles.dayName, !d.sessions && styles.off]}>{dayLabel(`${d.day}T12:00:00`)}</Text>
                      <Text style={[styles.dayMoney, !d.sessions && styles.off]}>
                        {d.sessions ? sessionMoney(d.takings.made, currency) : "No sessions"}
                        {d.sessions ? (open ? "  ▴" : "  ▾") : ""}
                      </Text>
                    </Pressable>
                    {open ? (
                      <View style={styles.dayDetail}>
                        <TakingsLines t={d.takings} currency={currency} />
                        {list.map((s) => {
                          const note = moneyNote(s, currency, now);
                          const kind = sessionKind(s, now);
                          return (
                            <View key={s.id} style={styles.sessionRow}>
                              <Text style={styles.sessionName} numberOfLines={1}>
                                {clockLabel(s.starts_at)} · {name(s)}
                              </Text>
                              <Text style={[styles.sessionMoney, { color: themeText(note.colour) }]}>
                                {kind === "booked" ? KIND_STYLE.booked.label : note.text}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })
            : people.map((p) => (
                <View key={p.name} style={styles.dayBox}>
                  <View style={styles.dayRow}>
                    <Text style={styles.dayName}>{p.name}</Text>
                    <Text style={styles.dayMoney}>{sessionMoney(p.takings.made, currency)}</Text>
                  </View>
                  <View style={styles.dayDetail}>
                    <TakingsLines t={p.takings} currency={currency} />
                  </View>
                </View>
              ))}
          {view === "clients" && !people.length ? <Text style={styles.line}>No sessions this week.</Text> : null}
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  title: { color: "#fff", fontSize: 19, fontWeight: "700" },
  close: { color: BRAND_GOLD, fontSize: 16, fontWeight: "700" },
  weekNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24 },
  arrow: { color: BRAND_GOLD, fontSize: 30, fontWeight: "700" },
  off: { opacity: 0.35 },
  weekTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: "#1E293B", borderRadius: 14, padding: 14, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: BRAND_GOLD },
  cardLabel: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700" },
  big: { color: "#fff", fontSize: 28, fontWeight: "800", marginVertical: 4 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 3 },
  weekButton: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#334155" },
  weekText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  weekLink: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 2 },
  switchRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: { flex: 1, borderRadius: 18, paddingVertical: 8, alignItems: "center", backgroundColor: "#1E293B" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#94A3B8", fontWeight: "700" },
  chipTextOn: { color: "#0F172A" },
  dayBox: { backgroundColor: "#1E293B", borderRadius: 12, marginBottom: 8 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  dayName: { color: "#fff", fontSize: 15, fontWeight: "700", flexShrink: 1 },
  dayMoney: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dayDetail: { paddingHorizontal: 12, paddingBottom: 12 },
  sessionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, gap: 8 },
  sessionName: { color: "#CBD5E1", fontSize: 13, flexShrink: 1 },
  sessionMoney: { fontSize: 13, fontWeight: "700" },
});
