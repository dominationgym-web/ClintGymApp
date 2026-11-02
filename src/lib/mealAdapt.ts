import { supabase } from "@/lib/supabase";
import { FOODS } from "@/lib/foods";
import { foodAllowed, makeDay, type MealPlanSettings } from "@/lib/mealPlanMaker";
import { learnedDislikes, learnedLikes, makeWeek, readTaste, readWeek, tasteNote, weekStart, type Taste } from "@/lib/mealWeek";
import type { ClientMealPlan } from "@/types/database";

// Makes the plan again around what the client likes (GRIZZ, 2026-11-02): the
// AI (adapt-meal-plan) reads their tastes and picks foods to use more and
// foods to leave out; without it the app reads the same scores itself. The
// meals are then made with the app's maths, so the day still adds up.

type Advice = { likes: string[]; leaveOut: string[]; note: string; fromAi: boolean };

async function askAi(clientId: string, settings: MealPlanSettings, taste: Taste, current: string[]): Promise<Advice | null> {
  const diet = settings.diet ?? "everything";
  const foods: Record<string, string[]> = {};
  for (const f of FOODS) {
    if (!foodAllowed(f.name, diet, !!settings.dairyFree)) continue;
    (foods[f.group] ??= []).push(f.name);
  }
  try {
    const { data, error } = await supabase.functions.invoke("adapt-meal-plan", {
      method: "POST",
      body: { client_id: clientId, taste: { liked: taste.liked, disliked: taste.disliked }, foods, current },
    });
    const out = data as { likes?: string[]; leave_out?: string[]; note?: string } | null;
    if (error || !out || !Array.isArray(out.likes)) return null;
    return { likes: out.likes, leaveOut: out.leave_out ?? [], note: out.note ?? "", fromAi: true };
  } catch {
    return null;
  }
}

/** The foods on the plan now, for the AI. */
function planFoods(plan: ClientMealPlan): string[] {
  const days = readWeek(plan.week)?.days ?? [plan.training_day, plan.rest_day];
  return [...new Set(days.flatMap((d) => d.meals.flatMap((m) => (m.own ? [] : m.items.map((i) => i.food)))))];
}

/**
 * The plan made again, with new foods, around the client's tastes. A weekly
 * plan becomes the week starting on `today`'s Monday.
 */
export async function adaptPlan(plan: ClientMealPlan, firstName: string, today: string): Promise<{ plan: ClientMealPlan; fromAi: boolean }> {
  const taste = readTaste(plan.taste);
  const hasTaste = Object.keys(taste.liked).length + Object.keys(taste.disliked).length > 0;
  const advice: Advice =
    (hasTaste ? await askAi(plan.client_id, plan.settings, taste, planFoods(plan)) : null) ?? {
      likes: learnedLikes(taste),
      leaveOut: learnedDislikes(taste),
      note: tasteNote(taste, firstName),
      fromAi: false,
    };
  const avoid = [...new Set([...(plan.settings.avoid ?? []), ...advice.leaveOut])].filter((f) => !advice.likes.includes(f));
  const settings: MealPlanSettings = { ...plan.settings, likes: advice.likes, avoid };
  const variety = plan.variety + 1;
  const next: ClientMealPlan = {
    ...plan,
    settings,
    variety,
    training_day: makeDay(settings, plan.targets, true, variety),
    rest_day: makeDay(settings, plan.targets, false, variety),
    week: settings.weekly ? makeWeek(settings, plan.targets, variety, weekStart(today)) : {},
    taste: { ...taste, adaptedOn: today, note: advice.note },
    updated_at: new Date().toISOString(),
  };
  return { plan: next, fromAi: advice.fromAi };
}
