import React, { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { clientTierLines, money, monthlyBill, sidePricing, trainerCurrency } from "@/lib/billing";
import { themedStyles } from "@/lib/theme";
import type { BillingSettings, PriceSide } from "@/types/database";

// Moving from 1 on 1 only to Evolution (GRIZZ, 2026-11-02): before a trainer
// on the 1 on 1 only price turns on the Evolution side, tell them that the
// moment one client uses Evolution they move up to the Evolution price
// automatically, and show both prices so it's clear. Moving every client back
// to 1 on 1 brings the 1 on 1 price back, so switching stays simple.
//
// Website-first billing: the phone apps show no prices (Apple and Google
// rules), so there the notice explains the change without amounts.
const SELLS = Platform.OS === "web";

type Settings = Pick<BillingSettings, "prices" | "free_clients" | "client_tiers" | "one_on_one_prices" | "one_on_one_tiers">;

/** The signed-in trainer's price side, or null for the owner / while loading. */
export function useMyPriceSide() {
  const { trainer } = useAuth();
  const [side, setSide] = useState<PriceSide | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const reload = useCallback(async () => {
    if (!trainer || trainer.is_owner) return;
    const [sides, s] = await Promise.all([
      supabase.rpc("trainer_price_sides"),
      supabase.from("billing_settings").select("prices, free_clients, client_tiers, one_on_one_prices, one_on_one_tiers").eq("id", 1).maybeSingle(),
    ]);
    setSide(sides.data?.find((r) => r.trainer_id === trainer.id)?.side ?? null);
    setSettings((s.data as Settings | null) ?? null);
  }, [trainer]);
  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);
  return { side, settings, reload };
}

export default function EvolutionUpgradeNotice({
  visible,
  settings,
  continueLabel,
  onContinue,
  onCancel,
}: {
  visible: boolean;
  settings: Settings | null;
  continueLabel: string;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const { trainer } = useAuth();
  const currency = trainer ? trainerCurrency(trainer) : "ZAR";
  const evo = settings ? sidePricing(settings, "evolution") : null;
  const one = settings ? sidePricing(settings, "one_on_one") : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.box} onPress={() => {}}>
          <ScrollView>
            <Text style={styles.title}>Moving up to Evolution</Text>
            <Text style={styles.text}>
              You're on the 🤝 1 on 1 only price. The moment one of your clients uses the Evolution side (an Evolution or Both client),
              you move up to the Evolution price automatically. It covers both sides, so your 1 on 1 clients stay included.
            </Text>
            {SELLS && settings && evo && one ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>1 on 1 only (now)</Text>
                  <Text style={styles.line}>{money(one.prices[currency].monthly, currency)} a month</Text>
                  {clientTierLines(one.tiers, currency, 0).map((l) => (
                    <Text key={l} style={styles.line}>
                      {l}
                    </Text>
                  ))}
                  <Text style={styles.line}>Most: {money(monthlyBill(settings, "one_on_one", currency, 1000), currency)} a month</Text>
                </View>
                <View style={[styles.card, styles.cardGold]}>
                  <Text style={styles.cardTitle}>Evolution (both sides)</Text>
                  <Text style={styles.line}>
                    {money(evo.prices[currency].monthly, currency)} a month, first {evo.included} clients included
                  </Text>
                  {clientTierLines(evo.tiers, currency, evo.included).map((l) => (
                    <Text key={l} style={styles.line}>
                      {l}
                    </Text>
                  ))}
                  <Text style={styles.line}>
                    e.g. 10 clients {money(monthlyBill(settings, "evolution", currency, 10), currency)}, 30 clients{" "}
                    {money(monthlyBill(settings, "evolution", currency, 30), currency)} a month
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.text}>Your monthly fee changes to the Evolution plan. See both prices under your plan on the website version.</Text>
            )}
            <Text style={styles.text}>
              Changed your mind later? Set those clients back to 1 on 1 (or archive them) and you're back on the 1 on 1 only price.
            </Text>
            <Pressable style={styles.primary} onPress={onContinue}>
              <Text style={styles.primaryText}>{continueLabel}</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancelText}>Not now</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#1E293B", borderRadius: 16, padding: 18, width: "100%", maxWidth: 420, maxHeight: "90%" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  text: { color: "#CBD5E1", fontSize: 14, marginTop: 10, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: "#334155", borderRadius: 12, padding: 12, marginTop: 12 },
  cardGold: { borderColor: BRAND_GOLD },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 4 },
  line: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  cancel: { alignSelf: "center", marginTop: 12 },
  cancelText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
