import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { clientTierLines, freeUseFeesStart, money, PLAN_LABEL, planPrice, planState, planStateLabel, shortDate } from "@/lib/billing";
import TrainerPaymentDetails from "@/components/TrainerPaymentDetails";
import SendProofOfPayment from "@/components/SendProofOfPayment";
import CardPayment from "@/components/CardPayment";
import type { BillingSettings, EftDetails, Trainer, TrainerBillingStatus } from "@/types/database";

// A trainer's own plan (0064): what they pay, when it's due, client fees owed,
// and where to pay (the app owner's EFT details). Nothing shows until the
// owner has set their plan.
//
// Website-first billing (GRIZZ, 2026-10-19): trainers pay on the website (the
// web version), by card (0136) or EFT. The phone apps sell nothing, so there
// they only show where the plan stands, with no prices or ways to pay.
const SELLS = Platform.OS === "web";

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
            {SELLS
              ? `From ${shortDate(status.client_fees_from ?? freeUseFeesStart(freeUse))} you pay a monthly fee for each active client (${clientTierLines(settings.client_tiers ?? [], currency, 0).join(", ")}). The app reminds you before then.`
              : `Per-client fees start ${shortDate(status.client_fees_from ?? freeUseFeesStart(freeUse))}.`}
          </Text>
          <Text style={styles.line}>Banked referrals come off your client fees.</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>
            Your plan: {PLAN_LABEL[status.billing_plan!]}
            {SELLS ? ` · ${money(planPrice(settings.prices, currency, status.billing_plan!), currency)}` : ""}
          </Text>
          <Text style={[styles.line, state.kind === "overdue" && styles.warn]}>{planStateLabel(state)}</Text>
        </>
      )}
      {SELLS && status.client_fees_from && !freeUse ? (
        <Text style={styles.line}>
          Client fees from {shortDate(status.client_fees_from)}, a month per active client:{" "}
          {clientTierLines(settings.client_tiers ?? [], currency, settings.free_clients).join(", ")}.
        </Text>
      ) : null}
      {owed > 0 ? (
        <Text style={[styles.line, Number(status.client_fees_overdue) > 0 && styles.warn]}>
          {SELLS ? `Client fees owed: ${money(owed, currency)}` : "Client fees are due"}
          {Number(status.client_fees_overdue) > 0 ? " (overdue)" : ""}
        </Text>
      ) : null}
      {SELLS ? <CardPayment trainerId={trainer.id} /> : null}
      {SELLS && (showPayment || due) && owner ? (
        <>
          <Text style={styles.payTitle}>Or pay by EFT</Text>
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
