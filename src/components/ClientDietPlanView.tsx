import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { DIET_WEEKDAYS, INTAKE_ACTIVITY_LEVELS, intakeDetails, amountLabel, dailyTarget, dayTotals, normaliseWeek, sumTotals, weekdayIndex, type DietDay } from "@/lib/dietPlan";
import type { ClientDietPlan } from "@/types/database";

// The client's meal plan from their trainer (0071), read-only, in the
// Nutrition section. Opens on today, one day at a time.
function MealPlan() {
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

// The client's meal plan, with a short form above it for clients who did
// their intake before it asked height, weight and activity (GRIZZ,
// 2026-10-12), so their coach's diet planner can work out their BMR.
export default function ClientDietPlanView() {
  const { client, refreshProfile } = useAuth();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [saving, setSaving] = useState(false);
  const missing = client != null && (() => {
    const d = intakeDetails(client);
    return d.height_cm == null || d.weight_kg == null || d.activity == null;
  })();

  const save = async () => {
    if (!client) return;
    const h = Number(height.replace(",", "."));
    const w = Number(weight.replace(",", "."));
    if (!(h >= 100 && h <= 250)) return Alert.alert("Your height", "Type your height in centimetres, for example 175.");
    if (!(w >= 25 && w <= 400)) return Alert.alert("Your weight", "Type your weight in kilograms, for example 82.");
    if (!activity) return Alert.alert("How active are you?", "Tap the option that fits you best.");
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ intake_responses: { ...(client.intake_responses ?? {}), height_cm: String(h), weight_kg: String(w), activity_level: activity } })
      .eq("id", client.id);
    setSaving(false);
    if (error) return Alert.alert("Couldn't save", error.message);
    await refreshProfile();
  };

  return (
    <View>
      {missing && (
        <View style={styles.ask}>
          <Text style={styles.askTitle}>Help your coach plan your meals</Text>
          <Text style={styles.empty}>Your height, weight and how active you are let your coach work out your daily calories.</Text>
          <View style={styles.askRow}>
            <TextInput style={styles.askInput} value={height} onChangeText={setHeight} placeholder="Height (cm)" placeholderTextColor="#64748B" keyboardType="decimal-pad" maxLength={5} />
            <TextInput style={styles.askInput} value={weight} onChangeText={setWeight} placeholder="Weight (kg)" placeholderTextColor="#64748B" keyboardType="decimal-pad" maxLength={5} />
          </View>
          <View style={styles.askChips}>
            {INTAKE_ACTIVITY_LEVELS.map((a) => (
              <Pressable key={a.label} style={[styles.dayTab, styles.askChip, activity === a.label && styles.dayTabOn]} onPress={() => setActivity(a.label)}>
                <Text style={[styles.dayTabText, activity === a.label && styles.dayTabTextOn]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          {activity ? <Text style={styles.note}>{INTAKE_ACTIVITY_LEVELS.find((a) => a.label === activity)?.detail}</Text> : null}
          <Pressable style={styles.askSave} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.askSaveText}>Send to my coach</Text>}
          </Pressable>
        </View>
      )}
      <MealPlan />
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: BRAND_GOLD },
  askTitle: { color: "#fff", fontWeight: "800", marginBottom: 4 },
  askRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  askInput: { flex: 1, backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14 },
  askChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  askChip: { flex: 0, paddingHorizontal: 12, backgroundColor: "#1E293B" },
  askSave: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  askSaveText: { color: "#0F172A", fontWeight: "800" },
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
