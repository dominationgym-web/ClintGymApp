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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
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

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onToggle}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.label, styles.flex1]}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CheckinForm>(EMPTY_CHECKIN_FORM);
  // The day the screen was loaded for. The tab stays mounted, so if the app is
  // left open overnight the screen has to notice that a new day has started.
  const loadedFor = useRef<string | null>(null);

  const set = <K extends keyof CheckinForm>(key: K, value: CheckinForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
    setEditing(false);
    setForm(data ? formFromCheckin(data) : EMPTY_CHECKIN_FORM);
  }, [client]);

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
        <Text style={styles.title}>You're checked in for today ✅</Text>
        {missing.length > 0 && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Still blank: {missing.join(", ")}. Tap "Change my answers" to add them.
            </Text>
          </View>
        )}
        <View style={styles.summaryCard}>
          <SummaryRow label="Alcohol (units)" value={String(saved.alcohol_units)} />
          <SummaryRow label="Bed / wake" value={`${orDash(saved.sleep_bed_time)} / ${orDash(saved.sleep_wake_time)}`} />
          <SummaryRow label="Sleep quality" value={saved.sleep_quality ? `${saved.sleep_quality} / 5` : "-"} />
          <SummaryRow label="Water" value={`${saved.water_litres} L`} />
          <SummaryRow label="Meals yesterday" value={String(saved.meals_total)} />
          <SummaryRow label="High-GI meals" value={String(saved.high_gi_count)} />
          <SummaryRow label="Wound down without screens" value={yesNo(saved.wound_down)} />
          <SummaryRow label="Distress or pain flagged" value={yesNo(saved.distress_flag)} />
          {saved.distress_flag && saved.distress_notes && <Text style={styles.summaryNote}>{saved.distress_notes}</Text>}
        </View>
        <Pressable style={styles.button} onPress={() => setEditing(true)}>
          <Text style={styles.buttonText}>Change my answers</Text>
        </Pressable>
        <Text style={[styles.helper, styles.centerText]}>
          You can change today's check-in until midnight. Come back tomorrow morning for your next one.
        </Text>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{saved ? "Change today's check-in" : "Morning check-in"}</Text>

        <Text style={styles.sectionHeading}>Alcohol (units last night)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#64748B"
          value={form.alcoholUnits}
          onChangeText={(v) => set("alcoholUnits", v)}
        />

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

        <Text style={styles.sectionHeading}>Anything wrong?</Text>
        <Toggle
          label="Flag real distress or pain (not just a rough day)"
          value={form.distressFlag}
          onToggle={() => set("distressFlag", !form.distressFlag)}
        />
        {form.distressFlag && (
          <TextInput
            style={[styles.input, styles.multiline]}
            multiline
            placeholder="Briefly describe what's going on - your trainer will follow up outside the app."
            placeholderTextColor="#64748B"
            value={form.distressNotes}
            onChangeText={(v) => set("distressNotes", v)}
          />
        )}

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.buttonText}>{saved ? "Save changes" : "Submit check-in"}</Text>
          )}
        </Pressable>
        {saved && (
          <Pressable style={styles.secondaryButton} onPress={cancelEditing} disabled={saving}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  secondaryButton: { padding: 14, alignItems: "center", marginTop: 6, marginBottom: 40 },
  secondaryButtonText: { color: "#94A3B8", fontWeight: "600", fontSize: 15 },
});
