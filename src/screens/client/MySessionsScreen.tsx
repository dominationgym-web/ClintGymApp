import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import SessionMonthCalendar from "@/components/sessions/SessionMonthCalendar";
import SessionInvoiceView from "@/components/sessions/SessionInvoiceView";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { money } from "@/lib/billing";
import { navigationRef } from "@/navigation/navigationRef";
import {
  KIND_STYLE,
  agreementCurrent,
  billingLabel,
  cancelPreview,
  clockLabel,
  dayKey,
  dayLabel,
  feeText,
  fillAgreement,
  kindDetail,
  monthLabel,
  monthStart,
  noticeHours,
  policyLabel,
  regularLabel,
  sessionKind,
  sessionMoney,
  shiftMonth,
} from "@/lib/liveSessions";
import type { ClientStackParamList } from "@/navigation/types";
import type { LiveSession, SessionAgreement, SessionInvoice, SessionPlan, SessionSettings } from "@/types/database";
import { themeBg, themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

type Tab = "sessions" | "month" | "invoices" | "agreement";

// The client's in-person sessions (0168): confirm the ones their coach marked
// done with one tap, cancel one (seeing first whether it will be charged),
// their month, their invoices, and the agreement they sign.
export default function MySessionsScreen() {
  const { client } = useAuth();
  const route = useRoute<RouteProp<ClientStackParamList, "MySessions">>();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? "sessions");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [signed, setSigned] = useState<SessionAgreement | null>(null);
  const [coach, setCoach] = useState("Your coach");
  const [coachPhone, setCoachPhone] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [invoices, setInvoices] = useState<SessionInvoice[]>([]);
  const [month, setMonth] = useState(monthStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const load = useCallback(async () => {
    if (!client) return;
    const from = new Date(Math.min(new Date(`${shiftMonth(month, -1)}T00:00:00`).getTime(), Date.now() - 14 * 86400000)).toISOString();
    const to = new Date(`${shiftMonth(month, 2)}T00:00:00`).toISOString();
    const [p, a, ls, inv, t] = await Promise.all([
      supabase.from("session_plans").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("session_agreements").select("*").eq("client_id", client.id).order("signed_at", { ascending: false }).limit(1),
      supabase.from("live_sessions").select("*").eq("client_id", client.id).gte("starts_at", from).lt("starts_at", to).order("starts_at"),
      supabase.from("session_invoices").select("*").eq("client_id", client.id).order("month", { ascending: false }),
      client.trainer_id ? supabase.from("trainers").select("name, business_name, phone").eq("id", client.trainer_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setPlan(p.data ?? null);
    setSigned(a.data?.[0] ?? null);
    setSessions((ls.data ?? []).filter((s) => s.status !== "removed"));
    setInvoices(inv.data ?? []);
    const tr = t.data as { name: string; business_name: string | null; phone: string | null } | null;
    if (tr) {
      setCoach(tr.business_name?.trim() || tr.name);
      setCoachPhone(tr.phone);
    }
    if (p.data) {
      const { data } = await supabase.from("session_settings").select("*").eq("trainer_id", p.data.trainer_id).maybeSingle();
      setSettings(data ?? null);
    }
    setLoading(false);
  }, [client, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const needsSign = !!plan && plan.active && !agreementCurrent(signed, plan);
  const unpaid = invoices.filter((i) => i.status === "sent");
  const tabs: ScreenTab<Tab>[] = [
    { key: "sessions", label: "Sessions", icon: "people" },
    { key: "month", label: "Month", icon: "calendar" },
    { key: "invoices", label: "Invoices", icon: "receipt", dot: unpaid.length ? "#F59E0B" : null },
    { key: "agreement", label: "Agreement", icon: "document-text", dot: needsSign ? "#F59E0B" : null },
  ];

  return (
    <View style={styles.container}>
      <ScreenTabBar tabs={tabs} current={tab} onChange={setTab} position="top" />
      {loading ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 24 }} />
      ) : !plan ? (
        <Text style={[styles.helper, { padding: 20 }]}>Your coach hasn't set up in-person sessions for you yet.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeText(BRAND_GOLD)} />}
        >
          {needsSign && tab !== "agreement" ? (
            <Pressable style={styles.notice} onPress={() => setTab("agreement")}>
              <Text style={styles.noticeText}>✍️ Please read and sign your session agreement. Tap here.</Text>
            </Pressable>
          ) : null}
          {tab === "sessions" && <SessionsTab sessions={sessions} plan={plan} coach={coach} onChanged={load} />}
          {tab === "month" && <MonthTab month={month} onMonth={setMonth} sessions={sessions} />}
          {tab === "invoices" && <InvoicesTab invoices={invoices} paidForYou={!!plan.paid_by} />}
          {tab === "agreement" && (
            <AgreementTab plan={plan} settings={settings} signed={signed} coach={coach} coachPhone={coachPhone} clientName={client?.name ?? ""} needsSign={needsSign} onSigned={load} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SessionsTab({ sessions, plan, coach, onChanged }: { sessions: LiveSession[]; plan: SessionPlan; coach: string; onChanged: () => void }) {
  const now = new Date();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<LiveSession | null>(null);
  const toConfirm = sessions.filter((s) => s.status === "done" && !s.client_confirmed_at && !s.client_disputed_at);
  const upcoming = sessions.filter((s) => s.status === "booked" && new Date(s.starts_at) > now);
  const recent = sessions
    .filter((s) => new Date(s.starts_at) <= now && s.status !== "booked")
    .slice(-6)
    .reverse();

  const confirm = async (s: LiveSession, happened: boolean) => {
    setBusy(s.id);
    const { error } = await supabase.rpc("client_confirm_session", { p_id: s.id, p_happened: happened });
    setBusy(null);
    if (error) Alert.alert("Couldn't save", error.message);
    else if (!happened) Alert.alert("Your coach has been told", "They'll check it and fix it if needed.");
    onChanged();
  };

  const notThere = (s: LiveSession) =>
    Alert.alert("This session didn't happen?", `${dayLabel(s.starts_at)} at ${clockLabel(s.starts_at)}. ${coach} will be asked to check it.`, [
      { text: "Back", style: "cancel" },
      { text: "It didn't happen", style: "destructive", onPress: () => confirm(s, false) },
    ]);

  return (
    <>
      {toConfirm.length ? <Text style={styles.sectionTitle}>Did you train?</Text> : null}
      {toConfirm.map((s) => (
        <View key={s.id} style={[styles.row, { borderLeftColor: themeBg(BRAND_GOLD) }]}>
          <Text style={styles.rowTitle}>
            {dayLabel(s.starts_at)} · {clockLabel(s.starts_at)} with {coach}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.smallButton} onPress={() => confirm(s, true)} disabled={busy === s.id}>
              {busy === s.id ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.smallButtonText}>✓ Yes, I trained</Text>}
            </Pressable>
            <Pressable style={styles.outline} onPress={() => notThere(s)}>
              <Text style={styles.outlineText}>No</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Coming up</Text>
      <Text style={styles.meta}>
        {plan.per_week} a week{plan.regular.length ? ` · ${regularLabel(plan.regular)}` : ""} · cancellation rule: {policyLabel(plan.policy)}
      </Text>
      {upcoming.length === 0 ? <Text style={styles.helper}>No sessions booked yet.</Text> : null}
      {upcoming.slice(0, 4).map((s) => (
        <View key={s.id} style={styles.row}>
          <Text style={styles.rowTitle}>
            {dayLabel(s.starts_at)} · {clockLabel(s.starts_at)}
          </Text>
          <Text style={styles.meta}>{s.minutes} min with {coach}</Text>
          <Pressable style={styles.outlineSmall} onPress={() => setCancelling(s)}>
            <Text style={styles.outlineText}>Can't make it</Text>
          </Pressable>
        </View>
      ))}
      {upcoming.length > 4 ? <Text style={styles.meta}>See the rest on the Month tab.</Text> : null}

      {recent.length ? <Text style={styles.sectionTitle}>Recent</Text> : null}
      {recent.map((s) => {
        const kind = sessionKind(s, now);
        return (
          <View key={s.id} style={[styles.row, { borderLeftColor: themeBg(KIND_STYLE[kind].colour) }]}>
            <Text style={styles.rowTitle}>
              {dayLabel(s.starts_at)} · {clockLabel(s.starts_at)}
            </Text>
            <Text style={[styles.kind, { color: themeText(KIND_STYLE[kind].colour) }]}>
              {KIND_STYLE[kind].icon} {kindDetail(kind, s.cancelled_at ? noticeHours(s.starts_at, s.cancelled_at) : null, { clientOk: !!s.client_confirmed_at, catchUp: !!s.makeup_for, catchUpBooked: !!s.makeup_session_id })}
            </Text>
          </View>
        );
      })}

      <CancelModal session={cancelling} plan={plan} coach={coach} onClose={() => setCancelling(null)} onDone={onChanged} />
    </>
  );
}

// Before cancelling, the client sees how much notice they're giving and
// whether it will be charged under their agreement.
function CancelModal({ session, plan, coach, onClose, onDone }: { session: LiveSession | null; plan: SessionPlan; coach: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setReason(""), [session?.id]);
  if (!session) return null;
  const preview = cancelPreview(plan.policy, session.starts_at);
  const colour = preview.charged ? "#EF4444" : preview.charged === false ? "#22C55E" : "#F59E0B";

  const cancel = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("cancel_live_session", { p_id: session.id, p_reason: reason.trim() || null });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't cancel", error.message);
      return;
    }
    onClose();
    onDone();
    Alert.alert("Cancelled", `${coach} has been told.`);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sectionTitle}>
              Cancel {dayLabel(session.starts_at)} at {clockLabel(session.starts_at)}?
            </Text>
            <View style={[styles.result, { borderColor: themeBg(colour) }]}>
              <Text style={styles.resultText}>{preview.text}</Text>
            </View>
            <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Why? (optional)" placeholderTextColor="#64748B" maxLength={200} />
            <Pressable style={[styles.button, { backgroundColor: themeBg("#EF4444") }]} onPress={cancel} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { color: "#fff" }]}>Cancel the session</Text>}
            </Pressable>
            <Pressable style={styles.closeRow} onPress={onClose}>
              <Text style={styles.closeText}>Keep it</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

function MonthTab({ month, onMonth, sessions }: { month: string; onMonth: (m: string) => void; sessions: LiveSession[] }) {
  const [day, setDay] = useState(dayKey(new Date()));
  const list = sessions.filter((s) => dayKey(s.starts_at) === day);
  return (
    <>
      <SessionMonthCalendar month={month} onMonth={onMonth} sessions={sessions} selected={day} onSelect={setDay} />
      <Text style={styles.sectionTitle}>{dayLabel(day)}</Text>
      {list.length === 0 ? <Text style={styles.helper}>No session.</Text> : null}
      {list.map((s) => {
        const kind = sessionKind(s);
        return (
          <View key={s.id} style={[styles.row, { borderLeftColor: themeBg(KIND_STYLE[kind].colour) }]}>
            <Text style={styles.rowTitle}>{clockLabel(s.starts_at)}</Text>
            <Text style={[styles.kind, { color: themeText(KIND_STYLE[kind].colour) }]}>
              {KIND_STYLE[kind].icon} {kindDetail(kind, s.cancelled_at ? noticeHours(s.starts_at, s.cancelled_at) : null, { catchUp: !!s.makeup_for, catchUpBooked: !!s.makeup_session_id })}
            </Text>
          </View>
        );
      })}
      <Text style={styles.meta}>🟡 trained · 🔴 late cancellation or no-show · 🟢 cancelled in time · 🔁 catch-up · 🔵 coach cancelled · ⚪ booked</Text>
    </>
  );
}

function InvoicesTab({ invoices, paidForYou }: { invoices: SessionInvoice[]; paidForYou: boolean }) {
  const [open, setOpen] = useState<SessionInvoice | null>(null);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open !== null, () => setOpen(null));
  if (open) {
    return (
      <>
        <Pressable onPress={() => setOpen(null)} hitSlop={10}>
          <Text style={styles.back}>‹ All invoices</Text>
        </Pressable>
        <View style={{ marginTop: 10 }}>
          <SessionInvoiceView invoice={open} who="client" />
        </View>
        {open.status === "sent" ? (
          <Pressable style={styles.button} onPress={() => navigationRef.navigate("ClientTabs", { screen: "Profile", params: { open: "pay" } })}>
            <Text style={styles.buttonText}>🧾 Send proof of payment</Text>
          </Pressable>
        ) : null}
      </>
    );
  }
  return (
    <>
      {paidForYou ? (
        // Someone in the group pays for them (0170): their sessions are on that person's invoice.
        <Text style={styles.helper}>Someone in your group pays for your sessions, so they're on that person's invoice, listed under your name.</Text>
      ) : invoices.length === 0 ? (
        <Text style={styles.helper}>No invoices yet. Your coach sends one each month.</Text>
      ) : null}
      {invoices.map((inv) => (
        <Pressable key={inv.id} style={[styles.row, { borderLeftColor: themeBg(inv.status === "paid" ? "#22C55E" : "#F59E0B") }]} onPress={() => setOpen(inv)}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.rowTitle}>{monthLabel(inv.month)}</Text>
            <Text style={styles.rowTitle}>{sessionMoney(Number(inv.total), inv.currency)}</Text>
          </View>
          <Text style={[styles.meta, { color: themeText(inv.status === "paid" ? "#22C55E" : "#F59E0B") }]}>
            {inv.status === "paid" ? "Paid ✅" : "Not paid yet"} · {billingLabel(inv.billing).toLowerCase()}
          </Text>
        </Pressable>
      ))}
    </>
  );
}

function AgreementTab({
  plan,
  settings,
  signed,
  coach,
  coachPhone,
  clientName,
  needsSign,
  onSigned,
}: {
  plan: SessionPlan;
  settings: SessionSettings | null;
  signed: SessionAgreement | null;
  coach: string;
  coachPhone: string | null;
  clientName: string;
  needsSign: boolean;
  onSigned: () => void;
}) {
  const [name, setName] = useState("");
  const [ticked, setTicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const text = fillAgreement(settings?.agreement_text, {
    coach,
    client: clientName,
    fee: feeText(plan, settings?.currency ?? "ZAR"),
    policy: plan.policy,
    billing: plan.billing,
    minutes: plan.minutes,
    regular: plan.regular,
    contact: coachPhone,
  });

  const sign = async () => {
    if (!ticked || name.trim().length < 2) {
      Alert.alert("Almost there", "Tick that you agree and type your full name.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("sign_session_agreement", { p_name: name.trim(), p_agreement: text });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't sign", error.message);
      return;
    }
    Alert.alert("Signed ✍️", `${coach} has been told. Thank you.`);
    onSigned();
  };

  return (
    <>
      <Text style={styles.agreement}>{text}</Text>
      {needsSign ? (
        <>
          <Pressable style={styles.tickRow} onPress={() => setTicked(!ticked)}>
            <View style={[styles.tick, ticked && styles.tickOn]}>{ticked ? <Text style={styles.tickMark}>✓</Text> : null}</View>
            <Text style={styles.tickText}>I have read and agree to this agreement</Text>
          </Pressable>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor="#64748B" maxLength={120} />
          <Pressable style={styles.button} onPress={sign} disabled={saving}>
            {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Sign</Text>}
          </Pressable>
          {signed ? <Text style={styles.meta}>Your coach changed the terms since you last signed, so it needs a new signature.</Text> : null}
        </>
      ) : signed ? (
        <Text style={[styles.helper, { color: themeText("#22C55E") }]}>
          ✍️ Signed by {signed.signed_name} on {new Date(signed.signed_at).toLocaleDateString()} at {clockLabel(signed.signed_at)}.
        </Text>
      ) : null}
    </>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  back: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 4, marginBottom: 6, lineHeight: 17 },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#334155" },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  kind: { fontSize: 13, fontWeight: "600", marginTop: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 },
  smallButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  smallButtonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  outlineSmall: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, alignSelf: "flex-start", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  notice: { backgroundColor: "#3B2F0B", borderRadius: 10, padding: 12, marginBottom: 4 },
  noticeText: { color: "#FDE68A", fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, fontSize: 15, marginTop: 12, borderWidth: 1, borderColor: "#334155" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  result: { borderWidth: 2, borderRadius: 10, padding: 12 },
  resultText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  closeRow: { padding: 12, alignItems: "center", marginTop: 6 },
  closeText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
  agreement: { color: "#E2E8F0", fontSize: 14, lineHeight: 21, backgroundColor: "#1E293B", borderRadius: 10, padding: 14 },
  tickRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  tick: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  tickOn: { backgroundColor: BRAND_GOLD },
  tickMark: { color: "#0F172A", fontWeight: "900" },
  tickText: { color: "#fff", fontSize: 14, flex: 1 },
});
