import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { KIND_STYLE, catchUpDeadline, catchUpDue, clockLabel, dayLabel } from "@/lib/liveSessions";
import type { LiveSession } from "@/types/database";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

// Catch-ups owed, each with the day it has to be booked by (GRIZZ,
// 2026-11-02: "If the trainer doesn't do the catch-up by the end of the month
// he needs to credit them or try do the catch-up the following month. This
// needs to be decided before invoicing."). Once that day has passed the coach
// picks 🟢 Credit or ➡️ Next month; invoices can't be sent until then.
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
  const now = new Date();
  const rows = catchUps
    .map((s) => ({ s, due: catchUpDue(s, now) }))
    .filter((r) => !onlyLate || r.due === "late")
    .sort((a, b) => (a.due === "late" ? 0 : 1) - (b.due === "late" ? 0 : 1) || a.s.starts_at.localeCompare(b.s.starts_at));
  if (!rows.length) return null;
  const late = rows.filter((r) => r.due === "late").length;

  const decide = async (s: LiveSession, choice: "credit" | "next") => {
    setBusy(s.id + choice);
    const { error } = await supabase.rpc("decide_catch_up", { p_id: s.id, p_choice: choice });
    setBusy(null);
    if (error) return Alert.alert("Couldn't save", error.message);
    onChanged();
  };
  const dueLabel = (s: LiveSession) => dayLabel(`${catchUpDeadline(s)}T12:00:00`);

  return (
    <>
      <Text style={styles.title}>{onlyLate ? "⚠️ Decide before you send invoices" : "Catch-ups to book"}</Text>
      {late ? (
        <Text style={styles.warn}>
          {late === 1 ? "1 catch-up wasn't" : `${late} catch-ups weren't`} done in time. Credit {late === 1 ? "it" : "them"} or move {late === 1 ? "it" : "them"} to next month
          before you send invoices.
        </Text>
      ) : null}
      {rows.map(({ s, due }) => (
        <View key={s.id} style={[styles.row, { borderLeftColor: themeBg(due === "late" ? "#F59E0B" : KIND_STYLE.makeup.colour) }]}>
          <Text style={styles.rowTitle}>{name(s)}</Text>
          <Text style={styles.rowBody}>
            For {dayLabel(s.starts_at)}, {clockLabel(s.starts_at)} ({s.cancelled_by === "trainer" ? "you were away: the catch-up is charged" : "cancelled in time"})
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
      ))}
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
});
