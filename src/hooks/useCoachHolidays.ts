import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { asHolidays, type Holiday } from "@/lib/holidays";
import { todayIso } from "@/lib/dates";

/** A coach's holidays that aren't over yet (0205), loaded each time the screen comes back into view. */
export function useCoachHolidays(trainerId: string | null | undefined): { holidays: Holiday[]; reload: () => void } {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const reload = useCallback(() => {
    if (!trainerId) return;
    supabase
      .from("trainer_time_off")
      .select("*")
      .eq("trainer_id", trainerId)
      .is("removed_at", null)
      .not("holiday_from", "is", null)
      .gte("holiday_until", todayIso())
      .order("holiday_from")
      .then(({ data }) => setHolidays(asHolidays(data ?? [])));
  }, [trainerId]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  return { holidays, reload };
}
