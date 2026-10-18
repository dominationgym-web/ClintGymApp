import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso, toIsoDate } from "@/lib/dates";
import { cycleLooksIrregular, cycleToday, MENOPAUSE_HEADING, SUPPLEMENT_PREP_LIST, supplementPrepDaysLeft, type CycleToday } from "@/lib/cycle";
import { CYCLE_NUDGE_BODY, CYCLE_NUDGE_TITLE, scheduleCycleReminders, scheduleCycleTrackerNudge } from "@/lib/notifications";
import { getCycleIrregular, getCycleReminderEnabled, setCycleIrregular, setCycleReminderEnabled } from "@/lib/cycleReminderSetting";
import { useAuth } from "@/context/AuthContext";
import type { ClientStackParamList } from "@/navigation/types";
import type { CycleLog } from "@/types/database";

// Women's Health Reset cycle tracking (0038). She logs the first day of each
// period; the app works out her phase and guides her through it, with an 8am
// reminder in the installed app. Women whose periods are irregular or have
// stopped (perimenopause, menopause) can turn the phase guide off.

function useCycleLogs() {
  const { client } = useAuth();
  const [logs, setLogs] = useState<CycleLog[] | null>(null);
  const [irregular, setIrregular] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    const { data, error } = await supabase
      .from("cycle_logs")
      .select("*")
      .eq("client_id", client.id)
      .order("period_start", { ascending: false })
      .limit(24);
    // No signal: keep what's shown and leave her reminders alone, rather than treat it as "no periods".
    if (error) {
      setLogs((prev) => prev ?? []);
      return;
    }
    const rows = data ?? [];
    setLogs(rows);
    Promise.all([getCycleReminderEnabled(), getCycleIrregular()]).then(([enabled, irr]) => {
      setIrregular(irr);
      // No phase reminders when her periods are irregular or have stopped: the phases won't fit.
      scheduleCycleReminders(rows.map((r) => r.period_start), enabled && !irr);
      // Women who haven't logged a period yet get a Saturday nudge; logging one (or saying they've stopped) ends it.
      scheduleCycleTrackerNudge(client.sex === "female" && rows.length === 0 && !irr);
    });
  }, [client?.id, client?.sex]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { logs, reload: load, clientId: client?.id, sex: client?.sex ?? null, irregular, setIrregular };
}

const daysAgoIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIsoDate(d);
};

const prettyDate = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

function TodayCard({ today, full }: { today: CycleToday; full: boolean }) {
  const p = today.phase;
  // The week before her period: make sure she has her supplements.
  const prepLeft = supplementPrepDaysLeft(today, todayIso());
  return (
    <View style={styles.todayCard}>
      <Text style={styles.kicker}>
        DAY {today.cycleDay} OF ABOUT {today.cycleLength}
      </Text>
      <Text style={styles.phaseName}>
        {p.emoji} {p.name}
      </Text>
      <Text style={styles.body}>{p.tagline}</Text>
      {today.periodDue && (
        <Text style={styles.due}>Your period is due. Log it below when it starts and the app will catch up.</Text>
      )}
      {prepLeft !== null && (
        <View style={styles.prepBox}>
          <Text style={styles.blockTitle}>
            🛒 Period due in about {prepLeft} day{prepLeft === 1 ? "" : "s"}: check your supplements
          </Text>
          {SUPPLEMENT_PREP_LIST.map((l) => (
            <Text key={l} style={styles.line}>
              • {l}
            </Text>
          ))}
        </View>
      )}
      {full ? (
        <>
          <Block title="How you might feel" lines={p.feel} />
          <Block title="Training" lines={p.training} />
          <Block title="Food" lines={p.nutrition} />
          <Block title="Supplements" lines={p.supplements} />
          {!today.periodDue && <Text style={styles.small}>Next period expected around {prettyDate(today.nextPeriodOn)}.</Text>}
        </>
      ) : (
        <Text style={styles.reminder}>{p.reminder}</Text>
      )}
    </View>
  );
}

