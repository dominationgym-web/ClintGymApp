import { useEffect, useState } from "react";
import { loadRecoveryActivities } from "@/lib/recoveryPlanQueries";
import { recoveryShortName } from "@/lib/recoveryActivities";

/** A client's recovery activities (0107) for a calendar month: date → bright green labels. */
export function useRecoveryCalendar(clientId: string, from: string, to: string, refreshKey?: unknown) {
  const [byDate, setByDate] = useState<Record<string, { label: string; done: boolean }[]>>({});
  useEffect(() => {
    let live = true;
    loadRecoveryActivities(clientId, from, to).then((rows) => {
      if (!live) return;
      const map: Record<string, { label: string; done: boolean }[]> = {};
      for (const r of rows) {
        if (r.skipped) continue;
        const date = r.done_on ?? r.planned_on;
        (map[date] ??= []).push({ label: recoveryShortName(r.activity), done: !!r.done_on });
      }
      setByDate(map);
    });
    return () => {
      live = false;
    };
  }, [clientId, from, to, refreshKey]);
  return byDate;
}
