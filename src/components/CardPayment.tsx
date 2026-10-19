import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { money, shortDate } from "@/lib/billing";
import {
  cancelCard,
  cardExpired,
  cardLabel,
  chargedLabel,
  loadCardBilling,
  startCardCheckout,
  startSaveCard,
  verifyCardPayment,
  type CardBillingInfo,
} from "@/lib/cardBilling";
import type { TrainerPayment } from "@/types/database";

// Paying Daily Evolution by card, on the website only (0126, GRIZZ
// 2026-10-19: website-first billing, so the phone apps sell nothing). What's
// owed now, the saved card with automatic monthly payments, and past payments.
// Nothing shows until the owner switches card billing on.
export default function CardPayment({ trainerId }: { trainerId: string }) {
  const [info, setInfo] = useState<CardBillingInfo | null>(null);
  const [payments, setPayments] = useState<TrainerPayment[]>([]);
  const [autopay, setAutopay] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, { data: paid }] = await Promise.all([
      loadCardBilling(),
      supabase.from("trainer_payments").select("*").eq("trainer_id", trainerId).order("paid_on", { ascending: false }).limit(12),
    ]);
    setInfo(data);
    setPayments((paid ?? []) as TrainerPayment[]);
  }, [trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (Platform.OS !== "web" || !info?.enabled) return null;
  const { quote, card } = info;

  const go = async (start: () => Promise<{ data: { url: string } | null; error: string | null }>) => {
    setBusy(true);
    const { data, error } = await start();
    if (error || !data) {
      setBusy(false);
      return Alert.alert("Couldn't open the card page", error ?? "Please try again.");
    }
    // Paystack's secure page, which brings the trainer back here when done.
    window.location.assign(data.url);
  };

  const stop = () =>
    Alert.alert(
      "Stop automatic payments?",
      "Your saved card is removed and nothing more is charged to it. You can still pay by card or EFT when a payment is due.",
      [
        { text: "Keep them", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const { error } = await cancelCard();
            setBusy(false);
            if (error) return Alert.alert("Couldn't stop them", error);
            load();
          },
        },
      ],
    );

  const rand = quote ? chargedLabel(quote) : null;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>💳 Pay by card</Text>
      {quote && quote.total > 0 ? (
        <>
          {quote.plan_amount > 0 && (
            <Text style={styles.line}>
              {quote.plan_label ?? "Your plan"}: {money(quote.plan_amount, quote.currency)}
            </Text>
          )}
          {quote.fees_amount > 0 && <Text style={styles.line}>Client fees: {money(quote.fees_amount, quote.currency)}</Text>}
          <Pressable style={styles.check} onPress={() => setAutopay((v) => !v)}>
            <View style={[styles.box18, autopay && styles.box18On]} />
            <Text style={styles.checkText}>Save my card and pay automatically each time a payment is due</Text>
          </Pressable>
          <Pressable style={styles.pay} onPress={() => go(() => startCardCheckout(autopay))} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.payText}>Pay {money(quote.total, quote.currency)} by card</Text>
            )}
          </Pressable>
          {rand && <Text style={styles.small}>Charged in rand as {rand}. Your bank sets the exchange rate.</Text>}
          <Text style={styles.small}>Paystack's secure page takes your card. Daily Evolution never sees your card number.</Text>
        </>
      ) : (
        <Text style={styles.line}>Nothing to pay right now.</Text>
      )}

      {card ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Your card</Text>
          <Text style={[styles.line, cardExpired(card, todayIso()) && styles.warn]}>
            {cardLabel(card)}
            {cardExpired(card, todayIso()) ? " (expired)" : ""}
          </Text>
          <Text style={styles.line}>{card.autopay ? "✅ Pays automatically when a payment is due." : "Automatic payments are off."}</Text>
          <View style={styles.row}>
            <Pressable style={styles.secondary} onPress={() => go(startSaveCard)} disabled={busy}>
              <Text style={styles.secondaryText}>Change card</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={stop} disabled={busy}>
              <Text style={styles.stopText}>Stop automatic payments</Text>
            </Pressable>
          </View>
          <Text style={styles.small}>Changing card charges R5 to check the new card, refunded straight away.</Text>
        </View>
      ) : (
        <Pressable onPress={() => go(startSaveCard)} disabled={busy}>
          <Text style={styles.link}>Save a card for automatic payments</Text>
        </Pressable>
      )}

      {payments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading}>Your payments</Text>
          {payments.map((p) => (
            <Text key={p.id} style={styles.line}>
              {shortDate(p.paid_on)} · {p.kind === "subscription" ? `Plan${p.months ? ` (${p.months} month${p.months === 1 ? "" : "s"})` : ""}` : "Client fees"} ·{" "}
              {money(Number(p.amount), p.currency)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Coming back from Paystack's page (web only): records the payment straight
 * away rather than waiting for Paystack's webhook, says how it went, and
 * clears the reference from the address bar.
 */
export function CardPaymentReturn() {
  const { refreshProfile } = useAuth();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) return;
    window.history.replaceState(null, "", window.location.pathname);
    verifyCardPayment(reference).then(async ({ data, error }) => {
      if (error) return Alert.alert("Card payment", error);
      await refreshProfile();
      if (data?.status === "paid") Alert.alert("Thank you", "Your card payment went through and is recorded.");
      else if (data?.status === "failed") Alert.alert("Card payment didn't go through", "Nothing was charged. Please try again or use another card.");
      else Alert.alert("Card payment", "Your payment is still being confirmed. It shows here as soon as Paystack confirms it.");
    });
  }, []);
  return null;
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: BRAND_GOLD },
  title: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  heading: { color: "#fff", fontWeight: "700", fontSize: 14 },
  section: { marginTop: 14 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 6, lineHeight: 19 },
  warn: { color: "#F59E0B", fontWeight: "600" },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 6, lineHeight: 17 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  box18: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#64748B" },
  box18On: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  checkText: { color: "#E2E8F0", fontSize: 13, flex: 1, lineHeight: 18 },
  pay: { backgroundColor: "#22C55E", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  payText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  row: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  secondary: { borderWidth: 1, borderColor: "#475569", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, alignItems: "center" },
  secondaryText: { color: "#E2E8F0", fontWeight: "700" },
  stopText: { color: "#EF4444", fontWeight: "700" },
  link: { color: BRAND_GOLD, fontWeight: "700", marginTop: 12 },
});
