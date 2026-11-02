import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { foodUnits, searchFoods, type FoodUnit } from "@/lib/foods";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { CookingIdeasLink } from "@/components/ProteinCookingIdeas";
import KeyboardSafe from "@/components/KeyboardSafe";
import ShoppingListSheet from "@/components/ShoppingListSheet";
import { trainingDaysGuess } from "@/lib/shoppingList";
import { useMealTicks } from "@/hooks/useMealTicks";
import { tickedSource } from "@/lib/mealTicks";
import { todayIso } from "@/lib/dates";
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
  findFood,
  normaliseWeek,
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
  MAX_SNACKS,
  snackTimes,
  snackTimesFor,
  MIN_MEALS,
  isSnack,
  keepOwnMeals,
  leaveOutEverywhere,
  mealPlace,
  swapItem,
  swapOptions,
  whyFoodMatters,
  type MealPlanSettings,
} from "@/lib/mealPlanMaker";
import type { Client, ClientMealPlan } from "@/types/database";
import { themeBorder, themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";
import { intakeTrainingDays } from "@/lib/intakePages";
import { adaptPlan } from "@/lib/mealAdapt";
import {
  defaultTrainDays,
  makeWeek,
  readTaste,
  readWeek,
  tasteLeaveOut,
  tasteOwnMeal,
  tastePutBack,
  tasteSwap,
  trainsOn,
  WEEK_DAY_NAMES,
  WEEK_DAYS,
  weekdayOf,
  weekIsOld,
  weekStart,
  type Taste,
} from "@/lib/mealWeek";

// Carbs and insulin, in line with the trainer guide (nutrition review,
// 2026-10-18): fat loss comes from the calorie deficit, not from cutting carbs.
const INSULIN_SPIKE =
  "When you eat carbs, your blood sugar goes up and your body releases insulin to move that sugar into your muscles and liver. That's normal and healthy. Insulin does slow fat burning for a few hours after a meal, but over weeks your fat loss depends on how much you eat in total, not on insulin. Studies that match calories find the same fat loss on lower-carb and higher-carb diets.";
const LOSE_CARBS =
  "Your plan is a calorie deficit: a bit less food than your body uses, so it takes the rest from stored fat. Protein, fibre and whole foods (vegetables, fruit, beans and lentils) keep you full, so the deficit is easier to stick to. If you prefer fewer carbs, swap some for protein or veg. That's fine, but it doesn't burn more fat when the calories are the same.";
const TIMED_CARBS =
  "Your carbs are timed around your training. Before training they give you energy, and after training your muscles use them to refuel and recover. Your other meals have a bit less carbs and more protein and veg. It's about energy for your sessions; your total calories are what decide fat loss or gain.";
const SNACK_SALT = "Biltong is high in salt, so go easier on it if you have high blood pressure.";

// What the client gets when the trainer taps Tell them (a coach message, 0034).
export const MEAL_PLAN_READY_MESSAGE = "Your meal plan is ready. Open Menu ☰ → My meal plan to see it. Swap any food you don't like. 🥗";

/**
 * A day of meals, with Swap and Leave out on each food when `onSwap` /
 * `onLeaveOut` are given, "Put in my own" on each meal with `onOwnMeal`, and
 * a tick box on each meal with `tick` (meal ticking, 0165).
 */
export function MealDayView({
  day,
  targetKcal,
  onSwap,
  onLeaveOut,
  onOwnMeal,
  tick,
  coachView,
}: {
  day: DietDay;
  targetKcal: number | null;
  onSwap?: (meal: number, index: number) => void;
  onLeaveOut?: (meal: number, index: number) => void;
  onOwnMeal?: (meal: number) => void;
  tick?: MealTickProps;
  /** Seen by the trainer: "their" own meal, not "your". */
  coachView?: boolean;
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
            {tick && meal.items.length > 0 && <MealTickButton on={tick.isTicked(m)} onPress={() => tick.onTick(m)} />}
            <Text style={styles.mealMacros}>
              P {t.protein} g · C {t.carbs} g · F {t.fat} g
            </Text>
            {meal.own && <Text style={styles.ownTag}>⭐ {coachView ? "Their" : "Your"} own meal, the same every day</Text>}
            {meal.items.length === 0 && !meal.own && onOwnMeal && (
              <View style={styles.emptyMeal}>
                <Text style={styles.helper}>Nothing left in this meal. Do you eat the same thing every day? Put in what you eat and the app balances the rest of your day around it.</Text>
                <Pressable style={[styles.button, styles.primary, styles.stacked]} onPress={() => onOwnMeal(m)}>
                  <Text style={styles.primaryText}>+ Put in what I eat</Text>
                </Pressable>
              </View>
            )}
            {meal.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.item}>
                  • {item.food}: <Text style={styles.amount}>{amountLabel(item)}</Text>
                </Text>
                <CookingIdeasLink food={item.food} />
                {onSwap && !meal.own && (
                  <Pressable onPress={() => onSwap(m, i)} hitSlop={8}>
                    <Text style={styles.swap}>⇄ Swap</Text>
                  </Pressable>
                )}
                {onLeaveOut && !meal.own && (
                  <Pressable onPress={() => onLeaveOut(m, i)} hitSlop={8} accessibilityLabel={`Leave out ${item.food}`}>
                    <Text style={styles.leaveOut}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {onOwnMeal && !isSnack(meal) && (meal.own || meal.items.length > 0) && (
              <Pressable onPress={() => onOwnMeal(m)} hitSlop={8} style={{ marginTop: 8 }}>
                <Text style={styles.ownLink}>{meal.own ? "✎ Change my meal" : "✎ Put in my own meal instead"}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

export type MealTickProps = { isTicked: (meal: number) => boolean; onTick: (meal: number) => void };

// "I ate this": ticks the meal off today's plan (0165).
export function MealTickButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.tick, on && styles.tickOn]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel="I ate this meal"
    >
      <Text style={[styles.tickText, on && styles.tickTextOn]}>{on ? "✓ Ate it today" : "☐ Tick when you've eaten it"}</Text>
    </Pressable>
  );
}

// The meal plan maker (GRIZZ, 2026-10-12). Since 2026-11-02 the trainer works
// the plan out on the client's Diet tab ("the trainer has control of the meal
// planning"): a page at a time, the client's height, weight, age and activity,
// their goal, how many meals they eat and when they train, and whether they
// eat meat or dairy. Most carbs go around training. Every plan has a protein
// snack (biltong for meat eaters) with fruit. Clients the intake says should
// see a doctor or dietitian first (see referralReasons) only get "Stay the
// same".
//
// The client sees the plan under Nutrition → Your meal plan from your coach,
// and can still Swap a food for another with the same protein, carbs or fat,
// leave foods out, put in their own meal, tick meals and make a shopping
// list. They no longer work the plan out themselves.
type Details = { height: string; weight: string; age: string; sex: DietSex | null; activity: string };

// A food in the client's own meal while they type it: an amount in the food's
// handiest measure (eggs, slices, grams).
type OwnRow = { food: string; amount: string; unit: FoodUnit };

const ownRow = (item: DietItem): OwnRow => {
  const food = findFood(item.food);
  const units = food ? foodUnits(food) : [{ label: "g", grams: 1 }];
  // Whole or half eggs, slices and so on read easier than grams.
  const unit = units.find((u) => u.grams > 1 && Number.isInteger((item.grams / u.grams) * 2)) ?? units[units.length - 1];
  return { food: item.food, amount: String(Math.round((item.grams / unit.grams) * 10) / 10), unit };
};

const ownGrams = (row: OwnRow) => Math.round(num(row.amount) * row.unit.grams);

const STEPS = ["details", "goal", "meals", "diet"] as const;

const num = (text: string) => Number(text.replace(",", "."));

/** The trainer making the plan for one of their clients (Diet tab). */
export type MealPlanForTrainer = { client: Client; trainerId: string; onDetailsSaved?: () => void };

export default function MealPlanMaker({ forTrainer }: { forTrainer?: MealPlanForTrainer } = {}) {
  const auth = useAuth();
  const coachMode = !!forTrainer;
  const client = forTrainer?.client ?? auth.client;
  const refreshProfile = forTrainer?.onDetailsSaved ?? auth.refreshProfile;
  const first = client?.name?.trim().split(/\s+/)[0] || "your client";
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
  // Phone Back closes what is open first, one step at a time.
  useStepBack(step > 0, () => setStep((s) => Math.max(0, s - 1)));
  // The trainer told the client this version of the plan is ready.
  const [told, setTold] = useState(false);
  const [telling, setTelling] = useState(false);
  // The trainer's diet planner week, which the client sees first while it has meals.
  const [coachWeek, setCoachWeek] = useState(false);
  const [count, setCount] = useState(4);
  const [times, setTimes] = useState<string[]>(() => mealTimesFor(4, "17:30"));
  const [training, setTraining] = useState<string | null>("17:30");
  // Snack times: none, one or two (GRIZZ, 2026-11-02: "some people only eat twice a day with maybe 1 snack").
  const [snacks, setSnacks] = useState<string[]>(() => snackTimesFor(mealTimesFor(4, "17:30"), 1, "17:30"));
  const [dayKind, setDayKind] = useState<"training" | "rest">("training");
  // Today's ticked meals (0165). The plan opens on the day they've been ticking.
  const mealTicks = useMealTicks(coachMode ? undefined : client?.id);
  const tickedKind = tickedSource(mealTicks.ticks, todayIso());
  useEffect(() => {
    if (tickedKind === "training" || tickedKind === "rest") setDayKind(tickedKind);
  }, [tickedKind]);
  const [swapping, setSwapping] = useState<{ meal: number; index: number } | null>(null);
  // The food the client wants to leave out, while they're asked if they're sure.
  const [leaving, setLeaving] = useState<{ meal: number; index: number } | null>(null);
  const [saving, setSaving] = useState(false);
  // The meal the client is putting their own foods in, by its place in the day.
  const [ownMeal, setOwnMeal] = useState<{ place: number; name: string } | null>(null);
  const [ownDraft, setOwnDraft] = useState<OwnRow[]>([]);
  const [ownSearch, setOwnSearch] = useState("");
  const [shopping, setShopping] = useState(false);
  // A week at a time (GRIZZ, 2026-11-02): a different plan each day, and the days they train.
  const [weekly, setWeekly] = useState(false);
  const [trainDays, setTrainDays] = useState<number[]>([]);
  const [weekDay, setWeekDay] = useState(() => weekdayOf(todayIso()));
  // Making the plan again around what they like, and what came of it.
  const [adapting, setAdapting] = useState(false);
  const [newWeek, setNewWeek] = useState(false);

  useEffect(() => {
    if (!client) return;
    Promise.all([
      supabase.from("client_meal_plans").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("client_diet_plans").select("*").eq("client_id", client.id).maybeSingle(),
    ]).then(([{ data: mine }, { data: coach }]) => {
      const coachDetails = coach ? { ...coach, activity: Number(coach.activity) } : null;
      const coachTarget = coachDetails ? dailyTarget(coachDetails) : null;
      setCoachKcal(coachTarget);
      setCoachWeek(!!coach && normaliseWeek(coach.days).some((d) => d.meals.some((m) => m.items.length > 0)));
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
        setSnacks(snackTimes(mine.settings));
        setTraining(mine.settings.training);
        if (mine.settings.goal) setGoal(mine.settings.goal);
        if (mine.settings.diet) setDiet(mine.settings.diet);
        if (mine.settings.dairyFree) setDairyFree(true);
        if (!mine.settings.training) setDayKind("rest");
        setWeekly(!!mine.settings.weekly);
        setTrainDays(mine.settings.trainDays ?? defaultTrainDays(intakeTrainingDays(client.intake_responses as Record<string, string> | null)));
      } else if (coachMode) {
        setTrainDays(defaultTrainDays(intakeTrainingDays(client.intake_responses as Record<string, string> | null)));
        setEditing(true);
      }
      setLoading(false);
      // A new week: next week's plan, adapted to what they like (GRIZZ,
      // 2026-11-02: "make changes over time accordingly").
      const today = todayIso();
      if (mine?.settings?.weekly && (weekIsOld(readWeek(mine.week), today) || !readWeek(mine.week))) {
        setAdapting(true);
        adaptPlan(mine, client.name?.trim().split(/\s+/)[0] || "your client", today)
          .then(({ plan: next }) => supabase.from("client_meal_plans").upsert(next).then(({ error }) => {
            if (!error) {
              setPlan(next);
              setNewWeek(true);
            }
          }))
          .finally(() => setAdapting(false));
      }
    });
  }, [client?.id]);

  if (loading) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 12 }} />;

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
    <View style={[styles.insulinBox, { borderLeftColor: themeBorder("#F87171") }]}>
      <Text style={[styles.insulinTitle, { color: themeText("#F87171") }]}>🩺 Check with a doctor or dietitian first</Text>
      <Text style={styles.insulinText}>
        Because of {referral.join(" and ")}, {REFERRAL_NOTE.charAt(0).toLowerCase() + REFERRAL_NOTE.slice(1)}
      </Text>
    </View>
  ) : null;

  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.headerTitle}>
        {coachMode
          ? `Made from ${first}'s BMR and goal. ${first} can swap foods, leave foods out and put in their own meals.`
          : "Your coach worked out this plan for you. Swap or leave out any food, or put in your own meal."}
      </Text>
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
            <Text style={styles.explainHead}>A week at a time</Text>
            <Text style={styles.explain}>
              A weekly plan has different meals for each day, Monday to Sunday, with more carbs on training days (marked ●). Every
              food swapped in, left out or put in an own meal teaches the plan what they like, and each new week is made again
              around those foods. The AI reads the choices and picks more of what they enjoy, and the app's maths keeps the
              calories, protein, carbs and fat on target.
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
              Unless your coach set no snacks, your day has a protein snack with a piece of fruit between meals to help you reach your
              protein (a second snack is fruit with a few nuts). Lean biltong works
              really well, especially if you don't eat a lot. {SNACK_SALT} Vegetarians and pescatarians get Greek yoghurt instead.
            </Text>
            <Text style={styles.explainHead}>6. Don't like a food?</Text>
            <Text style={styles.explain}>
              Tap ⇄ Swap next to it and pick something you like. The app changes the weight so you still get the same amount of
              protein, carbs or fat. Or tap ✕ to leave it out: the app tells you why it's there, and can top up the other foods
              like it so you still get the same. Eat the same breakfast (or any meal) every day? Tap Put in my own meal and add what you eat: the app keeps it and balances the
              rest of your day around it.{coachMode ? " Tap New ideas for a fresh set of foods, or Change meals to change the details or goal." : ""}
            </Text>
            <Text style={styles.explain}>
              {coachMode
                ? `You work the plan out; ${first} sees it under Nutrition and can swap foods, leave foods out and put in their own meals. You see every change here.`
                : "Your coach worked this plan out for you and sees any change you make. Want a different goal or meal times? Ask your coach."}
            </Text>
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
    if (error) Alert.alert("Couldn't save the plan", error.message);
    else setTold(false);
  };

  // Tells the client their plan is ready, as a coach message: a phone
  // notification and a card on their Check-in, like Save and tell for workouts.
  const tell = async () => {
    if (!client || !forTrainer) return;
    setTelling(true);
    const { error } = await supabase
      .from("coach_messages")
      .insert({ client_id: client.id, trainer_id: forTrainer.trainerId, body: MEAL_PLAN_READY_MESSAGE });
    setTelling(false);
    if (error) return Alert.alert(`Couldn't tell ${first}`, error.message);
    setTold(true);
  };

  // Their height, weight, age and activity go on their profile too, so their
  // coach's diet planner has them.
  const saveDetails = async () => {
    if (!client) return false;
    const fail = (title: string, message: string) => {
      Alert.alert(title, message);
      return false;
    };
    if (!(body.height_cm >= 100 && body.height_cm <= 250)) return fail("Height", "Type the height in centimetres, for example 165.");
    if (!(body.weight_kg >= 25 && body.weight_kg <= 400)) return fail("Weight", "Type the weight in kilograms, for example 68.");
    if (!(body.age >= 12 && body.age <= 100)) return fail("Age", "Type the age in years, for example 34.");
    if (!body.sex) return fail("Male or female?", "Tap the one that fits. It changes the BMR.");
    if (!factor) return fail("How active?", "Tap the option that fits best.");
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
    if (error) return fail("Couldn't save the details", error.message);
    refreshProfile();
    return true;
  };

  const build = (variety: number) => {
    if (!client || !need) return;
    const cleaned = times.slice(0, count).map(cleanTime);
    if (cleaned.some((t) => !t)) return Alert.alert("Meal times", "Type each time like 07:00 or 13:30.");
    const snackAt = snacks.map(cleanTime);
    if (snackAt.some((t) => !t)) return Alert.alert("Snack times", "Type each time like 10:30 or 15:30.");
    // Foods they left out stay out of every new plan.
    // Their own meals stay too, for the meals the day still has.
    const ownMeals = keepOwnMeals(plan?.settings.ownMeals, cleaned.length);
    if (weekly && training && !trainDays.length) return Alert.alert("Training days", `Tap the days ${first} trains.`);
    const settings: MealPlanSettings = {
      meals: cleaned as string[],
      training,
      goal: safeGoal,
      diet,
      dairyFree,
      avoid: plan?.settings.avoid ?? [],
      ownMeals,
      trainingDays: weekly && training ? trainDays.length : plan?.settings.trainingDays,
      likes: plan?.settings.likes ?? [],
      weekly,
      trainDays: [...trainDays].sort(),
      snacks: snackAt as string[],
    };
    const targets = macroTargets(kcalFor(safeGoal), body.weight_kg, safeGoal, body.height_cm);
    save({
      client_id: client.id,
      settings,
      targets,
      training_day: makeDay(settings, targets, true, variety),
      rest_day: makeDay(settings, targets, false, variety),
      week: weekly ? makeWeek(settings, targets, variety, weekStart(todayIso())) : {},
      taste: plan?.taste ?? {},
      variety,
      updated_at: new Date().toISOString(),
    });
    setDayKind(training ? "training" : "rest");
    setEditing(false);
  };

  const chooseMeals = (n: number, trainAt: string | null) => {
    setCount(n);
    setTraining(trainAt);
    const next = mealTimesFor(n, trainAt);
    setTimes(next);
    setSnacks(snackTimesFor(next, snacks.length, trainAt));
  };

  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <Pressable key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  if (!coachMode && !plan) {
    return (
      <Text style={styles.helper}>
        Your coach hasn't worked out your meal plan yet. When they do, it shows here, and you can swap any food you don't like, leave
        foods out and put in your own meals.
      </Text>
    );
  }

  if (editing || !plan) {
    const page = STEPS[step];
    const next = async () => {
      if (page === "details" && !(await saveDetails())) return;
      if (page === "diet") return build(plan ? plan.variety + 1 : 0);
      setStep(step + 1);
    };
    const back = () => (step > 0 ? setStep(step - 1) : plan ? setEditing(false) : null);

    return (
      <View>
        {header}
        {explainer}
        <Text style={styles.stepCount}>Step {step + 1} of {STEPS.length}</Text>

        {page === "details" && (
          <View>
            <Text style={styles.label}>About {first}</Text>
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
            <Text style={styles.label}>How active is {first}?</Text>
            <View style={styles.chips}>
              {INTAKE_ACTIVITY_LEVELS.map((a) => chip(details.activity === a.label, a.label, () => setDetails({ ...details, activity: a.label })))}
            </View>
            {details.activity ? <Text style={styles.note}>{INTAKE_ACTIVITY_LEVELS.find((a) => a.label === details.activity)?.detail}</Text> : null}
            {base && need ? (
              <Text style={[styles.helper, { marginTop: 8 }]}>
                {first}'s BMR is {base.toLocaleString()} kcal. With their activity their body uses about {need.toLocaleString()} kcal a day.
              </Text>
            ) : null}
          </View>
        )}

        {page === "goal" && (
          <View>
            <Text style={styles.label}>Does {first} want to lose fat, build muscle or stay the same?</Text>
            <View style={styles.chips}>
              {coachKcal ? chip(goal === "coach", "Your diet planner target", () => setGoal("coach")) : null}
              {goals.map((g) => chip(safeGoal === g.key, g.label, () => setGoal(g.key), g.key))}
            </View>
            {need ? (
              <Text style={styles.note}>
                {safeGoal === "coach"
                  ? `${coachKcal?.toLocaleString()} kcal a day, as you set it in the diet planner.`
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

        {page === "meals" && (
          <View>
            <Text style={styles.label}>Plan for</Text>
            <View style={styles.chips}>
              {chip(!weekly, "A training and a rest day", () => setWeekly(false))}
              {chip(weekly, "A whole week, different each day", () => setWeekly(true))}
            </View>
            <Text style={styles.note}>
              {weekly
                ? `A different plan for each day, Monday to Sunday. Each new week is made again around the foods ${first} picks.`
                : "The same training-day and rest-day plan every week."}
            </Text>
            <Text style={styles.label}>How many meals does {first} tend to eat in a day?</Text>
            <View style={styles.chips}>
              {Array.from({ length: MAX_MEALS - MIN_MEALS + 1 }, (_, i) => MIN_MEALS + i).map((n) =>
                chip(count === n, String(n), () => chooseMeals(n, training)),
              )}
            </View>
            <Text style={styles.label}>And how many snacks?</Text>
            <View style={styles.chips}>
              {Array.from({ length: MAX_SNACKS + 1 }, (_, n) => n).map((n) =>
                chip(snacks.length === n, n === 0 ? "None" : String(n), () => setSnacks(snackTimesFor(times.slice(0, count), n, training)), `snack${n}`),
              )}
            </View>
            <Text style={styles.note}>
              {snacks.length === 0
                ? "No snacks: the meals carry all the protein and calories."
                : snacks.length === 1
                  ? "A protein snack with a piece of fruit."
                  : "A protein snack with fruit, and a fruit and nut snack."}
            </Text>
            <Text style={styles.label}>When does {first} train?</Text>
            <View style={styles.chips}>
              {TRAINING_TIMES.map((t) => chip(training === t.time, t.label, () => chooseMeals(count, t.time), t.key))}
              {chip(training === null, "Doesn't train", () => chooseMeals(count, null))}
            </View>
            {training && weekly && (
              <>
                <Text style={styles.label}>Which days does {first} train?</Text>
                <View style={styles.chips}>
                  {WEEK_DAYS.map((d, i) =>
                    chip(trainDays.includes(i), d, () => setTrainDays(trainDays.includes(i) ? trainDays.filter((x) => x !== i) : [...trainDays, i]), d),
                  )}
                </View>
                <Text style={styles.note}>Training days get more carbs around the session.</Text>
              </>
            )}
            <Text style={styles.label}>{first}'s meal times</Text>
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
            {snacks.length > 0 && (
              <>
                <Text style={styles.label}>{first}'s snack times</Text>
                <View style={styles.times}>
                  {snacks.map((t, i) => (
                    <TextInput
                      key={i}
                      style={styles.timeInput}
                      value={t}
                      onChangeText={(v) => setSnacks(snacks.map((x, j) => (j === i ? v : x)))}
                      placeholder="10:30"
                      placeholderTextColor="#64748B"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {page === "diet" && (
          <View>
            <Text style={styles.label}>What does {first} eat?</Text>
            {MEAL_DIETS.map((d) => (
              <Pressable key={d.key} style={[styles.dietOption, diet === d.key && styles.dietOptionOn]} onPress={() => setDiet(d.key)}>
                <Text style={[styles.dietLabel, diet === d.key && styles.chipTextOn]}>{d.label}</Text>
                <Text style={[styles.note, { marginTop: 2 }, diet === d.key && styles.chipTextOn]}>{d.detail}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Milk, yoghurt and cheese?</Text>
            <View style={styles.chips}>
              {chip(!dairyFree, "Has dairy", () => setDairyFree(false))}
              {chip(dairyFree, "No dairy (lactose or allergy)", () => setDairyFree(true))}
            </View>
          </View>
        )}

        <View style={styles.buttons}>
            {(step > 0 || plan) && (
              <Pressable style={[styles.button, styles.secondary]} onPress={back}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
            )}
            <Pressable style={[styles.button, styles.primary]} onPress={next} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={themeText("#0F172A")} />
              ) : (
                <Text style={styles.primaryText}>{page === "diet" ? "Make the plan" : "Next"}</Text>
              )}
            </Pressable>
        </View>
      </View>
    );
  }

  const week = plan.settings.weekly ? readWeek(plan.week) : null;
  const taste = readTaste(plan.taste);
  const todayDay = weekdayOf(todayIso());
  // On a weekly plan the day is a weekday, and today's meals can be ticked.
  const kind: "training" | "rest" = week ? (trainsOn(plan.settings, weekDay) ? "training" : "rest") : dayKind;
  const day = week ? week.days[weekDay] : dayKind === "training" ? plan.training_day : plan.rest_day;
  const canTick = !coachMode && (!week || weekDay === todayDay);
  /** The plan with this day's meals changed. */
  const withDay = (meals: DietDay["meals"]): ClientMealPlan =>
    week
      ? { ...plan, week: { ...week, days: week.days.map((d, i) => (i === weekDay ? { meals } : d)) } }
      : dayKind === "training"
        ? { ...plan, training_day: { meals } }
        : { ...plan, rest_day: { meals } };
  // Each choice the client makes teaches the plan what they like (not the trainer's).
  const learn = (next: Taste) => (coachMode ? plan.taste ?? {} : next);
  const swapTarget: DietItem | null = swapping ? day.meals[swapping.meal]?.items[swapping.index] ?? null : null;
  const pickSwap = (food: string) => {
    if (!swapping || !swapTarget) return;
    const meals = day.meals.map((m, mi) =>
      mi !== swapping.meal ? m : { ...m, items: m.items.map((it, ii) => (ii === swapping.index ? swapItem(it, food) : it)) },
    );
    save({ ...withDay(meals), taste: learn(tasteSwap(taste, swapTarget.food, food)) });
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
    const days = week?.days.map((d) => leaveOutEverywhere(d, food));
    const avoid = [...new Set([...(plan.settings.avoid ?? []), food])];
    save({
      ...plan,
      settings: { ...plan.settings, avoid },
      training_day: training.day,
      rest_day: rest.day,
      ...(week && days ? { week: { ...week, days: days.map((d) => d.day) } } : {}),
      taste: learn(tasteLeaveOut(taste, food)),
    });
    setLeaving(null);
    const current = days ? days[weekDay] : dayKind === "training" ? training : rest;
    if (!current.rebalanced) {
      Alert.alert("Left out", `Nothing else on this day gives what ${food} did, so it's a little lower now. ${coachMode ? "Tap New ideas for a fresh plan without it." : "Your coach can make you a fresh plan without it."}`);
    }
  };
  // Their own meal (GRIZZ, 2026-10-27): the foods they eat at this meal every
  // day. Both days are made again so the other meals balance around it.
  const openOwnMeal = (meal: number) => {
    const place = mealPlace(day, meal);
    const mine = plan.settings.ownMeals?.[String(place)] ?? [];
    setOwnDraft(mine.map(ownRow));
    setOwnSearch("");
    setOwnMeal({ place, name: day.meals[meal]?.name ?? "this meal" });
  };
  const saveOwnMeal = (items: DietItem[] | null) => {
    if (!ownMeal) return;
    const ownMeals = { ...(plan.settings.ownMeals ?? {}) };
    if (items?.length) ownMeals[String(ownMeal.place)] = items;
    else delete ownMeals[String(ownMeal.place)];
    // Foods they put in their own meal are ones they eat, so they come off the "don't eat" list.
    const avoid = (plan.settings.avoid ?? []).filter((f) => !items?.some((it) => it.food === f));
    const settings: MealPlanSettings = { ...plan.settings, avoid, ownMeals };
    save({
      ...plan,
      settings,
      training_day: makeDay(settings, plan.targets, true, plan.variety),
      rest_day: makeDay(settings, plan.targets, false, plan.variety),
      ...(week ? { week: makeWeek(settings, plan.targets, plan.variety, week.startsOn) } : {}),
      taste: learn(tasteOwnMeal(taste, (items ?? []).map((it) => it.food))),
      updated_at: new Date().toISOString(),
    });
    setOwnMeal(null);
  };
  const ownItems: DietItem[] = ownDraft.map((r) => ({ food: r.food, grams: ownGrams(r) })).filter((it) => it.grams > 0);
  const ownTotals = sumTotals(ownItems);
  const ownResults = searchFoods(ownSearch).slice(0, 8);
  const addOwnFood = (name: string) => {
    const food = findFood(name);
    if (!food) return;
    const unit = foodUnits(food)[0];
    setOwnDraft([...ownDraft, { food: name, amount: String(food.usual), unit }]);
    setOwnSearch("");
  };
  const putBack = (food: string) => {
    const avoid = (plan.settings.avoid ?? []).filter((f) => f !== food);
    save({ ...plan, settings: { ...plan.settings, avoid }, taste: learn(tastePutBack(taste, food)) });
  };
  // Makes the plan again now around what they like (the AI reads their swaps).
  const adaptNow = async () => {
    setAdapting(true);
    try {
      const { plan: next, fromAi } = await adaptPlan(plan, first, todayIso());
      await save(next);
      if (!fromAi && Object.keys(taste.liked).length + Object.keys(taste.disliked).length > 0)
        Alert.alert("Made with the app's own reading", "The AI couldn't be reached, so the app used its own reading of what they pick.");
    } finally {
      setAdapting(false);
    }
  };

  return (
    <View>
      {header}
      {explainer}
      {newWeek && (
        <View style={styles.insulinBox}>
          <Text style={styles.insulinTitle}>🗓️ A new week's plan</Text>
          <Text style={styles.insulinText}>
            {coachMode
              ? `This week's plan for ${first} was made around the foods they pick.`
              : "Your plan for this week is ready, made around the foods you pick."}
          </Text>
        </View>
      )}
      {adapting && <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 8 }} />}
      {week && (
        <>
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d, i) => (
              <Pressable
                key={d}
                style={[styles.weekDay, weekDay === i && styles.chipOn]}
                onPress={() => setWeekDay(i)}
                accessibilityLabel={WEEK_DAY_NAMES[i]}
              >
                <Text style={[styles.weekDayText, weekDay === i && styles.chipTextOn]}>{d}</Text>
                {trainsOn(plan.settings, i) && <Text style={[styles.weekDot, weekDay === i && styles.chipTextOn]}>●</Text>}
              </Pressable>
            ))}
          </View>
          <Text style={styles.weekLabel}>
            {WEEK_DAY_NAMES[weekDay]}
            {weekDay === todayDay ? " (today)" : ""} · {kind === "training" ? "training day" : "rest day"}
          </Text>
        </>
      )}
      {!week && plan.settings.training && (
        <View style={styles.chips}>
          {(["training", "rest"] as const).map((k) => (
            <Pressable key={k} style={[styles.chip, styles.flex, dayKind === k && styles.chipOn]} onPress={() => setDayKind(k)}>
              <Text style={[styles.chipText, dayKind === k && styles.chipTextOn]}>{k === "training" ? "Training day" : "Rest day"}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {referralBox}
      {coachMode && (
        <Text style={styles.helper}>
          {plan.settings.meals.length} meals at {plan.settings.meals.join(", ")}
          {(() => {
            const s = snackTimes(plan.settings);
            return s.length ? `, ${s.length === 1 ? "a snack" : `${s.length} snacks`} at ${s.join(", ")}` : ", no snacks";
          })()}
          {plan.settings.training ? `, training at ${plan.settings.training}` : ", no training"}.
          {coachWeek ? ` ${first} sees your diet planner week below instead while it has meals in it.` : ""}
        </Text>
      )}
      {/* Right at the top, so the setup is easy to change once the plan is made (GRIZZ, 2026-11-02). */}
      {coachMode && (
        <Pressable
          style={[styles.button, styles.secondary, styles.stacked, { marginTop: 0, marginBottom: 10 }]}
          onPress={() => {
            setStep(0);
            setEditing(true);
          }}
        >
          <Text style={styles.secondaryText}>✎ Change details, goal, meals or training time</Text>
        </Pressable>
      )}
      <MealDayView
        day={day}
        targetKcal={plan.targets.kcal}
        onSwap={(meal, index) => setSwapping({ meal, index })}
        onLeaveOut={(meal, index) => setLeaving({ meal, index })}
        onOwnMeal={coachMode ? undefined : openOwnMeal}
        coachView={coachMode}
        tick={
          canTick
            ? { isTicked: (m) => mealTicks.isTicked(kind, m, day.meals[m]), onTick: (m) => mealTicks.toggle(kind, m, day.meals[m]) }
            : undefined
        }
      />
      {(plan.settings.avoid ?? []).length > 0 && (
        <View style={styles.avoidBox}>
          <Text style={styles.avoidTitle}>{coachMode ? `${first} doesn't eat` : "You don't eat"} (left out of every plan)</Text>
          <View style={styles.chips}>
            {(plan.settings.avoid ?? []).map((f) => (
              <Pressable key={f} style={styles.avoidChip} onPress={() => putBack(f)} accessibilityLabel={`Put ${f} back`}>
                <Text style={styles.avoidText}>{f}  ↩</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.avoidHint}>
            {coachMode ? "Tap one to allow it again. It comes back next time you tap New ideas." : "Tap one to allow it again. It comes back the next time your coach makes your plan."}
          </Text>
        </View>
      )}
      <View style={styles.insulinBox}>
        <Text style={styles.insulinTitle}>🧠 {coachMode ? `What ${first} likes` : "Your plan learns what you like"}</Text>
        <Text style={styles.insulinText}>
          {coachMode
            ? taste.note || `Each food ${first} swaps in, leaves out or puts in their own meal teaches the plan what they like.`
            : `Each food you swap in, leave out or put in your own meal teaches your plan what you like.${week ? " Each new week uses more of the foods you pick." : ""}`}
        </Text>
        {coachMode && (
          <Pressable style={[styles.button, styles.secondary, styles.stacked]} onPress={adaptNow} disabled={adapting || saving}>
            {adapting ? <ActivityIndicator color={themeText("#fff")} /> : <Text style={styles.secondaryText}>✨ Adapt the plan to {first}'s tastes now</Text>}
          </Pressable>
        )}
      </View>
      <View style={styles.insulinBox}>
        <Text style={styles.insulinTitle}>{plan.settings.goal === "lose" ? "📉 How you lose fat" : "⏱️ Why the carbs are where they are"}</Text>
        <Text style={styles.insulinText}>{plan.settings.goal === "lose" ? LOSE_CARBS : TIMED_CARBS}</Text>
      </View>
      <Text style={styles.note}>
        Weights are for the food as listed, for example cooked rice. Swap keeps the same protein, carbs or fat. Tap ✕ to leave a food out. {SNACK_SALT}
      </Text>
      {coachMode ? (
        <>
          <View style={styles.buttons}>
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={() => {
                setStep(0);
                setEditing(true);
              }}
            >
              <Text style={styles.secondaryText}>Change meals</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.primary]} onPress={() => build(plan.variety + 1)} disabled={saving}>
              {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.primaryText}>New ideas</Text>}
            </Pressable>
          </View>
          <Pressable style={[styles.button, told ? styles.secondary : styles.primary, styles.stacked]} onPress={tell} disabled={telling || told}>
            {telling ? (
              <ActivityIndicator color={themeText("#0F172A")} />
            ) : (
              <Text style={told ? styles.secondaryText : styles.primaryText}>{told ? `Sent ✓ ${first} was told` : `📣 Tell ${first} their meal plan is ready`}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <View style={styles.shopBox}>
          <Text style={styles.shopTitle}>🛒 Happy with your plan?</Text>
          <Text style={styles.insulinText}>Would you like a shopping list for the week? The app adds up everything you need to buy, in the packs shops sell.</Text>
          <Pressable style={[styles.button, styles.primary, styles.stacked]} onPress={() => setShopping(true)}>
            <Text style={styles.primaryText}>Yes, make my shopping list</Text>
          </Pressable>
        </View>
      )}
      <ShoppingListSheet
        visible={shopping}
        trainingDay={plan.training_day}
        restDay={plan.rest_day}
        trains={!!plan.settings.training}
        days={week ? (plan.settings.trainDays ?? []).length : plan.settings.trainingDays ?? trainingDaysGuess(details.activity)}
        onDays={(trainingDays) => {
          if (trainingDays !== plan.settings.trainingDays) save({ ...plan, settings: { ...plan.settings, trainingDays } });
        }}
        onClose={() => setShopping(false)}
        week={week?.days ?? null}
      />

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
            {!coachMode && (
              <Pressable
                style={[styles.button, styles.secondary, styles.stacked]}
                onPress={() => {
                  const meal = leaving?.meal;
                  setLeaving(null);
                  if (meal != null) setTimeout(() => openOwnMeal(meal), 400);
                }}
              >
                <Text style={styles.secondaryText}>✎ Put in my own meal instead</Text>
              </Pressable>
            )}
            <Pressable style={[styles.button, styles.secondary, styles.stacked]} onPress={() => setLeaving(null)}>
              <Text style={styles.secondaryText}>Keep it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!ownMeal} animationType="slide" transparent onRequestClose={() => setOwnMeal(null)}>
        <KeyboardSafe>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { maxHeight: "90%" }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>Your own meal: {ownMeal?.name}</Text>
                <Text style={styles.helper}>
                  Eat the same thing every day? Add each food and how much you have. The app keeps this meal the same on training and rest
                  days, and works the rest of your day around it so you still hit your target.
                </Text>
                {ownDraft.map((row, i) => (
                  <View key={row.food + i} style={styles.ownRow}>
                    <Text style={styles.ownName}>{row.food}</Text>
                    <TextInput
                      style={styles.ownAmount}
                      value={row.amount}
                      onChangeText={(v) => setOwnDraft(ownDraft.map((r, j) => (j === i ? { ...r, amount: v } : r)))}
                      keyboardType="decimal-pad"
                      maxLength={6}
                      accessibilityLabel={`How much ${row.food}`}
                    />
                    <Text style={styles.ownUnit}>{row.unit.label}</Text>
                    <Pressable onPress={() => setOwnDraft(ownDraft.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel={`Remove ${row.food}`}>
                      <Text style={styles.leaveOut}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                {ownItems.length > 0 && (
                  <Text style={[styles.mealMacros, { marginTop: 8 }]}>
                    {ownTotals.kcal} kcal · P {ownTotals.protein} g · C {ownTotals.carbs} g · F {ownTotals.fat} g
                  </Text>
                )}
                <Text style={styles.label}>{ownDraft.length ? "Add another food" : "Add a food"}</Text>
                <TextInput
                  style={styles.ownSearch}
                  value={ownSearch}
                  onChangeText={setOwnSearch}
                  placeholder="Type a food, e.g. eggs, toast, banana"
                  placeholderTextColor="#64748B"
                />
                {ownResults.map((f) => (
                  <Pressable key={f.name} style={styles.option} onPress={() => addOwnFood(f.name)}>
                    <Text style={styles.optionName}>{f.name}</Text>
                    <Text style={styles.amount}>+ Add</Text>
                  </Pressable>
                ))}
                {ownSearch.trim() !== "" && ownResults.length === 0 && (
                  <Text style={styles.note}>No food by that name. Try another word, or pick the closest one.</Text>
                )}
                <Pressable
                  style={[styles.button, styles.primary, styles.stacked, !ownItems.length && { opacity: 0.5 }]}
                  onPress={() => saveOwnMeal(ownItems)}
                  disabled={!ownItems.length || saving}
                >
                  <Text style={styles.primaryText}>Save my meal</Text>
                </Pressable>
                {ownMeal && plan.settings.ownMeals?.[String(ownMeal.place)] && (
                  <Pressable style={[styles.button, styles.secondary, styles.stacked]} onPress={() => saveOwnMeal(null)}>
                    <Text style={styles.secondaryText}>Let the app pick this meal again</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.button, styles.secondary, styles.stacked]} onPress={() => setOwnMeal(null)}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardSafe>
      </Modal>
    </View>
  );
}

const styles = themedStyles({
  // flexBasis auto, as flex 0 squashes the button's text on the laptop app.
  shopBox: { backgroundColor: "#0F172A", borderRadius: 10, borderWidth: 1, borderColor: BRAND_GOLD, padding: 12, marginTop: 14 },
  shopTitle: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  stacked: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", marginTop: 10 },
  tick: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, marginVertical: 6 },
  tickOn: { backgroundColor: "#14532D", borderColor: "#22C55E" },
  tickText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  tickTextOn: { color: "#4ADE80" },
  ownTag: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  ownLink: { color: "#38BDF8", fontWeight: "700", fontSize: 13 },
  emptyMeal: { marginTop: 6 },
  ownRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#334155" },
  ownName: { color: "#fff", fontSize: 14, flex: 1 },
  ownAmount: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, width: 64, textAlign: "center" },
  ownUnit: { color: "#94A3B8", fontSize: 13, minWidth: 34 },
  ownSearch: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15 },
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
  weekRow: { flexDirection: "row", gap: 4, marginBottom: 6 },
  weekDay: { flex: 1, backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  weekDayText: { color: "#CBD5E1", fontWeight: "700", fontSize: 12 },
  weekDot: { color: BRAND_GOLD, fontSize: 8, marginTop: 2 },
  weekLabel: { color: "#94A3B8", fontSize: 13, fontWeight: "700", marginBottom: 8 },
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
