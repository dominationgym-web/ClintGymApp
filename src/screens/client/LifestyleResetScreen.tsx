import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
  Alert,
  Switch,
  TextInput,
  Keyboard,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { LifestyleResetDailyLog } from "@/types/database";
import LifestyleResetContent from "@/screens/client/LifestyleResetContent";
import { RESET_GUIDES, type ResetHabitKey } from "@/lib/resetGuides";
import {
  FEELINGS,
  HELPED_OPTIONS,
  RESET_HABITS,
  RESET_LOCATIONS,
  RESET_PHASES,
  RESET_REMINDER_TIMES,
  RESET_WEEKS_TOTAL,
  formatReminderTime,
  newHabits,
  resetWeek,
  resetWeekDates,
  resetWeekNumber,
  type ResetHelped,
  type ResetLocation,
} from "@/lib/resetProgram";
import { getResetReminder, setResetReminder, type ResetReminderSetting } from "@/lib/resetReminderSetting";
import { scheduleResetReminders } from "@/lib/notifications";
import { BRAND_GOLD } from "@/lib/brand";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import WeekBrowser from "@/components/reset/WeekBrowser";
import ResetTraining from "@/components/reset/ResetTraining";

type HabitKey = ResetHabitKey;
type TabKey = "plan" | "training" | "guide";

// Reset Training sits right at the top, next to her plan, so it's one tap away.
const TABS: ScreenTab<TabKey>[] = [
  { key: "plan", label: "My Reset", icon: "leaf" },
  { key: "training", label: "Reset Training", icon: "barbell" },
  { key: "guide", label: "Full guide", icon: "book" },
];

