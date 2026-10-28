import { useEffect, useState } from "react";
import { addDays } from "@/lib/programSchedule";
import { supabase } from "@/lib/supabase";
import { SWAP_DAYS_AHEAD, swapLabels } from "@/lib/workoutSwaps";
import type { ClientWorkoutSwap } from "@/types/database";

/**
 * The client's workout swaps (0167) touching the days from `from` to `to`, and
 * the "Swapped" line for each day on a WeekCalendar. Bump `refreshKey` to load again.
 */
export function useWorkoutSwaps(clientId: string, from: string, to: string, refreshKey: unknown = 0) {
  const [swaps, setSwaps] = useState<ClientWorkoutSwap[]>([]);
  useEffect(() => {
    supabase
      .from("client_workout_swaps")
      .select("*")
      .eq("client_id", clientId)
      .is("undone_at", null)
      .gte("swapped_on", addDays(from, -SWAP_DAYS_AHEAD))
      .lte("swapped_on", to)
      .then(({ data }) => setSwaps(data ?? []));
  }, [clientId, from, to, refreshKey]);
  return { swaps, labels: swapLabels(swaps) };
}
