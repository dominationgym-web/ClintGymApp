import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";

// The heading the coach's meal plan sits under on the Nutrition page.
export const COACH_MEAL_PLAN_TITLE = "Your meal plan from your coach";

// Calls back when it's time to check again; returns how to stop.
export type Recheck = (check: () => void) => () => void;

// Has the coach given this client a meal plan? Checked whenever the screen
// comes into view, so a plan the coach just saved shows up (GRIZZ, 2026-10-27).
export function useHasMealPlan(clientId: string | undefined) {
  const navigation = useNavigation();
  return useHasMealPlanWith(clientId, (check) => navigation.addListener("focus", check));
}

// The same, checked again whenever `recheck` says, for use outside a screen
// (the client's laptop sidebar).
export function useHasMealPlanWith(clientId: string | undefined, recheck: Recheck) {
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
    return recheck(check);
    // recheck is a new function each render; the subscription only depends on the client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
  return has;
}