function Block({ title, lines }: { title: string; lines: string[] }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.blockTitle}>{title}</Text>
      {lines.map((l) => (
        <Text key={l} style={styles.line}>
          • {l}
        </Text>
      ))}
    </View>
  );
}

/** The whole tracker, at the top of the Women's Health Reset page. */
export default function CycleTracker() {
  const { logs, reload, clientId, sex, irregular, setIrregular } = useCycleLogs();
  const [busy, setBusy] = useState(false);
  const [pickingEarlier, setPickingEarlier] = useState(false);
  const [daysAgo, setDaysAgo] = useState(2);
  const [remindersOn, setRemindersOn] = useState<boolean | null>(null);

  useEffect(() => {
    getCycleReminderEnabled().then(setRemindersOn);
  }, []);

  if (!logs) return <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 16 }} />;

  const starts = logs.map((l) => l.period_start);
  const today = cycleToday(starts, todayIso());

  const logStart = async (iso: string) => {
    if (!clientId) return;
    setBusy(true);
    const { error } = await supabase.from("cycle_logs").upsert(
      { client_id: clientId, period_start: iso },
      { onConflict: "client_id,period_start", ignoreDuplicates: true }
    );
    setBusy(false);
    setPickingEarlier(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    reload();
  };

  const remove = (log: CycleLog) =>
    Alert.alert("Remove this date?", prettyDate(log.period_start), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("cycle_logs").delete().eq("id", log.id);
          if (error) Alert.alert("Couldn't remove", error.message);
          reload();
        },
      },
    ]);

  const toggleReminders = (next: boolean) => {
    setRemindersOn(next);
    setCycleReminderEnabled(next);
    scheduleCycleReminders(starts, next && !irregular);
  };

  const toggleIrregular = (next: boolean) => {
    setIrregular(next);
    setCycleIrregular(next);
    scheduleCycleReminders(starts, (remindersOn ?? true) && !next);
    scheduleCycleTrackerNudge(sex === "female" && starts.length === 0 && !next);
  };

  return (
    <View>
      {irregular ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌡️ Periods irregular or stopped</Text>
          <Text style={styles.body}>
            The phase guide is off, because the phases won't fit when your periods are irregular or have stopped. Go by how you
            feel each day. You can still log any period below, which is handy to show your doctor.
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>Open {MENOPAUSE_HEADING} further down this page for how to train and eat now.</Text>
        </View>
      ) : today ? (
        <TodayCard today={today} full />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Start tracking your cycle</Text>
          <Text style={styles.body}>
            Log the first day of your last period and the app will show you which phase you're in, what to expect, and how to
            train, eat and supplement for it.
          </Text>
          <Text style={styles.small}>Periods irregular or stopped? Use the switch further down.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log your period</Text>
        <Text style={styles.small}>Log the first day of bleeding each month.</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.button} onPress={() => logStart(todayIso())} disabled={busy}>
            <Text style={styles.buttonText}>Started today</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => logStart(daysAgoIso(1))} disabled={busy}>
            <Text style={styles.buttonText}>Yesterday</Text>
          </Pressable>
          <Pressable style={styles.outline} onPress={() => setPickingEarlier((p) => !p)} disabled={busy}>
            <Text style={styles.outlineText}>Earlier</Text>
          </Pressable>
        </View>
        {pickingEarlier && (
          <View style={styles.earlier}>
            <View style={styles.stepperRow}>
              <Pressable style={styles.stepper} onPress={() => setDaysAgo((d) => Math.min(60, d + 1))}>
                <Text style={styles.stepperText}>-</Text>
              </Pressable>
              <Text style={styles.earlierDate}>{prettyDate(daysAgoIso(daysAgo))}</Text>
              <Pressable style={styles.stepper} onPress={() => setDaysAgo((d) => Math.max(2, d - 1))}>
                <Text style={styles.stepperText}>+</Text>
              </Pressable>
            </View>
            <Pressable style={[styles.button, { marginTop: 10 }]} onPress={() => logStart(daysAgoIso(daysAgo))} disabled={busy}>
              <Text style={styles.buttonText}>Save this date</Text>
            </Pressable>
          </View>
        )}
        {logs.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.blockTitle}>Your periods</Text>
            {logs.slice(0, 6).map((l) => (
              <View key={l.id} style={styles.historyRow}>
                <Text style={styles.line}>{prettyDate(l.period_start)}</Text>
                <Pressable onPress={() => remove(l)} hitSlop={8}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.small, { marginTop: 10 }]}>Only you can see this. Your coach can't.</Text>
      </View>

      {!irregular && cycleLooksIrregular(starts, todayIso()) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your cycles look irregular</Text>
          <Text style={styles.small}>
            If you're over 40, this can be perimenopause. If the phase guide doesn't fit, turn on the switch below and track how you
            feel instead. Irregular cycles at any age are worth mentioning to your doctor.
          </Text>
        </View>
      )}

      <View style={[styles.card, styles.toggleRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>My periods are irregular or have stopped</Text>
          <Text style={styles.small}>For perimenopause, menopause or cycles that vary a lot. Turns off the phase guide and phase reminders.</Text>
        </View>
        <Switch
          value={irregular}
          onValueChange={toggleIrregular}
          trackColor={{ true: BRAND_GOLD, false: "#334155" }}
          accessibilityLabel="My periods are irregular or have stopped"
        />
      </View>

      {!irregular && (
        <View style={[styles.card, styles.toggleRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Daily phase reminder</Text>
            <Text style={styles.small}>An 8am note on what to focus on for your phase, and a supplement check a week before your period (in the installed app).</Text>
          </View>
          <Switch
            value={remindersOn ?? true}
            disabled={remindersOn === null}
            onValueChange={toggleReminders}
            trackColor={{ true: BRAND_GOLD, false: "#334155" }}
            accessibilityLabel="Daily phase reminder"
          />
        </View>
      )}
    </View>
  );
}

/** A small card on the Check-in screen once she's logged a period; tap for the full guide. */
export function CycleTodayBanner() {
  const { logs, sex, irregular } = useCycleLogs();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const today = logs ? cycleToday(logs.map((l) => l.period_start), todayIso()) : null;
  const openTracker = () => navigation.navigate("Section", { sectionKey: "womensHealthReset", open: "Cycle tracker" });
  // Saturdays, until she logs her first period: the same nudge as the phone
  // reminder, so it also shows in Expo Go.
  // Periods irregular or stopped: no phase card and no nudge.
  if (irregular) return null;
  if (!today && logs && logs.length === 0 && sex === "female" && parseIsoDate(todayIso()).getDay() === 6) {
    return (
      <Pressable style={styles.todayCard} onPress={openTracker}>
        <Text style={styles.phaseName}>{CYCLE_NUDGE_TITLE}</Text>
        <Text style={styles.body}>{CYCLE_NUDGE_BODY.replace(" Menu ☰ → Cycle tracker.", "")}</Text>
        <Text style={styles.reminder}>Tap to open it ›</Text>
      </Pressable>
    );
  }
  if (!today) return null;
  return (
    <Pressable onPress={openTracker}>
      <TodayCard today={today} full={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  todayCard: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 12, padding: 14, marginBottom: 12 },
  kicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  phaseName: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2, marginBottom: 4 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  due: { color: "#FBBF24", fontSize: 13, marginTop: 8 },
  reminder: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  prepBox: { backgroundColor: "#0F172A", borderRadius: 8, padding: 10, marginTop: 10 },
  blockTitle: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  line: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginBottom: 3 },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  button: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  outline: { flex: 1, borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  earlier: { marginTop: 12 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  stepperText: { color: BRAND_GOLD, fontSize: 20, fontWeight: "700" },
  earlierDate: { color: "#fff", fontSize: 16, fontWeight: "700" },
  historyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  removeText: { color: "#F87171", fontSize: 13, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
