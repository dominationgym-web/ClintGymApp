import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { freeUseFeesStart, money, PLAN_LABEL, planPrice, planState, planStateLabel, shortDate } from "@/lib/billing";
import TrainerPaymentDetails from "@/components/TrainerPaymentDetails";
import SendProofOfPayment from "@/components/SendProofOfPayment";
import type { BillingSettings, EftDetails, Trainer, TrainerBillingStatus } from "@/types/database";

// A trainer's own plan (0064): what they pay, when it's due, client fees owed,
// and where to pay (the app owner's EFT details). Nothing shows until the
// owner has set their plan.
export default function TrainerPlanCard({ trainer, showPayment = false }: { trainer: Trainer; showPayment?: boolean }) {
  const [status, setStatus] = useState<TrainerBillingStatus | null>(null);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [owner, setOwner] = useState<{ eft_details: EftDetails; pop_whatsapp: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.rpc("trainer_billing_status", { p_trainer: trainer.id }),
      supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.rpc("owner_payment_details"),
    ]).then(([s, b, o]) => {
      if (cancelled) return;
      setStatus(s.data?.[0] ?? null);
      setSettings(b.data ?? null);
      setOwner(o.data?.[0] ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [trainer.id, trainer.paid_until, trainer.free_use_from]);

  if (loading) return <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 12 }} />;
  const freeUse = trainer.free_use_from;
  if (!status || !settings || (!freeUse && (!status.billing_plan || !status.billing_currency))) return null;

  const currency = status.billing_currency ?? "ZAR";
  const state = planState({ ...status, trial_ends_at: trainer.trial_ends_at, free_use_from: freeUse }, todayIso());
  const owed = Number(status.client_fees_owed);
  const due = state.kind === "overdue" || owed > 0;

  return (
    <View style={[styles.box, due && styles.boxDue]}>
      {freeUse ? (
        <>
          <Text style={styles.title}>🎁 You're on free use</Text>
          <Text style={styles.line}>No monthly subscription.</Text>
          <Text style={styles.line}>
            From {shortDate(status.client_fees_from ?? freeUseFeesStart(freeUse))} you pay{" "}
            {money(settings.prices[currency].client, currency)} a month for each active client. The app reminds you
            before then.
          </Text>
          <Text style={styles.line}>Banked referrals come off your client fees.</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>
            Your plan: {PLAN_LABEL[status.billing_plan!]} · {money(planPrice(settings.prices, currency, status.billing_plan!), currency)}
          </Text>
          <Text style={[styles.line, state.kind === "overdue" && styles.warn]}>{planStateLabel(state)}</Text>
        </>
      )}
      {status.client_fees_from && !freeUse ? (
        <Text style={styles.line}>
          Client fees from {shortDate(status.client_fees_from)}: {money(settings.prices[currency].client, currency)} a month for
          each active client above {settings.free_clients}.
        </Text>
      ) : null}
      {owed > 0 ? (
        <Text style={[styles.line, Number(status.client_fees_overdue) > 0 && styles.warn]}>
          Client fees owed: {money(owed, currency)}
          {Number(status.client_fees_overdue) > 0 ? " (overdue)" : ""}
        </Text>
      ) : null}
      {(showPayment || due) && owner ? (
        <>
          <Text style={styles.payTitle}>How to pay</Text>
          <TrainerPaymentDetails eftDetails={owner.eft_details} popWhatsapp={owner.pop_whatsapp} proofInApp />
          <SendProofOfPayment to="owner" payerId={trainer.id} trainerId={trainer.id} receiverName="Daily Evolution" />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#334155" },
  boxDue: { borderColor: "#F59E0B" },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 6, lineHeight: 19 },
  warn: { color: "#F59E0B", fontWeight: "600" },
  payTitle: { color: BRAND_GOLD, fontWeight: "700", marginTop: 12 },
});
