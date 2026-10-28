import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { MealDayView } from "@/components/MealPlanMaker";
import type { ClientMealPlan } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// On the trainer's Diet tab: the plan the client made for themselves with the
// meal plan maker (0077), read-only, under a tap-to-open heading.
export default function ClientOwnMealPlan({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [plan, setPlan] = useState<ClientMealPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [dayKind, setDayKind] = useState<"training" | "rest">("training");

  useEffect(() => {
    supabase
      .from("client_meal_plans")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle()
      .then(({ data }) => {
        setPlan(data?.settings?.meals?.length ? data : null);
        if (data && !data.settings.training) setDayKind("rest");
      });
  }, [clientId]);

  if (!plan) return null;
  const day = dayKind === "training" ? plan.training_day : plan.rest_day;

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.title}>🤖 {clientName}'s own meal plan</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.helper}>
            Made with the app's meal plan maker: {plan.settings.meals.length} meals at {plan.settings.meals.join(", ")}
            {plan.settings.training ? `, training at ${plan.settings.training}` : ", no training"}. Your diet plan, when you make one,
            shows to them first.
          </Text>
          {plan.settings.training && (
            <View style={styles.tabs}>
              {(["training", "rest"] as const).map((k) => (
                <Pressable key={k} style={[styles.tab, dayKind === k && styles.tabOn]} onPress={() => setDayKind(k)}>
                  <Text style={[styles.tabText, dayKind === k && styles.tabTextOn]}>{k === "training" ? "Training day" : "Rest day"}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <MealDayView day={day} targetKcal={plan.targets.kcal} />
        </View>
      )}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },
  chevron: { color: BRAND_GOLD, fontSize: 14 },
  helper: { color: "#94A3B8", fontSize: 13, marginBottom: 8 },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 8 },
  tab: { flex: 1, backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  tabOn: { backgroundColor: BRAND_GOLD },
  tabText: { color: "#CBD5E1", fontWeight: "700" },
  tabTextOn: { color: "#0F172A" },
});
