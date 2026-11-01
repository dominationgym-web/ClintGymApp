import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, RefreshControl, Share, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import TextInput from "@/components/TextInput";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import SessionMonthCalendar from "@/components/sessions/SessionMonthCalendar";
import SessionActionsModal from "@/components/sessions/SessionActionsModal";
import SessionPlanEditor from "@/components/sessions/SessionPlanEditor";
import CalendarImportModal from "@/components/sessions/CalendarImportModal";
import SessionInvoiceView from "@/components/sessions/SessionInvoiceView";
import SessionTimeChips from "@/components/sessions/SessionTimeChips";
import { TodayMoneyCard, WeekMoneyModal } from "@/components/sessions/SessionEarnings";
import { TimeOffSection } from "@/components/sessions/BlockTimeModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { money } from "@/lib/billing";
import { phoneTimeZone, whatsappDigits } from "@/lib/videoCheckins";
import { eftRows } from "@/lib/trainers";
import {
  AGREEMENT_TEMPLATE,
  AGREEMENT_WORDS,
  BILLINGS,
  KIND_STYLE,
  POLICIES,
  SESSION_LENGTHS,
  agreementCurrent,
  atTime,
  cleanTime,
  clockLabel,
  dayKey,
  dayLabel,
  fillAgreement,
  groupFees,
  invoiceText,
  kindDetail,
  monthLabel,
  monthStart,
  noticeHours,
  openSlots,
  policyLabel,
  regularLabel,
  sessionKind,
  sessionMoney,
  shiftMonth,
  slotGroups,
  groupNames,
} from "@/lib/liveSessions";
import type { TrainerStackParamList } from "@/navigation/types";
import type { BillingCurrency, LiveSession, SessionAgreement, SessionInvoice, SessionPlan, SessionSettings } from "@/types/database";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

export type LiveTab = "todo" | "calendar" | "clients" | "invoices" | "setup";
type Tab = LiveTab;
type ClientInfo = { id: string; name: string; phone: string | null; email: string | null; live_only?: boolean; one_on_one?: boolean };

// In-person session booking (0168, GRIZZ 2026-10-31). Five tabs instead of
// one long page: what needs the trainer now, the month calendar, each
// client's deal, the month's invoices, and the trainer's normal fee and rule.
// On the trainer's 1 on 1 side (GRIZZ, 2026-11-01) each of these is its own
// bottom tab: `only` shows that one page with no top tab bar.
export default function LiveSessionsScreen({ only }: { only?: Tab } = {}) {
  const { trainer } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const route = useRoute<RouteProp<TrainerStackParamList, "LiveSessions">>();
  const [tab, setTab] = useState<Tab>(only ?? route.params?.tab ?? "todo");
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [plans, setPlans] = useState<SessionPlan[]>([]);
  const [signed, setSigned] = useState<Record<string, SessionAgreement>>({});
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [drafts, setDrafts] = useState<SessionInvoice[]>([]);
  const [month, setMonth] = useState(monthStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<LiveSession | null>(null);
  const [weekMoney, setWeekMoney] = useState(false);
  // A cancelled session whose catch-up is being booked on the Calendar tab.
  const [makeup, setMakeup] = useState<LiveSession | null>(null);

  useEffect(() => {
    if (!only && route.params?.tab) setTab(route.params.tab);
  }, [only, route.params?.tab]);
  // Back on the tab's own page each time the trainer comes to the tab.
  useFocusEffect(
    useCallback(() => {
      if (only) setTab(only);
    }, [only])
  );

  const load = useCallback(async () => {
    if (!trainer) return;
    const from = new Date(Math.min(new Date(`${shiftMonth(month, -1)}T00:00:00`).getTime(), Date.now() - 92 * 86400000)).toISOString();
    const to = new Date(`${shiftMonth(month, 2)}T00:00:00`).toISOString();
    const [s, p, a, c, ls, d] = await Promise.all([
      supabase.from("session_settings").select("*").eq("trainer_id", trainer.id).maybeSingle(),
      supabase.from("session_plans").select("*").eq("trainer_id", trainer.id),
      supabase.from("session_agreements").select("*").eq("trainer_id", trainer.id).order("signed_at", { ascending: false }),
      supabase.from("clients").select("id, name, phone, email, live_only, one_on_one").eq("trainer_id", trainer.id).neq("id", trainer.id).is("archived_at", null).order("name"),
      supabase.from("live_sessions").select("*").eq("trainer_id", trainer.id).gte("starts_at", from).lt("starts_at", to).order("starts_at"),
      supabase.from("session_invoices").select("*").eq("trainer_id", trainer.id).eq("status", "draft").order("month"),
    ]);
    setSettings(s.data ?? null);
    setPlans(p.data ?? []);
    const latest: Record<string, SessionAgreement> = {};
    for (const row of a.data ?? []) if (!latest[row.client_id]) latest[row.client_id] = row;
    setSigned(latest);
    setClients((c.data ?? []) as ClientInfo[]);
    setSessions(ls.data ?? []);
    setDrafts(d.data ?? []);
    setLoading(false);
  }, [trainer, month]);

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

  const byId = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const planOf = useMemo(() => Object.fromEntries(plans.map((p) => [p.client_id, p])), [plans]);
  const now = new Date();
  const todo = sessions.filter((s) => ["unconfirmed", "decide"].includes(sessionKind(s, now)) || (s.status === "done" && s.client_disputed_at));
  const unsigned = plans.filter((p) => p.active && !agreementCurrent(signed[p.client_id], p));
  const catchUps = sessions.filter((s) => s.charge === "makeup" && !s.makeup_session_id && (s.status === "cancelled" || s.status === "no_show"));

  const tabs: ScreenTab<Tab>[] = [
    { key: "todo", label: only ? "Today" : "To do", icon: "checkbox", dot: todo.length || unsigned.length || catchUps.length ? "#F59E0B" : null },
    { key: "calendar", label: "Calendar", icon: "calendar" },
    { key: "clients", label: "Clients", icon: "people" },
    { key: "invoices", label: "Invoices", icon: "receipt", dot: drafts.length ? "#F59E0B" : null },
    { key: "setup", label: "Setup", icon: "settings", dot: settings ? null : "#F59E0B" },
  ];

  const sessionsLeftToday = sessions.some((s) => dayKey(s.starts_at) === dayKey(now) && sessionKind(s, now) === "booked");
  const moneyCard = settings ? <TodayMoneyCard sessions={sessions} currency={settings.currency} onWeek={() => setWeekMoney(true)} /> : null;

  // An app client's name, or the name a diary-only session carries (0174).
  const who = (s: Pick<LiveSession, "client_id" | "guest_name">) => (s.client_id ? byId[s.client_id]?.name : s.guest_name) ?? "Client";

  return (
    <View style={styles.container}>
      {only ? null : <ScreenTabBar tabs={tabs} current={tab} onChange={setTab} position="top" />}
      {loading ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeText(BRAND_GOLD)} />}
        >
          {only && tab !== only ? (
            <Pressable onPress={() => setTab(only)} hitSlop={10}>
              <Text style={[styles.back, { marginBottom: 12 }]}>‹ Back to {tabs.find((t) => t.key === only)?.label ?? "the list"}</Text>
            </Pressable>
          ) : null}
          {!settings && tab !== "setup" ? (
            <Pressable style={styles.notice} onPress={() => setTab("setup")}>
              <Text style={styles.noticeText}>Start under Setup: your normal fee and cancellation rule. Then set up each client under Clients.</Text>
            </Pressable>
          ) : null}
          {/* What the day (and week) made after cancellations and credits (GRIZZ, 2026-11-01):
              at the top once the day's sessions are over, under them until then. */}
          {tab === "todo" && settings && !sessionsLeftToday ? moneyCard : null}
          {tab === "todo" && (
            <ToDo
              todo={todo}
              today={sessions.filter((s) => dayKey(s.starts_at) === dayKey(now) && s.status !== "removed" && !todo.includes(s))}
              unsigned={unsigned}
              catchUps={catchUps}
              planOf={planOf}
              currency={settings?.currency ?? "ZAR"}
              onCatchUp={(s) => {
                setMakeup(s);
                setTab("calendar");
              }}
              drafts={drafts.length}
              name={who}
              onOpen={setOpen}
              onGo={setTab}
              onChanged={load}
            />
          )}
          {tab === "todo" && settings && sessionsLeftToday ? <View style={{ marginTop: 20 }}>{moneyCard}</View> : null}
          {tab === "calendar" && (
            <CalendarTab
              month={month}
              onMonth={setMonth}
              sessions={sessions}
              clients={clients}
              plans={plans}
              settings={settings}
              name={who}
              makeup={makeup}
              onMakeupDone={() => setMakeup(null)}
              onOpen={setOpen}
              onChanged={load}
            />
          )}
          {tab === "clients" && (
            <ClientsTab
              clients={clients}
              planOf={planOf}
              signed={signed}
              settings={settings}
              onChanged={load}
              oneOnOne={!!only}
              onOpenPage={(clientId) => navigation.navigate("ClientDetail", { clientId })}
            />
          )}
          {tab === "invoices" && <InvoicesTab plans={plans} drafts={drafts} byId={byId} onChanged={load} />}
          {tab === "setup" && <SetupTab settings={settings} onSaved={setSettings} />}
        </ScrollView>
      )}
      <WeekMoneyModal
        visible={weekMoney}
        sessions={sessions}
        currency={settings?.currency ?? "ZAR"}
        name={who}
        onClose={() => setWeekMoney(false)}
      />
      <SessionActionsModal
        session={open}
        clientName={open ? who(open) : ""}
        clientPhone={open ? byId[open.client_id ?? ""]?.phone ?? null : null}
        policy={(open && planOf[open.client_id ?? ""]?.policy) || settings?.policy || "24h"}
        settings={settings}
        sessions={sessions}
        clients={clients}
        onClose={() => setOpen(null)}
        onChanged={load}
      />
    </View>
  );
}

