import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { regularLabel, sessionMoney } from "@/lib/liveSessions";
import { diaryKey, regularFromCalendar } from "@/lib/calendarRegular";
import type { BillingCurrency, LiveSession } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// The people on the 1 on 1 calendar who aren't in the app yet (names from a
// calendar import, 0174), each with the days and times worked out from the
// calendar and their own price per session (0178, GRIZZ 2026-11-01).
export default function DiaryPeople({
  sessions,
  currency,
  normalFee,
  onChanged,
}: {
  sessions: LiveSession[];
  currency: BillingCurrency;
  normalFee: number | null;
  onChanged: () => void;
}) {
  const { trainer } = useAuth();
  const [fees, setFees] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const loadFees = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase.from("diary_name_fees").select("name_key, fee").eq("trainer_id", trainer.id);
    setFees(Object.fromEntries((data ?? []).map((r) => [r.name_key, Number(r.fee)])));
  }, [trainer]);
  useEffect(() => {
    loadFees();
  }, [loadFees]);

  // One row per name (first spelling seen), people with sessions coming up first.
  const people = useMemo(() => {
    const now = Date.now();
    const byKey = new Map<string, { name: string; next: number; last: LiveSession }>();
    for (const s of sessions) {
      if (s.client_id || !s.guest_name || s.status === "removed") continue;
      const k = diaryKey(s.guest_name);
      if (!k || k.includes("???")) continue;
      const t = new Date(s.starts_at).getTime();
      const row = byKey.get(k) ?? { name: s.guest_name.trim(), next: Infinity, last: s };
      if (t >= now && t < row.next) row.next = t;
      if (t > new Date(row.last.starts_at).getTime()) row.last = s;
      byKey.set(k, row);
    }
    return [...byKey.entries()]
      .map(([key, r]) => ({ key, ...r, cal: regularFromCalendar(sessions, { name: r.name }) }))
      .sort((a, b) => (a.next === Infinity ? 1 : 0) - (b.next === Infinity ? 1 : 0) || a.name.localeCompare(b.name));
  }, [sessions]);

  if (!people.length) return null;

  const priceOf = (p: (typeof people)[number]) => fees[p.key] ?? Number(p.last.fee ?? normalFee ?? 0);
  const save = async (name: string) => {
    const fee = Number(typed.replace(",", "."));
    if (!typed.trim() || !Number.isFinite(fee) || fee < 0) return Alert.alert("Type a price", "The price per session, e.g. 350.");
    setBusy(true);
    const { error } = await supabase.rpc("set_diary_fee", { p_name: name, p_fee: fee });
    setBusy(false);
    if (error) return Alert.alert("Couldn't save the price", error.message);
    setOpen(null);
    loadFees();
    onChanged();
  };

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.title}>📅 On your calendar, not in the app yet</Text>
      <Text style={styles.meta}>Worked out from your calendar. Tap a name to set their price per session. When they join the app, tap one of their sessions › Link to their app account.</Text>
      {people.map((p) => {
        const on = open === p.key;
        return (
          <View key={p.key} style={styles.row}>
            <Pressable
              onPress={() => {
                setOpen(on ? null : p.key);
                setTyped(String(priceOf(p)));
              }}
            >
              <Text style={styles.name}>
                {p.name} · {sessionMoney(priceOf(p), currency)}
              </Text>
              <Text style={styles.meta}>{p.cal.regular.length ? `${regularLabel(p.cal.regular)}${p.cal.minutes ? ` · ${p.cal.minutes} min` : ""}` : "No regular times yet"}</Text>
            </Pressable>
            {on ? (
              <View style={styles.edit}>
                <TextInput style={styles.input} value={typed} onChangeText={setTyped} keyboardType="decimal-pad" placeholder="350" />
                <Pressable style={styles.button} onPress={() => save(p.name)} disabled={busy}>
                  {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Save</Text>}
                </Pressable>
              </View>
            ) : null}
            {on ? <Text style={styles.meta}>Their sessions from now on take the new price.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
  title: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 3, lineHeight: 17 },
  row: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginTop: 8 },
  name: { color: "#fff", fontSize: 15, fontWeight: "700" },
  edit: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  input: { width: 140, backgroundColor: "#F8FAFC", color: "#0F172A", borderRadius: 10, padding: 10, fontSize: 15 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  buttonText: { color: "#0F172A", fontWeight: "800" },
});
