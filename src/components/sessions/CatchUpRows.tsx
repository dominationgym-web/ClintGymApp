import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import SafeBottom from "@/components/SafeBottom";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { KIND_STYLE, catchUpDeadline, catchUpDue, clockLabel, dayLabel } from "@/lib/liveSessions";
import type { LiveSession } from "@/types/database";
import { catchUpWhoKey, groupCatchUps } from "@/lib/catchUpGroups";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

type Due = "late" | "soon" | "ok";
type Row = { s: LiveSession; due: Due };

/** "Mon 3 Nov 06:00, Wed 5 Nov 06:00 and 2 more". */
const dayList = (rows: Row[], max = 3) =>
  rows
    .slice(0, max)
    .map((r) => `${dayLabel(r.s.starts_at)} ${clockLabel(r.s.starts_at)}`)
    .join(", ") + (rows.length > max ? ` and ${rows.length - max} more` : "");

const reason = (s: LiveSession) =>
  s.cancelled_by === "trainer" ? "you were away: the catch-up is charged" : s.away_id ? "they were away" : "cancelled in time";

// Catch-ups owed, each with the day it has to be booked by (GRIZZ,
// 2026-11-02: "If the trainer doesn't do the catch-up by the end of the month
// he needs to credit them or try do the catch-up the following month. This
// needs to be decided before invoicing."). Once that day has passed the coach
// picks 🟢 Credit or ➡️ Next month; invoices can't be sent until then.
//
// A client owing several shows as one slot with the count (GRIZZ, 2026-11-13:
// "only show one slot but with the number of catch ups ... if you want to
// remove those catchups its one touch or the option to select some to remove
// and others to keep"). Removing credits them, the same as Can't do one: Credit.
export default function CatchUpRows({
  catchUps,
  name,
  onCatchUp,
  onChanged,
  onlyLate,
}: {
  catchUps: LiveSession[];
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  /** Book it: find a gap on the calendar. */
  onCatchUp?: (s: LiveSession) => void;
  onChanged: () => void;
  /** Just the ones to decide before invoicing. */
  onlyLate?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const now = new Date();
  const rows: Row[] = catchUps
    .map((s) => ({ s, due: catchUpDue(s, now) }))
    .filter((r) => !onlyLate || r.due === "late")
    .sort((a, b) => (a.due === "late" ? 0 : 1) - (b.due === "late" ? 0 : 1) || a.s.starts_at.localeCompare(b.s.starts_at));
  if (!rows.length) return null;
  const late = rows.filter((r) => r.due === "late").length;
  const groups = groupCatchUps(rows);

  const decide = async (s: LiveSession, choice: "credit" | "next") => {
    setBusy(s.id + choice);
    const { error } = await supabase.rpc("decide_catch_up", { p_id: s.id, p_choice: choice });
    setBusy(null);
    if (error) return Alert.alert("Couldn't save", error.message);
    onChanged();
  };
  const decideMany = async (list: LiveSession[], choice: "credit" | "next", key: string) => {
    setBusy(key);
    const results = await Promise.all(list.map((s) => supabase.rpc("decide_catch_up", { p_id: s.id, p_choice: choice })));
    setBusy(null);
    const failed = results.filter((r) => r.error);
    if (failed.length) Alert.alert("Couldn't save them all", `${failed.length} of ${list.length} didn't save. ${failed[0].error?.message ?? ""}`);
    onChanged();
    return !failed.length;
  };
  const removeMany = (list: LiveSession[], key: string, after?: () => void) => {
    const who = (name(list[0]) || "Client").split(" ")[0];
    const n = list.length;
    Alert.alert(
      n === 1 ? `Remove 1 of ${who}'s catch-ups?` : `Remove ${n} of ${who}'s catch-ups?`,
      `${n === 1 ? "It's" : "They're"} credited: no catch-up, and ${n === 1 ? "it comes" : "they come"} off ${who}'s next invoice.`,
      [
        { text: "Back", style: "cancel" },
        {
          text: n === 1 ? "Remove it" : `Remove ${n}`,
          onPress: async () => {
            if (await decideMany(list, "credit", key)) after?.();
          },
        },
      ],
    );
  };
  const credit = (s: LiveSession) =>
    Alert.alert(`Credit ${name(s)}?`, "No catch-up for this session. It comes off their next invoice instead.", [
      { text: "Back", style: "cancel" },
      { text: "Credit", onPress: () => decide(s, "credit") },
    ]);
  const dueLabel = (s: LiveSession) => dayLabel(`${catchUpDeadline(s)}T12:00:00`);
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const single = ({ s, due }: Row) => (
    <View key={s.id} style={[styles.row, { borderLeftColor: themeBg(due === "late" ? "#F59E0B" : KIND_STYLE.makeup.colour) }]}>
      <Text style={styles.rowTitle}>{name(s)}</Text>
      <Text style={styles.rowBody}>
        For {dayLabel(s.starts_at)}, {clockLabel(s.starts_at)} ({reason(s)})
      </Text>
      <Text style={[styles.due, { color: themeText(due === "ok" ? "#94A3B8" : "#F59E0B") }]}>
        {due === "late" ? `⚠️ Not done by ${dueLabel(s)}: credit it or move it to next month` : `Book by ${dueLabel(s)}${due === "soon" ? " ⏳" : ""}`}
      </Text>
      <View style={styles.actions}>
        {onCatchUp ? (
          // Green like the open slots, to get catch-ups booked (GRIZZ, 2026-11-03).
          <Pressable style={styles.gapButton} onPress={() => onCatchUp(s)}>
            <Text style={styles.gapButtonText}>Find a gap ›</Text>
          </Pressable>
        ) : null}
        {due !== "late" && !onlyLate ? (
          // Some clients can't do catch-ups because of when they train:
          // credit them straight away (GRIZZ, 2026-11-08).
          <Pressable style={styles.outline} onPress={() => credit(s)} disabled={!!busy}>
            {busy === s.id + "credit" ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.outlineText}>Can't do one: 🟢 Credit</Text>}
          </Pressable>
        ) : null}
        {due === "late" ? (
          <>
            <Pressable style={styles.outline} onPress={() => decide(s, "credit")} disabled={!!busy}>
              {busy === s.id + "credit" ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.outlineText}>🟢 Credit</Text>}
            </Pressable>
            <Pressable style={styles.outline} onPress={() => decide(s, "next")} disabled={!!busy}>
              {busy === s.id + "next" ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.outlineText}>Next month</Text>}
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );

  const grouped = (group: Row[]) => {
    const first = group[0];
    const lateOnes = group.filter((r) => r.due === "late").map((r) => r.s);
    const key = catchUpWhoKey(first.s);
    const n = group.length;
    return (
      <View key={key} style={[styles.row, { borderLeftColor: themeBg(lateOnes.length ? "#F59E0B" : KIND_STYLE.makeup.colour) }]}>
        <View style={styles.headLine}>
          <Text style={[styles.rowTitle, { flex: 1 }]}>{name(first.s)}</Text>
          <View style={styles.count}>
            <Text style={styles.countText}>{n} catch-ups</Text>
          </View>
        </View>
        <Text style={styles.rowBody}>For {dayList(group)}</Text>
        <Text style={[styles.due, { color: themeText(lateOnes.length || first.due !== "ok" ? "#F59E0B" : "#94A3B8") }]}>
          {lateOnes.length
            ? `⚠️ ${lateOnes.length === 1 ? "1 wasn't" : `${lateOnes.length} weren't`} done in time: remove (credit) or move to next month`
            : `First one: book by ${dueLabel(first.s)}${first.due === "soon" ? " ⏳" : ""}`}
        </Text>
        <View style={styles.actions}>
          {onCatchUp ? (
            <Pressable style={styles.gapButton} onPress={() => onCatchUp(first.s)}>
              <Text style={styles.gapButtonText}>Find a gap ›</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.outline} onPress={() => removeMany(group.map((r) => r.s), key + "all")} disabled={!!busy}>
            {busy === key + "all" ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.outlineText}>🟢 Remove all {n}</Text>}
          </Pressable>
          <Pressable
            style={styles.outline}
            onPress={() => {
              setPicked(new Set());
              setPicking(group);
            }}
            disabled={!!busy}
          >
            <Text style={styles.outlineText}>Pick which ›</Text>
          </Pressable>
          {lateOnes.length ? (
            <Pressable style={styles.outline} onPress={() => decideMany(lateOnes, "next", key + "next")} disabled={!!busy}>
              {busy === key + "next" ? (
                <ActivityIndicator color={themeText(BRAND_GOLD)} />
              ) : (
                <Text style={styles.outlineText}>{lateOnes.length === 1 ? "Late one" : `${lateOnes.length} late`} to next month</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <>
      <Text style={styles.title}>{onlyLate ? "⚠️ Decide before you send invoices" : "Catch-ups to book"}</Text>
      {late ? (
        <Text style={styles.warn}>
          {late === 1 ? "1 catch-up wasn't" : `${late} catch-ups weren't`} done in time. Credit {late === 1 ? "it" : "them"} or move {late === 1 ? "it" : "them"} to next month
          before you send invoices.
        </Text>
      ) : null}
      {groups.map((group) => (group.length === 1 || onlyLate ? group.map(single) : grouped(group)))}

      {picking ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setPicking(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                {name(picking[0].s)}: {picking.length} catch-ups
              </Text>
              <Text style={styles.helper}>Tap the ones to remove. They're credited and come off the next invoice. The rest stay on your list.</Text>
              <ScrollView style={{ flexGrow: 0, flexShrink: 1 }}>
                {picking.map(({ s, due }) => {
                  const on = picked.has(s.id);
                  return (
                    <Pressable key={s.id} style={[styles.pick, on && styles.pickOn]} onPress={() => toggle(s.id)}>
                      <View style={[styles.tick, on && styles.tickOn]}>
                        <Text style={styles.tickText}>{on ? "✓" : ""}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickTitle}>
                          {dayLabel(s.starts_at)}, {clockLabel(s.starts_at)}
                        </Text>
                        <Text style={[styles.pickBody, due === "late" && { color: themeText("#F59E0B") }]}>
                          {reason(s)}. {due === "late" ? `⚠️ Not done by ${dueLabel(s)}` : `Book by ${dueLabel(s)}`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                style={[styles.outline, styles.wide]}
                onPress={() => setPicked(picked.size === picking.length ? new Set() : new Set(picking.map((r) => r.s.id)))}
              >
                <Text style={styles.outlineText}>{picked.size === picking.length ? "Untick all" : "Tick all"}</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.wide, (!picked.size || !!busy) && { opacity: 0.5 }]}
                disabled={!picked.size || !!busy}
                onPress={() =>
                  removeMany(
                    picking.filter((r) => picked.has(r.s.id)).map((r) => r.s),
                    "pick",
                    () => setPicking(null),
                  )
                }
              >
                {busy === "pick" ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.buttonText}>{picked.size ? `🟢 Remove ${picked.size} picked` : "Tap the ones to remove"}</Text>
                )}
              </Pressable>
              <Pressable style={[styles.outline, styles.wide]} onPress={() => setPicking(null)}>
                <Text style={styles.outlineText}>Close</Text>
              </Pressable>
              <SafeBottom />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = themedStyles({
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  warn: { color: "#F59E0B", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#334155" },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  rowBody: { color: "#CBD5E1", fontSize: 14, marginTop: 4 },
  due: { fontSize: 13, marginTop: 4, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 8 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, minWidth: 90, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  gapButton: { backgroundColor: "#22C55E", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, minWidth: 90, alignItems: "center" },
  gapButtonText: { color: "#052E16", fontWeight: "800", fontSize: 14 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, minWidth: 90, alignItems: "center" },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  wide: { marginTop: 10, paddingVertical: 12 },
  headLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: { backgroundColor: "#F59E0B", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  sheetTitle: { color: "#fff", fontSize: 19, fontWeight: "800", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  pick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  pickOn: { borderColor: BRAND_GOLD },
  tick: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: "#64748B", alignItems: "center", justifyContent: "center" },
  tickOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  tickText: { color: "#0F172A", fontWeight: "900", fontSize: 15 },
  pickTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pickBody: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
});
