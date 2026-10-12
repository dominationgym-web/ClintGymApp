import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import KeyboardSafe from "@/components/KeyboardSafe";
import { amountLabel, dailyTarget, dayTotals, intakeDetails, sumTotals, targetStatus, type DietDay, type DietItem } from "@/lib/dietPlan";
import {
  cleanTime,
  DEFAULT_TIMES,
  macroTargets,
  makeDay,
  MAX_MEALS,
  MIN_MEALS,
  swapItem,
  swapOptions,
  type MealPlanSettings,
} from "@/lib/mealPlanMaker";
import type { ClientMealPlan } from "@/types/database";

/** A day of meals, with a Swap button on each food when `onSwap` is given. */
export function MealDayView({
  day,
  targetKcal,
  onSwap,
}: {
  day: DietDay;
  targetKcal: number | null;
  onSwap?: (meal: number, index: number) => void;
}) {
  const totals = dayTotals(day);
  const status = targetKcal ? targetStatus(totals.kcal, targetKcal) : null;
  return (
    <View>
      <View style={styles.totals}>
        <Text style={styles.total}>
          {totals.kcal.toLocaleString()} kcal{targetKcal ? ` (target ${targetKcal.toLocaleString()})` : ""}
          {status && status.state !== "on" ? ` · ${status.by} ${status.state}` : ""}
        </Text>
        <Text style={styles.macros}>
          Protein {totals.protein} g · Carbs {totals.carbs} g · Fat {totals.fat} g
        </Text>
      </View>
      {day.meals.map((meal, m) => {
        const t = sumTotals(meal.items);
        return (
          <View key={meal.name + m} style={styles.meal}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealKcal}>{t.kcal} kcal</Text>
            </View>
            <Text style={styles.mealMacros}>
              P {t.protein} g · C {t.carbs} g · F {t.fat} g
            </Text>
            {meal.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.item}>
                  • {item.food}: <Text style={styles.amount}>{amountLabel(item)}</Text>
                </Text>
                {onSwap && (
                  <Pressable onPress={() => onSwap(m, i)} hitSlop={8}>
                    <Text style={styles.swap}>⇄ Swap</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// The client's own meal plan maker (GRIZZ, 2026-10-12), in the Nutrition
// section: pick meals, times and training time, and the app builds a
// medium-carb day with the carbs around training. Tap Swap to change a food
// for another with the same protein, carbs or fat.
export default function MealPlanMaker() {
  const { client } = useAuth();
  const [plan, setPlan] = useState<ClientMealPlan | null>(null);
  const [target, setTarget] = useState<{ kcal: number; weight: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(4);
  const [times, setTimes] = useState<string[]>(DEFAULT_TIMES[4]);
  const [training, setTraining] = useState<string>("17:30");
  const [trains, setTrains] = useState(true);
  const [dayKind, setDayKind] = useState<"training" | "rest">("training");
  const [swapping, setSwapping] = useState<{ meal: number; index: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;
    Promise.all([
      supabase.from("client_meal_plans").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("client_diet_plans").select("*").eq("client_id", client.id).maybeSingle(),
    ]).then(([{ data: mine }, { data: coach }]) => {
      // The coach's numbers first (they include any over or under they set), then the intake.
      const fromCoach = coach ? dailyTarget({ ...coach, activity: Number(coach.activity) }) : null;
      const intake = intakeDetails(client);
      const fromIntake = intake.activity ? dailyTarget({ ...intake, activity: intake.activity, adjust_kcal: 0 }) : null;
      const kcal = fromCoach ?? fromIntake;
      const weight = (fromCoach ? coach?.weight_kg : null) ?? intake.weight_kg;
      setTarget(kcal && weight ? { kcal, weight: Number(weight) } : null);
      if (mine?.settings?.meals?.length) {
        setPlan(mine);
        setCount(mine.settings.meals.length);
        setTimes(mine.settings.meals);
        setTrains(!!mine.settings.training);
        if (mine.settings.training) setTraining(mine.settings.training);
        if (!mine.settings.training) setDayKind("rest");
      } else {
        setEditing(true);
      }
      setLoading(false);
    });
  }, [client?.id]);

  if (loading) return <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 12 }} />;
  if (!target) {
    return (
      <Text style={styles.helper}>
        The app needs your height, weight, age and how active you are to work out your calories. Fill them in under "Your
        meal plan from your coach" above, or ask your coach.
      </Text>
    );
  }

  const save = async (next: ClientMealPlan) => {
    setPlan(next);
    if (!client) return;
    setSaving(true);
    const { error } = await supabase.from("client_meal_plans").upsert({ ...next, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) Alert.alert("Couldn't save your plan", error.message);
  };

  const build = (variety: number) => {
    if (!client) return;
    const cleaned = times.slice(0, count).map(cleanTime);
    if (cleaned.some((t) => !t)) return Alert.alert("Meal times", "Type each time like 07:00 or 13:30.");
    const trainingTime = trains ? cleanTime(training) : null;
    if (trains && !trainingTime) return Alert.alert("Training time", "Type it like 17:30, or tap I don't train.");
    const settings: MealPlanSettings = { meals: cleaned as string[], training: trainingTime };
    const targets = macroTargets(target.kcal, target.weight);
    save({
      client_id: client.id,
      settings,
      targets,
      training_day: makeDay(settings, targets, true, variety),
      rest_day: makeDay(settings, targets, false, variety),
      variety,
      updated_at: new Date().toISOString(),
    });
    setDayKind(trainingTime ? "training" : "rest");
    setEditing(false);
  };

  const chooseCount = (n: number) => {
    setCount(n);
    setTimes(DEFAULT_TIMES[n]);
  };

  if (editing || !plan) {
    return (
      <View>
        <Text style={styles.helper}>
          Tell the app how you like to eat and it builds your day: balanced meals with medium carbs, most of them before and
          after training to keep insulin spikes low. Your target is {target.kcal.toLocaleString()} kcal a day.
        </Text>
        <Text style={styles.label}>How many meals a day?</Text>
        <View style={styles.chips}>
          {Array.from({ length: MAX_MEALS - MIN_MEALS + 1 }, (_, i) => MIN_MEALS + i).map((n) => (
            <Pressable key={n} style={[styles.chip, count === n && styles.chipOn]} onPress={() => chooseCount(n)}>
              <Text style={[styles.chipText, count === n && styles.chipTextOn]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Meal times</Text>
        <View style={styles.times}>
          {times.slice(0, count).map((t, i) => (
            <TextInput
              key={i}
              style={styles.timeInput}
              value={t}
              onChangeText={(v) => setTimes(times.map((x, j) => (j === i ? v : x)))}
              placeholder="07:00"
              placeholderTextColor="#64748B"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          ))}
        </View>
        <Text style={styles.label}>When do you train?</Text>
        <View style={styles.times}>
          {trains && (
            <TextInput
              style={styles.timeInput}
              value={training}
              onChangeText={setTraining}
              placeholder="17:30"
              placeholderTextColor="#64748B"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          )}
          <Pressable style={[styles.chip, !trains && styles.chipOn]} onPress={() => setTrains(!trains)}>
            <Text style={[styles.chipText, !trains && styles.chipTextOn]}>I don't train</Text>
          </Pressable>
        </View>
        <View style={styles.buttons}>
          {plan && (
            <Pressable style={[styles.button, styles.secondary]} onPress={() => setEditing(false)}>
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>
          )}
          <Pressable style={[styles.button, styles.primary]} onPress={() => build(plan ? plan.variety + 1 : 0)} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>Make my plan</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  const day = dayKind === "training" ? plan.training_day : plan.rest_day;
  const swapTarget: DietItem | null = swapping ? day.meals[swapping.meal]?.items[swapping.index] ?? null : null;
  const pickSwap = (food: string) => {
    if (!swapping || !swapTarget) return;
    const meals = day.meals.map((m, mi) =>
      mi !== swapping.meal ? m : { ...m, items: m.items.map((it, ii) => (ii === swapping.index ? swapItem(it, food) : it)) },
    );
    save(dayKind === "training" ? { ...plan, training_day: { meals } } : { ...plan, rest_day: { meals } });
    setSwapping(null);
  };

  return (
    <View>
      {plan.settings.training && (
        <View style={styles.chips}>
          {(["training", "rest"] as const).map((k) => (
            <Pressable key={k} style={[styles.chip, styles.flex, dayKind === k && styles.chipOn]} onPress={() => setDayKind(k)}>
              <Text style={[styles.chipText, dayKind === k && styles.chipTextOn]}>{k === "training" ? "Training day" : "Rest day"}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <MealDayView day={day} targetKcal={plan.targets.kcal} onSwap={(meal, index) => setSwapping({ meal, index })} />
      <Text style={styles.note}>
        Weights are for the food as listed, for example cooked rice. Swap keeps the same protein, carbs or fat.
      </Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, styles.secondary]} onPress={() => setEditing(true)}>
          <Text style={styles.secondaryText}>Change my meals</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primary]} onPress={() => build(plan.variety + 1)} disabled={saving}>
          {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>New ideas</Text>}
        </Pressable>
      </View>

      <Modal visible={!!swapTarget} animationType="slide" transparent onRequestClose={() => setSwapping(null)}>
        <KeyboardSafe>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Swap {swapTarget?.food}</Text>
              <Text style={styles.helper}>Each option gives the same protein, carbs or fat.</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {swapTarget &&
                  swapOptions(swapTarget.food).map((f) => (
                    <Pressable key={f.name} style={styles.option} onPress={() => pickSwap(f.name)}>
                      <Text style={styles.optionName}>{f.name}</Text>
                      <Text style={styles.amount}>{amountLabel(swapItem(swapTarget, f.name))}</Text>
                    </Pressable>
                  ))}
              </ScrollView>
              <Pressable style={[styles.button, styles.secondary, { marginTop: 12 }]} onPress={() => setSwapping(null)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardSafe>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 8 },
  label: { color: "#fff", fontWeight: "700", marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: { backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignItems: "center" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700" },
  chipTextOn: { color: "#0F172A" },
  flex: { flex: 1 },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  timeInput: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, width: 72, textAlign: "center" },
  buttons: { flexDirection: "row", gap: 8, marginTop: 14 },
  button: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primary: { backgroundColor: BRAND_GOLD },
  primaryText: { color: "#0F172A", fontWeight: "800" },
  secondary: { backgroundColor: "#334155" },
  secondaryText: { color: "#fff", fontWeight: "700" },
  totals: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 8 },
  total: { color: "#fff", fontWeight: "800", fontSize: 15 },
  macros: { color: "#CBD5E1", fontSize: 12, marginTop: 4 },
  meal: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 8 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between" },
  mealName: { color: "#fff", fontWeight: "800" },
  mealKcal: { color: BRAND_GOLD, fontWeight: "700" },
  mealMacros: { color: "#94A3B8", fontSize: 12, marginBottom: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  item: { color: "#E2E8F0", fontSize: 14, flex: 1 },
  amount: { color: BRAND_GOLD, fontWeight: "700" },
  swap: { color: "#38BDF8", fontWeight: "700", fontSize: 13 },
  note: { color: "#64748B", fontSize: 12, marginTop: 4 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  option: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#334155", gap: 8 },
  optionName: { color: "#fff", fontSize: 14, flex: 1 },
});
