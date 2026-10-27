import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { normaliseWeek, weekdayIndex, type DietDay } from "@/lib/dietPlan";
import type { DashLog } from "@/lib/clientDashboard";
import type { BodyStat } from "@/lib/progress";
import type { ClientMealPlan } from "@/types/database";

// Data for the client's laptop pages (GRIZZ, 2026-10-27), loaded again each
// time the page comes into view, so a set logged on the phone shows up.

/** Every set the client has logged (paged: Supabase sends 1000 rows at most). */
export function useWorkoutLogs(clientId: string | undefined) {
  const [logs, setLogs] = useState<DashLog[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!clientId) return;
      let live = true;
      (async () => {
        const all: DashLog[] = [];
        for (let from = 0; from < 20000; from += 1000) {
          const { data } = await supabase
            .from("workout_logs")
            .select("exercise_name, log_date, weight_kg, reps, warm_up, set_number")
            .eq("client_id", clientId)
            .order("id")
            .range(from, from + 999);
          all.push(...((data as DashLog[] | null) ?? []));
          if (!data || data.length < 1000) break;
        }
        if (live) setLogs(all);
      })();
      return () => {
        live = false;
      };
    }, [clientId]),
  );
  return logs;
}

export function useBodyStats(clientId: string | undefined) {
  const [stats, setStats] = useState<BodyStat[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!clientId) return;
      supabase
        .from("client_body_stats")
        .select("*")
        .eq("client_id", clientId)
        .order("measured_on")
        .then(({ data }) => setStats((data as BodyStat[] | null) ?? []));
    }, [clientId]),
  );
  return stats;
}

export type DayKind = "coach" | "training" | "rest";

// The client's food plan for a day: the coach's plan if they have one (that
// weekday), otherwise their own plan's training or rest day.
export type FoodPlan =
  | { kind: "coach"; week: DietDay[] }
  | { kind: "own"; plan: ClientMealPlan }
  | { kind: "none" };

export function useFoodPlan(clientId: string | undefined) {
  const [food, setFood] = useState<FoodPlan | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!clientId) return;
      Promise.all([
        supabase.from("client_diet_plans").select("days").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_meal_plans").select("*").eq("client_id", clientId).maybeSingle(),
      ]).then(([coach, own]) => {
        const week = coach.data ? normaliseWeek(coach.data.days) : [];
        if (week.some((d) => d.meals.some((m) => m.items.length > 0))) setFood({ kind: "coach", week });
        else if (own.data) setFood({ kind: "own", plan: own.data as ClientMealPlan });
        else setFood({ kind: "none" });
      });
    }, [clientId]),
  );
  return food;
}

/** The plan day for `date`: the coach's weekday, or the own plan's training or rest day. */
export function planDay(food: FoodPlan, date: Date, kind: "training" | "rest"): { day: DietDay; source: DayKind } | null {
  if (food.kind === "coach") return { day: food.week[weekdayIndex(date)], source: "coach" };
  if (food.kind === "own") return kind === "training" ? { day: food.plan.training_day, source: "training" } : { day: food.plan.rest_day, source: "rest" };
  return null;
}
