import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { useAuth } from "@/context/AuthContext";
import { dayKey } from "@/lib/liveSessions";
import { holidayDay } from "@/lib/holidays";
import { askWindow, publicHolidaysBetween, type PublicHoliday } from "@/lib/publicHolidays";
import { trainerCountry } from "@/lib/clientPricing";
import type { LiveSession, PublicHolidayAnswer, SessionInvoice } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

type Question = PublicHoliday & { booked: LiveSession[] };

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

/** "Dave, Sharde and Jade". */
function nameList(names: string[]): string {
  const u = [...new Set(names)];
  if (u.length <= 1) return u.join("");
  return `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`;
}

// Public holidays before invoicing (GRIZZ, 2026-11-25: "see when there are
// public holidays and confirm with the trainers if they will be working on
// those public holidays. So that the invoicing can be done correctly ... And
// can it be location specific?"). Each public holiday in the trainer's country
// with 1 on 1 sessions booked is asked once, from the 15th for next month so
// it's answered before the 1st's invoices. Not working = a one-day coach
// holiday: clients are told, the sessions are cancelled free and go on the
// catch-up list, or are credited straight away. Drafts already made for that
// month are brought up to date.
export default function PublicHolidayCheck({
  sessions,
  drafts,
  name,
  onChanged,
  startOpen,
}: {
  sessions: LiveSession[];
  /** Draft invoices (any month): the holiday's month is rebuilt after an answer. */
  drafts: SessionInvoice[];
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  onChanged: () => void;
  /** Open straight away (Invoices tab); on Today it's one tap-to-open line. */
  startOpen?: boolean;
}) {
  const { trainer } = useAuth();
  const today = dayKey(new Date());
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [answered, setAnswered] = useState<Set<string> | null>(null);
  const [off, setOff] = useState<string | null>(null);
  const [shown, setShown] = useState(!!startOpen);
  const [busy, setBusy] = useState<string | null>(null);
  // Not working: each client's choice, by session (GRIZZ, 2026-11-25: "Let the
  // trainer decide based on clients choice. Some will want to catchup. Other
  // will be credited.").
  const [choice, setChoice] = useState<Record<string, "catch" | "credit">>({});
  const country = trainerCountry(trainer);

  const load = useCallback(async () => {
    if (!trainer) return;
    const w = askWindow(today);
    const [list, a] = await Promise.all([
      publicHolidaysBetween(country, w.from, w.until),
      supabase.from("trainer_public_holiday_answers").select("day").eq("trainer_id", trainer.id).gte("day", w.from).lte("day", w.until),
    ]);
    setHolidays(list);
    setAnswered(new Set((a.data ?? []).map((r: Pick<PublicHolidayAnswer, "day">) => r.day)));
  }, [trainer, country, today]);

  useEffect(() => {
    load();
  }, [load]);

  const questions: Question[] = useMemo(() => {
    if (!answered) return [];
    return holidays
      .filter((h) => !answered.has(h.day))
      .map((h) => ({
        ...h,
        booked: sessions.filter((s) => s.status === "booked" && dayKey(s.starts_at) === h.day && (s.client_id || s.guest_name)),
      }))
      .filter((q) => q.booked.length > 0);
  }, [holidays, answered, sessions]);

  if (!trainer || !questions.length) return null;

  const save = (q: Question, working: boolean, catchUps: boolean | null) =>
    supabase
      .from("trainer_public_holiday_answers")
      .upsert({ trainer_id: trainer.id, day: q.day, name: q.name, working, catch_ups: catchUps }, { onConflict: "trainer_id,day" });

  // The month's drafts follow the answer, so what's sent is right first time.
  const rebuildDrafts = async (day: string) => {
    const month = `${day.slice(0, 7)}-01`;
    await Promise.all(
      drafts
        .filter((d) => d.status === "draft" && d.month === month)
        .map((inv) =>
          inv.client_id
            ? supabase.rpc("build_session_invoice", { p_client: inv.client_id, p_month: inv.month })
            : supabase.rpc("build_diary_invoice", { p_name: inv.guest_name ?? inv.guest_key ?? "", p_month: inv.month })
        )
    );
  };

  const working = async (q: Question) => {
    setBusy(q.day + "work");
    const { error } = await save(q, true, null);
    setBusy(null);
    if (error) return Alert.alert("Couldn't save", error.message);
    setAnswered((a) => new Set([...(a ?? []), q.day]));
  };

  const notWorking = async (q: Question) => {
    setBusy(q.day + "off");
    const why = q.official ? `It's ${q.name}, a public holiday. No training that day.` : `It's ${q.name}. No training that day.`;
    const { error } = await supabase.rpc("add_trainer_holiday", { p_first: q.day, p_last: q.day, p_reason: why });
    if (error) {
      setBusy(null);
      return Alert.alert("Couldn't save", error.message);
    }
    // Everyone is on the catch-up list now; the ones picked for Credit come off it (not charged).
    const credit = q.booked.filter((s) => choice[s.id] === "credit").map((s) => s.id);
    if (credit.length) {
      const { data } = await supabase.from("live_sessions").select("id, charge, makeup_session_id").in("id", credit);
      const owed = (data ?? []).filter((s) => s.charge === "makeup" && !s.makeup_session_id);
      await Promise.all(owed.map((s) => supabase.rpc("decide_catch_up", { p_id: s.id, p_choice: "credit" })));
    }
    await save(q, false, credit.length === 0 ? true : credit.length === q.booked.length ? false : null);
    await rebuildDrafts(q.day);
    setBusy(null);
    setOff(null);
    setAnswered((a) => new Set([...(a ?? []), q.day]));
    onChanged();
  };

  const count = questions.length;
  if (!shown) {
    return (
      <Pressable style={styles.line} onPress={() => setShown(true)}>
        <Text style={styles.lineText}>
          📅 {count} public holiday{count === 1 ? "" : "s"} coming up: are you working?
        </Text>
        <Text style={styles.lineTap}>Answer ›</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.box}>
      <Pressable onPress={() => !startOpen && setShown(false)} disabled={startOpen}>
        <Text style={styles.title}>📅 Public holidays coming up{startOpen ? "" : "  ˄"}</Text>
      </Pressable>
      <Text style={styles.helper}>Are you working? Answer before the invoices go out so they're right.</Text>
      {questions.map((q) => {
        const who = nameList(q.booked.map((s) => firstName(name(s))));
        const n = q.booked.length;
        return (
          <View key={q.day} style={styles.card}>
            <Text style={styles.day}>
              {holidayDay(q.day)} · {q.name}
            </Text>
            {!q.official ? <Text style={styles.note}>Not a public holiday, but many people take it off.</Text> : null}
            <Text style={styles.body}>
              {n} session{n === 1 ? "" : "s"} booked: {who}
            </Text>
            {off === q.day ? (
              <>
                <Text style={styles.ask}>Clients are told you're off. What does each one want?</Text>
                {q.booked.map((sess) => {
                  const c = choice[sess.id];
                  const pick = (v: "catch" | "credit") => setChoice((m) => ({ ...m, [sess.id]: v }));
                  return (
                    <View key={sess.id} style={styles.person}>
                      <Text style={styles.personName}>{firstName(name(sess))}</Text>
                      <View style={styles.chips}>
                        <Pressable style={[styles.chip, c === "catch" && styles.chipCatch]} onPress={() => pick("catch")} disabled={!!busy}>
                          <Text style={[styles.chipText, c === "catch" && styles.chipCatchText]}>🔁 Catch-up</Text>
                        </Pressable>
                        <Pressable style={[styles.chip, c === "credit" && styles.chipCredit]} onPress={() => pick("credit")} disabled={!!busy}>
                          <Text style={[styles.chipText, c === "credit" && styles.chipCreditText]}>🟢 Credit</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                <Text style={styles.small}>Catch-up: still charged, the catch-up is free. Credit: not charged.</Text>
                {(() => {
                  const left = q.booked.filter((x) => !choice[x.id]).length;
                  return (
                    <Pressable style={[styles.button, styles.save, left > 0 && styles.dim]} onPress={() => notWorking(q)} disabled={!!busy || left > 0}>
                      {busy === q.day + "off" ? (
                        <ActivityIndicator color="#0F172A" />
                      ) : (
                        <Text style={styles.buttonText}>{left > 0 ? `Pick for ${left === n ? "each person" : `${left} more`}` : "🌴 Save my day off"}</Text>
                      )}
                    </Pressable>
                  );
                })()}
                <Pressable onPress={() => setOff(null)} hitSlop={10} disabled={!!busy}>
                  <Text style={styles.back}>‹ Back</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.actions}>
                <Pressable style={[styles.button, styles.half]} onPress={() => working(q)} disabled={!!busy}>
                  {busy === q.day + "work" ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>✅ I'm working</Text>}
                </Pressable>
                <Pressable style={[styles.outline, styles.half]} onPress={() => setOff(q.day)} disabled={!!busy}>
                  <Text style={styles.outlineText}>🌴 Not working</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
  box: { marginBottom: 16 },
  line: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 10, borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12, gap: 8 },
  lineText: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },
  lineTap: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: BRAND_GOLD },
  day: { color: "#fff", fontSize: 15, fontWeight: "700" },
  note: { color: "#F59E0B", fontSize: 13, marginTop: 2 },
  body: { color: "#CBD5E1", fontSize: 14, marginTop: 4 },
  ask: { color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 10, marginTop: 10 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, minWidth: 130, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  half: { flexGrow: 1, flexBasis: 130 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, minWidth: 130, alignItems: "center", justifyContent: "center" },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 8 },
  person: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10 },
  personName: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1, minWidth: 60 },
  chips: { flexDirection: "row", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#475569", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7 },
  chipText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  chipCatch: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipCatchText: { color: "#0F172A" },
  chipCredit: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  chipCreditText: { color: "#052E16" },
  save: { marginTop: 12, paddingVertical: 12 },
  dim: { opacity: 0.5 },
  back: { color: BRAND_GOLD, fontSize: 14, fontWeight: "600", marginTop: 10 },
});
