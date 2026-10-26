import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/programSchedule";
import { BRAND_GOLD } from "@/lib/brand";
import { getHealthLink, healthSourceHere, syncHealthSteps } from "@/lib/healthLink";
import {
  STEP_GOAL_CHOICES,
  formatSteps,
  isStepEvening,
  parseSteps,
  stepProgress,
  stepStatus,
  stepStreak,
  validGoal,
  type StepDay,
} from "@/lib/steps";

type Goal = { goal: number; reminders: boolean };

// The daily step goal on the Check-in tab (0158, GRIZZ, 2026-10-26). One
// compact card: today's steps against the goal, with a bar. Tap it to set the
// goal, type today's steps in, or turn the 4pm and 7pm reminders off. Each
// time the tab opens, a linked watch's steps are read first. From 19:00 the
// card turns gold and says where they are for the day.
export default function StepsCard() {
  const { client } = useAuth();
  const clientId = client?.id;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [days, setDays] = useState<StepDay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [watch, setWatch] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    const today = todayIso();
    const link = await getHealthLink(clientId);
    const linked = !!link && healthSourceHere() === link.source;
    setWatch(linked);
    if (linked) await syncHealthSteps(clientId);
    const [g, s] = await Promise.all([
      supabase.from("client_step_goals").select("goal, reminders").eq("client_id", clientId).maybeSingle(),
      supabase
        .from("client_steps")
        .select("step_date, steps, goal, source, updated_at")
        .eq("client_id", clientId)
        .gte("step_date", addDays(today, -30))
        .lte("step_date", today),
    ]);
    if (g.error || s.error) return;
    setGoal((g.data as Goal | null) ?? null);
    setDays((s.data ?? []) as StepDay[]);
    setLoaded(true);
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  if (!clientId || !loaded) return null;

  const today = todayIso();
  const row = days.find((d) => d.step_date === today) ?? null;
  const steps = row?.steps ?? 0;

  if (!goal) {
    return (
      <>
        <Pressable style={styles.card} onPress={() => setOpen(true)} accessibilityRole="button">
          <Text style={styles.title}>👟 Set a daily step goal</Text>
          <Text style={styles.text}>Pick how many steps a day you're aiming for. At 4pm the app reminds you if you're not there yet.</Text>
          <Text style={styles.link}>Set my goal ›</Text>
        </Pressable>
        <StepsModal visible={open} onClose={() => setOpen(false)} clientId={clientId} goal={null} row={row} watch={watch} onSaved={load} />
      </>
    );
  }

  const hit = steps >= goal.goal;
  const evening = isStepEvening(new Date());
  const streak = stepStreak(days, today, goal.goal);
  const updated = row ? new Date(row.updated_at) : null;
  const when = updated ? `${String(updated.getHours()).padStart(2, "0")}:${String(updated.getMinutes()).padStart(2, "0")}` : null;

  return (
    <>
      <Pressable
        style={[styles.card, (evening || hit) && styles.cardGold]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Steps today ${formatSteps(steps)} of ${formatSteps(goal.goal)}`}
      >
        <View style={styles.row}>
          <Text style={styles.title}>{evening && !hit ? "👟 Where you are today" : hit ? "🎉 Step goal hit" : "👟 Steps today"}</Text>
          <Text style={styles.count}>
            <Text style={styles.countBig}>{formatSteps(steps)}</Text> / {formatSteps(goal.goal)}
          </Text>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.round(stepProgress(steps, goal.goal) * 100)}%` }, hit && styles.barDone]} />
        </View>
        <Text style={styles.text}>{row || watch ? stepStatus(steps, goal.goal) : "Tap to add today's steps."}</Text>
        <Text style={styles.small}>
          {row?.source && row.source !== "manual" && when ? `⌚ From your watch at ${when}` : row ? "Typed in" : watch ? "⌚ Watch linked" : "Add your steps yourself or link your watch under Profile"}
          {streak > 1 ? `  ·  🔥 ${streak} days in a row` : ""}
        </Text>
      </Pressable>
      <StepsModal visible={open} onClose={() => setOpen(false)} clientId={clientId} goal={goal} row={row} watch={watch} onSaved={load} />
    </>
  );
}

