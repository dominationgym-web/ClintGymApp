import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import KeyboardSafe from "@/components/KeyboardSafe";
import {
  amountLabel,
  bmr,
  dailyNeed,
  dailyTarget,
  dayTotals,
  INTAKE_ACTIVITY_LEVELS,
  intakeDetails,
  REFERRAL_NOTE,
  referralReasons,
  sumTotals,
  targetStatus,
  type DietDay,
  type DietItem,
  type DietSex,
} from "@/lib/dietPlan";
import {
  cleanTime,
  goalKcal,
  macroTargets,
  MEAL_DIETS,
  MEAL_GOALS,
  mealTimesFor,
  TRAINING_TIMES,
  type MealDiet,
  type MealGoal,
  makeDay,
  MAX_MEALS,
  MIN_MEALS,
  leaveOutEverywhere,
  swapItem,
  swapOptions,
  whyFoodMatters,
  type MealPlanSettings,
} from "@/lib/mealPlanMaker";
import type { ClientMealPlan } from "@/types/database";

// Carbs and insulin, in line with the trainer guide (nutrition review,
// 2026-10-18): fat loss comes from the calorie deficit, not from cutting carbs.
const INSULIN_SPIKE =
  "When you eat carbs, your blood sugar goes up and your body releases insulin to move that sugar into your muscles and liver. That's normal and healthy. Insulin does slow fat burning for a few hours after a meal, but over weeks your fat loss depends on how much you eat in total, not on insulin. Studies that match calories find the same fat loss on lower-carb and higher-carb diets.";
const LOSE_CARBS =
  "Your plan is a calorie deficit: a bit less food than your body uses, so it takes the rest from stored fat. Protein, fibre and whole foods (vegetables, fruit, beans and lentils) keep you full, so the deficit is easier to stick to. If you prefer fewer carbs, swap some for protein or veg. That's fine, but it doesn't burn more fat when the calories are the same.";
const TIMED_CARBS =
  "Your carbs are timed around your training. Before training they give you energy, and after training your muscles use them to refuel and recover. Your other meals have a bit less carbs and more protein and veg. It's about energy for your sessions; your total calories are what decide fat loss or gain.";
const SNACK_SALT = "Biltong is high in salt, so go easier on it if you have high blood pressure.";

