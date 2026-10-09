import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso, toIsoDate } from "@/lib/dates";
import { cycleToday, type CycleToday } from "@/lib/cycle";
import { scheduleCycleReminders } from "@/lib/notifications";
import { getCycleReminderEnabled, setCycleReminderEnabled } from "@/lib/cycleReminderSetting";
import { useAuth } from "@/context/AuthContext";
import type { ClientStackParamList } from "@/navigation/types";
import type { CycleLog } from "@/types/database";

// Women's Health Reset cycle tracking (0038). She logs the first day of each
// period; the app works out her phase and guides her through it, with an 8am
// reminder in the installed app.

function useCycleLogs() {
  const { client } = useAuth();
  const [logs, setLogs] = useState<CycleLog[] | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    const { data } = await supabase
      .from("cycle_logs")
      .select("*")
      .eq("client_id", client.id)
      .order("period_start", { ascending: false })
      .limit(24);
    const rows = data ?? [];
    setLogs(rows);
    getCycleReminderEnabled().then((enabled) => scheduleCycleReminders(rows.map((r) => r.period_start), enabled));
  }, [client?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { logs, reload: load, clientId: client?.id };
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
  const { logs, reload, clientId } = useCycleLogs();
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
    scheduleCycleReminders(starts, next);
  };

  return (
    <View>
      {today ? (
        <TodayCard today={today} full />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Start tracking your cycle</Text>
          <Text style={styles.body}>
            Log the first day of your last period and the app will show you which phase you're in, what to expect, and how to
            train, eat and supplement for it.
          </Text>
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

      <View style={[styles.card, styles.toggleRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Daily phase reminder</Text>
          <Text style={styles.small}>An 8am note on what to focus on for your phase (in the installed app).</Text>
        </View>
        <Switch
          value={remindersOn ?? true}
          disabled={remindersOn === null}
          onValueChange={toggleReminders}
          trackColor={{ true: BRAND_GOLD, false: "#334155" }}
          accessibilityLabel="Daily phase reminder"
        />
      </View>
    </View>
  );
}

/** A small card on the Check-in screen once she's logged a period; tap for the full guide. */
export function CycleTodayBanner() {
  const { logs } = useCycleLogs();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const today = logs ? cycleToday(logs.map((l) => l.period_start), todayIso()) : null;
  if (!today) return null;
  return (
    <Pressable onPress={() => navigation.navigate("Section", { sectionKey: "womensHealthReset" })}>
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
