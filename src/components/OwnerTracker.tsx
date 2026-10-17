import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { money, monthLabel } from "@/lib/billing";
import { trackerTotals, trainerPlanLine } from "@/lib/tracker";
import type { BillingCurrency, OwnerTrackerRow } from "@/types/database";

const SIDES: { currency: BillingCurrency; label: string }[] = [
  { currency: "ZAR", label: "🇿🇦 South Africa" },
  { currency: "USD", label: "🌍 International" },
];

// The owner's tracker (0105): every trainer's clients, the monthly client
// fees and trainer subscriptions, split South Africa and International.
export default function OwnerTracker() {
  const [rows, setRows] = useState<OwnerTrackerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrainers, setShowTrainers] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("owner_tracker");
    if (err) setError(err.message);
    else setRows(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Text style={styles.hint}>Couldn't load the tracker: {error}</Text>;
  if (!rows) return <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 24 }} />;

  const today = todayIso();
  const t = trackerTotals(rows, today);

  return (
    <>
      <Text style={styles.heading}>Clients</Text>
      <View style={styles.row}>
        <Stat value={String(t.clients.active)} label="Active" />
        <Stat value={String(t.clients.sa)} label="🇿🇦 SA" />
        <Stat value={String(t.clients.international)} label="🌍 International" />
      </View>
      <Text style={styles.hint}>
        Includes your own {t.clients.ownActive}. {t.trainers} trainer{t.trainers === 1 ? "" : "s"}
        {t.onTrial ? `, ${t.onTrial} on trial` : ""}
        {t.freeUse ? `, ${t.freeUse} on free use` : ""}.
      </Text>

      <Text style={styles.heading}>Monthly client fees · {monthLabel(today)}</Text>
      <View style={styles.row}>
        {SIDES.map(({ currency, label }) => (
          <View key={currency} style={styles.box}>
            <Text style={styles.boxLabel}>{label}</Text>
            <Text style={styles.big}>{money(t.money[currency].clientFeesNow, currency)}</Text>
            <Text style={styles.small}>due this month</Text>
            <Text style={styles.small}>{money(t.money[currency].clientFeesFull, currency)} a month once trials end</Text>
          </View>
        ))}
      </View>

      <Text style={styles.heading}>Trainer subs</Text>
      <View style={styles.row}>
        {SIDES.map(({ currency, label }) => (
          <View key={currency} style={styles.box}>
            <Text style={styles.boxLabel}>{label}</Text>
            <Text style={styles.big}>{money(t.money[currency].subsMonthly, currency)}</Text>
            <Text style={styles.small}>a month from {t.money[currency].paidSubs} paid plan{t.money[currency].paidSubs === 1 ? "" : "s"}</Text>
            <Text style={styles.small}>Paid in since the 1st: {money(t.money[currency].paidThisMonth, currency)}</Text>
          </View>
        ))}
      </View>

      {t.noRegion > 0 && (
        <Text style={styles.warn}>
          {t.noRegion} trainer{t.noRegion === 1 ? " has" : "s have"} no country yet, so they're not in SA or International.
          Set their currency on Trainers → Billing.
        </Text>
      )}

      <Pressable style={styles.toggle} onPress={() => setShowTrainers((v) => !v)}>
        <Text style={styles.toggleText}>
          {showTrainers ? "▾" : "▸"} Each trainer ({rows.length})
        </Text>
      </Pressable>
      {showTrainers &&
        rows.map((r) => (
          <View key={r.trainer_id} style={styles.trainerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trainerName} numberOfLines={1}>
                {r.region === "SA" ? "🇿🇦 " : r.region === "International" ? "🌍 " : ""}
                {r.name}
              </Text>
              <Text style={styles.small}>{trainerPlanLine(r, today)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.trainerName}>
                {r.clients_active} client{r.clients_active === 1 ? "" : "s"}
              </Text>
              {!r.is_owner && (
                <Text style={styles.small}>{money(Number(r.client_fee_full), r.currency)} a month</Text>
              )}
            </View>
          </View>
        ))}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.big}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: "#1E293B", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  box: { flex: 1, backgroundColor: "#1E293B", borderRadius: 12, padding: 12 },
  boxLabel: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginBottom: 4 },
  big: { color: "#fff", fontSize: 22, fontWeight: "800" },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  hint: { color: "#64748B", fontSize: 12, marginTop: 6 },
  warn: { color: "#F59E0B", fontSize: 12, marginTop: 12 },
  toggle: { marginTop: 16, paddingVertical: 8 },
  toggleText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  trainerRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8, gap: 10 },
  trainerName: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
