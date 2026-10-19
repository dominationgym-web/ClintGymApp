import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/TextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { addDays } from "@/lib/programSchedule";
import { referralRewards, trainerDisplayName } from "@/lib/trainers";
import {
  amountsLabel,
  creditsUsable,
  CURRENCIES,
  feeCreditsUsable,
  CURRENCY_LABEL,
  freeUseFeesStart,
  halfYearTotals,
  money,
  monthLabel,
  monthStart,
  PLAN_LABEL,
  PLAN_MONTHS,
  planAmountDue,
  planPrice,
  PLANS,
  planState,
  planStateLabel,
  referralCreditValue,
  shortDate,
} from "@/lib/billing";
import type {
  BillingCurrency,
  BillingMonthRow,
  BillingPlan,
  BillingSettings,
  ClientActivation,
  PaymentProof,
  Trainer,
  TrainerBillingMonth,
  TrainerBillingStatus,
  TrainerPayment,
} from "@/types/database";
import KeyboardSafe from "@/components/KeyboardSafe";
import PaymentProofModal from "@/components/PaymentProofModal";
import { proofWhen } from "@/lib/paymentProofs";
import { countryName } from "@/lib/phoneCountry";
import OwnerTracker from "@/components/OwnerTracker";

// The owner's billing view (0064): who owes what, this month's client count
// and fees per trainer, the monthly log, 6-month totals, each trainer's plan
// with payments and referral credit, and the prices and lockout switch.
// Everything is a tap-to-open heading so nothing needs long scrolling.
export default function BillingScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [everyone, setEveryone] = useState<Trainer[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TrainerBillingStatus>>({});
  const [thisMonth, setThisMonth] = useState<BillingMonthRow[]>([]);
  const [months, setMonths] = useState<TrainerBillingMonth[]>([]);
  const [payments, setPayments] = useState<TrainerPayment[]>([]);
  const [activations, setActivations] = useState<ClientActivation[]>([]);
  const [open, setOpen] = useState<string | null>("outstanding");
  const [planFor, setPlanFor] = useState<Trainer | null>(null);
  const [payFor, setPayFor] = useState<Trainer | null>(null);
  const [freeUseFor, setFreeUseFor] = useState<Trainer | null>(null);
  // Trainers' proofs of payment sent through the app, not checked yet (0117).
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [viewing, setViewing] = useState<PaymentProof | null>(null);
  const today = todayIso();

  const load = useCallback(async () => {
    const [s, t, cur, m, p, a] = await Promise.all([
      supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("trainers").select("*").order("created_at", { ascending: true }),
      supabase.rpc("billing_month_rows", { p_month: todayIso() }),
      supabase.from("trainer_billing_months").select("*").order("month", { ascending: false }),
      supabase.from("trainer_payments").select("*").order("paid_on", { ascending: false }),
      supabase.from("client_activations").select("*").order("activated_on", { ascending: false }),
    ]);
    const { data: proofRows } = await supabase
      .from("payment_proofs")
      .select("*")
      .eq("to_owner", true)
      .eq("status", "new")
      .order("created_at", { ascending: false });
    setProofs((proofRows as PaymentProof[] | null) ?? []);
    if (proofRows?.length) setOpen((o) => (o === "outstanding" ? "proofs" : o));
    const err = s.error ?? t.error ?? cur.error ?? m.error ?? p.error ?? a.error;
    if (err) Alert.alert("Couldn't load billing", err.message);
    const all = t.data ?? [];
    setSettings(s.data ?? null);
    setEveryone(all);
    setThisMonth(cur.data ?? []);
    setMonths(m.data ?? []);
    setPayments(p.data ?? []);
    const trainerIds = new Set(all.filter((x) => !x.is_owner).map((x) => x.id));
    setActivations((a.data ?? []).filter((x) => trainerIds.has(x.trainer_id)));
    const results = await Promise.all(
      all.filter((x) => !x.is_owner && x.approved).map((x) => supabase.rpc("trainer_billing_status", { p_trainer: x.id })),
    );
    const map: Record<string, TrainerBillingStatus> = {};
    for (const r of results) for (const row of r.data ?? []) map[row.trainer_id] = row;
    setStatuses(map);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const trainers = everyone.filter((t) => !t.is_owner && t.approved);
  const byId = useMemo(() => Object.fromEntries(everyone.map((t) => [t.id, t])), [everyone]);
  const unusedCredits = (t: Trainer) =>
    referralRewards(everyone.filter((x) => x.referred_by === t.id && x.approved).length, t.referral_credits_used).unused;

  const outstanding = trainers.filter((t) => {
    const s = statuses[t.id];
    return s && (s.plan_overdue || s.client_fees_owed > 0);
  });

  const halves = useMemo(
    () =>
      halfYearTotals({
        months,
        payments,
        activations,
        referralApprovals: everyone.filter((t) => t.referred_by && t.approved && t.approved_at).map((t) => t.approved_at!.slice(0, 10)),
      }),
    [months, payments, activations, everyone],
  );

  const monthKeys = [...new Set(months.map((m) => m.month))];

  const endFreeUse = (t: Trainer) =>
    Alert.alert(
      `End ${trainerDisplayName(t)}'s free use?`,
      "They go back to a normal plan. Set their plan straight after, and they'll be told.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End free use",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("trainers").update({ free_use_from: null }).eq("id", t.id);
            if (error) Alert.alert("Couldn't save", error.message);
            await load();
          },
        },
      ],
    );

  const toggleLockout = async (value: boolean) => {
    const go = async () => {
      const { error } = await supabase.from("billing_settings").update({ lockout_enabled: value, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) Alert.alert("Couldn't update", error.message);
      await load();
    };
    if (!value) return go();
    Alert.alert(
      "Lock out unpaid trainers?",
      "From now on, a trainer whose plan has run out or whose client fees are past due is locked out until you record their payment. Their clients see a 'paused' screen.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Switch on", style: "destructive", onPress: go },
      ],
    );
  };

  const payOutReferrals = (t: Trainer) => {
    const unused = unusedCredits(t);
    const currency = t.billing_currency ?? "USD";
    if (!settings || unused === 0) return;
    const amount = referralCreditValue(settings.prices, currency, unused);
    Alert.alert(
      `Pay out ${trainerDisplayName(t)}'s referrals?`,
      `For a trainer who's cancelling: ${unused} unused referral${unused === 1 ? "" : "s"} = ${money(amount, currency)}. Tap once you've paid them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as paid out",
          onPress: async () => {
            const { error } = await supabase
              .from("referral_payouts")
              .insert({ trainer_id: t.id, credits: unused, amount, currency, paid_on: todayIso() });
            if (error) Alert.alert("Couldn't save", error.message);
            await load();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_GOLD} />
      </View>
    );
  }

  const section = (key: string, title: string, badge: string | null, body: () => React.ReactNode) => (
    <View style={styles.section} key={key}>
      <Pressable style={styles.sectionHeader} onPress={() => setOpen(open === key ? null : key)} accessibilityRole="button">
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        <Text style={styles.chevron}>{open === key ? "▲" : "▼"}</Text>
      </Pressable>
      {open === key ? <View style={styles.sectionBody}>{body()}</View> : null}
    </View>
  );

  const monthRows = (rows: { trainer_id: string; active_clients: number; new_activations: number; free: boolean; client_fee: number; currency: BillingCurrency | null }[]) => {
    if (rows.length === 0) return <Text style={styles.muted}>No trainers on a plan yet.</Text>;
    const total: Partial<Record<BillingCurrency, number>> = {};
    for (const r of rows) total[r.currency ?? "USD"] = (total[r.currency ?? "USD"] ?? 0) + Number(r.client_fee);
    return (
      <>
        {rows.map((r) => (
          <View key={r.trainer_id} style={styles.line}>
            <Text style={styles.lineName}>{byId[r.trainer_id] ? trainerDisplayName(byId[r.trainer_id]) : "Trainer"}</Text>
            <Text style={styles.lineDetail}>
              {r.active_clients} active · {r.new_activations} new ·{" "}
              {r.free ? "free months" : money(Number(r.client_fee), r.currency)}
            </Text>
          </View>
        ))}
        <Text style={styles.total}>Client fees: {amountsLabel(total)}</Text>
      </>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {settings ? (
        <Text style={styles.intro}>
          Client fees start {settings.free_client_months} months after a trainer's plan starts, for every active client above{" "}
          {settings.free_clients}. They're worked out on the 1st and due by the {settings.client_fees_due_day}th.
        </Text>
      ) : null}

      {proofs.length > 0
        ? section("proofs", "🧾 Proof of payment", String(proofs.length), () =>
            proofs.map((p) => {
              const t = byId[p.trainer_id];
              return (
                <View key={p.id} style={styles.line}>
                  <Text style={styles.lineName}>{t ? trainerDisplayName(t) : "A trainer"}</Text>
                  <Text style={styles.lineDetail}>
                    Sent {proofWhen(p.created_at)}
                    {p.amount ? ` · ${p.amount}` : ""}
                  </Text>
                  <Pressable onPress={() => setViewing(p)} hitSlop={8}>
                    <Text style={styles.link}>View and record payment</Text>
                  </Pressable>
                </View>
              );
            }),
          )
        : null}

      {section("outstanding", "Outstanding", outstanding.length ? String(outstanding.length) : null, () =>
        outstanding.length === 0 ? (
          <Text style={styles.muted}>Nobody owes you anything right now.</Text>
        ) : (
          outstanding.map((t) => {
            const s = statuses[t.id];
            return (
              <View key={t.id} style={styles.line}>
                <Text style={styles.lineName}>{trainerDisplayName(t)}</Text>
                {s.plan_overdue ? <Text style={styles.warn}>{planStateLabel(planState(t, today))}</Text> : null}
                {s.client_fees_owed > 0 ? (
                  <Text style={s.client_fees_overdue > 0 ? styles.warn : styles.lineDetail}>
                    Client fees owed: {money(Number(s.client_fees_owed), t.billing_currency)}
                    {s.client_fees_overdue > 0 ? " (overdue)" : ""}
                  </Text>
                ) : null}
                <Pressable onPress={() => setPayFor(t)} hitSlop={8}>
                  <Text style={styles.link}>Record payment</Text>
                </Pressable>
              </View>
            );
          })
        ),
      )}

      {section("month", `This month (${monthLabel(today)})`, null, () => (
        <>
          <Text style={styles.muted}>Live count so far. It's saved on the 1st.</Text>
          {monthRows(thisMonth)}
        </>
      ))}

      {section("log", "Monthly log", monthKeys.length ? String(monthKeys.length) : null, () =>
        monthKeys.length === 0 ? (
          <Text style={styles.muted}>The first month is saved on the 1st of next month.</Text>
        ) : (
          monthKeys.map((key) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.subheading}>{monthLabel(key)}</Text>
              {monthRows(months.filter((m) => m.month === key))}
            </View>
          ))
        ),
      )}

      {section("halves", "6-month totals", null, () =>
        halves.length === 0 ? (
          <Text style={styles.muted}>Nothing to total yet.</Text>
        ) : (
          halves.map((h) => (
            <View key={h.key} style={styles.line}>
              <Text style={styles.lineName}>{h.label}</Text>
              <Text style={styles.lineDetail}>Client sign-ups: {h.activations}</Text>
              <Text style={styles.lineDetail}>Client fees billed: {amountsLabel(h.clientFees)}</Text>
              <Text style={styles.lineDetail}>Client fees received: {amountsLabel(h.feePayments)}</Text>
              <Text style={styles.lineDetail}>Plan payments received: {amountsLabel(h.planPayments)}</Text>
              <Text style={styles.lineDetail}>Trainer referrals: {h.referrals}</Text>
            </View>
          ))
        ),
      )}

      {section("trainers", "Trainers' plans", trainers.length ? String(trainers.length) : null, () =>
        trainers.length === 0 ? (
          <Text style={styles.muted}>No approved trainers yet.</Text>
        ) : (
          trainers.map((t) => {
            const unused = unusedCredits(t);
            const s = statuses[t.id];
            const state = planState(t, today);
            return (
              <View key={t.id} style={styles.line}>
                <Text style={styles.lineName}>{trainerDisplayName(t)}</Text>
                <Text style={styles.lineDetail}>
                  📍{" "}
                  {t.signup_country
                    ? `Applied from ${countryName(t.signup_country)} (${t.signup_country === "ZA" ? "rand" : "dollar"} prices)`
                    : "Country not checked (applied before the location check)"}
                </Text>
                {t.free_use_from ? null : (
                  <Text style={styles.lineDetail}>
                    {t.billing_plan ? `${PLAN_LABEL[t.billing_plan]} · ${t.billing_currency}` : "No plan set yet"}
                  </Text>
                )}
                <Text style={state.kind === "overdue" ? styles.warn : styles.lineDetail}>{planStateLabel(state)}</Text>
                {s?.client_fees_from ? (
                  <Text style={styles.lineDetail}>Client fees from {shortDate(s.client_fees_from)}</Text>
                ) : null}
                {unused > 0 && settings ? (
                  <Text style={styles.lineDetail}>
                    Referral credit: {unused} × 25% = {money(referralCreditValue(settings.prices, t.billing_currency ?? "USD", unused), t.billing_currency ?? "USD")}
                  </Text>
                ) : null}
                {t.free_use_from ? (
                  <Text style={styles.lineDetail}>
                    Free use since {shortDate(t.free_use_from)} ·{" "}
                    {money(settings?.prices[t.billing_currency ?? "ZAR"].client ?? 0, t.billing_currency ?? "ZAR")} per active client a
                    month from {shortDate(freeUseFeesStart(t.free_use_from))}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  {t.free_use_from ? null : (
                    <Pressable onPress={() => setPlanFor(t)} hitSlop={8}>
                      <Text style={styles.link}>{t.billing_plan ? "Change plan" : "Set plan"}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => (t.free_use_from ? endFreeUse(t) : setFreeUseFor(t))} hitSlop={8}>
                    <Text style={styles.link}>{t.free_use_from ? "End free use" : "Give free use"}</Text>
                  </Pressable>
                  {t.billing_plan || t.free_use_from ? (
                    <Pressable onPress={() => setPayFor(t)} hitSlop={8}>
                      <Text style={styles.link}>Record payment</Text>
                    </Pressable>
                  ) : null}
                  {unused > 0 ? (
                    <Pressable onPress={() => payOutReferrals(t)} hitSlop={8}>
                      <Text style={styles.link}>Pay out referrals</Text>
                    </Pressable>
                  ) : null}
                </View>
                {payments
                  .filter((p) => p.trainer_id === t.id)
                  .slice(0, 3)
                  .map((p) => (
                    <Text key={p.id} style={styles.small}>
                      {shortDate(p.paid_on)}: {money(Number(p.amount), p.currency)}{" "}
                      {p.kind === "subscription" ? `plan (${p.months} month${p.months === 1 ? "" : "s"})` : "client fees"}
                      {p.note?.startsWith("Referral credit") ? ` (${p.note})` : ""}
                    </Text>
                  ))}
              </View>
            );
          })
        ),
      )}

      {/* Money in one place (review 2026-10-18): the tracker moved here from Profile. */}
      {section("tracker", "📊 Tracker: all trainers' clients and income", null, () => <OwnerTracker />)}

      {section("prices", "Prices and lockout", null, () =>
        settings ? (
          <>
            {CURRENCIES.map((c) => (
              <View key={c} style={styles.line}>
                <Text style={styles.lineName}>{CURRENCY_LABEL[c]}</Text>
                {PLANS.map((p) => (
                  <Text key={p} style={styles.lineDetail}>
                    {PLAN_LABEL[p]}: {money(planPrice(settings.prices, c, p), c)}
                  </Text>
                ))}
                <Text style={styles.lineDetail}>Per client per month: {money(settings.prices[c].client, c)}</Text>
              </View>
            ))}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>Lock out unpaid trainers</Text>
                <Text style={styles.muted}>Off: reminders only. On: no access until you record their payment.</Text>
              </View>
              <Switch
                value={settings.lockout_enabled}
                onValueChange={toggleLockout}
                trackColor={{ true: BRAND_GOLD, false: "#334155" }}
                accessibilityLabel="Lock out unpaid trainers"
              />
            </View>
            <Text style={styles.muted}>To change a price, ask in the project chat.</Text>
          </>
        ) : null,
      )}

      <PaymentProofModal
        proof={viewing}
        from={viewing && byId[viewing.trainer_id] ? trainerDisplayName(byId[viewing.trainer_id]) : "a trainer"}
        confirmLabel="✓ Paid, record the payment"
        onConfirm={(p) => {
          setViewing(null);
          const t = byId[p.trainer_id];
          if (t) setPayFor(t);
        }}
        onReviewed={load}
        onClose={() => setViewing(null)}
      />
      {planFor ? <SetPlanModal trainer={planFor} onClose={() => setPlanFor(null)} onSaved={load} /> : null}
      {freeUseFor && settings ? (
        <FreeUseModal trainer={freeUseFor} settings={settings} onClose={() => setFreeUseFor(null)} onSaved={load} />
      ) : null}
      {payFor && settings ? (
        <RecordPaymentModal
          trainer={payFor}
          settings={settings}
          status={statuses[payFor.id]}
          unusedCredits={unusedCredits(payFor)}
          onClose={() => setPayFor(null)}
          onSaved={load}
        />
      ) : null}
    </ScrollView>
  );
}

function Choice<T extends string>({ options, value, onChange, label }: { options: T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <View style={styles.choiceRow}>
      {options.map((o) => (
        <Pressable key={o} style={[styles.choice, value === o && styles.choiceOn]} onPress={() => onChange(o)}>
          <Text style={[styles.choiceText, value === o && styles.choiceTextOn]}>{label(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SetPlanModal({ trainer, onClose, onSaved }: { trainer: Trainer; onClose: () => void; onSaved: () => Promise<void> }) {
  const today = todayIso();
  const trialEnd = trainer.trial_ends_at && trainer.trial_ends_at >= today ? trainer.trial_ends_at : null;
  const [plan, setPlan] = useState<BillingPlan>(trainer.billing_plan ?? "monthly");
  const [currency, setCurrency] = useState<BillingCurrency>(
    trainer.billing_currency ?? (trainer.signup_country && trainer.signup_country !== "ZA" ? "USD" : "ZAR"),
  );
  const [start, setStart] = useState<"trial" | "today">(trialEnd ? "trial" : "today");
  const [saving, setSaving] = useState(false);
  const keepStart = trainer.billing_started_on != null;

  const save = async () => {
    setSaving(true);
    const changes: Partial<Trainer> = { billing_plan: plan, billing_currency: currency };
    if (!keepStart) changes.billing_started_on = start === "trial" && trialEnd ? addDays(trialEnd, 1) : today;
    const { error } = await supabase.from("trainers").update(changes).eq("id", trainer.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    await onSaved();
    onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.modalTitle}>{trainerDisplayName(trainer)}'s plan</Text>
          <Text style={styles.fieldLabel}>Plan</Text>
          <Choice options={PLANS} value={plan} onChange={setPlan} label={(p) => PLAN_LABEL[p]} />
          <Text style={styles.fieldLabel}>Currency</Text>
          <Choice options={CURRENCIES} value={currency} onChange={setCurrency} label={(c) => (c === "USD" ? "US dollars" : "Rand")} />
          {keepStart ? (
            <Text style={styles.muted}>Plan started {shortDate(trainer.billing_started_on!)}.</Text>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Plan starts</Text>
              <Choice
                options={trialEnd ? (["trial", "today"] as const).slice() : (["today"] as ("trial" | "today")[])}
                value={start}
                onChange={setStart}
                label={(s) => (s === "trial" && trialEnd ? `After trial (${shortDate(addDays(trialEnd, 1))})` : "Today")}
              />
              <Text style={styles.muted}>Client fees start 2 months after this.</Text>
            </>
          )}
          <Pressable style={styles.primary} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>Save</Text>}
          </Pressable>
          <Pressable style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Free use (0096): only the owner gives it. No subscription; per-client fees
// on every active client start 6 months on (the next 1st), and the trainer
// and owner are reminded before then.
function FreeUseModal({
  trainer,
  settings,
  onClose,
  onSaved,
}: {
  trainer: Trainer;
  settings: BillingSettings;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const today = todayIso();
  const [currency, setCurrency] = useState<BillingCurrency>(
    trainer.billing_currency ?? (trainer.signup_country && trainer.signup_country !== "ZA" ? "USD" : "ZAR"),
  );
  const [saving, setSaving] = useState(false);
  const feesFrom = freeUseFeesStart(today);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("trainers")
      .update({ free_use_from: today, billing_currency: currency })
      .eq("id", trainer.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    await onSaved();
    onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.modalTitle}>Free use for {trainerDisplayName(trainer)}</Text>
          <Text style={styles.lineDetail}>
            No monthly subscription from today. From {shortDate(feesFrom)} they pay{" "}
            {money(settings.prices[currency].client, currency)} a month for every active client.
          </Text>
          <Text style={styles.muted}>
            The app reminds them and you 30 days and 7 days before, and on the day. Fees are worked out on the 1st of
            each month, so they start on the 1st after the 6 months are up.
          </Text>
          <Text style={styles.fieldLabel}>Currency</Text>
          <Choice options={CURRENCIES} value={currency} onChange={setCurrency} label={(c) => (c === "USD" ? "US dollars" : "Rand")} />
          <Pressable style={styles.primary} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>Give free use</Text>}
          </Pressable>
          <Pressable style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function RecordPaymentModal({
  trainer,
  settings,
  status,
  unusedCredits,
  onClose,
  onSaved,
}: {
  trainer: Trainer;
  settings: BillingSettings;
  status: TrainerBillingStatus | undefined;
  unusedCredits: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const currency = trainer.billing_currency ?? "USD";
  const owed = Number(status?.client_fees_owed ?? 0);
  const [kind, setKind] = useState<"subscription" | "client_fees">(
    trainer.free_use_from ? "client_fees" : status?.plan_overdue || owed === 0 ? "subscription" : "client_fees",
  );
  const [plan, setPlan] = useState<BillingPlan>(trainer.billing_plan ?? "monthly");
  const usable = creditsUsable(settings.prices, currency, plan, unusedCredits);
  const [useCredit, setUseCredit] = useState(usable > 0);
  // Referral credit can also come off client fees (free-use trainers have no plan).
  const feeCredits = feeCreditsUsable(settings.prices, currency, owed, unusedCredits);
  const feeCreditValue = referralCreditValue(settings.prices, currency, feeCredits);
  // On by default only for free-use trainers: everyone else was told it comes off their plan payment.
  const [useFeeCredit, setUseFeeCredit] = useState(feeCredits > 0 && !!trainer.free_use_from);
  const suggested =
    kind === "subscription"
      ? planAmountDue(settings.prices, currency, plan, useCredit ? usable : 0)
      : owed - (useFeeCredit ? feeCreditValue : 0);
  const [amount, setAmount] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = amount ?? String(suggested);

  const save = async () => {
    const value = Number(shown.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert("Check the amount", "Type the amount you received, e.g. 500.");
      return;
    }
    setSaving(true);
    const creditingFees = kind === "client_fees" && useFeeCredit && feeCredits > 0;
    // The referral credit is logged as its own client-fee payment, so what they owe goes down by it.
    if (creditingFees) {
      const credit = await supabase.from("trainer_payments").insert({
        trainer_id: trainer.id,
        kind: "client_fees",
        amount: feeCreditValue,
        currency,
        months: null,
        paid_on: todayIso(),
        note: `Referral credit: ${feeCredits} × 25%`,
      });
      if (!credit.error) {
        const used = await supabase
          .from("trainers")
          .update({ referral_credits_used: trainer.referral_credits_used + feeCredits })
          .eq("id", trainer.id);
        if (used.error) Alert.alert("Credit saved, but the referral credit wasn't marked used", used.error.message);
      } else {
        setSaving(false);
        Alert.alert("Couldn't save the referral credit", credit.error.message);
        return;
      }
    }
    const { error } =
      creditingFees && value === 0
        ? { error: null }
        : await supabase.from("trainer_payments").insert({
            trainer_id: trainer.id,
            kind,
            amount: value,
            currency,
            months: kind === "subscription" ? PLAN_MONTHS[plan] : null,
            paid_on: todayIso(),
          });
    if (!error && kind === "subscription" && useCredit && usable > 0) {
      const res = await supabase
        .from("trainers")
        .update({ referral_credits_used: trainer.referral_credits_used + usable })
        .eq("id", trainer.id);
      if (res.error) Alert.alert("Payment saved, but the referral credit wasn't marked used", res.error.message);
    }
    setSaving(false);
    if (error && creditingFees) {
      // The credit is already stored, so close rather than let a retry add it twice.
      Alert.alert("Referral credit saved, payment not saved", `${error.message}\n\nOpen Record payment again to add the payment.`);
      await onSaved();
      onClose();
      return;
    }
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    await onSaved();
    onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardSafe>
      <SafeAreaView style={styles.modal}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.modalTitle}>Payment from {trainerDisplayName(trainer)}</Text>
          <Text style={styles.fieldLabel}>What for</Text>
          <Choice
            options={["subscription", "client_fees"] as ("subscription" | "client_fees")[]}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setAmount(null);
            }}
            label={(k) => (k === "subscription" ? "Plan" : "Client fees")}
          />
          {kind === "subscription" ? (
            <>
              <Text style={styles.fieldLabel}>Pays for</Text>
              <Choice
                options={PLANS}
                value={plan}
                onChange={(p) => {
                  setPlan(p);
                  setAmount(null);
                }}
                label={(p) => PLAN_LABEL[p]}
              />
              {usable > 0 ? (
                <View style={styles.switchRow}>
                  <Text style={[styles.lineDetail, { flex: 1 }]}>
                    Use referral credit ({usable} × 25% = {money(referralCreditValue(settings.prices, currency, usable), currency)} off)
                  </Text>
                  <Switch
                    value={useCredit}
                    onValueChange={(v) => {
                      setUseCredit(v);
                      setAmount(null);
                    }}
                    trackColor={{ true: BRAND_GOLD, false: "#334155" }}
                  />
                </View>
              ) : null}
              <Text style={styles.muted}>
                {trainer.paid_until
                  ? `Paid until ${shortDate(trainer.paid_until)} now; this adds ${PLAN_MONTHS[plan]} month${PLAN_MONTHS[plan] === 1 ? "" : "s"}.`
                  : `Their first payment: it covers ${PLAN_MONTHS[plan]} month${PLAN_MONTHS[plan] === 1 ? "" : "s"} from the plan start.`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.muted}>They owe {money(owed, currency)} in client fees.</Text>
              {feeCredits > 0 ? (
                <View style={styles.switchRow}>
                  <Text style={[styles.lineDetail, { flex: 1 }]}>
                    Use referral credit ({feeCredits} × 25% = {money(feeCreditValue, currency)} off)
                  </Text>
                  <Switch
                    value={useFeeCredit}
                    onValueChange={(v) => {
                      setUseFeeCredit(v);
                      setAmount(null);
                    }}
                    trackColor={{ true: BRAND_GOLD, false: "#334155" }}
                  />
                </View>
              ) : null}
            </>
          )}
          <Text style={styles.fieldLabel}>Amount received ({currency === "ZAR" ? "rand" : "US dollars"})</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={shown} onChangeText={setAmount} />
          <Pressable style={styles.primary} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>Save payment</Text>}
          </Pressable>
          <Pressable style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  intro: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  section: { backgroundColor: "#1E293B", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  badge: {
    color: "#0F172A",
    backgroundColor: BRAND_GOLD,
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 8,
  },
  chevron: { color: BRAND_GOLD, fontSize: 12 },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  subheading: { color: BRAND_GOLD, fontWeight: "700", marginBottom: 6 },
  line: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 8 },
  lineName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  lineDetail: { color: "#CBD5E1", fontSize: 13, marginTop: 3 },
  small: { color: "#64748B", fontSize: 12, marginTop: 3 },
  warn: { color: "#F59E0B", fontSize: 13, marginTop: 3, fontWeight: "600" },
  muted: { color: "#94A3B8", fontSize: 12, lineHeight: 18, marginTop: 4 },
  total: { color: BRAND_GOLD, fontWeight: "700", marginTop: 4 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginTop: 8 },
  actions: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  fieldLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  choiceOn: { borderColor: BRAND_GOLD, backgroundColor: "#2A2410" },
  choiceText: { color: "#CBD5E1", fontWeight: "600" },
  choiceTextOn: { color: BRAND_GOLD },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 16 },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 24 },
  primaryText: { color: "#0F172A", fontWeight: "800" },
  secondary: { padding: 14, alignItems: "center" },
  secondaryText: { color: "#94A3B8", fontWeight: "600" },
});