// The Women's Health Reset tab. Her trainer switches it on; she browses the
// 12 weeks, taps Start, then ticks off each day's habits, notes how she felt,
// and can pick a daily reminder.
export default function LifestyleResetScreen() {
  const { client, refreshProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [tab, setTab] = useState<TabKey>("plan");
  const [todayLog, setTodayLog] = useState<Partial<LifestyleResetDailyLog>>({});
  const [weekLogs, setWeekLogs] = useState<LifestyleResetDailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guideKey, setGuideKey] = useState<HabitKey | null>(null);
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [reminder, setReminder] = useState<ResetReminderSetting | null>(null);
  // The same Gym/Home setting as the rest of the app (picked at signup, the
  // trainer can switch it), so changing it here changes it everywhere.
  const [location, setLocation] = useState<ResetLocation>(client?.training_place ?? "gym");
  useEffect(() => {
    if (client?.training_place) setLocation(client.training_place);
  }, [client?.training_place]);

  const startedOn = client?.reset_started_on ?? null;
  const currentWeek = startedOn ? resetWeekNumber(startedOn, todayIso()) : null;
  const inProgram = currentWeek !== null && currentWeek >= 1 && currentWeek <= RESET_WEEKS_TOTAL;
  const finished = currentWeek !== null && currentWeek > RESET_WEEKS_TOTAL;

  const load = useCallback(async () => {
    if (!client || !startedOn || !inProgram) {
      setWeekLogs([]);
      setTodayLog({});
      return;
    }
    const { from, to } = resetWeekDates(startedOn, currentWeek);
    const { data } = await supabase
      .from("lifestyle_reset_daily_logs")
      .select("*")
      .eq("client_id", client.id)
      .gte("log_date", from)
      .lte("log_date", to)
      .order("log_date", { ascending: true });
    const rows = data ?? [];
    setWeekLogs(rows);
    setTodayLog(rows.find((r) => r.log_date === todayIso()) ?? {});
  }, [client, startedOn, inProgram, currentWeek]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Tops up the phone reminders each time she opens the tab.
  useFocusEffect(
    useCallback(() => {
      getResetReminder().then((r) => {
        setReminder(r);
        scheduleResetReminders(startedOn, r.enabled, r.time);
      });
    }, [startedOn])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await load();
    setRefreshing(false);
  };

  const saveLog = async (changes: Partial<LifestyleResetDailyLog>): Promise<boolean> => {
    if (!client) return false;
    setTodayLog((prev) => ({ ...prev, ...changes }));
    const payload: Partial<LifestyleResetDailyLog> = { client_id: client.id, log_date: todayIso(), ...changes };
    const { data, error } = await supabase
      .from("lifestyle_reset_daily_logs")
      .upsert(payload, { onConflict: "client_id,log_date" })
      .select()
      .single();
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      return false;
    }
    setWeekLogs((prev) => {
      const others = prev.filter((r) => r.log_date !== todayIso());
      return [...others, data].sort((a, b) => a.log_date.localeCompare(b.log_date));
    });
    return true;
  };

  const toggleHabit = (key: HabitKey) => {
    if (!inProgram) {
      Alert.alert("Start the program first", "Tap Start on the My Reset tab, then you can tick things off.");
      return;
    }
    saveLog({ [key]: !todayLog[key] });
  };

  const changeReminder = (next: ResetReminderSetting) => {
    setReminder(next);
    setResetReminder(next);
    scheduleResetReminders(startedOn, next.enabled, next.time);
  };

  const chooseLocation = async (next: ResetLocation) => {
    if (!client) return;
    const before = location;
    setLocation(next);
    const { error } = await supabase.from("clients").update({ training_place: next }).eq("id", client.id);
    if (error) {
      setLocation(before);
      Alert.alert("Couldn't save", error.message);
      return;
    }
    refreshProfile();
  };

  const start = () => {
    Alert.alert("Start the Reset today?", "Week 1 begins today. You'll get new steps each week.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Start",
        onPress: async () => {
          if (!client) return;
          const today = todayIso();
          const { error } = await supabase.from("clients").update({ reset_started_on: today }).eq("id", client.id);
          if (error) {
            Alert.alert("Couldn't start", error.message);
            return;
          }
          await refreshProfile();
          setViewWeek(null);
          Alert.alert("Want a daily reminder?", "We'll nudge you to tick off your habits. You can change this any time.", [
            { text: "Not now", style: "cancel" },
            { text: "7am", onPress: () => changeReminder({ enabled: true, time: "07:00" }) },
            { text: "7pm", onPress: () => changeReminder({ enabled: true, time: "19:00" }) },
          ]);
          scheduleResetReminders(today, reminder?.enabled ?? false, reminder?.time ?? "07:00");
        },
      },
    ]);
  };

  const restart = () => {
    Alert.alert("Start again from week 1?", "Your ticks and notes so far are kept.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start again",
        style: "destructive",
        onPress: async () => {
          if (!client) return;
          const { error } = await supabase.from("clients").update({ reset_started_on: todayIso() }).eq("id", client.id);
          if (error) {
            Alert.alert("Couldn't restart", error.message);
            return;
          }
          await refreshProfile();
          setViewWeek(null);
        },
      },
    ]);
  };

  if (loading || !client) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_GOLD} />
      </View>
    );
  }

  const shownWeek = viewWeek ?? (inProgram ? currentWeek : 1);
  const plan = inProgram ? resetWeek(currentWeek) : null;
  const weekCount = (key: HabitKey) => weekLogs.filter((r) => r[key]).length;
  const todaysHabits = plan ? RESET_HABITS.filter((h) => plan.habits.includes(h.key)) : [];
  const fresh = new Set(inProgram ? newHabits(currentWeek) : []);
  const ticked = todaysHabits.filter((h) => todayLog[h.key]).length;

  return (
    <View style={styles.container}>
      <ScreenTabBar tabs={TABS} current={tab} onChange={setTab} position="top" />
      <ScrollView
        key={tab}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === "plan" && (
          <>
            {!startedOn && (
              <>
                <Text style={styles.heroTitle}>12-Week Women's Health Reset</Text>
                <Text style={styles.heroText}>A few small steps each week. Tap a week or press Next to see it.</Text>
                <Text style={styles.chooseTitle}>Where will you train?</Text>
                <View style={styles.chooseRow}>
                  {RESET_LOCATIONS.map((l) => (
                    <Pressable
                      key={l.value}
                      style={[styles.chooseCard, location === l.value && styles.chooseCardOn]}
                      onPress={() => chooseLocation(l.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: location === l.value }}
                    >
                      <Text style={styles.chooseEmoji}>{l.emoji}</Text>
                      <Text style={[styles.chooseLabel, location === l.value && styles.chooseLabelOn]}>{l.label}</Text>
                      <Text style={[styles.chooseLine, location === l.value && styles.chooseLabelOn]}>{l.line}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={[styles.startButton, styles.startButtonTop]} onPress={start}>
                  <Text style={styles.startButtonText}>Start this program</Text>
                </Pressable>
              </>
            )}

            {inProgram && plan && (
              <>
                <View style={styles.weekHeader}>
                  <Text style={[styles.weekBadge, { color: RESET_PHASES[plan.phase].color }]}>
                    Week {currentWeek} of {RESET_WEEKS_TOTAL} · {RESET_PHASES[plan.phase].name}
                  </Text>
                  <Text style={styles.weekTitle}>{plan.title}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(currentWeek / RESET_WEEKS_TOTAL) * 100}%` }]} />
                  </View>
                </View>

                <Text style={styles.sectionTitle}>
                  Today · {ticked} of {todaysHabits.length} done
                </Text>
                <Text style={styles.hint}>Tap to tick off. Tap ? to see how to do it.</Text>
                {todaysHabits.map((h) => (
                  <View key={h.key} style={styles.habitRow}>
                    <Pressable style={styles.habitToggle} onPress={() => toggleHabit(h.key)}>
                      <View style={[styles.checkbox, todayLog[h.key] && styles.checkboxChecked]}>
                        {todayLog[h.key] && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.habitLabel}>{h.label}</Text>
                      {fresh.has(h.key) && <Text style={styles.newBadge}>NEW</Text>}
                    </Pressable>
                    <Pressable
                      style={styles.helpButton}
                      onPress={() => setGuideKey(h.key)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`How to do ${h.label}`}
                    >
                      <Text style={styles.helpButtonText}>?</Text>
                    </Pressable>
                  </View>
                ))}
                <Text style={styles.weekLine}>
                  {weekLogs.reduce((n, r) => n + todaysHabits.filter((h) => r[h.key]).length, 0)} ticks so far this week.
                  Aim for 70-80%, not perfect.
                </Text>

                <DailyNote key={todayIso()} log={todayLog} onSave={saveLog} />
              </>
            )}

            {finished && (
              <View style={styles.finishedCard}>
                <Text style={styles.finishedTitle}>🎉 You finished the 12 weeks!</Text>
                <Text style={styles.heroText}>Keep the habits that helped most. Chat to your coach about what's next.</Text>
                <Pressable style={styles.secondaryButton} onPress={restart}>
                  <Text style={styles.secondaryButtonText}>Start again from week 1</Text>
                </Pressable>
              </View>
            )}

            {startedOn && <Text style={styles.sectionTitle}>The 12 weeks</Text>}
            <WeekBrowser
              week={shownWeek}
              onChange={setViewWeek}
              currentWeek={inProgram ? currentWeek : undefined}
              location={location}
            />

            {!startedOn && (
              <Pressable style={[styles.startButton]} onPress={start}>
                <Text style={styles.startButtonText}>Start this program</Text>
              </Pressable>
            )}

            {startedOn && reminder && <ReminderCard setting={reminder} onChange={changeReminder} />}

            {inProgram && (
              <Pressable onPress={restart} style={{ alignSelf: "center", marginTop: 16 }}>
                <Text style={styles.restartLink}>Start again from week 1</Text>
              </Pressable>
            )}
          </>
        )}

        {tab === "training" && (
          <ResetTraining
            location={location}
            onChangeLocation={chooseLocation}
            currentWeek={inProgram ? currentWeek : null}
            trainedToday={!!todayLog.strength_training}
            cardioToday={!!todayLog.aerobic_exercise}
            strengthThisWeek={weekCount("strength_training")}
            cardioThisWeek={weekCount("aerobic_exercise")}
            onToggleTrained={() => toggleHabit("strength_training")}
            onToggleCardio={() => toggleHabit("aerobic_exercise")}
          />
        )}

        {tab === "guide" && (
          <>
            <Pressable
              style={styles.cycleLink}
              onPress={() => navigation.navigate("Section", { sectionKey: "womensHealthReset" })}
            >
              <Text style={styles.cycleLinkText}>🌸 Your cycle: log your period and see your phase ›</Text>
            </Pressable>
            <LifestyleResetContent />
          </>
        )}
      </ScrollView>

      <HabitGuideSheet
        habitKey={guideKey}
        done={guideKey ? !!todayLog[guideKey] : false}
        onToggleDone={() => guideKey && toggleHabit(guideKey)}
        onClose={() => setGuideKey(null)}
      />
    </View>
  );
}

function DailyNote({
  log,
  onSave,
}: {
  log: Partial<LifestyleResetDailyLog>;
  onSave: (changes: Partial<LifestyleResetDailyLog>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(log.note ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(log.note ?? "");
  }, [log.note]);

  const saveNote = async () => {
    Keyboard.dismiss();
    if (await onSave({ note: draft.trim() || null })) setSaved(true);
  };

  return (
    <View style={styles.noteCard}>
      <Text style={styles.noteTitle}>How did you feel today?</Text>
      <View style={styles.feelingRow}>
        {FEELINGS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.feeling, log.feeling === f.value && styles.feelingOn]}
            onPress={() => onSave({ feeling: f.value })}
            accessibilityLabel={f.label}
          >
            <Text style={styles.feelingEmoji}>{f.emoji}</Text>
            <Text style={styles.feelingLabel}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.noteTitle}>Is it helping?</Text>
      <View style={styles.helpedRow}>
        {HELPED_OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            style={[styles.helpedChip, log.helped === o.value && styles.helpedChipOn]}
            onPress={() => onSave({ helped: o.value as ResetHelped })}
          >
            <Text style={[styles.helpedText, log.helped === o.value && styles.helpedTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.noteInput}
        value={draft}
        onChangeText={(t) => {
          setDraft(t);
          setSaved(false);
        }}
        placeholder="Anything you noticed? Energy, sleep, mood, cravings..."
        placeholderTextColor="#64748B"
        multiline
        maxLength={1000}
      />
      <View style={styles.noteFooter}>
        <Text style={styles.noteHint}>Your coach can see your notes.</Text>
        <Pressable style={styles.saveButton} onPress={saveNote}>
          <Text style={styles.saveButtonText}>{saved ? "Saved ✓" : "Save note"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReminderCard({
  setting,
  onChange,
}: {
  setting: ResetReminderSetting;
  onChange: (next: ResetReminderSetting) => void;
}) {
  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.noteTitle}>Daily reminder</Text>
          <Text style={styles.noteHint}>A nudge each day to tick off your Reset.</Text>
        </View>
        <Switch
          value={setting.enabled}
          onValueChange={(enabled) => onChange({ ...setting, enabled })}
          trackColor={{ true: BRAND_GOLD, false: "#334155" }}
          accessibilityLabel="Daily reminder"
        />
      </View>
      {setting.enabled && (
        <View style={styles.helpedRow}>
          {RESET_REMINDER_TIMES.map((t) => (
            <Pressable
              key={t}
              style={[styles.helpedChip, setting.time === t && styles.helpedChipOn]}
              onPress={() => onChange({ ...setting, time: t })}
            >
              <Text style={[styles.helpedText, setting.time === t && styles.helpedTextOn]}>{formatReminderTime(t)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function HabitGuideSheet({
  habitKey,
  done,
  onToggleDone,
  onClose,
}: {
  habitKey: HabitKey | null;
  done: boolean;
  onToggleDone: () => void;
  onClose: () => void;
}) {
  const guide = habitKey ? RESET_GUIDES[habitKey] : null;
  return (
    <Modal visible={!!guide} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {guide && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {guide.icon} {guide.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={styles.sheetWhy}>{guide.why}</Text>

            <Text style={styles.sheetLabel}>How to do it</Text>
            {guide.steps.map((step, i) => (
              <View key={step} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            <Text style={styles.sheetLabel}>Coach's tips</Text>
            {guide.tips.map((tip) => (
              <Text key={tip} style={styles.tipText}>
                •  {tip}
              </Text>
            ))}

            <View style={styles.easierBox}>
              <Text style={styles.easierLabel}>Tough day?</Text>
              <Text style={styles.easierText}>{guide.easier}</Text>
            </View>
          </ScrollView>
          <Pressable style={[styles.doneButton, done && styles.doneButtonDone]} onPress={onToggleDone}>
            <Text style={[styles.doneButtonText, done && styles.doneButtonTextDone]}>
              {done ? "✓ Done today" : "Mark as done today"}
            </Text>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  heroText: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 4 },
  weekHeader: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 16 },
  weekBadge: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  weekTitle: { color: "#fff", fontSize: 19, fontWeight: "800", marginTop: 4 },
  progressTrack: { height: 6, backgroundColor: "#0F172A", borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: BRAND_GOLD, borderRadius: 3 },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 17, marginTop: 12, marginBottom: 10 },
  hint: { color: "#64748B", fontSize: 12, marginTop: -4, marginBottom: 10 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    marginBottom: 8,
  },
  habitToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  helpButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: BRAND_GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  helpButtonText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  checkmark: { color: "#0F172A", fontWeight: "900", fontSize: 13 },
  habitLabel: { color: "#E2E8F0", fontSize: 14.5, fontWeight: "600", flexShrink: 1 },
  newBadge: {
    color: "#0F172A",
    backgroundColor: BRAND_GOLD,
    fontSize: 10,
    fontWeight: "800",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: "hidden",
  },
  weekLine: { color: "#64748B", fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 6 },
  noteCard: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12 },
  noteTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  feelingRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  feeling: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, borderRadius: 10, flex: 1 },
  feelingOn: { backgroundColor: "#334155" },
  feelingEmoji: { fontSize: 26 },
  feelingLabel: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  helpedRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  helpedChip: { borderWidth: 1.5, borderColor: "#334155", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  helpedChipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  helpedText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13.5 },
  helpedTextOn: { color: "#0F172A" },
  noteInput: {
    backgroundColor: "#0F172A",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
    marginTop: 10,
    fontSize: 14,
  },
  noteFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  noteHint: { color: "#64748B", fontSize: 12, flexShrink: 1 },
  saveButton: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  saveButtonText: { color: "#0F172A", fontWeight: "700" },
  startButton: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  chooseTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 12, marginBottom: 8 },
  chooseRow: { flexDirection: "row", gap: 10 },
  chooseCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#1E293B",
    padding: 12,
    alignItems: "center",
  },
  chooseCardOn: { borderColor: BRAND_GOLD, backgroundColor: "#2A2614" },
  chooseEmoji: { fontSize: 26 },
  chooseLabel: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 4 },
  chooseLabelOn: { color: BRAND_GOLD },
  chooseLine: { color: "#94A3B8", fontSize: 12, textAlign: "center", marginTop: 2 },
  startButtonTop: { marginTop: 8, marginBottom: 14, paddingVertical: 12 },
  startButtonText: { color: "#0F172A", fontWeight: "800", fontSize: 17 },
  reminderCard: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 16, gap: 10 },
  reminderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  finishedCard: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 8 },
  finishedTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  secondaryButton: { borderWidth: 1.5, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 12 },
  secondaryButtonText: { color: BRAND_GOLD, fontWeight: "700" },
  restartLink: { color: "#64748B", fontSize: 13, textDecorationLine: "underline" },
  cycleLink: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 16 },
  cycleLinkText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    maxHeight: "85%",
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "#1E293B",
    padding: 20,
    paddingBottom: 32,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetTitle: { color: "#fff", fontSize: 19, fontWeight: "700", flex: 1 },
  sheetClose: { color: "#94A3B8", fontSize: 18, paddingLeft: 12 },
  sheetWhy: { color: "#CBD5E1", fontSize: 14, lineHeight: 21 },
  sheetLabel: { color: "#22C55E", fontWeight: "700", fontSize: 13, marginTop: 18, marginBottom: 8, textTransform: "uppercase" },
  stepRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1E293B",
    color: "#22C55E",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 22,
    overflow: "hidden",
  },
  stepText: { color: "#E2E8F0", fontSize: 14, lineHeight: 21, flex: 1 },
  tipText: { color: "#CBD5E1", fontSize: 13.5, lineHeight: 20, marginBottom: 4 },
  easierBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 16 },
  easierLabel: { color: "#F59E0B", fontWeight: "700", fontSize: 12.5, marginBottom: 4 },
  easierText: { color: "#E2E8F0", fontSize: 13.5, lineHeight: 20 },
  doneButton: {
    borderWidth: 1.5,
    borderColor: "#22C55E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  doneButtonDone: { backgroundColor: "#22C55E" },
  doneButtonText: { color: "#22C55E", fontWeight: "700", fontSize: 15 },
  doneButtonTextDone: { color: "#0F172A" },
});
