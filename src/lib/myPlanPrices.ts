import { supabase } from "@/lib/supabase";
import { sidePricing } from "@/lib/billing";
import type { BillingPrices, BillingSettings } from "@/types/database";

/**
 * The signed-in trainer's plan prices (0179): Evolution, or the cheaper
 * 1 on 1 only prices when none of their clients is an Evolution client.
 * Referral credit is 25% of these.
 */
export async function myPlanPrices(trainerId: string): Promise<BillingPrices | null> {
  const [settings, sides] = await Promise.all([
    supabase.from("billing_settings").select("prices, free_clients, client_tiers, one_on_one_prices, one_on_one_tiers").eq("id", 1).maybeSingle(),
    supabase.rpc("trainer_price_sides"),
  ]);
  const s = settings.data as Pick<BillingSettings, "prices" | "free_clients" | "client_tiers" | "one_on_one_prices" | "one_on_one_tiers"> | null;
  if (!s?.prices) return null;
  const side = sides.data?.find((r) => r.trainer_id === trainerId)?.side ?? "evolution";
  return sidePricing(s, side).prices;
}