/** A day of meals, with Swap and Leave out on each food when `onSwap` / `onLeaveOut` are given. */
export function MealDayView({
  day,
  targetKcal,
  onSwap,
  onLeaveOut,
}: {
  day: DietDay;
  targetKcal: number | null;
  onSwap?: (meal: number, index: number) => void;
  onLeaveOut?: (meal: number, index: number) => void;
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
          Protein {totals.protein} g · Carbs {totals.carbs} g · Fat {totals.fat} g · Fibre {totals.fibre} g
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
                {onLeaveOut && (
                  <Pressable onPress={() => onLeaveOut(m, i)} hitSlop={8} accessibilityLabel={`Leave out ${item.food}`}>
                    <Text style={styles.leaveOut}>✕</Text>
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
// section. It walks them through a page at a time: their height, weight, age
// and activity, their goal, whether they want Daily Evolution to work out a
// plan, how many meals they eat and when they train, and whether they eat
// meat or dairy. Most carbs go around training. Every plan has a protein snack
// (biltong for meat eaters) with fruit. Tap Swap to change a food for another
// with the same protein, carbs or fat. Clients the intake says should see a
// doctor or dietitian first (see referralReasons) only get "Stay the same".
type Details = { height: string; weight: string; age: string; sex: DietSex | null; activity: string };

const STEPS = ["details", "goal", "offer", "meals", "diet"] as const;

const num = (text: string) => Number(text.replace(",", "."));

export default function MealPlanMaker() {
  const { client, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<ClientMealPlan | null>(null);
  const [coachKcal, setCoachKcal] = useState<number | null>(null);
  const [details, setDetails] = useState<Details>({ height: "", weight: "", age: "", sex: null, activity: "" });
  const [goal, setGoal] = useState<MealGoal>("maintain");
  const [diet, setDiet] = useState<MealDiet>("everything");
  const [dairyFree, setDairyFree] = useState(false);
  const [explain, setExplain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [declined, setDeclined] = useState(false);
  const [count, setCount] = useState(4);
  const [times, setTimes] = useState<string[]>(() => mealTimesFor(4, "17:30"));
  const [training, setTraining] = useState<string | null>("17:30");
  const [dayKind, setDayKind] = useState<"training" | "rest">("training");
  const [swapping, setSwapping] = useState<{ meal: number; index: number } | null>(null);
  // The food the client wants to leave out, while they're asked if they're sure.
  const [leaving, setLeaving] = useState<{ meal: number; index: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;
    Promise.all([
      supabase.from("client_meal_plans").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("client_diet_plans").select("*").eq("client_id", client.id).maybeSingle(),
    ]).then(([{ data: mine }, { data: coach }]) => {
      const coachDetails = coach ? { ...coach, activity: Number(coach.activity) } : null;
      const coachTarget = coachDetails ? dailyTarget(coachDetails) : null;
      setCoachKcal(coachTarget);
      // Fill in what we already know: the client's own answers first, then the coach's.
      const intake = intakeDetails(client);
      const pickNum = (a: number | null | undefined, b: number | null | undefined) => (a ?? b ?? "") === "" ? "" : String(a ?? b);
      const activity = intake.activity ?? (coachDetails?.activity && coachDetails.activity !== 1 ? coachDetails.activity : null);
      setDetails({
        height: pickNum(intake.height_cm, coachDetails?.height_cm),
        weight: pickNum(intake.weight_kg, coachDetails?.weight_kg),
        age: pickNum(intake.age, coachDetails?.age),
        sex: intake.sex ?? coachDetails?.sex ?? null,
        activity: INTAKE_ACTIVITY_LEVELS.find((a) => a.factor === activity)?.label ?? "",
      });
      if (coachTarget) setGoal("coach");
      if (mine?.settings?.meals?.length) {
        setPlan(mine);
        setCount(mine.settings.meals.length);
        setTimes(mine.settings.meals);
        setTraining(mine.settings.training);
        if (mine.settings.goal) setGoal(mine.settings.goal);
        if (mine.settings.diet) setDiet(mine.settings.diet);
        if (mine.settings.dairyFree) setDairyFree(true);
        if (!mine.settings.training) setDayKind("rest");
      } else {
        setEditing(true);
      }
      setLoading(false);
    });
  }, [client?.id]);

  if (loading) return <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 12 }} />;

  const factor = INTAKE_ACTIVITY_LEVELS.find((a) => a.label === details.activity)?.factor ?? null;
  const body = {
    height_cm: num(details.height),
    weight_kg: num(details.weight),
    age: num(details.age),
    sex: details.sex,
    activity: factor ?? 1,
  };
  const detailsOk =
    body.height_cm >= 100 && body.height_cm <= 250 && body.weight_kg >= 25 && body.weight_kg <= 400 && body.age >= 12 && body.age <= 100 && !!body.sex && !!factor;
  const base = detailsOk ? bmr(body) : null;
  const need = detailsOk ? dailyNeed(body) : null;
  // Diabetes, kidney disease, pregnancy, an eating disorder or under 18: no
  // calorie deficit (or surplus) until a doctor or dietitian says so.
  const referral = client ? referralReasons(client, detailsOk ? body.age : null) : [];
  const goals = referral.length ? MEAL_GOALS.filter((g) => g.key === "maintain") : MEAL_GOALS;
  const safeGoal: MealGoal = referral.length && goal !== "coach" ? "maintain" : goal;
  const kcalFor = (g: MealGoal) => (need ? goalKcal(need, g, coachKcal, { sex: body.sex, bmr: base }) : 0);
  const referralBox = referral.length ? (
    <View style={[styles.insulinBox, { borderLeftColor: "#F87171" }]}>
      <Text style={[styles.insulinTitle, { color: "#F87171" }]}>🩺 Check with a doctor or dietitian first</Text>
      <Text style={styles.insulinText}>
        Because of {referral.join(" and ")}, {REFERRAL_NOTE.charAt(0).toLowerCase() + REFERRAL_NOTE.slice(1)}
      </Text>
    </View>
  ) : null;

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
              • To lose fat, eat a bit less than your body uses. It then takes the difference from your stored fat.{"\n"}• To
              stay the same, eat what your body uses.{"\n"}• To build muscle, eat a bit more than your body uses, and train
              hard. The extra food gives your body what it needs to build new muscle.
            </Text>
            <Text style={styles.explainHead}>3. Carbs and insulin</Text>
            <Text style={styles.explain}>{INSULIN_SPIKE}</Text>
            <Text style={styles.explainHead}>4. Your carbs, protein and fibre</Text>
            <Text style={styles.explain}>
              • Most of the carbs go in the meal before training and the reload meal after it, when they fuel your session. You
              get a training-day plan and a rest-day plan.{"\n"}• Fat loss: protein is a bit higher, because it keeps you full
              and protects your muscle.{"\n"}• Every day has vegetables, a fruit, beans or lentils and (unless you're dairy-free)
              milk, yoghurt or cottage cheese, for at least 25 g of fibre.
            </Text>
            <Text style={styles.explainHead}>5. Your protein snack</Text>
            <Text style={styles.explain}>
              Every plan has a protein snack with a piece of fruit between meals to help you reach your protein. Lean biltong works
              really well, especially if you don't eat a lot. {SNACK_SALT} Vegetarians and pescatarians get Greek yoghurt instead.
            </Text>
            <Text style={styles.explainHead}>6. Don't like a food?</Text>
            <Text style={styles.explain}>
              Tap ⇄ Swap next to it and pick something you like. The app changes the weight so you still get the same amount of
              protein, carbs or fat. Or tap ✕ to leave it out: the app tells you why it's there, and can top up the other foods
              like it so you still get the same. Tap New ideas for a fresh set of foods, or Change my meals to change your details or goal.
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

  // Their height, weight, age and activity go on their profile too, so their
  // coach's diet planner has them.
  const saveDetails = async () => {
    if (!client) return false;
    const fail = (title: string, message: string) => {
      Alert.alert(title, message);
      return false;
    };
    if (!(body.height_cm >= 100 && body.height_cm <= 250)) return fail("Your height", "Type your height in centimetres, for example 165.");
    if (!(body.weight_kg >= 25 && body.weight_kg <= 400)) return fail("Your weight", "Type your weight in kilograms, for example 68.");
    if (!(body.age >= 12 && body.age <= 100)) return fail("Your age", "Type your age in years, for example 34.");
    if (!body.sex) return fail("Male or female?", "Tap the one that fits you. It changes your BMR.");
    if (!factor) return fail("How active are you?", "Tap the option that fits you best.");
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({
        ...(client.sex ? {} : { sex: body.sex }),
        intake_responses: {
          ...(client.intake_responses ?? {}),
          height_cm: String(body.height_cm),
          weight_kg: String(body.weight_kg),
          age: String(body.age),
          activity_level: details.activity,
        },
      })
      .eq("id", client.id);
    setSaving(false);
    if (error) return fail("Couldn't save your details", error.message);
    refreshProfile();
    return true;
  };

  const build = (variety: number) => {
    if (!client || !need) return;
    const cleaned = times.slice(0, count).map(cleanTime);
    if (cleaned.some((t) => !t)) return Alert.alert("Meal times", "Type each time like 07:00 or 13:30.");
    // Foods they left out stay out of every new plan.
    const settings: MealPlanSettings = { meals: cleaned as string[], training, goal: safeGoal, diet, dairyFree, avoid: plan?.settings.avoid ?? [] };
    const targets = macroTargets(kcalFor(safeGoal), body.weight_kg, safeGoal, body.height_cm);
    save({
      client_id: client.id,
      settings,
      targets,
      training_day: makeDay(settings, targets, true, variety),
      rest_day: makeDay(settings, targets, false, variety),
      variety,
      updated_at: new Date().toISOString(),
    });
    setDayKind(training ? "training" : "rest");
    setEditing(false);
  };

  const chooseMeals = (n: number, trainAt: string | null) => {
    setCount(n);
    setTraining(trainAt);
    setTimes(mealTimesFor(n, trainAt));
  };

  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <Pressable key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  if (editing || !plan) {
    const page = STEPS[step];
    const next = async () => {
      if (page === "details" && !(await saveDetails())) return;
      if (page === "diet") return build(plan ? plan.variety + 1 : 0);
      setStep(step + 1);
    };
    const back = () => (step > 0 ? setStep(step - 1) : plan ? setEditing(false) : null);

    if (declined) {
      return (
        <View>
          {header}
          {explainer}
          <Text style={styles.helper}>
            No problem. Your body uses about {need?.toLocaleString()} kcal a day
            {safeGoal === "lose" ? ", so aim a bit under that to lose fat" : safeGoal === "gain" ? ", so aim a bit over that to build muscle" : ""}.
            Come back here any time and Daily Evolution will work out a meal plan for you.
          </Text>
          <Pressable style={[styles.button, styles.primary, { flex: 0, marginTop: 8 }]} onPress={() => { setDeclined(false); setStep(3); }}>
            <Text style={styles.primaryText}>Work out my meal plan</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View>
        {header}
        {explainer}
        <Text style={styles.stepCount}>Step {step + 1} of {STEPS.length}</Text>

        {page === "details" && (
          <View>
            <Text style={styles.label}>About you</Text>
            <View style={styles.detailRow}>
              {([["height", "Height (cm)", "165"], ["weight", "Weight (kg)", "68"], ["age", "Age", "34"]] as const).map(([key, label, hint]) => (
                <View key={key} style={styles.detailBox}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <TextInput
                    style={styles.detailInput}
                    value={details[key]}
                    onChangeText={(v) => setDetails({ ...details, [key]: v })}
                    placeholder={hint}
                    placeholderTextColor="#64748B"
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                </View>
              ))}
            </View>
            {!client?.sex && (
              <View style={styles.chips}>
                {chip(details.sex === "female", "Female", () => setDetails({ ...details, sex: "female" }))}
                {chip(details.sex === "male", "Male", () => setDetails({ ...details, sex: "male" }))}
              </View>
            )}
            <Text style={styles.label}>How active are you?</Text>
            <View style={styles.chips}>
              {INTAKE_ACTIVITY_LEVELS.map((a) => chip(details.activity === a.label, a.label, () => setDetails({ ...details, activity: a.label })))}
            </View>
            {details.activity ? <Text style={styles.note}>{INTAKE_ACTIVITY_LEVELS.find((a) => a.label === details.activity)?.detail}</Text> : null}
            {base && need ? (
              <Text style={[styles.helper, { marginTop: 8 }]}>
                Your BMR is {base.toLocaleString()} kcal. With your activity your body uses about {need.toLocaleString()} kcal a day.
              </Text>
            ) : null}
          </View>
        )}

        {page === "goal" && (
          <View>
            <Text style={styles.label}>Do you want to lose fat, build muscle or stay the same?</Text>
            <View style={styles.chips}>
              {coachKcal ? chip(goal === "coach", "My coach's target", () => setGoal("coach")) : null}
              {goals.map((g) => chip(safeGoal === g.key, g.label, () => setGoal(g.key), g.key))}
            </View>
            {need ? (
              <Text style={styles.note}>
                {safeGoal === "coach"
                  ? `${coachKcal?.toLocaleString()} kcal a day, as your coach set it.`
                  : `${MEAL_GOALS.find((g) => g.key === safeGoal)?.detail}: ${kcalFor(safeGoal).toLocaleString()} kcal a day.`}
                {safeGoal === "lose" && need && kcalFor("lose") >= need ? " That's already the lowest safe amount for you, so the plan keeps you here." : ""}
              </Text>
            ) : null}
            {referralBox}
            <View style={styles.insulinBox}>
              <Text style={styles.insulinTitle}>{safeGoal === "lose" ? "📉 How you lose fat" : "⏱️ Carbs timed around training"}</Text>
              <Text style={styles.insulinText}>{safeGoal === "lose" ? LOSE_CARBS : TIMED_CARBS}</Text>
            </View>
          </View>
        )}

        {page === "offer" && (
          <View>
            <Text style={styles.bigQuestion}>Would you like Daily Evolution to work out a meal plan for you?</Text>
            <Text style={styles.helper}>It takes a few taps: how many meals you eat, when you train and what you eat.</Text>
            <View style={styles.buttons}>
              <Pressable style={[styles.button, styles.secondary]} onPress={() => setDeclined(true)}>
                <Text style={styles.secondaryText}>Not now</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.primary]} onPress={() => setStep(step + 1)}>
                <Text style={styles.primaryText}>Yes please</Text>
              </Pressable>
            </View>
            <Pressable onPress={back} style={{ marginTop: 12 }}>
              <Text style={styles.backLink}>‹ Back</Text>
            </Pressable>
          </View>
        )}

        {page === "meals" && (
          <View>
            <Text style={styles.label}>How many meals do you tend to eat in a day?</Text>
            <View style={styles.chips}>
              {Array.from({ length: MAX_MEALS - MIN_MEALS + 1 }, (_, i) => MIN_MEALS + i).map((n) =>
                chip(count === n, String(n), () => chooseMeals(n, training)),
              )}
            </View>
            <Text style={styles.note}>Plus a protein snack, which the app adds for you.</Text>
            <Text style={styles.label}>When do you train?</Text>
            <View style={styles.chips}>
              {TRAINING_TIMES.map((t) => chip(training === t.time, t.label, () => chooseMeals(count, t.time), t.key))}
              {chip(training === null, "I don't train", () => chooseMeals(count, null))}
            </View>
            <Text style={styles.label}>Your meal times</Text>
            <Text style={styles.note}>Set around your training. Tap a time to change it.</Text>
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
          </View>
        )}

        {page === "diet" && (
          <View>
            <Text style={styles.label}>What do you eat?</Text>
            {MEAL_DIETS.map((d) => (
              <Pressable key={d.key} style={[styles.dietOption, diet === d.key && styles.dietOptionOn]} onPress={() => setDiet(d.key)}>
                <Text style={[styles.dietLabel, diet === d.key && styles.chipTextOn]}>{d.label}</Text>
                <Text style={[styles.note, { marginTop: 2 }, diet === d.key && styles.chipTextOn]}>{d.detail}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Milk, yoghurt and cheese?</Text>
            <View style={styles.chips}>
              {chip(!dairyFree, "I have dairy", () => setDairyFree(false))}
              {chip(dairyFree, "No dairy (lactose or allergy)", () => setDairyFree(true))}
            </View>
          </View>
        )}

        {page !== "offer" && (
          <View style={styles.buttons}>
            {(step > 0 || plan) && (
              <Pressable style={[styles.button, styles.secondary]} onPress={back}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
            )}
            <Pressable style={[styles.button, styles.primary]} onPress={next} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.primaryText}>{page === "diet" ? "Make my plan" : "Next"}</Text>
              )}
            </Pressable>
          </View>
        )}
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

  const leaveTarget: DietItem | null = leaving ? day.meals[leaving.meal]?.items[leaving.index] ?? null : null;
  // Leaving a food out takes it off both days and out of every new plan, and
  // the other foods make up what it gave (GRIZZ, 2026-10-22).
  const leaveOut = () => {
    if (!leaving || !leaveTarget) return;
    const food = leaveTarget.food;
    const training = leaveOutEverywhere(plan.training_day, food);
    const rest = leaveOutEverywhere(plan.rest_day, food);
    const avoid = [...new Set([...(plan.settings.avoid ?? []), food])];
    save({ ...plan, settings: { ...plan.settings, avoid }, training_day: training.day, rest_day: rest.day });
    setLeaving(null);
    const current = dayKind === "training" ? training : rest;
    if (!current.rebalanced) {
      Alert.alert("Left out", `Nothing else on this day gives what ${food} did, so it's a little lower now. Tap New ideas for a fresh plan without it.`);
    }
  };
  const putBack = (food: string) => {
    const avoid = (plan.settings.avoid ?? []).filter((f) => f !== food);
    save({ ...plan, settings: { ...plan.settings, avoid } });
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
      {referralBox}
      <MealDayView
        day={day}
        targetKcal={plan.targets.kcal}
        onSwap={(meal, index) => setSwapping({ meal, index })}
        onLeaveOut={(meal, index) => setLeaving({ meal, index })}
      />
      {(plan.settings.avoid ?? []).length > 0 && (
        <View style={styles.avoidBox}>
          <Text style={styles.avoidTitle}>You don't eat (left out of every plan)</Text>
          <View style={styles.chips}>
            {(plan.settings.avoid ?? []).map((f) => (
              <Pressable key={f} style={styles.avoidChip} onPress={() => putBack(f)} accessibilityLabel={`Put ${f} back`}>
                <Text style={styles.avoidText}>{f}  ↩</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.avoidHint}>Tap one to allow it again. It comes back next time you tap New ideas.</Text>
        </View>
      )}
      <View style={styles.insulinBox}>
        <Text style={styles.insulinTitle}>{plan.settings.goal === "lose" ? "📉 How you lose fat" : "⏱️ Why the carbs are where they are"}</Text>
        <Text style={styles.insulinText}>{plan.settings.goal === "lose" ? LOSE_CARBS : TIMED_CARBS}</Text>
      </View>
      <Text style={styles.note}>
        Weights are for the food as listed, for example cooked rice. Swap keeps the same protein, carbs or fat. Tap ✕ to leave a food out. {SNACK_SALT}
      </Text>
      <View style={styles.buttons}>
        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={() => {
            setStep(0);
            setEditing(true);
          }}
        >
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
                  swapOptions(swapTarget.food, plan.settings.diet, plan.settings.dairyFree).map((f) => (
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

      <Modal visible={!!leaveTarget} animationType="slide" transparent onRequestClose={() => setLeaving(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Leave out {leaveTarget?.food}?</Text>
            <Text style={styles.explainHead}>Why it's in your plan</Text>
            <Text style={styles.explain}>{leaveTarget ? whyFoodMatters(leaveTarget.food) : ""}</Text>
            <Text style={[styles.helper, { marginTop: 12 }]}>
              If you leave it out, the other foods go up to give you the same, and it stays out of your plan, on training and rest days and in New ideas.
            </Text>
            <Pressable style={[styles.button, styles.primary, styles.stacked]} onPress={leaveOut} disabled={saving}>
              <Text style={styles.primaryText}>Leave it out</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondary, styles.stacked]}
              onPress={() => {
                const target = leaving;
                setLeaving(null);
                // iPhones won't open a sheet while another is still closing.
                setTimeout(() => setSwapping(target), 400);
              }}
            >
              <Text style={styles.secondaryText}>⇄ Swap it for something else</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondary, styles.stacked]} onPress={() => setLeaving(null)}>
              <Text style={styles.secondaryText}>Keep it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stacked: { flex: 0, marginTop: 10 },
  avoidBox: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginTop: 8 },
  avoidTitle: { color: "#fff", fontWeight: "700", marginBottom: 6 },
  avoidChip: { backgroundColor: "#334155", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  avoidText: { color: "#E2E8F0", fontWeight: "600", fontSize: 13 },
  avoidHint: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  leaveOut: { color: "#F87171", fontWeight: "800", fontSize: 15, marginLeft: 14 },
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
  stepCount: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  detailRow: { flexDirection: "row", gap: 8 },
  detailBox: { flex: 1 },
  detailLabel: { color: "#94A3B8", fontSize: 12, marginBottom: 4 },
  detailInput: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, textAlign: "center", fontSize: 16 },
  bigQuestion: { color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 25, marginVertical: 8 },
  backLink: { color: "#94A3B8", fontWeight: "700" },
  insulinBox: { backgroundColor: "#0F172A", borderRadius: 10, borderLeftWidth: 3, borderLeftColor: BRAND_GOLD, padding: 12, marginTop: 10 },
  insulinTitle: { color: BRAND_GOLD, fontWeight: "800", marginBottom: 4 },
  insulinText: { color: "#E2E8F0", fontSize: 13, lineHeight: 19 },
  dietOption: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 8 },
  dietOptionOn: { backgroundColor: BRAND_GOLD },
  dietLabel: { color: "#fff", fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  option: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#334155", gap: 8 },
  optionName: { color: "#fff", fontSize: 14, flex: 1 },
});