function StepsModal({
  visible,
  onClose,
  clientId,
  goal,
  row,
  watch,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  goal: Goal | null;
  row: StepDay | null;
  watch: boolean;
  onSaved: () => Promise<void>;
}) {
  const [pick, setPick] = useState<number | null>(goal?.goal ?? 10000);
  const [own, setOwn] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [reminders, setReminders] = useState(goal?.reminders ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    const g = goal?.goal ?? 10000;
    setPick(STEP_GOAL_CHOICES.includes(g) ? g : null);
    setOwn(STEP_GOAL_CHOICES.includes(g) ? "" : String(g));
    setStepsText(row?.source === "manual" ? String(row.steps) : "");
    setReminders(goal?.reminders ?? true);
    setError(null);
  };

  const save = async () => {
    const chosen = own.trim() ? validGoal(parseSteps(own)) : pick;
    if (!chosen) {
      setError("Pick a goal, or type one between 1 000 and 50 000 steps.");
      return;
    }
    const typed = stepsText.trim() ? parseSteps(stepsText) : null;
    if (stepsText.trim() && typed === null) {
      setError("Type today's steps as a number, like 8 500.");
      return;
    }
    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const { error: goalError } = await supabase
      .from("client_step_goals")
      .upsert({ client_id: clientId, goal: chosen, reminders, updated_at: now }, { onConflict: "client_id" });
    let stepsError = null;
    if (typed !== null) {
      ({ error: stepsError } = await supabase
        .from("client_steps")
        .upsert({ client_id: clientId, step_date: todayIso(), steps: typed, goal: chosen, source: "manual", updated_at: now }, { onConflict: "client_id,step_date" }));
    } else if (row) {
      // Today counts against the new goal too.
      ({ error: stepsError } = await supabase.from("client_steps").update({ goal: chosen }).eq("client_id", clientId).eq("step_date", row.step_date));
    }
    setSaving(false);
    if (goalError || stepsError) {
      setError("Couldn't save. Check your internet connection and try again.");
      return;
    }
    await onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={reset}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.row}>
              <Text style={styles.sheetTitle}>👟 Daily steps</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>My goal each day</Text>
              <View style={styles.chips}>
                {STEP_GOAL_CHOICES.map((n) => {
                  const on = pick === n && !own.trim();
                  return (
                    <Pressable
                      key={n}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => {
                        setPick(n);
                        setOwn("");
                      }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{formatSteps(n)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="Or type your own, e.g. 9 000"
                placeholderTextColor="#64748B"
                value={own}
                onChangeText={setOwn}
                maxLength={6}
              />
              <Text style={styles.hint}>New to walking? Start near what you do now and add 1 000 a week.</Text>

              <Text style={styles.label}>Steps today</Text>
              {watch && <Text style={styles.hint}>⌚ Your watch's steps come in each time you open the app. Only type here if you walked without it.</Text>}
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder={row ? formatSteps(row.steps) : "e.g. 6 500"}
                placeholderTextColor="#64748B"
                value={stepsText}
                onChangeText={setStepsText}
                maxLength={7}
              />

              <View style={[styles.row, styles.switchRow]}>
                <Text style={styles.switchText}>Remind me at 4pm and tell me where I am at 7pm</Text>
                <Switch value={reminders} onValueChange={setReminders} trackColor={{ true: BRAND_GOLD, false: "#334155" }} />
              </View>

              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable style={[styles.button, saving && styles.buttonOff]} onPress={save} disabled={saving}>
                <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: "#334155" },
  cardGold: { borderColor: BRAND_GOLD },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: "#fff", fontWeight: "800", fontSize: 16, flexShrink: 1 },
  count: { color: "#94A3B8", fontSize: 14 },
  countBig: { color: "#fff", fontWeight: "800", fontSize: 18 },
  bar: { height: 10, backgroundColor: "#0F172A", borderRadius: 5, marginTop: 10, overflow: "hidden" },
  barFill: { height: 10, backgroundColor: BRAND_GOLD, borderRadius: 5 },
  barDone: { backgroundColor: "#22C55E" },
  text: { color: "#E2E8F0", fontSize: 14, marginTop: 8 },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#1E293B", borderRadius: 14, padding: 18, maxHeight: "90%" },
  sheetTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  close: { color: "#94A3B8", fontSize: 20 },
  label: { color: "#fff", fontWeight: "700", fontSize: 15, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: "#475569" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#E2E8F0", fontWeight: "600" },
  chipTextOn: { color: "#0F172A" },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 10, padding: 12, fontSize: 16, marginTop: 10 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 6 },
  switchRow: { marginTop: 18 },
  switchText: { color: "#E2E8F0", fontSize: 14, flex: 1 },
  error: { color: "#F87171", marginTop: 12 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  buttonOff: { opacity: 0.6 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
