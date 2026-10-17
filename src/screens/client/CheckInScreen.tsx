import CheckinFeedbackCard from "@/components/CheckinFeedbackCard";
import { checkinFeedback } from "@/lib/checkinFeedback";
import NotificationsPrompt from "@/components/NotificationsPrompt";
import WellbeingQuestions from "@/components/WellbeingQuestions";
import RecoverySuggestionCard from "@/components/RecoverySuggestionCard";
import { WELLBEING_TOPICS } from "@/lib/wellbeing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
} from "react-native";
import ProgressPhotoReminder from "@/components/ProgressPhotoReminder";
import SleepReminder from "@/components/SleepReminder";
import ResetReminderBanner from "@/components/reset/ResetReminderBanner";
import { CycleTodayBanner } from "@/components/CycleTracker";
import { CoachMessageCard } from "@/components/CoachMessages";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import {
  EMPTY_CHECKIN_FORM,
  formFromCheckin,
  parseTime,
  unansweredSections,
  validateCheckinForm,
  type CheckinForm,
  type CheckinValues,
} from "@/lib/checkinForm";
import type { Checkin } from "@/types/database";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// The check-in's three pages, in order.
const CHECKIN_STEPS = ["How you feel", "Sleep", "Food & drink"] as const;

const yesNo = (value: boolean | null) => (value === null ? "-" : value ? "Yes" : "No");
const orDash = (value: string | null) => (value ? value.slice(0, 5) : "-");

