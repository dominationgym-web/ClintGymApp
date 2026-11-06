import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { EVOLUTION_FREE_DAYS, clientTierLines, evolutionFreeUntil, money, monthlyCap, shortDate, sidePricing, trainerCurrency } from "@/lib/billing";
import { todayIso } from "@/lib/dates";
import { themeText, themedStyles } from "@/lib/theme";
import type { BillingSettings } from "@/types/database";

// Switching on the Evolution side (GRIZZ, 2026-11-06). Every trainer starts on
// 1 on 1 with Evolution off. Before it goes on, explain: 30 days free from the
// minute it's switched on, then the Evolution subscription; the first 5
// clients are free; switch it off to stop.
//
// Website-first billing: the phone apps show no prices (Apple and Google
// rules), so there the notice says the same without amounts.
const SELLS = Platform.OS === "web";

type Settings = Pick<BillingSettings, "prices" | "free_clients" | "client_tiers" | "one_on_one_prices" | "one_on_one_tiers">;

export default function EvolutionSwitchNotice({
  visible,
  saving,
  onSwitchOn,
  onCancel,
}: {
  visible: boolean;
  saving: boolean;
  onSwitchOn: () => void;
  onCancel: () => void;
}) {
  const { trainer } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    if (!visible || !SELLS || settings) return;
    supabase
      .from("billing_settings")
      .select("prices, free_clients, client_tiers, one_on_one_prices, one_on_one_tiers")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setSettings((data as Settings | null) ?? null));
  }, [visible, settings]);

  const currency = trainer ? trainerCurrency(trainer) : "ZAR";
  const evo = settings ? sidePricing(settings, "evolution") : null;
  const cap = settings ? monthlyCap(settings, "evolution", currency) : null;
  const included = evo?.included ?? 5;
  // The 30 free days happen once: switched on before means the subscription starts straight away.
  const usedUntil = evolutionFreeUntil(trainer?.evolution_started_on);
  const freeUsed = !!usedUntil && usedUntil < todayIso();
  const subscription = SELLS && evo ? `the ${money(evo.prices[currency].monthly, currency)} a month Evolution subscription` : "the Evolution monthly subscription";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.box} onPress={() => {}}>
          <ScrollView>
            <Text style={styles.title}>Switch on Evolution</Text>
            <Text style={styles.text}>
              Evolution is your online coaching side: programs, check-ins, nutrition and progress for clients who train on their own. Your
              1 on 1 side stays exactly as it is.
            </Text>
            <View style={[styles.card, styles.cardGold]}>
              {freeUsed ? (
                <Text style={styles.point}>
                  Your {EVOLUTION_FREE_DAYS} free days ran until {shortDate(usedUntil!)}, so {subscription} starts as soon as you switch it on.
                </Text>
              ) : (
                <Text style={styles.point}>
                  🎁 The minute you switch it on, you get {EVOLUTION_FREE_DAYS} days free. After that, {subscription} starts.
                </Text>
              )}
              <Text style={styles.point}>👥 Your first {included} clients are free.</Text>
              {SELLS && evo
                ? clientTierLines(evo.tiers, currency, included).map((l) => (
                    <Text key={l} style={styles.line}>
                      {l}
                    </Text>
                  ))
                : null}
              {SELLS && cap !== null ? <Text style={styles.line}>The most you pay: {money(cap, currency)} a month, 1 on 1 included.</Text> : null}
              <Text style={styles.point}>⏹ To stop, just switch Evolution off again: ☰ Menu › Evolution side.</Text>
            </View>
            <Pressable style={styles.primary} onPress={onSwitchOn} disabled={saving}>
              {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.primaryText}>Switch on Evolution</Text>}
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
  point: { color: "#fff", fontSize: 14, lineHeight: 20, marginTop: 6 },
  line: { color: "#94A3B8", fontSize: 13, marginTop: 2, marginLeft: 22 },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  cancel: { alignSelf: "center", marginTop: 12 },
  cancelText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
