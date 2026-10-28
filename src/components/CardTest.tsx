import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { shortDate } from "@/lib/billing";
import { cancelCard, cardLabel, loadCardBilling, startSaveCard, type CardBillingInfo, type CardCharge } from "@/lib/cardBilling";
import { themeText, themedStyles } from "@/lib/theme";

// The owner's card payment check on the Billing page (website only). While
// card payments are off only the owner can use them, so this R5 card check
// (refunded straight away) walks the whole Paystack loop: their page, the
// return to the app, the webhook, saving the card and the refund. It also
// lists the latest card charges from every trainer.
const KIND: Record<CardCharge["kind"], string> = { checkout: "Paid on the website", auto: "Automatic", card_check: "Card check" };
const STATUS: Record<CardCharge["status"], string> = { pending: "⏳ Waiting", success: "✅ Went through", failed: "❌ Failed" };

export default function CardTest({ trainerNames }: { trainerNames: Record<string, string> }) {
  const [info, setInfo] = useState<CardBillingInfo | null>(null);
  const [charges, setCharges] = useState<CardCharge[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, { data: rows }] = await Promise.all([
      loadCardBilling(),
      supabase.from("card_charges").select("*").order("created_at", { ascending: false }).limit(5),
    ]);
    setInfo(data);
    setCharges((rows ?? []) as CardCharge[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (Platform.OS !== "web" || !info) return null;

  const tryCard = async () => {
    setBusy(true);
    const { data, error } = await startSaveCard(false);
    if (error || !data) {
      setBusy(false);
      return Alert.alert("Couldn't open the card page", error ?? "Please try again.");
    }
    window.location.assign(data.url);
  };

  const removeCard = async () => {
    setBusy(true);
    const { error } = await cancelCard();
    setBusy(false);
    if (error) return Alert.alert("Couldn't remove it", error);
    load();
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Try card payments</Text>
      {!info.mode ? (
        <Text style={styles.line}>The Paystack key isn't added yet, so card payments can't run.</Text>
      ) : (
        <>
          <Text style={styles.line}>
            {info.mode === "test"
              ? "Paystack test key added. Test cards only, no real money moves."
              : "⚠️ Paystack LIVE key added. This charges a real card R5 and refunds it."}
          </Text>
          {info.mode === "test" ? (
            <Text style={styles.small}>
              Test card: 4084 0840 8408 4081, any future expiry, CVV 408. If Paystack asks, the PIN is 0000 and the OTP is
              123456.
            </Text>
          ) : null}
          <Pressable style={styles.button} onPress={tryCard} disabled={busy}>
            {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Try a card (R5, refunded)</Text>}
          </Pressable>
          {info.card ? (
            <View style={styles.row}>
              <Text style={[styles.line, { flex: 1 }]}>Saved: {cardLabel(info.card)}</Text>
              <Pressable onPress={removeCard} disabled={busy}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
      {charges.length > 0 ? (
        <>
          <Text style={styles.heading}>Latest card charges</Text>
          {charges.map((c) => (
            <Text key={c.reference} style={styles.small}>
              {shortDate(c.created_at.slice(0, 10))} · {trainerNames[c.trainer_id] ?? "Trainer"} · {KIND[c.kind]} · R
              {(c.charged_cents / 100).toFixed(2)} · {STATUS[c.status]}
              {c.message ? ` · ${c.message}` : ""}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = themedStyles({
  box: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#334155" },
  title: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14 },
  heading: { color: "#fff", fontWeight: "700", fontSize: 13, marginTop: 12 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 6, lineHeight: 19 },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 6, lineHeight: 17 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#0F172A", fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  remove: { color: "#EF4444", fontWeight: "700", marginTop: 6 },
});
