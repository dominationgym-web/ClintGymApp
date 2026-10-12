import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import KeyboardSafe from "@/components/KeyboardSafe";
import { amountLabel, bmr, dailyNeed, dailyTarget, dayTotals, intakeDetails, sumTotals, targetStatus, type DietDay, type DietItem } from "@/lib/dietPlan";
import {
  cleanTime,
  DEFAULT_TIMES,
  goalKcal,
  macroTargets,
  MEAL_GOALS,
  type MealGoal,
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
  // What the body uses a day (BMR times activity), the coach's own target if
  // they set one, and body weight for the protein.
  const [target, setTarget] = useState<{ bmr: number; need: number; coachKcal: number | null; weight: number } | null>(null);
  const [goal, setGoal] = useState<MealGoal>("maintain");
  const [explain, setExplain] = useState(false);
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
      const coachDetails = coach ? { ...coach, activity: Number(coach.activity) } : null;
      const coachKcal = coachDetails ? dailyTarget(coachDetails) : null;
      const intake = intakeDetails(client);
      const details = coachKcal && coachDetails ? coachDetails : intake.activity ? { ...intake, activity: intake.activity } : null;
      const need = details ? dailyNeed(details) : null;
      const base = details ? bmr(details) : null;
      const weight = details?.weight_kg;
      setTarget(need && base && weight ? { bmr: base, need, coachKcal, weight: Number(weight) } : null);
      if (coachKcal) setGoal("coach");
      if (mine?.settings?.meals?.length) {
        setPlan(mine);
        setCount(mine.settings.meals.length);
        setTimes(mine.settings.meals);
        setTrains(!!mine.settings.training);
        if (mine.settings.training) setTraining(mine.settings.training);
        if (mine.settings.goal) setGoal(mine.settings.goal);
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

  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.headerTitle}>Work out your own meal plan and diet based on your BMR and goals.</Text>
      <Pressable style={styles.help} onPress={() => setExplain(true)} accessibilityLabel="How it works" hitSlop={8}>
        <Text style={styles.helpText}>?</Text>
      </Pressable>
    </View>
  );
  const explainer = (
    <Modal visible={explain} animationType="slide" transparent onRequestClose={() => setExplain(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { maxHeight: "85%" }]}>
          <ScrollView>
            <Text style={styles.sheetTitle}>How it works</Text>
            <Text style={styles.explainHead}>1. Your BMR</Text>
            <Text style={styles.explain}>
              BMR is what your body burns at rest, just to keep you alive. The app works it out from your height, weight, age and
              sex, then adds your activity to get what your body uses in a day.
            </Text>
            <Text style={styles.explainHead}>2. Your goal</Text>
            <Text style={styles.explain}>
              • To lose weight, eat a bit less than your body uses. It then takes the difference from your stored fat.{"\n"}• To
              stay the same, eat what your body uses.{"\n"}• To build muscle, eat a bit more than your body uses, and train
              hard. The extra food gives your body what it needs to build new muscle.{"\n"}The app keeps your day under, on or
              over what you use, depending on the goal you pick.
            </Text>
            <Text style={styles.explainHead}>3. Your meals</Text>
            <Text style={styles.explain}>
              Pick how many meals you want and at what times, and when you train. The app builds your day from the foods in the
              app: plenty of protein, healthy fats and medium carbs. Most of the carbs go in the meal before training and the
              reload meal after it, when your body uses them best. Your other meals stay lower in carbs to keep insulin spikes
              small. You get a training-day plan and a rest-day plan.
            </Text>
            <Text style={styles.explainHead}>4. Don't like a food?</Text>
            <Text style={styles.explain}>
              Tap ⇄ Swap next to it and pick something you like. The app changes the weight so you still get the same amount of
              protein, carbs or fat. Tap New ideas for a fresh set of foods, or Change my meals to change your times or goal.
            </Text>
            <Text style={styles.explain}>Your coach can see your plan. If your coach makes you a diet plan, follow theirs first.</Text>
          </ScrollView>
          <Pressable style={[styles.button, styles.primary, { marginTop: 12, flex: 0 }]} onPress={() => setExplain(false)}>
            <Text style={styles.primaryText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

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
    const settings: MealPlanSettings = { meals: cleaned as string[], training: trainingTime, goal };
    const targets = macroTargets(goalKcal(target.need, goal, target.coachKcal), target.weight);
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
        {header}
        <Text style={styles.helper}>
          Your BMR is {target.bmr.toLocaleString()} kcal. With your activity your body uses about {target.need.toLocaleString()} kcal a
          day.
        </Text>
        <Text style={styles.label}>Your goal</Text>
        <View style={styles.chips}>
          {target.coachKcal && (
            <Pressable style={[styles.chip, goal === "coach" && styles.chipOn]} onPress={() => setGoal("coach")}>
              <Text style={[styles.chipText, goal === "coach" && styles.chipTextOn]}>My coach's target</Text>
            </Pressable>
          )}
          {MEAL_GOALS.map((g) => (
            <Pressable key={g.key} style={[styles.chip, goal === g.key && styles.chipOn]} onPress={() => setGoal(g.key)}>
              <Text style={[styles.chipText, goal === g.key && styles.chipTextOn]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>
          {goal === "coach"
            ? `${target.coachKcal?.toLocaleString()} kcal a day, as your coach set it.`
            : `${MEAL_GOALS.find((g) => g.key === goal)?.detail}: ${goalKcal(target.need, goal, target.coachKcal).toLocaleString()} kcal a day.`}
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
        {explainer}
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
      {header}
      {explainer}
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 15, flex: 1 },
  help: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  helpText: { color: "#0F172A", fontSize: 26, fontWeight: "900" },
  explainHead: { color: BRAND_GOLD, fontWeight: "800", marginTop: 12, marginBottom: 4 },
  explain: { color: "#E2E8F0", fontSize: 14, lineHeight: 21 },
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
