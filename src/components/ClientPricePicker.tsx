import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { PRICE_PACKAGES, clientRate, currencySymbol, priceText, ratePrice, suggestedRate, trainerCountry } from "@/lib/clientPricing";
import { countryLabel } from "@/lib/countries";
import type { ClientRate, PricePackage } from "@/types/database";
import { themedStyles } from "@/lib/theme";

type Props = {
  clientId: string;
  value: PricePackage | null | undefined;
  residenceCountry?: string | null;
  rate?: ClientRate | null;
  onChanged: (next: PricePackage | null) => void;
  onRateChanged?: (next: ClientRate) => void;
};

// On a client's profile: which of the trainer's prices they pay (0106), and
// whether that's the Local or International list (0231). Feeds the trainer's
// Profile > Income.
export default function ClientPricePicker({ clientId, value, residenceCountry, rate: chosenRate, onChanged, onRateChanged }: Props) {
  const { trainer } = useAuth();
  const [saving, setSaving] = useState(false);
  const prices = trainer?.client_prices ?? null;
  const home = trainerCountry(trainer);
  const rate = clientRate({ residence_country: residenceCountry, client_rate: chosenRate }, home);
  const lives = countryLabel(residenceCountry);

  const pickRate = async (next: ClientRate) => {
    if (next === rate && chosenRate) return;
    setSaving(true);
    const { error } = await supabase.from("clients").update({ client_rate: next }).eq("id", clientId);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    onRateChanged?.(next);
  };

  const rateRow = (
    <>
      <Text style={styles.lives}>{lives ? `Lives in ${lives}` : "Country not given (signed up before it was asked)"}</Text>
      <View style={styles.chips}>
        {(
          [
            ["local", `🏠 Local (${currencySymbol(prices?.currency ?? "ZAR").trim()})`],
            ["international", "🌍 International ($)"],
          ] as const
        ).map(([key, label]) => {
          const on = key === rate;
          return (
            <Pressable key={key} style={[styles.chip, on && styles.chipOn]} onPress={() => pickRate(key)} disabled={saving}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {chosenRate && residenceCountry && chosenRate !== suggestedRate(residenceCountry, home) ? (
        <Text style={styles.hint}>You changed this by hand.</Text>
      ) : null}
    </>
  );

  if (!prices) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>What they pay you</Text>
        {rateRow}
        <Text style={styles.hint}>Set your prices on Profile → Income, then pick their package here.</Text>
      </View>
    );
  }

  const price = ratePrice(prices, value, rate);
  const fellBack = rate === "international" && price && price.currency !== "USD" && prices.currency !== "USD";

  if (prices.mode === "flat") {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>What they pay you</Text>
        {rateRow}
        <Text style={styles.amount}>{price === null ? "No monthly fee set" : `${priceText(price.amount, price.currency)} a month`}</Text>
        {fellBack ? <Text style={styles.hint}>No International fee set yet, so this is your Local fee.</Text> : null}
        <Text style={styles.hint}>Your one monthly fee (Profile → Income).</Text>
      </View>
    );
  }

  const pick = async (next: PricePackage) => {
    const chosen = next === value ? null : next;
    setSaving(true);
    const { error } = await supabase.from("clients").update({ price_package: chosen }).eq("id", clientId);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    onChanged(chosen);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>What they pay you</Text>
      {rateRow}
      <View style={[styles.chips, { marginTop: 8 }]}>
        {PRICE_PACKAGES.map((p) => {
          const on = p.key === value;
          return (
            <Pressable key={p.key} style={[styles.chip, on && styles.chipOn]} onPress={() => pick(p.key)} disabled={saving}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.short}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.amount}>
        {!value
          ? "Pick their package"
          : price === null
            ? "No price set for this package yet"
            : `${PRICE_PACKAGES.find((p) => p.key === value)?.label}: ${priceText(price.amount, price.currency)} a month`}
      </Text>
      {fellBack ? <Text style={styles.hint}>No International price for this package yet, so this is your Local price.</Text> : null}
    </View>
  );
}

const styles = themedStyles({
  box: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 12 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 6 },
  lives: { color: "#E2E8F0", fontSize: 13, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  amount: { color: "#E2E8F0", fontSize: 13, marginTop: 8 },
  hint: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
