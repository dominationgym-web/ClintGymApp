import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso } from "@/lib/dates";
import { mondayOf, weekDates } from "@/lib/trainingCalendar";
import { amountLabel, dayTotals, sumTotals } from "@/lib/dietPlan";
import { eatenOn, tickedSource, weekFoodTip } from "@/lib/mealTicks";
import { grouped } from "@/lib/clientDashboard";
import { useMealTicks } from "@/hooks/useMealTicks";
import { planDay, useFoodPlan } from "@/hooks/useClientDashboardData";
import MealPlanMaker, { MealTickButton } from "@/components/MealPlanMaker";
import ClientDietPlanView from "@/components/ClientDietPlanView";
import { Card, CardTitle, DashChips, DashPage, DashTabs, Muted, Pill, Row, Stat, Tip, dash, natural } from "@/components/DashboardParts";

type Tab = "today" | "plan";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHART = 220;

// Nutrition & diet (GRIZZ, 2026-10-27, "with meal ticking"): today's meals
// from their plan with a tick for each one eaten, what that adds up to, and
// how the week's eating went. The plan itself is one tab over.
export default function FoodScreen() {
  const { client } = useAuth();
  const today = todayIso();
  const monday = mondayOf(today);
  const days = weekDates(monday);
  const food = useFoodPlan(client?.id);
  const mealTicks = useMealTicks(client?.id, monday);
  const [tab, setTab] = useState<Tab>("today");
  const [picked, setPicked] = useState<"training" | "rest" | null>(null);

  if (!client || !food || !mealTicks.loaded) return <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 40 }} />;

  const tabs = (
    <DashTabs<Tab>
      tabs={[
        { key: "today", label: "Today" },
        { key: "plan", label: food.kind === "coach" ? "My coach's meal plan" : "My meal plan" },
      ]}
      on={tab}
      onPick={(t) => {
        setTab(t);
        // Meals ticked on the plan tab show here too.
        mealTicks.reload();
      }}
    />
  );

  if (tab === "plan" || food.kind === "none") {
    return (
      <DashPage title="Nutrition & diet" subtitle={food.kind === "none" ? "Make your meal plan and you can tick off each meal as you eat it" : "Your whole plan"} right={food.kind === "none" ? undefined : tabs}>
        <Card style={styles.plan}>{food.kind === "coach" ? <ClientDietPlanView /> : <MealPlanMaker />}</Card>
      </DashPage>
    );
  }

  const ticked = tickedSource(mealTicks.ticks, today);
  const trains = food.kind === "own" && !!food.plan.settings.training;
  const kind = picked ?? (ticked === "rest" || (ticked == null && food.kind === "own" && !trains) ? "rest" : "training");
  const current = planDay(food, new Date(), kind)!;
  const planned = dayTotals(current.day);
  const eaten = eatenOn(mealTicks.ticks, today);
  const meals = current.day.meals.map((meal, index) => ({ meal, index })).filter(({ meal }) => meal.items.length > 0);
  const tickedCount = meals.filter(({ meal, index }) => mealTicks.isTicked(current.source, index, meal)).length;

  // The week: what each ticked day added up to, against that day's plan.
  const targetFor = (iso: string) => {
    const d = planDay(food, parseIsoDate(iso), "training");
    return food.kind === "own" ? food.plan.targets.kcal : d ? dayTotals(d.day).kcal : 0;
  };
  const week = days.map((d) => ({ date: d, kcal: eatenOn(mealTicks.ticks, d).kcal, target: targetFor(d) }));
  const top = Math.max(...week.map((w) => Math.max(w.kcal, w.target)), 1) * 1.1;
  const tip = weekFoodTip(mealTicks.ticks, days, { kcal: planned.kcal, protein: planned.protein }, today);

  const stat = (label: string, now: number, of: number, unit: string, color: string) => (
    <Stat label={label} value={unit === "kcal" ? grouped(now) : String(Math.round(now))} unit={`/ ${unit === "kcal" ? grouped(of) : of} ${unit}`} bar={of ? now / of : 0} barColor={color} />
  );

  return (
    <DashPage title="Nutrition & diet" subtitle="Tick each meal as you eat it" right={tabs}>
      <Row>
        {stat("Calories", eaten.kcal, planned.kcal, "kcal", BRAND_GOLD)}
        {stat("Protein", eaten.protein, planned.protein, "g", "#22C55E")}
        {stat("Carbs", eaten.carbs, planned.carbs, "g", dash.blue)}
        {stat("Fat", eaten.fat, planned.fat, "g", dash.orange)}
      </Row>
      <Row>
        <Card style={{ flex: 1.3 }}>
          <CardTitle right={<Pill text={`${tickedCount} of ${meals.length} eaten`} tone={tickedCount === meals.length ? "green" : "gold"} />}>
            Today's meals{food.kind === "coach" ? ` · ${DAY_NAMES[(new Date().getDay() + 6) % 7]}` : ""}
          </CardTitle>
          {trains && (
            <View style={{ marginVertical: 6 }}>
              <DashChips
                items={[
                  { key: "training", label: "Training day" },
                  { key: "rest", label: "Rest day" },
                ]}
                on={kind}
                onPick={(k) => setPicked(k as "training" | "rest")}
              />
            </View>
          )}
          {meals.map(({ meal, index }) => {
            const t = sumTotals(meal.items);
            const on = mealTicks.isTicked(current.source, index, meal);
            return (
              <View key={`${index}${meal.name}`} style={[styles.meal, on && styles.mealOn]}>
                <View style={styles.mealTop}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  <Text style={styles.mealKcal}>
                    {t.kcal} kcal · P {t.protein} g
                  </Text>
                </View>
                <Text style={styles.items} numberOfLines={2}>
                  {meal.items.map((it) => `${it.food} ${amountLabel(it)}`).join(" · ")}
                </Text>
                <MealTickButton on={on} onPress={() => mealTicks.toggle(current.source, index, meal)} />
              </View>
            );
          })}
          {meals.length === 0 && <Muted>Nothing planned for today.</Muted>}
        </Card>
        <View style={styles.side}>
          <Card style={natural}>
            <CardTitle right={<Text style={styles.small}>target {grouped(planned.kcal)}</Text>}>Calories this week</CardTitle>
            <View style={styles.chart}>
              {week.map((w, i) => {
                const near = w.kcal > 0 && Math.abs(w.kcal - w.target) <= 200;
                // Today isn't over, so it's gold until it's near the plan.
                const color = near ? "#22C55E" : w.date === today ? BRAND_GOLD : dash.orange;
                return (
                  <View key={w.date} style={styles.barCol}>
                    <View style={styles.barArea}>
                      {w.target > 0 && <View style={[styles.targetMark, { bottom: (w.target / top) * CHART }]} />}
                      {w.kcal > 0 && <View style={[styles.bar, { height: (w.kcal / top) * CHART, backgroundColor: color }]} />}
                    </View>
                    <Text style={[styles.small, w.date === today && styles.today]}>{DAY_NAMES[i]}</Text>
                    <Text style={styles.tiny}>{w.kcal ? grouped(w.kcal) : w.date <= today ? "–" : ""}</Text>
                  </View>
                );
              })}
            </View>
            <Muted>Green is within 200 kcal of your plan, orange is further off and gold is today so far. The dashed line is your plan. Only ticked meals count.</Muted>
          </Card>
          {tip ? <Tip text={tip} /> : null}
        </View>
      </Row>
    </DashPage>
  );
}

const styles = StyleSheet.create({
  plan: { maxWidth: 760, width: "100%", alignSelf: "center" },
  side: { flex: 1, gap: 16 },
  meal: { borderBottomWidth: 1, borderBottomColor: "#1F2D4B", paddingVertical: 8 },
  mealOn: { opacity: 0.85 },
  mealTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  mealName: { color: "#fff", fontSize: 14, fontWeight: "700", flexShrink: 1 },
  mealKcal: { color: dash.muted, fontSize: 13 },
  items: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  small: { color: dash.muted, fontSize: 12 },
  tiny: { color: "#64748B", fontSize: 11 },
  today: { color: BRAND_GOLD, fontWeight: "800" },
  chart: { flexDirection: "row", gap: 10, marginVertical: 12 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barArea: { height: CHART, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "70%", borderTopLeftRadius: 6, borderTopRightRadius: 6, minHeight: 2 },
  targetMark: { position: "absolute", left: 0, right: 0, height: 0, borderTopWidth: 2, borderStyle: "dashed", borderColor: BRAND_GOLD },
});