// Two or more people at the same time are one group session (GRIZZ,
// 2026-11-01). One line for the slot, each person under it to tap: they're
// still marked and billed one by one.
function GroupLine({ sessions, name, onOpen, showDay }: { sessions: LiveSession[]; name: (s: LiveSession) => string; onOpen: (s: LiveSession) => void; showDay?: boolean }) {
  const first = sessions[0];
  const kinds = sessions.map((s) => sessionKind(s));
  const lead = KIND_STYLE[kinds.every((k) => k === kinds[0]) ? kinds[0] : "unconfirmed"];
  return (
    <View style={[styles.row, { borderLeftColor: themeBg(lead.colour) }]}>
      <Text style={styles.rowTitle}>
        {clockLabel(first.starts_at)} · 👥 {groupNames(sessions.map(name))}
        {showDay ? ` · ${dayLabel(first.starts_at)}` : ""}
        {sessions.every((s) => s.repeat_id) ? " 🔁" : ""}
      </Text>
      <Text style={styles.meta}>Group session · {sessions.length} people</Text>
      {sessions.map((s) => {
        const kind = sessionKind(s);
        const st = KIND_STYLE[kind];
        return (
          <Pressable key={s.id} style={styles.groupPerson} onPress={() => onOpen(s)}>
            <Text style={styles.tickText}>{name(s)}</Text>
            <Text style={[styles.rowKind, { color: themeText(st.colour), marginTop: 0 }]}>
              {st.icon} {kindDetail(kind, s.cancelled_at ? noticeHours(s.starts_at, s.cancelled_at) : null, { clientOk: !!s.client_confirmed_at, disputed: !!s.client_disputed_at, catchUp: !!s.makeup_for, catchUpBooked: !!s.makeup_session_id })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A day's sessions, people at the same time shown as one group session. */
function SlotLines({ sessions, name, onOpen }: { sessions: LiveSession[]; name: (s: LiveSession) => string; onOpen: (s: LiveSession) => void }) {
  return (
    <>
      {slotGroups(sessions).map((g) =>
        g.length > 1 ? <GroupLine key={g[0].id} sessions={g} name={name} onOpen={onOpen} /> : <SessionLine key={g[0].id} s={g[0]} name={name(g[0])} onOpen={onOpen} />,
      )}
    </>
  );
}

function SessionLine({ s, name, onOpen, showDay }: { s: LiveSession; name: string; onOpen: (s: LiveSession) => void; showDay?: boolean }) {
  const kind = sessionKind(s);
  const style = KIND_STYLE[kind];
  return (
    <Pressable style={[styles.row, { borderLeftColor: themeBg(style.colour) }]} onPress={() => onOpen(s)}>
      <Text style={styles.rowTitle}>
        {clockLabel(s.starts_at)} · {name}
        {showDay ? ` · ${dayLabel(s.starts_at)}` : ""}
        {s.repeat_id ? " 🔁" : ""}
      </Text>
      <Text style={[styles.rowKind, { color: themeText(style.colour) }]}>
        {style.icon} {kindDetail(kind, s.cancelled_at ? noticeHours(s.starts_at, s.cancelled_at) : null, { clientOk: !!s.client_confirmed_at, disputed: !!s.client_disputed_at, catchUp: !!s.makeup_for, catchUpBooked: !!s.makeup_session_id })}
      </Text>
    </Pressable>
  );
}

function ToDo({
  todo,
  today,
  unsigned,
  catchUps,
  onCatchUp,
  planOf,
  currency,
  drafts,
  name: who,
  onOpen,
  onGo,
  onChanged,
}: {
  todo: LiveSession[];
  today: LiveSession[];
  unsigned: SessionPlan[];
  catchUps: LiveSession[];
  onCatchUp: (s: LiveSession) => void;
  planOf: Record<string, SessionPlan>;
  currency: BillingCurrency;
  drafts: number;
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  onOpen: (s: LiveSession) => void;
  onGo: (t: Tab) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const done = async (s: LiveSession) => {
    setBusy(s.id);
    const { error } = await supabase.rpc("set_session_outcome", { p_id: s.id, p_outcome: "done" });
    setBusy(null);
    if (error) Alert.alert("Couldn't save", error.message);
    onChanged();
  };
  // Unmarked sessions at the same time are a group: tick who came (GRIZZ, 2026-10-31).
  const unmarked = todo.filter((s) => sessionKind(s) === "unconfirmed" && !s.client_disputed_at);
  const byTime = new Map<string, LiveSession[]>();
  for (const s of unmarked) byTime.set(s.starts_at, [...(byTime.get(s.starts_at) ?? []), s]);
  const groups = [...byTime.values()].filter((g) => g.length > 1);
  const inGroup = new Set(groups.flat().map((s) => s.id));
  const singles = todo.filter((s) => !inGroup.has(s.id));
  const clear = !todo.length && !unsigned.length && !drafts && !catchUps.length;
  return (
    <>
      {/* Today's sessions first: the 1 on 1 side is about the day (GRIZZ, 2026-11-01). */}
      <Text style={styles.sectionTitle}>Today · {dayLabel(new Date().toISOString())}</Text>
      {today.length ? <SlotLines sessions={today} name={who} onOpen={onOpen} /> : <Text style={styles.helper}>No sessions booked today.</Text>}

      {clear ? <Text style={styles.helper}>All clear 👍 Every past session is marked and every invoice is sent.</Text> : null}

      {drafts ? (
        <Pressable style={styles.notice} onPress={() => onGo("invoices")}>
          <Text style={styles.noticeText}>
            🧾 {drafts} invoice{drafts === 1 ? " is" : "s are"} ready to check and send. Tap to see.
          </Text>
        </Pressable>
      ) : null}

      {todo.length ? <Text style={styles.sectionTitle}>Did these happen?</Text> : null}
      {groups.map((g) => (
        <GroupCheck key={g[0].starts_at} sessions={g} name={who} planOf={planOf} currency={currency} onChanged={onChanged} />
      ))}
      {singles.map((s) => {
        const kind = sessionKind(s);
        return (
          <View key={s.id} style={[styles.row, { borderLeftColor: themeBg(KIND_STYLE[kind].colour) }]}>
            <Text style={styles.rowTitle}>
              {who(s)} · {dayLabel(s.starts_at)}, {clockLabel(s.starts_at)}
            </Text>
            <Text style={[styles.rowKind, { color: themeText(KIND_STYLE[kind].colour) }]}>
              {s.client_disputed_at ? "They say it didn't happen. Check and fix it." : kind === "decide" ? "Cancelled: charge or credit?" : "Not marked yet"}
            </Text>
            <View style={styles.actions}>
              {kind === "unconfirmed" ? (
                <Pressable style={styles.smallButton} onPress={() => done(s)} disabled={busy === s.id}>
                  {busy === s.id ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.smallButtonText}>✓ Came</Text>}
                </Pressable>
              ) : null}
              <Pressable style={styles.outline} onPress={() => onOpen(s)}>
                <Text style={styles.outlineText}>{kind === "unconfirmed" ? "Cancelled / No-show" : "Open"}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {catchUps.length ? <Text style={styles.sectionTitle}>🔁 Catch-ups to book</Text> : null}
      {catchUps.map((s) => (
        <View key={s.id} style={[styles.row, { borderLeftColor: themeBg(KIND_STYLE.makeup.colour) }]}>
          <Text style={styles.rowTitle}>{who(s)}</Text>
          <Text style={styles.rowBody}>
            For {dayLabel(s.starts_at)}, {clockLabel(s.starts_at)} ({s.cancelled_by === "trainer" ? "you were away: the catch-up is charged" : "cancelled in time"})
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.smallButton} onPress={() => onCatchUp(s)}>
              <Text style={styles.smallButtonText}>Find a gap</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {unsigned.length ? <Text style={styles.sectionTitle}>Not signed yet</Text> : null}
      {unsigned.map((p) => (
        <Text key={p.client_id} style={styles.helper}>
          ✍️ {who({ client_id: p.client_id })} hasn't signed the agreement for their current terms. They see it under Menu › My sessions.
        </Text>
      ))}

    </>
  );
}

// A group session: tick who came. The rest are forfeited (charged) or
// credited, the trainer's choice (GRIZZ, 2026-10-31).
function GroupCheck({
  sessions,
  name: who,
  planOf,
  currency,
  onChanged,
}: {
  sessions: LiveSession[];
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  planOf: Record<string, SessionPlan>;
  currency: BillingCurrency;
  onChanged: () => void;
}) {
  const [came, setCame] = useState<Set<string>>(new Set(sessions.map((s) => s.id)));
  const [missed, setMissed] = useState<"charge" | "credit">("charge");
  const [saving, setSaving] = useState(false);
  const absent = sessions.filter((s) => !came.has(s.id));
  // The special rate: one person training alone pays their solo fee.
  const fees = groupFees(
    sessions.map((s) => ({
      id: s.id,
      came: came.has(s.id),
      fee: Number(planOf[s.client_id ?? ""]?.fee ?? s.fee),
      soloFee: planOf[s.client_id ?? ""]?.solo_fee != null ? Number(planOf[s.client_id ?? ""].solo_fee) : null,
    })),
    missed
  );
  const special = sessions.find((s) => came.has(s.id) && fees[s.id] !== Number(planOf[s.client_id ?? ""]?.fee ?? s.fee));
  const save = async () => {
    setSaving(true);
    let failed = 0;
    for (const s of sessions) {
      if (Number(s.fee) !== fees[s.id]) {
        const { error } = await supabase.rpc("set_session_fee", { p_id: s.id, p_fee: fees[s.id] });
        if (error) failed++;
      }
      if (came.has(s.id)) {
        const { error } = await supabase.rpc("set_session_outcome", { p_id: s.id, p_outcome: "done" });
        if (error) failed++;
      } else {
        const { error } = await supabase.rpc("set_session_outcome", { p_id: s.id, p_outcome: "no_show" });
        if (error) failed++;
        else if (missed === "credit") {
          const r = await supabase.rpc("set_session_charge", { p_id: s.id, p_charge: "credit" });
          if (r.error) failed++;
        }
      }
    }
    setSaving(false);
    if (failed) Alert.alert("Some didn't save", "Pull down to refresh and try again.");
    onChanged();
  };
  return (
    <View style={[styles.row, { borderLeftColor: themeBg(KIND_STYLE.unconfirmed.colour) }]}>
      <Text style={styles.rowTitle}>
        👥 Group · {dayLabel(sessions[0].starts_at)}, {clockLabel(sessions[0].starts_at)}
      </Text>
      <Text style={styles.rowBody}>Tick who came:</Text>
      {sessions.map((s) => {
        const on = came.has(s.id);
        return (
          <Pressable
            key={s.id}
            style={styles.tickRow}
            onPress={() => {
              const next = new Set(came);
              if (on) next.delete(s.id);
              else next.add(s.id);
              setCame(next);
            }}
          >
            <View style={[styles.tick, on && styles.tickOn]}>{on ? <Text style={styles.tickMark}>✓</Text> : null}</View>
            <Text style={styles.tickText}>{who(s)}</Text>
          </Pressable>
        );
      })}
      {absent.length ? (
        <>
          <Text style={styles.rowBody}>{absent.length === 1 ? "The one who didn't come:" : "The ones who didn't come:"}</Text>
          <View style={styles.chips}>
            <Pressable style={[styles.chip, missed === "charge" && styles.chipOn]} onPress={() => setMissed("charge")}>
              <Text style={[styles.chipText, missed === "charge" && styles.chipTextOn]}>🔴 Forfeit (charged)</Text>
            </Pressable>
            <Pressable style={[styles.chip, missed === "credit" && styles.chipOn]} onPress={() => setMissed("credit")}>
              <Text style={[styles.chipText, missed === "credit" && styles.chipTextOn]}>🟢 Credit</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {special ? (
        <Text style={styles.rowBody}>
          Special rate: {who(special)} trained alone, so pays {money(fees[special.id], currency)}.
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable style={styles.smallButton} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.smallButtonText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function CalendarTab({
  month,
  onMonth,
  sessions,
  clients,
  plans,
  settings,
  name: who,
  makeup,
  onMakeupDone,
  onOpen,
  onChanged,
}: {
  month: string;
  onMonth: (m: string) => void;
  sessions: LiveSession[];
  clients: ClientInfo[];
  plans: SessionPlan[];
  settings: SessionSettings | null;
  makeup: LiveSession | null;
  onMakeupDone: () => void;
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  onOpen: (s: LiveSession) => void;
  onChanged: () => void;
}) {
  const [day, setDay] = useState<string>(dayKey(new Date()));
  const [adding, setAdding] = useState(false);
  const [addAt, setAddAt] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const list = sessions.filter((s) => s.status !== "removed" && dayKey(s.starts_at) === day);
  const taken = list.filter((s) => s.status === "booked" || s.status === "done").map((s) => ({ time: clockLabel(s.starts_at), minutes: s.minutes }));
  // Open slots show as "???" between bookings (GRIZZ 2026-11-01), today and later only.
  const today = dayKey(new Date());
  const nowClock = clockLabel(new Date().toISOString());
  const open =
    day < today ? [] : openSlots(settings?.day_start ?? "05:00", settings?.day_end ?? "20:00", settings?.minutes ?? 60, taken).filter((t) => day > today || t > nowClock);
  // People at the same time are one group session (GRIZZ, 2026-11-01).
  const lines: { time: string; g: LiveSession[] | null }[] = [
    ...slotGroups(list).map((g) => ({ time: clockLabel(g[0].starts_at), g })),
    ...(list.length ? open.map((t) => ({ time: t, g: null })) : []),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const book = (t: string | null) => {
    setAddAt(t);
    setAdding(true);
  };
  return (
    <>
      {makeup ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            🔁 Booking a catch-up for {who(makeup)} (for {dayLabel(makeup.starts_at)}). Tap a day, then ＋ Book. It's free on their invoice.
          </Text>
          <Pressable onPress={onMakeupDone}>
            <Text style={styles.link}>Stop</Text>
          </Pressable>
        </View>
      ) : null}
      <SessionMonthCalendar month={month} onMonth={onMonth} sessions={sessions} selected={day} onSelect={setDay} />
      <Text style={styles.sectionTitle}>{dayLabel(day)}</Text>
      {lines.map((l) =>
        l.g ? (
          l.g.length > 1 ? (
            <GroupLine key={l.g[0].id} sessions={l.g} name={who} onOpen={onOpen} />
          ) : (
            <SessionLine key={l.g[0].id} s={l.g[0]} name={who(l.g[0])} onOpen={onOpen} />
          )
        ) : (
          <Pressable key={`open-${l.time}`} style={[styles.row, styles.openRow]} onPress={() => book(l.time)}>
            <Text style={styles.openText}>{l.time} · ??? · open</Text>
          </Pressable>
        ),
      )}
      {list.length === 0 ? (
        <Text style={styles.helper}>{open.length ? `Nothing booked. The whole day is open (${open[0]} to ${settings?.day_end?.slice(0, 5) ?? "20:00"}).` : "Nothing booked."}</Text>
      ) : null}
      {list.length && open.length ? <Text style={styles.meta}>??? is an open slot. Tap one to book it.</Text> : null}
      <Pressable style={styles.button} onPress={() => book(null)}>
        <Text style={styles.buttonText}>
          ＋ Book {makeup ? "the catch-up" : "a session"} on {dayLabel(day)}
        </Text>
      </Pressable>
      {makeup ? null : (
        <Pressable style={styles.outline} onPress={() => setImporting(true)}>
          <Text style={styles.outlineText}>📥 Bring in sessions from your calendar</Text>
        </Pressable>
      )}
      {/* Away or can't train: block it out, clients are told and not charged (GRIZZ, 2026-11-01). */}
      {makeup ? null : <TimeOffSection day={day} sessions={sessions} currency={settings?.currency ?? "ZAR"} name={who} onChanged={onChanged} />}
      <CalendarImportModal
        visible={importing}
        clients={clients}
        sessions={sessions}
        hasFee={settings?.fee != null}
        onClose={() => setImporting(false)}
        onBooked={() => {
          setImporting(false);
          onChanged();
        }}
      />
      <Text style={styles.meta}>
        🟡 trained · 🔴 late cancellation or no-show · 🟢 cancelled in time · 🔁 catch-up owed · 🔵 you cancelled · 🟠 needs you · ⚪ booked. A 🔁 after a name means every week.
      </Text>
      <AddSessionModal
        visible={adding}
        day={day}
        initialTime={addAt}
        clients={makeup ? clients.filter((c) => c.id === makeup.client_id) : clients.filter((c) => plans.some((p) => p.client_id === c.id && p.active))}
        makeupFor={makeup?.id ?? null}
        plans={plans}
        settings={settings}
        booked={list.filter((s) => s.status === "booked" || s.status === "done").map((s) => ({ time: clockLabel(s.starts_at), minutes: s.minutes }))}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          if (makeup) onMakeupDone();
          onChanged();
        }}
      />
    </>
  );
}

function AddSessionModal({
  visible,
  day,
  clients,
  plans,
  settings,
  booked,
  makeupFor,
  initialTime,
  onClose,
  onSaved,
}: {
  visible: boolean;
  day: string;
  initialTime?: string | null;
  clients: ClientInfo[];
  makeupFor: string | null;
  plans: SessionPlan[];
  settings: SessionSettings | null;
  booked: { time: string; minutes: number }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [client, setClient] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [weekly, setWeekly] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) {
      setClient(clients.length === 1 ? clients[0].id : null);
      setTime(initialTime ?? null);
      setWeekly(false);
    }
  }, [visible]);
  const save = async () => {
    if (!client || !time) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("add_live_session", { p_client: client, p_starts_at: atTime(day, time), p_makeup_for: makeupFor });
    // "Every week" (GRIZZ 2026-11-01): the same slot repeats from this day on.
    const repeat = !error && weekly && !makeupFor && data?.id ? await supabase.rpc("repeat_live_session", { p_id: data.id }) : null;
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't book it", error.message);
      return;
    }
    if (repeat?.error) Alert.alert("Booked for this day only", `Couldn't make it weekly: ${repeat.error.message}`);
    onSaved();
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }}>
          <Text style={styles.sectionTitle}>
            {makeupFor ? "Book the catch-up" : "Book a session"} · {dayLabel(day)}
          </Text>
          {clients.length === 0 ? (
            <Text style={styles.helper}>Set up a client's sessions on the Clients tab first (their fee and cancellation rule).</Text>
          ) : (
            <>
              <Text style={styles.label}>Who?</Text>
              <View style={styles.chips}>
                {clients.map((c) => (
                  <Pressable key={c.id} style={[styles.chip, client === c.id && styles.chipOn]} onPress={() => setClient(c.id)}>
                    <Text style={[styles.chipText, client === c.id && styles.chipTextOn]}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>What time?</Text>
              <SessionTimeChips
                dayStart={settings?.day_start ?? "05:00"}
                dayEnd={settings?.day_end ?? "20:00"}
                minutes={plans.find((p) => p.client_id === client)?.minutes ?? settings?.minutes ?? 60}
                booked={booked}
                selected={time ? [time] : []}
                onPick={setTime}
              />
              {makeupFor ? null : (
                <>
                  <Text style={styles.label}>How often?</Text>
                  <View style={styles.chips}>
                    <Pressable style={[styles.chip, !weekly && styles.chipOn]} onPress={() => setWeekly(false)}>
                      <Text style={[styles.chipText, !weekly && styles.chipTextOn]}>Just this day</Text>
                    </Pressable>
                    <Pressable style={[styles.chip, weekly && styles.chipOn]} onPress={() => setWeekly(true)}>
                      <Text style={[styles.chipText, weekly && styles.chipTextOn]}>🔁 Every week from then</Text>
                    </Pressable>
                  </View>
                </>
              )}
              <Pressable style={[styles.button, !(client && time) && { opacity: 0.5 }]} onPress={save} disabled={!client || !time || saving}>
                {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Book it</Text>}
              </Pressable>
            </>
          )}
          <Pressable style={styles.closeRow} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ClientsTab({
  clients,
  planOf,
  signed,
  settings,
  onChanged,
  oneOnOne,
  onOpenPage,
}: {
  clients: ClientInfo[];
  planOf: Record<string, SessionPlan>;
  signed: Record<string, SessionAgreement>;
  settings: SessionSettings | null;
  onChanged: () => void;
  // The 1 on 1 side's Clients tab: also lists 1 on 1 clients with no sessions set up yet.
  oneOnOne?: boolean;
  onOpenPage?: (clientId: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const withPlan = clients.filter((c) => planOf[c.id]);
  const notSetUp = oneOnOne ? clients.filter((c) => !planOf[c.id] && (c.one_on_one || c.live_only)) : [];
  const others = clients.filter((c) => !planOf[c.id] && !notSetUp.includes(c));
  if (picked) {
    const c = clients.find((x) => x.id === picked);
    const plan = planOf[picked] ?? null;
    return (
      <>
        <Pressable onPress={() => setPicked(null)} hitSlop={10}>
          <Text style={styles.back}>‹ All clients</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>{c?.name}</Text>
        {onOpenPage ? (
          <Pressable style={[styles.outline, { marginBottom: 12 }]} onPress={() => onOpenPage(picked)}>
            <Text style={styles.outlineText}>Open their page: food, progress, check-ins</Text>
          </Pressable>
        ) : null}
        <SessionPlanEditor
          clientId={picked}
          clientName={c?.name ?? "Client"}
          plan={plan}
          settings={settings}
          signed={plan && agreementCurrent(signed[picked], plan) ? signed[picked] : null}
          payers={withPlan.filter((x) => x.id !== picked && planOf[x.id].group_size > 1 && !planOf[x.id].paid_by).map((x) => ({ id: x.id, name: x.name }))}
          paysFor={withPlan.filter((x) => planOf[x.id].paid_by === picked).map((x) => x.name.split(" ")[0])}
          onSaved={onChanged}
        />
      </>
    );
  }
  const currency: BillingCurrency = settings?.currency ?? "ZAR";
  return (
    <>
      <Text style={styles.helper}>Each client's fee, sessions a week, cancellation rule and regular times. Tap one to change it.</Text>
      {withPlan.length === 0 && notSetUp.length === 0 ? <Text style={styles.helper}>No clients set up for live sessions yet.</Text> : null}
      {notSetUp.map((c) => (
        <Pressable key={c.id} style={[styles.row, { borderLeftColor: themeBg("#F59E0B") }]} onPress={() => setPicked(c.id)}>
          <Text style={styles.rowTitle}>{c.name}</Text>
          <Text style={[styles.meta, { color: themeText("#F59E0B") }]}>Sessions not set up yet. Tap to set their fee and times.</Text>
        </Pressable>
      ))}
      {withPlan.map((c) => {
        const p = planOf[c.id];
        const ok = agreementCurrent(signed[c.id], p);
        return (
          <Pressable key={c.id} style={styles.row} onPress={() => setPicked(c.id)}>
            <Text style={styles.rowTitle}>
              {c.name}
              {p.active ? "" : " · stopped"}
            </Text>
            <Text style={styles.rowBody}>
              {money(Number(p.fee), currency)} · {p.per_week} a week · {policyLabel(p.policy)} · {BILLINGS.find((b) => b.key === p.billing)?.label}
            </Text>
            <Text style={styles.meta}>{regularLabel(p.regular)}</Text>
            {p.paid_by ? <Text style={styles.meta}>💳 Paid by {clients.find((x) => x.id === p.paid_by)?.name ?? "someone else"}</Text> : null}
            <Text style={[styles.meta, { color: themeText(ok ? "#22C55E" : "#F59E0B") }]}>{ok ? "✍️ Signed" : "✍️ Not signed yet"}</Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.outline} onPress={() => setShowOthers(!showOthers)}>
        <Text style={styles.outlineText}>{showOthers ? "Hide" : "＋ Set up a client"}</Text>
      </Pressable>
      {showOthers
        ? others.map((c) => (
            <Pressable key={c.id} style={styles.row} onPress={() => setPicked(c.id)}>
              <Text style={styles.rowTitle}>{c.name}</Text>
            </Pressable>
          ))
        : null}
      {showOthers && others.length === 0 ? <Text style={styles.helper}>Every client is set up.</Text> : null}
    </>
  );
}

function InvoicesTab({
  plans,
  drafts,
  byId,
  onChanged,
}: {
  plans: SessionPlan[];
  drafts: SessionInvoice[];
  byId: Record<string, ClientInfo>;
  onChanged: () => void;
}) {
  const { trainer } = useAuth();
  const [month, setMonth] = useState(monthStart(new Date()));
  const [rows, setRows] = useState<SessionInvoice[]>([]);
  const [open, setOpen] = useState<SessionInvoice | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMonth = useCallback(async () => {
    if (!trainer) return;
    const { data } = await supabase.from("session_invoices").select("*").eq("trainer_id", trainer.id).eq("month", month);
    setRows(data ?? []);
  }, [trainer, month]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const refresh = () => {
    loadMonth();
    onChanged();
  };

  const makeAll = async () => {
    setBusy(true);
    let failed = 0;
    for (const p of plans) {
      const { error } = await supabase.rpc("build_session_invoice", { p_client: p.client_id, p_month: month });
      if (error) failed++;
    }
    setBusy(false);
    refresh();
    if (failed) Alert.alert("Some didn't work", `${failed} invoice${failed === 1 ? "" : "s"} couldn't be made. Pull down to try again.`);
  };

  const currency = rows[0]?.currency ?? "ZAR";
  const total = rows.reduce((t, r) => t + Number(r.total), 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((t, r) => t + Number(r.total), 0);
  const name = (id: string) => byId[id]?.name ?? "Client";
  const otherDrafts = drafts.filter((d) => d.month !== month);

  return (
    <>
      <Text style={styles.helper}>
        On the 1st the app makes every client's invoice by itself (in advance: that month; in arrears: last month) and lets you know. Check it and tap Send.
      </Text>
      {otherDrafts.length ? (
        <>
          <Text style={styles.sectionTitle}>Ready to send</Text>
          {otherDrafts.map((inv) => (
            <InvoiceRow key={inv.id} inv={inv} name={`${name(inv.client_id)} · ${monthLabel(inv.month)}`} onPress={() => setOpen(inv)} />
          ))}
        </>
      ) : null}

      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.sectionTitleInline}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
      {rows.length ? (
        <View style={styles.totals}>
          <Text style={styles.totalText}>Invoiced {sessionMoney(total, currency)}</Text>
          <Text style={[styles.totalText, { color: themeText("#22C55E") }]}>Paid {sessionMoney(paid, currency)}</Text>
          <Text style={[styles.totalText, { color: themeText("#F59E0B") }]}>Owed {sessionMoney(total - paid, currency)}</Text>
        </View>
      ) : null}
      {rows.map((inv) => (
        <InvoiceRow key={inv.id} inv={inv} name={name(inv.client_id)} onPress={() => setOpen(inv)} />
      ))}
      {plans.length ? (
        <Pressable style={styles.outline} onPress={makeAll} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={themeText(BRAND_GOLD)} />
          ) : (
            <Text style={styles.outlineText}>{rows.length ? `Update ${monthLabel(month)}'s drafts` : `Make ${monthLabel(month)}'s invoices now`}</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.helper}>Set up a client on the Clients tab first.</Text>
      )}

      <InvoiceModal
        invoice={open}
        clientName={open ? name(open.client_id) : ""}
        phone={open ? byId[open.client_id ?? ""]?.phone ?? null : null}
        email={open ? byId[open.client_id ?? ""]?.email ?? null : null}
        onClose={() => setOpen(null)}
        onChanged={(inv) => {
          setOpen(inv);
          refresh();
        }}
      />
    </>
  );
}

function InvoiceRow({ inv, name, onPress }: { inv: SessionInvoice; name: string; onPress: () => void }) {
  const colour = inv.status === "paid" ? "#22C55E" : inv.status === "sent" ? "#F59E0B" : "#94A3B8";
  const status = inv.status === "paid" ? "Paid" : inv.status === "sent" ? "Sent · not paid" : "Draft";
  const red = inv.lines.filter((l) => l.kind === "late" || l.kind === "no_show").length;
  const green = inv.lines.filter((l) => l.kind === "notice").length;
  return (
    <Pressable style={[styles.row, { borderLeftColor: themeBg(colour) }]} onPress={onPress}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowTitle}>{sessionMoney(Number(inv.total), inv.currency)}</Text>
      </View>
      <Text style={[styles.meta, { color: themeText(colour) }]}>
        {status}
        {red ? ` · 🔴 ${red}` : ""}
        {green ? ` · 🟢 ${green}` : ""}
        {inv.undecided || inv.unconfirmed ? " · ⚠ needs checking" : ""}
      </Text>
    </Pressable>
  );
}

function InvoiceModal({
  invoice,
  clientName,
  phone,
  email,
  onClose,
  onChanged,
}: {
  invoice: SessionInvoice | null;
  clientName: string;
  phone: string | null;
  email: string | null;
  onClose: () => void;
  onChanged: (inv: SessionInvoice) => void;
}) {
  const { trainer } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  if (!invoice) return null;
  const coach = trainer?.business_name?.trim() || trainer?.name || "Your coach";

  const act = async (key: string, fn: () => PromiseLike<{ data: SessionInvoice | null; error: { message: string } | null }>, done?: string) => {
    setBusy(key);
    const { data, error } = await fn();
    setBusy(null);
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      return;
    }
    onChanged(data);
    if (done) Alert.alert("Done ✅", done);
  };

  const rebuild = () => act("rebuild", () => supabase.rpc("build_session_invoice", { p_client: invoice.client_id, p_month: invoice.month }));
  const send = () =>
    Alert.alert(`Send to ${clientName}?`, "They get a notification and see it in the app under My sessions. After sending it can't change; later changes go on next month's.", [
      { text: "Back", style: "cancel" },
      {
        text: "Send",
        onPress: () => act("send", () => supabase.rpc("send_session_invoice", { p_id: invoice.id }), `${clientName.split(" ")[0]} has it.`),
      },
    ]);
  const paid = (p: boolean) => act("paid", () => supabase.rpc("set_session_invoice_paid", { p_id: invoice.id, p_paid: p }));
  const payTo = eftRows(trainer?.eft_details);
  const whatsapp = () => {
    const text = invoiceText(invoice, clientName, coach, { style: "whatsapp", payTo });
    const digits = whatsappDigits(phone);
    if (digits) Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`);
    else Share.share({ message: text });
  };
  const sendEmail = () => {
    const text = invoiceText(invoice, clientName, coach, { style: "email", payTo });
    const subject = `Invoice for ${monthLabel(invoice.month)} sessions · ${coach}`;
    Linking.openURL(`mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`).catch(() =>
      Share.share({ message: text })
    );
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }}>
          <Text style={styles.rowTitle}>{clientName}</Text>
          <SessionInvoiceView invoice={invoice} who="trainer" />
          <View style={{ gap: 8, marginTop: 14 }}>
            {invoice.status === "draft" ? (
              <>
                <Pressable style={styles.button} onPress={send} disabled={!!busy}>
                  {busy === "send" ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Send to {clientName.split(" ")[0]}</Text>}
                </Pressable>
                <Pressable style={styles.outline} onPress={rebuild} disabled={!!busy}>
                  {busy === "rebuild" ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.outlineText}>Update with my latest changes</Text>}
                </Pressable>
              </>
            ) : null}
            <View style={styles.actions}>
              <Pressable style={[styles.outline, { flex: 1, marginTop: 0 }]} onPress={whatsapp}>
                <Text style={styles.outlineText}>💬 WhatsApp</Text>
              </Pressable>
              <Pressable style={[styles.outline, { flex: 1, marginTop: 0 }]} onPress={sendEmail}>
                <Text style={styles.outlineText}>✉️ Email</Text>
              </Pressable>
            </View>
            <Text style={styles.meta}>Sends a neat copy of this invoice, with your bank details, to {clientName.split(" ")[0]}.</Text>
            {invoice.status === "paid" ? (
              <Pressable style={styles.outline} onPress={() => paid(false)} disabled={!!busy}>
                <Text style={styles.outlineText}>Mark as not paid</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.outline} onPress={() => paid(true)} disabled={!!busy}>
                <Text style={styles.outlineText}>✅ Mark as paid</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={styles.closeRow} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SetupTab({ settings, onSaved }: { settings: SessionSettings | null; onSaved: (s: SessionSettings) => void }) {
  const { trainer } = useAuth();
  const [fee, setFee] = useState(settings?.fee != null ? String(settings.fee) : "");
  const [currency, setCurrency] = useState<BillingCurrency>(settings?.currency ?? trainer?.client_prices?.currency ?? "ZAR");
  const [billing, setBilling] = useState<SessionSettings["billing"]>(settings?.billing ?? "arrears");
  const [policy, setPolicy] = useState<SessionSettings["policy"]>(settings?.policy ?? "24h");
  const [minutes, setMinutes] = useState(settings?.minutes ?? 60);
  const [customMinutes, setCustomMinutes] = useState("");
  const [dayStart, setDayStart] = useState(cleanTime(settings?.day_start) ?? "05:00");
  const [dayEnd, setDayEnd] = useState(cleanTime(settings?.day_end) ?? "20:00");
  const [agreement, setAgreement] = useState(settings?.agreement_text ?? AGREEMENT_TEMPLATE);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const coach = trainer?.business_name?.trim() || trainer?.name || "Your coach";

  const save = async () => {
    if (!trainer) return;
    const amount = fee.trim() ? Number(fee.replace(",", ".").replace(/[^\d.]/g, "")) : null;
    if (amount !== null && Number.isNaN(amount)) {
      Alert.alert("Check the fee", "Type a number, like 350.");
      return;
    }
    const start = cleanTime(dayStart);
    const end = cleanTime(dayEnd);
    if (!start || !end || end <= start) {
      Alert.alert("Check your day", "Type the first session time and the end of your day, like 05:10 and 20:00.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("session_settings")
      .upsert({
        trainer_id: trainer.id,
        fee: amount,
        currency,
        billing,
        policy,
        minutes,
        day_start: start,
        day_end: end,
        // The standard text is kept as null, so later wording fixes in the app reach it.
        agreement_text: agreement.trim() && agreement.trim() !== AGREEMENT_TEMPLATE.trim() ? agreement.trim() : null,
        time_zone: phoneTimeZone(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      return;
    }
    onSaved(data);
    Alert.alert("Saved ✅", "New clients start with these. You can change any client's own deal on the Clients tab.");
  };

  return (
    <>
      <Text style={styles.helper}>Your normal deal. Each client starts with it, and you can change it for anyone on the Clients tab.</Text>
      <Text style={styles.label}>Normal fee per session</Text>
      <View style={styles.chips}>
        {(["ZAR", "USD"] as BillingCurrency[]).map((c) => (
          <Pressable key={c} style={[styles.chip, currency === c && styles.chipOn]} onPress={() => setCurrency(c)}>
            <Text style={[styles.chipText, currency === c && styles.chipTextOn]}>{c === "ZAR" ? "Rand (R)" : "Dollar ($)"}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="350" placeholderTextColor="#64748B" />

      <Text style={styles.label}>Billing</Text>
      <View style={styles.chips}>
        {BILLINGS.map((b) => (
          <Pressable key={b.key} style={[styles.chip, billing === b.key && styles.chipOn]} onPress={() => setBilling(b.key)}>
            <Text style={[styles.chipText, billing === b.key && styles.chipTextOn]}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.meta}>{BILLINGS.find((b) => b.key === billing)?.detail}</Text>

      <Text style={styles.label}>Cancellation rule</Text>
      <View style={styles.chips}>
        {POLICIES.map((p) => (
          <Pressable key={p.key} style={[styles.chip, policy === p.key && styles.chipOn]} onPress={() => setPolicy(p.key)}>
            <Text style={[styles.chipText, policy === p.key && styles.chipTextOn]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>How long is a session?</Text>
      <View style={styles.chips}>
        {[...new Set([...SESSION_LENGTHS, minutes])].sort((a, b) => a - b).map((m) => (
          <Pressable key={m} style={[styles.chip, minutes === m && styles.chipOn]} onPress={() => setMinutes(m)}>
            <Text style={[styles.chipText, minutes === m && styles.chipTextOn]}>{m} min</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={customMinutes}
        onChangeText={(v) => {
          setCustomMinutes(v);
          const n = Number(v);
          if (n >= 15 && n <= 180) setMinutes(Math.round(n));
        }}
        keyboardType="number-pad"
        placeholder="Other length in minutes, e.g. 55"
        placeholderTextColor="#64748B"
        maxLength={3}
      />

      <Text style={styles.label}>Your day</Text>
      <View style={styles.dayRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meta}>First session at</Text>
          <TextInput style={styles.input} value={dayStart} onChangeText={setDayStart} placeholder="05:10" placeholderTextColor="#64748B" maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.meta}>Last one ends by</Text>
          <TextInput style={styles.input} value={dayEnd} onChangeText={setDayEnd} placeholder="20:00" placeholderTextColor="#64748B" maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <Text style={styles.meta}>
        Booking times follow on from each other: with {minutes}-minute sessions from {cleanTime(dayStart) ?? "05:00"} you get{" "}
        {[0, 1, 2].map((i) => {
          const start = cleanTime(dayStart) ?? "05:00";
          const t = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + i * minutes;
          return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
        }).join(", ")}
        ... A session booked at another time starts a new run straight after it.
      </Text>

      <Text style={styles.label}>Your session agreement</Text>
      <Text style={styles.meta}>Change any of the wording. Each client signs it with a tick, their name and the date.</Text>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          ⚠️ Invoices follow your settings, not the wording. If you change how you bill or your cancellation rule here, change Billing and Cancellation rule above (and on each client) to match, or invoices will be wrong.
        </Text>
      </View>
      <TextInput
        style={[styles.input, { minHeight: 220, textAlignVertical: "top", fontSize: 14 }]}
        value={agreement}
        onChangeText={setAgreement}
        multiline
        maxLength={10000}
      />
      <Text style={styles.meta}>
        Words in {"{ }"} are filled in for each client: {AGREEMENT_WORDS.map((w) => `${w.word} ${w.means}`).join("; ")}.
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => setPreview(!preview)}>
          <Text style={styles.link}>{preview ? "Hide the example" : "See an example"}</Text>
        </Pressable>
        {agreement.trim() !== AGREEMENT_TEMPLATE.trim() ? (
          <Pressable onPress={() => setAgreement(AGREEMENT_TEMPLATE)}>
            <Text style={styles.link}>Back to the standard text</Text>
          </Pressable>
        ) : null}
      </View>
      {preview ? (
        <Text style={styles.agreement}>
          {fillAgreement(agreement, {
            coach,
            client: "Sarah Jacobs",
            fee: fee ? money(Number(fee) || 0, currency) : "R750",
            policy,
            billing,
            minutes,
            regular: [
              { weekday: 1, time: "05:50" },
              { weekday: 3, time: "05:50" },
              { weekday: 5, time: "05:50" },
            ],
            contact: trainer?.phone,
          })}
        </Text>
      ) : null}

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>
    </>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 4 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  sectionTitleInline: { color: "#fff", fontSize: 18, fontWeight: "700" },
  back: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginTop: 10 },
  agreement: { color: "#CBD5E1", fontSize: 13, lineHeight: 19, backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  time: { backgroundColor: "#1E293B", borderRadius: 8, width: 64, alignItems: "center", paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#0F172A" },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, fontSize: 15, marginTop: 6, borderWidth: 1, borderColor: "#334155" },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#334155" },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  openRow: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: "#475569", borderLeftWidth: 1, paddingVertical: 8 },
  openText: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  rowBody: { color: "#CBD5E1", fontSize: 14, marginTop: 4 },
  rowKind: { fontSize: 13, fontWeight: "600", marginTop: 3 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 6, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 8 },
  smallButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, minWidth: 90, alignItems: "center" },
  smallButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  notice: { backgroundColor: "#3B2F0B", borderRadius: 10, padding: 12, marginBottom: 8 },
  noticeText: { color: "#FDE68A", fontSize: 14, lineHeight: 20 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 8 },
  arrow: { color: BRAND_GOLD, fontSize: 28, fontWeight: "700", paddingHorizontal: 12 },
  dayRow: { flexDirection: "row", gap: 12 },
  groupPerson: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#334155", marginTop: 6 },
  tickRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  tick: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  tickOn: { backgroundColor: BRAND_GOLD },
  tickMark: { color: "#0F172A", fontWeight: "900" },
  tickText: { color: "#fff", fontSize: 15 },
  totals: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  totalText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  closeRow: { padding: 12, alignItems: "center", marginTop: 8 },
  closeText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
