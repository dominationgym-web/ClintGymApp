import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { EXTRA_DAYS, LOCAL_CURRENCIES, currencySymbol, incomeSummary, parsePrice, priceText, trainerCountry } from "@/lib/clientPricing";
import type { AccessStatus, ClientPriceList, ClientPrices, ClientRate, PricePackage } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

type Row = {
  id: string;
  price_package: PricePackage | null;
  archived_at: string | null;
  access_status: AccessStatus;
  residence_country: string | null;
  client_rate: ClientRate | null;
};
type ListDraft = { online: string; extra: Record<string, string>; flat: string };
type Draft = { currency: string; mode: "table" | "flat"; local: ListDraft; intl: ListDraft };

const toText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

const listDraft = (list: ClientPriceList | null | undefined): ListDraft => ({
  online: toText(list?.online),
  extra: Object.fromEntries(EXTRA_DAYS.map((d) => [d, toText(list?.extra?.[d])])),
  flat: toText(list?.flat),
});

const listFrom = (d: ListDraft): ClientPriceList => ({
  online: parsePrice(d.online),
  extra: Object.fromEntries(EXTRA_DAYS.map((x) => [x, parsePrice(d.extra[x] ?? "")])),
  flat: parsePrice(d.flat),
});

const listEmpty = (l: ClientPriceList, mode: Draft["mode"]) =>
  mode === "flat" ? l.flat === null : l.online === null && EXTRA_DAYS.every((d) => l.extra?.[d] === null);

function draftFrom(prices: ClientPrices | null | undefined): Draft {
  return {
    currency: prices?.currency ?? "ZAR",
    mode: prices?.mode ?? "table",
    local: listDraft(prices),
    intl: listDraft(prices?.international),
  };
}

// A trainer's own income (0106): what their active clients pay them a month,
// and the price table (or one monthly fee) it's worked out from. Each client's
// package is picked on their profile. Two price lists since 0227 (GRIZZ
// 2026-11-19): Local, in the trainer's own currency, and International, in
// dollars, for clients who live in another country.
export default function TrainerIncome() {
  const { trainer, refreshProfile } = useAuth();
  const [clients, setClients] = useState<Row[] | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(trainer?.client_prices));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase
      .from("clients")
      .select("id, price_package, archived_at, access_status, residence_country, client_rate")
      .eq("trainer_id", trainer.id).neq("id", trainer.id);
    setClients((data as Row[] | null) ?? []);
  }, [trainer?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!trainer) return null;
  const prices = trainer.client_prices ?? null;
  const summary = clients ? incomeSummary(prices, clients, trainerCountry(trainer)) : null;

  const save = async () => {
    const local = listFrom(draft.local);
    const intl = listFrom(draft.intl);
    const next: ClientPrices = {
      currency: draft.currency,
      mode: draft.mode,
      ...local,
      international: listEmpty(intl, draft.mode) ? null : intl,
    };
    if (listEmpty(local, draft.mode)) {
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
    Alert.alert("Prices saved", "Your monthly income below now uses these prices.");
  };

  const symbol = currencySymbol(draft.currency);
  const setList = (which: "local" | "intl", patch: Partial<ListDraft>) =>
    setDraft((d) => ({ ...d, [which]: { ...d[which], ...patch } }));
  const priceInput = (value: string, onChange: (v: string) => void, label: string, sym: string) => (
    <View style={styles.inputWrap}>
      <Text style={styles.symbol}>{sym.trim()}</Text>
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
      {/* GRIZZ 2026-10-23: the fee calculator stays open and easy to spot, not a drop-down. */}
      <View style={styles.calc}>
        <Text style={styles.calcTitle}>Calculate your fee structure here</Text>
        <Text style={styles.calcIntro}>Fill in what you charge each client a month. Your monthly income below adds up from these prices.</Text>
        <View style={styles.box}>
          <Text style={styles.label}>Your local currency: {LOCAL_CURRENCIES.find((c) => c.code === draft.currency)?.label ?? draft.currency}</Text>
          <View style={[styles.chips, styles.wrap]}>
            {LOCAL_CURRENCIES.map((c) => (
              <Pressable key={c.code} style={[styles.chip, draft.currency === c.code && styles.chipOn]} onPress={() => setDraft({ ...draft, currency: c.code })}>
                <Text style={[styles.chipText, draft.currency === c.code && styles.chipTextOn]} accessibilityLabel={c.label}>
                  {c.symbol.trim() === c.code ? c.code : `${c.symbol.trim()} ${c.code}`}
                </Text>
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

          <View style={styles.headRow}>
            <Text style={styles.cell} />
            <Text style={styles.colHead}>Local</Text>
            <Text style={styles.colHead}>International</Text>
          </View>
          {draft.mode === "flat" ? (
            <>
              <View style={styles.tableRow}>
                <Text style={styles.cell}>Monthly fee</Text>
                {priceInput(draft.local.flat, (v) => setList("local", { flat: v }), "Local monthly fee", symbol)}
                {priceInput(draft.intl.flat, (v) => setList("intl", { flat: v }), "International monthly fee", "$")}
              </View>
              <Text style={styles.hint}>Every client pays the same each month.</Text>
            </>
          ) : (
            <>
              <View style={styles.tableRow}>
                <Text style={styles.cell}>Fully Online</Text>
                {priceInput(draft.local.online, (v) => setList("local", { online: v }), "Local Fully Online price", symbol)}
                {priceInput(draft.intl.online, (v) => setList("intl", { online: v }), "International Fully Online price", "$")}
              </View>
              <Text style={styles.tableHeading}>1-on-1 clients using the app for extra days</Text>
              {EXTRA_DAYS.map((d) => (
                <View key={d} style={styles.tableRow}>
                  <Text style={styles.cell}>
                    {d} extra day{d === "1" ? "" : "s"} a week
                  </Text>
                  {priceInput(draft.local.extra[d] ?? "", (v) => setList("local", { extra: { ...draft.local.extra, [d]: v } }), `Local ${d} extra days price`, symbol)}
                  {priceInput(draft.intl.extra[d] ?? "", (v) => setList("intl", { extra: { ...draft.intl.extra, [d]: v } }), `International ${d} extra days price`, "$")}
                </View>
              ))}
              <Text style={styles.hint}>All prices are per client per month. Leave any you don't offer blank.</Text>
            </>
          )}
          <Text style={styles.hint}>
            International (in dollars) is for clients who live in another country. The app picks it from the country they chose at
            sign-up, and you can change it on their profile. Leave it blank and they pay your Local price.
          </Text>
          <Pressable style={styles.button} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Save prices</Text>}
          </Pressable>
        </View>
      </View>

      <Text style={styles.heading}>Your monthly income</Text>
      {!summary ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} />
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.stat}>
              {summary.totals.length === 0 ? (
                <Text style={styles.big}>{priceText(0, prices?.currency ?? draft.currency)}</Text>
              ) : (
                summary.totals.map((t, i) => (
                  <Text key={t.currency} style={styles.big}>
                    {i > 0 ? "+ " : ""}
                    {priceText(t.total, t.currency)}
                  </Text>
                ))
              )}
              <Text style={styles.small}>a month</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.big}>{summary.active}</Text>
              <Text style={styles.small}>active clients</Text>
              {summary.international > 0 ? <Text style={styles.small}>{summary.international} international</Text> : null}
            </View>
          </View>
          {summary.lines.map((l) => (
            <View key={l.key} style={styles.line}>
              <Text style={styles.lineLabel}>
                {l.label} · {l.clients} × {priceText(l.price, l.currency)}
              </Text>
              <Text style={styles.lineTotal}>{priceText(l.total, l.currency)}</Text>
            </View>
          ))}
          {summary.unpriced > 0 && (
            <Text style={styles.warn}>
              {summary.unpriced} client{summary.unpriced === 1 ? " has" : "s have"} no price yet.{" "}
              {prices?.mode === "flat" ? "Add your monthly fee above." : "Open each client and pick their package."}
            </Text>
          )}
        </>
      )}

      <Text style={styles.hint}>Test run: try your prices and see how it works. Clients don't see this.</Text>
    </>
  );
}

