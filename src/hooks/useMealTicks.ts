import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { mealKey, otherSourceTicks, tickFor, type MealTick, type TickSource } from "@/lib/mealTicks";
import type { DietMeal } from "@/lib/dietPlan";

// The client's ticked meals from `from` to today (0163), and ticking one on or
// off for today. Ticking a meal from another plan day (coach's plan, training
// or rest day) takes today's other ticks off, so nothing counts twice.
export function useMealTicks(clientId: string | undefined, from: string = todayIso()) {
  const [ticks, setTicks] = useState<MealTick[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("client_meal_ticks")
      .select("ate_on, meal_key, source, meal_name, kcal, protein, carbs, fat")
      .eq("client_id", clientId)
      .gte("ate_on", from)
      .order("created_at");
    setTicks((data as MealTick[] | null) ?? []);
    setLoaded(true);
  }, [clientId, from]);

  // Again each time the page comes into view, so a meal ticked on another page shows.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = todayIso();
  const isTicked = (source: TickSource, index: number, meal: DietMeal) =>
    ticks.some((t) => t.ate_on === today && t.meal_key === mealKey(source, index, meal.name));

  const toggle = async (source: TickSource, index: number, meal: DietMeal) => {
    if (!clientId) return;
    const row = tickFor(source, index, meal, today);
    const before = ticks;
    let error: { message: string } | null = null;
    if (isTicked(source, index, meal)) {
      setTicks(ticks.filter((t) => !(t.ate_on === today && t.meal_key === row.meal_key)));
      ({ error } = await supabase.from("client_meal_ticks").delete().eq("client_id", clientId).eq("ate_on", today).eq("meal_key", row.meal_key));
    } else {
      const others = otherSourceTicks(ticks, today, source);
      setTicks([...ticks.filter((t) => !others.includes(t)), row]);
      if (others.length) {
        ({ error } = await supabase.from("client_meal_ticks").delete().eq("client_id", clientId).eq("ate_on", today).neq("source", source));
      }
      if (!error) ({ error } = await supabase.from("client_meal_ticks").upsert({ client_id: clientId, ...row }));
    }
    if (error) {
      setTicks(before);
      Alert.alert("Couldn't save that", error.message);
    }
  };

  return { ticks, loaded, isTicked, toggle, reload: load };
}
