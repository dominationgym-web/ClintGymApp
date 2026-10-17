import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/billing";
import { EXTRA_DAYS, incomeSummary, parsePrice } from "@/lib/clientPricing";
import type { AccessStatus, BillingCurrency, ClientPrices, PricePackage } from "@/types/database";

type Row = { id: string; price_package: PricePackage | null; archived_at: string | null; access_status: AccessStatus };
type Draft = { currency: BillingCurrency; mode: "table" | "flat"; online: string; extra: Record<string, string>; flat: string };

const toText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

function draftFrom(prices: ClientPrices | null | undefined): Draft {
  return {
    currency: prices?.currency ?? "ZAR",
    mode: prices?.mode ?? "table",
    online: toText(prices?.online),
    extra: Object.fromEntries(EXTRA_DAYS.map((d) => [d, toText(prices?.extra?.[d])])),
    flat: toText(prices?.flat),
  };
}

// A trainer's own income (0106): what their active clients pay them a month,
// and the price table (or one monthly fee) it's worked out from. Each client's
// package is picked on their profile.
export default function TrainerIncome() {
  const { trainer, refreshProfile } = useAuth();
  const [clients, setClients] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState(!trainer?.client_prices);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(trainer?.client_prices));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("clients")
      .select("id, price_package, archived_at, access_status")
      .eq("trainer_id", trainer.id);
    setClients((data as Row[] | null) ?? []);
  }, [trainer?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!trainer) return null;
  const prices = trainer.client_prices ?? null;
  const currency = prices?.currency ?? draft.currency;
  const summary = clients ? incomeSummary(prices, clients) : null;

  const save = async () => {
    const next: ClientPrices = {
      currency: draft.currency,
      mode: draft.mode,
      online: parsePrice(draft.online),
      extra: Object.fromEntries(EXTRA_DAYS.map((d) => [d, parsePrice(draft.extra[d] ?? "")])),
      flat: parsePrice(draft.flat),
    };
    if (next.mode === "flat" ? next.flat === null : next.online === null && EXTRA_DAYS.every((d) => next.extra?.[d] === null)) {
      Alert.alert("Add a price", "Fill in at least one price first.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("trainers").update({ client_prices: next }).eq("id", trainer.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    await refreshProfile();
    setEditing(false);
  };

  const symbol = draft.currency === "ZAR" ? "R" : "$";
  const priceInput = (value: string, onChange: (v: string) => void, label: string) => (
    <View style={styles.inputWrap}>
      <Text style={styles.symbol}>{symbol}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor="#475569"
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <>
      <Text style={styles.heading}>Your monthly income</Text>
      {!summary ? (
        <ActivityIndicator color={BRAND_GOLD} />
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.stat}>
              <Text style={styles.big}>{money(summary.total, currency)}</Text>
              <Text style={styles.small}>a month</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.big}>{summary.active}</Text>
              <Text style={styles.small}>active clients</Text>
            </View>
          </View>
          {summary.lines.map((l) => (
            <View key={l.key} style={styles.line}>
              <Text style={styles.lineLabel}>
                {l.label} · {l.clients} × {money(l.price, currency)}
              </Text>
              <Text style={styles.lineTotal}>{money(l.total, currency)}</Text>
            </View>
          ))}
          {summary.unpriced > 0 && (
            <Text style={styles.warn}>
              {summary.unpriced} client{summary.unpriced === 1 ? " has" : "s have"} no price yet.{" "}
              {prices?.mode === "flat" ? "Add your monthly fee below." : "Open each client and pick their package."}
            </Text>
          )}
        </>
      )}

      <Pressable style={styles.toggle} onPress={() => setEditing((v) => !v)}>
        <Text style={styles.toggleText}>{editing ? "▾" : "▸"} Your prices</Text>
      </Pressable>
      {editing && (
        <View style={styles.box}>
          <Text style={styles.label}>Currency</Text>
          <View style={styles.chips}>
            {(["ZAR", "USD"] as const).map((c) => (
              <Pressable key={c} style={[styles.chip, draft.currency === c && styles.chipOn]} onPress={() => setDraft({ ...draft, currency: c })}>
                <Text style={[styles.chipText, draft.currency === c && styles.chipTextOn]}>{c === "ZAR" ? "Rand (R)" : "Dollars ($)"}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>How you charge</Text>
          <View style={styles.chips}>
            {([
              ["table", "Price table"],
              ["flat", "One monthly fee"],
            ] as const).map(([m, label]) => (
              <Pressable key={m} style={[styles.chip, draft.mode === m && styles.chipOn]} onPress={() => setDraft({ ...draft, mode: m })}>
                <Text style={[styles.chipText, draft.mode === m && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {draft.mode === "flat" ? (
            <>
              <Text style={styles.hint}>Every client pays the same each month.</Text>
              <View style={styles.tableRow}>
                <Text style={styles.cell}>Monthly fee</Text>
                {priceInput(draft.flat, (v) => setDraft({ ...draft, flat: v }), "Monthly fee")}
              </View>
            </>
          ) : (
            <>
              <View style={styles.tableRow}>
                <Text style={styles.cell}>Fully Online</Text>
                {priceInput(draft.online, (v) => setDraft({ ...draft, online: v }), "Fully Online price")}
              </View>
              <Text style={styles.tableHeading}>1-on-1 clients using the app for extra days</Text>
              {EXTRA_DAYS.map((d) => (
                <View key={d} style={styles.tableRow}>
                  <Text style={styles.cell}>
                    {d} extra day{d === "1" ? "" : "s"} a week
                  </Text>
                  {priceInput(draft.extra[d] ?? "", (v) => setDraft({ ...draft, extra: { ...draft.extra, [d]: v } }), `${d} extra days price`)}
                </View>
              ))}
              <Text style={styles.hint}>All prices are per client per month. Leave any you don't offer blank.</Text>
            </>
          )}
          <Pressable style={styles.button} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Save prices</Text>}
          </Pressable>
        </View>
      )}
      <Text style={styles.hint}>Test run: try your prices and see how it works. Clients don't see this.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: "#1E293B", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  big: { color: "#fff", fontSize: 22, fontWeight: "800" },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  line: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1E293B", borderRadius: 10, padding: 10, marginTop: 8 },
  lineLabel: { color: "#E2E8F0", fontSize: 13, flex: 1 },
  lineTotal: { color: "#fff", fontWeight: "700", fontSize: 13 },
  warn: { color: "#F59E0B", fontSize: 12, marginTop: 10 },
  toggle: { marginTop: 16, paddingVertical: 8 },
  toggleText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  box: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12 },
  label: { color: "#94A3B8", fontWeight: "600", marginTop: 6, marginBottom: 6 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  tableHeading: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginTop: 12, marginBottom: 2 },
  tableRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#334155", paddingVertical: 6 },
  cell: { color: "#E2E8F0", fontSize: 14, flex: 1 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#0F172A", borderRadius: 8, paddingHorizontal: 10, width: 120 },
  symbol: { color: "#94A3B8", fontWeight: "700" },
  input: { flex: 1, color: "#fff", paddingVertical: 8, paddingHorizontal: 6, fontSize: 15 },
  hint: { color: "#64748B", fontSize: 12, marginTop: 8 },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 14 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
});