const styles = themedStyles({
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: "#1E293B", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  big: { color: "#fff", fontSize: 22, fontWeight: "800" },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  line: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1E293B", borderRadius: 10, padding: 10, marginTop: 8 },
  lineLabel: { color: "#E2E8F0", fontSize: 13, flex: 1 },
  lineTotal: { color: "#fff", fontWeight: "700", fontSize: 13 },
  warn: { color: "#F59E0B", fontSize: 12, marginTop: 10 },
  calc: { borderWidth: 2, borderColor: BRAND_GOLD, borderRadius: 14, padding: 12, marginBottom: 18, backgroundColor: "#111827" },
  calcTitle: { color: BRAND_GOLD, fontSize: 19, fontWeight: "800" },
  calcIntro: { color: "#CBD5E1", fontSize: 13, marginTop: 4, marginBottom: 10 },
  box: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12 },
  label: { color: "#94A3B8", fontWeight: "600", marginTop: 6, marginBottom: 6 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 6 },
  wrap: { flexWrap: "wrap" },
  headRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  colHead: { color: BRAND_GOLD, fontWeight: "700", fontSize: 12, width: 92, textAlign: "center" },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  tableHeading: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginTop: 12, marginBottom: 2 },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 1, borderBottomColor: "#334155", paddingVertical: 6 },
  cell: { color: "#E2E8F0", fontSize: 14, flex: 1 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 8, paddingHorizontal: 8, width: 92 },
  symbol: { color: "#334155", fontWeight: "700" },
  input: { flex: 1, color: "#fff", paddingVertical: 8, paddingHorizontal: 6, fontSize: 15 },
  hint: { color: "#64748B", fontSize: 12, marginTop: 8 },
  button: { backgroundColor: "#D4AF37", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 14 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
});