export default function CheckInScreen() {
  const { client } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Today's saved check-in, if there is one. While `editing` is false and this
  // is set, the client sees a summary with a button to go back and change it.
  const [saved, setSaved] = useState<Checkin | null>(null);
  // The last week of check-ins, for the app's tips (checkinFeedback).
  const [week, setWeek] = useState<Checkin[]>([]);
  const [editing, setEditing] = useState(false);
  // The form is three short pages (GRIZZ dislikes scrolling, 2026-10-14).
  const [step, setStep] = useState(0);
  // Today's saved answers stay folded away until the client asks to see them.
  const [showAnswers, setShowAnswers] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Each new page starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const [form, setForm] = useState<CheckinForm>(EMPTY_CHECKIN_FORM);
  // The day the screen was loaded for. The tab stays mounted, so if the app is
  // left open overnight the screen has to notice that a new day has started.
  const loadedFor = useRef<string | null>(null);

  const set = <K extends keyof CheckinForm>(key: K, value: CheckinForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const loadWeek = useCallback(async () => {
    if (!client) return;
    const { data } = await supabase
      .from("checkins")
      .select("*")
      .eq("client_id", client.id)
      .order("checkin_date", { ascending: false })
      .limit(14);
    setWeek(data ?? []);
  }, [client]);

  const load = useCallback(async () => {
    if (!client) return;
    const today = todayIso();
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .eq("client_id", client.id)
      .eq("checkin_date", today)
      .maybeSingle();
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    loadedFor.current = today;
    setSaved(data);
    loadWeek();
    setEditing(false);
    setStep(0);
    setForm(data ? formFromCheckin(data) : EMPTY_CHECKIN_FORM);
  }, [client, loadWeek]);

  const reloadIfNewDay = useCallback(() => {
    if (loadedFor.current !== todayIso()) load();
  }, [load]);

  useFocusEffect(reloadIfNewDay);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reloadIfNewDay();
    });
    return () => subscription.remove();
  }, [reloadIfNewDay]);

  const tidyTime = (key: "bedTime" | "wakeTime") => {
    const parsed = parseTime(form[key]);
    if (parsed) set(key, parsed);
  };

  const save = async (values: CheckinValues) => {
    if (!client) return;
    setSaving(true);
    const write = async (existingId: string | null) =>
      existingId
        ? supabase.from("checkins").update(values).eq("id", existingId).select().single()
        : supabase
            .from("checkins")
            .insert({ ...values, client_id: client.id, checkin_date: loadedFor.current ?? todayIso() })
            .select()
            .single();

    let { data, error } = await write(saved?.id ?? null);
    // Already checked in today from another phone: change that check-in instead.
    if (error?.code === "23505") {
      const { data: existing } = await supabase
        .from("checkins")
        .select("id")
        .eq("client_id", client.id)
        .eq("checkin_date", loadedFor.current ?? todayIso())
        .maybeSingle();
      if (existing) ({ data, error } = await write(existing.id));
    }
    setSaving(false);
    if (error || !data) {
      Alert.alert("Couldn't save your check-in", error?.message ?? "Please try again.");
      return;
    }
    setSaved(data);
    setForm(formFromCheckin(data));
    setEditing(false);
    setStep(0);
  };

  const handleSubmit = () => {
    const result = validateCheckinForm(form);
    if (!result.ok) {
      Alert.alert(result.title, result.message);
      return;
    }
    const missing = unansweredSections(form);
    if (missing.length === 0) {
      save(result.values);
      return;
    }
    Alert.alert(
      "A few answers are blank",
      `You haven't filled in ${missing.join(", ")}. You can come back and add them later today.`,
      [
        { text: "Go back", style: "cancel" },
        { text: "Save anyway", onPress: () => save(result.values) },
      ],
    );
  };

  const cancelEditing = () => {
    if (saved) setForm(formFromCheckin(saved));
    setEditing(false);
    setStep(0);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Couldn't load your check-in</Text>
        <Text style={[styles.label, styles.centerText]}>Check your internet connection and try again.</Text>
        <Pressable style={[styles.button, styles.buttonCompact]} onPress={load}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (saved && !editing) {
    const missing = unansweredSections(formFromCheckin(saved));
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <NotificationsPrompt who="client" />
        <CoachMessageCard />
        <SleepReminder />
        <CycleTodayBanner />
        <ResetReminderBanner />
        <ProgressPhotoReminder />
        <Text style={styles.title}>You're checked in for today ✅</Text>
        <CheckinFeedbackCard
          feedback={checkinFeedback(week.some((c) => c.id === saved.id) ? week.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...week], todayIso())}
        />
        {client && <RecoverySuggestionCard clientId={client.id} refreshKey={saved} />}
        {missing.length > 0 && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Still blank: {missing.join(", ")}. Tap "Change my answers" to add them.
            </Text>
          </View>
        )}
        <Pressable style={styles.answersToggle} onPress={() => setShowAnswers(!showAnswers)}>
          <Text style={styles.answersToggleText}>Today's answers</Text>
          <Text style={styles.answersToggleText}>{showAnswers ? "▲" : "▼"}</Text>
        </Pressable>
        {showAnswers && (
        <View style={styles.summaryCard}>
          <SummaryRow label="Alcohol (units)" value={String(saved.alcohol_units)} />
          <SummaryRow label="Bed / wake" value={`${orDash(saved.sleep_bed_time)} / ${orDash(saved.sleep_wake_time)}`} />
          <SummaryRow label="Sleep quality" value={saved.sleep_quality ? `${saved.sleep_quality} / 5` : "-"} />
          <SummaryRow label="Water" value={`${saved.water_litres} L`} />
          <SummaryRow label="Meals yesterday" value={String(saved.meals_total)} />
          <SummaryRow label="High-GI meals" value={String(saved.high_gi_count)} />
          <SummaryRow label="Wound down without screens" value={yesNo(saved.wound_down)} />
          {WELLBEING_TOPICS.map((t) => (
            <SummaryRow
              key={t.key}
              label={`${t.icon} ${t.title}`}
              value={saved[`${t.key}_status`] === "reported" ? "Reported" : saved[`${t.key}_status`] === "ok" ? "Okay" : "-"}
            />
          ))}
          {saved.distress_flag && saved.distress_notes && <Text style={styles.summaryNote}>{saved.distress_notes}</Text>}
        </View>
        )}
        <Pressable
          style={styles.button}
          onPress={() => {
            setStep(0);
            setEditing(true);
          }}
        >
          <Text style={styles.buttonText}>Change my answers</Text>
        </Pressable>
        <Text style={[styles.helper, styles.centerText]}>
          You can change today's check-in until midnight. Come back tomorrow morning for your next one.
        </Text>
      </ScrollView>
    );
  }

  // The whole app keeps typing above the keyboard (KeyboardSafe in RootNavigator).
  return (
    <View style={styles.flex1}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && (
          <>
            <NotificationsPrompt who="client" />
            <CoachMessageCard />
            <SleepReminder />
            <CycleTodayBanner />
            <ResetReminderBanner />
            <ProgressPhotoReminder />
            {client && !saved && <RecoverySuggestionCard clientId={client.id} />}
          </>
        )}
        <Text style={styles.title}>{saved ? "Change today's check-in" : "Morning check-in"}</Text>
        <View style={styles.steps}>
          {CHECKIN_STEPS.map((label, i) => (
            <Pressable key={label} style={styles.stepItem} onPress={() => setStep(i)}>
              <View style={[styles.stepBar, i <= step && styles.stepBarOn]} />
              <Text style={[styles.stepLabel, i === step && styles.stepLabelOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {step === 0 && (
          <>
            <WellbeingQuestions value={form.wellbeing} onChange={(next) => set("wellbeing", next)} />

          </>
        )}
        {step === 1 && (
          <>
            <Text style={styles.sectionHeading}>Sleep times (24-hour clock, e.g. 22:30)</Text>
            <View style={styles.row}>
              {(
                [
                  { key: "bedTime", label: "Bed", placeholder: "22:30" },
                  { key: "wakeTime", label: "Wake", placeholder: "06:00" },
                ] as const
              ).map((field) => (
                <View key={field.key} style={styles.flex1}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                    placeholder={field.placeholder}
                    placeholderTextColor="#64748B"
                    value={form[field.key]}
                    onChangeText={(v) => set(field.key, v)}
                    onBlur={() => tidyTime(field.key)}
                    maxLength={5}
                  />
                </View>
              ))}
            </View>

            <Text style={styles.sectionHeading}>Sleep quality (1 = poor, 5 = great)</Text>
            <View style={styles.row}>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <Pressable
                  key={n}
                  style={[styles.scoreBubble, form.sleepQuality === n && styles.scoreBubbleSelected]}
                  onPress={() => set("sleepQuality", form.sleepQuality === n ? null : n)}
                >
                  <Text style={styles.scoreText}>{n}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionHeading}>Wound down without screens before bed?</Text>
            <Text style={styles.hint}>Last 30-60 minutes before bed: no phone, TV or laptop. Reading, stretching or breathing all count.</Text>
            <View style={styles.row}>
              {([true, false] as const).map((answer) => (
                <Pressable
                  key={String(answer)}
                  style={[styles.choice, form.woundDown === answer && styles.choiceSelected]}
                  onPress={() => set("woundDown", form.woundDown === answer ? null : answer)}
                >
                  <Text style={[styles.choiceText, form.woundDown === answer && styles.choiceTextSelected]}>
                    {answer ? "Yes" : "No"}
                  </Text>
                </Pressable>
              ))}
            </View>

          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.sectionHeading}>Water (litres)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="e.g. 2,5"
              placeholderTextColor="#64748B"
              value={form.waterLitres}
              onChangeText={(v) => set("waterLitres", v)}
            />

            <Text style={styles.sectionHeading}>Meals yesterday (total)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#64748B"
              value={form.mealsTotal}
              onChangeText={(v) => set("mealsTotal", v)}
            />

            <Text style={styles.sectionHeading}>High-GI meals (count)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#64748B"
              value={form.highGiCount}
              onChangeText={(v) => set("highGiCount", v)}
            />

            <Text style={styles.sectionHeading}>Alcohol (units last night)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#64748B"
              value={form.alcoholUnits}
              onChangeText={(v) => set("alcoholUnits", v)}
            />

          </>
        )}

        {step < CHECKIN_STEPS.length - 1 ? (
          <Pressable style={styles.button} onPress={() => setStep(step + 1)}>
            <Text style={styles.buttonText}>Next: {CHECKIN_STEPS[step + 1]} ›</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.buttonText}>{saved ? "Save changes" : "Submit check-in"}</Text>
              )}
            </Pressable>
          </>
        )}
        {step > 0 && (
          <Pressable style={styles.secondaryButton} onPress={() => setStep(step - 1)} disabled={saving}>
            <Text style={styles.secondaryButtonText}>‹ Back</Text>
          </Pressable>
        )}
        {saved && (
          <Pressable style={styles.secondaryButton} onPress={cancelEditing} disabled={saving}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A", padding: 24 },
  centerText: { textAlign: "center" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16, textAlign: "center" },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 18, marginBottom: 8 },
  label: { color: "#E2E8F0", fontSize: 14 },
  inputLabel: { color: "#94A3B8", fontSize: 12, marginBottom: 4 },
  hint: { color: "#64748B", fontSize: 13, marginBottom: 10 },
  choice: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    alignItems: "center",
  },
  choiceSelected: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  choiceText: { color: "#fff", fontWeight: "600" },
  choiceTextSelected: { color: "#0F172A" },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 10 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12 },
  multiline: { minHeight: 80, textAlignVertical: "top", marginTop: 8 },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  scoreBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBubbleSelected: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  scoreText: { color: "#fff", fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  checkmark: { color: "#0F172A", fontSize: 12, fontWeight: "800", lineHeight: 14 },
  notice: { backgroundColor: "#422006", borderRadius: 10, padding: 12, marginBottom: 12 },
  noticeText: { color: "#FDE68A", fontSize: 14 },
  summaryCard: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  summaryLabel: { color: "#94A3B8", fontSize: 14, flexShrink: 1 },
  summaryValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  summaryNote: { color: "#E2E8F0", fontSize: 13, marginTop: 6, fontStyle: "italic" },
  button: {
    backgroundColor: "#22C55E",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 28,
  },
  buttonCompact: { marginTop: 20, paddingHorizontal: 28 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  steps: { flexDirection: "row", gap: 8, marginBottom: 8 },
  stepItem: { flex: 1, alignItems: "center" },
  stepBar: { height: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: "#334155" },
  stepBarOn: { backgroundColor: "#22C55E" },
  stepLabel: { color: "#64748B", fontSize: 12, marginTop: 6 },
  stepLabelOn: { color: "#fff", fontWeight: "700" },
  answersToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  answersToggleText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryButton: { padding: 14, alignItems: "center", marginTop: 6, marginBottom: 40 },
  secondaryButtonText: { color: "#94A3B8", fontWeight: "600", fontSize: 15 },
});
