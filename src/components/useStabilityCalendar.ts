import { useEffect, useState } from "react";
import { loadStabilityCalendar, type StabilityCalendarItem } from "@/lib/stabilityCalendar";
import type { ClientStabilityDay, ClientStabilityProgram } from "@/types/database";

/** A client's stability sessions (0110) for a calendar month: date → purple labels, plus the rows behind them. */
export function useStabilityCalendar(clientId: string, from: string, to: string, refreshKey?: unknown) {
  const [state, setState] = useState<{
    map: Record<string, StabilityCalendarItem[]>;
    days: ClientStabilityDay[];
    programs: ClientStabilityProgram[];
  }>({ map: {}, days: [], programs: [] });
  useEffect(() => {
    let live = true;
    loadStabilityCalendar(clientId, from, to).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [clientId, from, to, refreshKey]);
  return state;
}
