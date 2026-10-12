import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { DIET_WEEKDAYS, amountLabel, dailyTarget, dayTotals, normaliseWeek, sumTotals, weekdayIndex, type DietDay } from "@/lib/dietPlan";
import type { ClientDietPlan } from "@/types/database";

// The client's meal plan from their trainer (0071), read-only, in the
// Nutrition section. Opens on today, one day at a time.
export default function ClientDietPlanView() {
  const { client } = useAuth();
  const userId = client?.id;
  const [plan, setPlan] = useState<ClientDietPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [day, setDay] = useState(weekdayIndex(new Date()));

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setFailed(false);
    supabase
      .from("client_diet_plans")
      .select("*")
      .eq("client_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        setFailed(!!error);
        setPlan(data);
        setLoading(false);
      });
  }, [userId, reload]);

  if (loading) return <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 12 }} />;
  if (failed) {
    return (
      <Pressable onPress={() => setReload((r) => r + 1)}>
        <Text style={styles.empty}>
          Couldn't load your meal plan. <Text style={styles.amount}>Tap to try again.</Text>
        </Text>
      </Pressable>
    );
  }
  const days: DietDay[] = plan ? normaliseWeek(plan.days) : [];
  if (!plan || days.every((d) => d.meals.every((m) => m.items.length === 0))) {
    return <Text style={styles.empty}>Your coach hasn't set a meal plan for you yet. When they do, it shows here.</Text>;
  }

  const target = dailyTarget({ ...plan, activity: Number(plan.activity) });
  const today = days[day];
  const totals = dayTotals(today);

  return (
    <View>
      <View style={styles.dayTabs}>
        {DIET_WEEKDAYS.map((d, i) => (
          <Pressable key={d} style={[styles.dayTab, i === day && styles.dayTabOn]} onPress={() => setDay(i)}>
            <Text style={[styles.dayTabText, i === day && styles.dayTabTextOn]}>{d}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.totals}>
        <Text style={styles.total}>
          {totals.kcal.toLocaleString()} kcal{target != null ? ` (your target is ${target.toLocaleString()})` : ""}
        </Text>
        <Text style={styles.macros}>
          Protein {totals.protein} g · Carbs {totals.carbs} g · Fat {totals.fat} g · Fibre {totals.fibre} g
        </Text>
      </View>
      {today.meals
        .filter((m) => m.items.length > 0)
        .map((meal) => (
          <View key={meal.name} style={styles.meal}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealKcal}>{sumTotals(meal.items).kcal} kcal</Text>
            </View>
            {meal.items.map((item, i) => (
              <Text key={i} style={styles.item}>
                • {item.food}: <Text style={styles.amount}>{amountLabel(item)}</Text>
              </Text>
            ))}
          </View>
        ))}
      {today.meals.every((m) => m.items.length === 0) && <Text style={styles.empty}>Nothing planned for this day.</Text>}
      <Text style={styles.note}>Weights are for the food as listed, for example cooked rice or raw chicken.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#94A3B8", fontSize: 14, lineHeight: 20 },
  dayTabs: { flexDirection: "row", gap: 4, marginBottom: 10 },
  dayTab: { flex: 1, backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  dayTabOn: { backgroundColor: BRAND_GOLD },
  dayTabText: { color: "#CBD5E1", fontWeight: "700", fontSize: 12 },
  dayTabTextOn: { color: "#0F172A" },
  totals: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 8 },
  total: { color: "#fff", fontWeight: "800", fontSize: 15 },
  macros: { color: "#CBD5E1", fontSize: 12, marginTop: 4 },
  meal: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 8 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  mealName: { color: "#fff", fontWeight: "800" },
  mealKcal: { color: BRAND_GOLD, fontWeight: "700" },
  item: { color: "#E2E8F0", fontSize: 14, marginTop: 2 },
  amount: { color: BRAND_GOLD, fontWeight: "700" },
  note: { color: "#64748B", fontSize: 12, marginTop: 4 },
});
