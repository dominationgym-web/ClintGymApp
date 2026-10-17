import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/billing";
import { PRICE_PACKAGES, clientPrice } from "@/lib/clientPricing";
import type { PricePackage } from "@/types/database";

// On a client's profile: which of the trainer's prices they pay (0106).
// Feeds the trainer's Profile > Income.
export default function ClientPricePicker({
  clientId,
  value,
  onChanged,
}: {
  clientId: string;
  value: PricePackage | null | undefined;
  onChanged: (next: PricePackage | null) => void;
}) {
  const { trainer } = useAuth();
  const [saving, setSaving] = useState(false);
  const prices = trainer?.client_prices ?? null;
  const currency = prices?.currency ?? "ZAR";

  if (!prices) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>What they pay you</Text>
        <Text style={styles.hint}>Set your prices on Profile → Income, then pick their package here.</Text>
      </View>
    );
  }

  if (prices.mode === "flat") {
    const fee = clientPrice(prices, null);
    return (
      <View style={styles.box}>
        <Text style={styles.title}>What they pay you</Text>
        <Text style={styles.amount}>{fee === null ? "No monthly fee set" : `${money(fee, currency)} a month`}</Text>
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

  const price = clientPrice(prices, value);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>What they pay you</Text>
      <View style={styles.chips}>
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
            : `${PRICE_PACKAGES.find((p) => p.key === value)?.label}: ${money(price, currency)} a month`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 12 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  amount: { color: "#E2E8F0", fontSize: 13, marginTop: 8 },
  hint: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
