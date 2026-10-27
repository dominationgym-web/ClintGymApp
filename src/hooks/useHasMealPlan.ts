import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";

// The heading the coach's meal plan sits under on the Nutrition page.
export const COACH_MEAL_PLAN_TITLE = "Your meal plan from your coach";

// Has the coach given this client a meal plan? Checked whenever the screen
// comes into view, so a plan the coach just saved shows up (GRIZZ, 2026-10-27).
export function useHasMealPlan(clientId: string | undefined) {
  const navigation = useNavigation();
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!clientId) return;
    const check = () =>
      supabase
        .from("client_diet_plans")
        .select("client_id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .then(({ count }) => setHas((count ?? 0) > 0));
    check();
    return navigation.addListener("focus", check);
  }, [clientId, navigation]);
  return has;
}
