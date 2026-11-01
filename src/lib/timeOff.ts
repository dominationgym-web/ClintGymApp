import type { LiveSession } from "@/types/database";

// Blocked-out time (0177): the stretches of time a block covers, in the
// phone's time. The whole day runs midnight to midnight; "only some hours"
// covers those hours on each day.

export type Range = { from: Date; to: Date };

const at = (day: string, plus: number, time = "00:00") => {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d + plus, h, min);
};

/** null while the hours aren't both typed or the end isn't after the start. */
export function blockRanges(firstDay: string, days: number, from: string | null, to: string | null, partDay: boolean): Range[] | null {
  if (!partDay) return [{ from: at(firstDay, 0), to: at(firstDay, days) }];
  if (!from || !to || to <= from) return null;
  return Array.from({ length: days }, (_, i) => ({ from: at(firstDay, i, from), to: at(firstDay, i, to) }));
}

/** Booked sessions a block would cancel. */
export function sessionsInBlock<T extends Pick<LiveSession, "status" | "starts_at">>(sessions: T[], ranges: Range[]): T[] {
  return sessions.filter((s) => {
    if (s.status !== "booked") return false;
    const t = new Date(s.starts_at).getTime();
    return ranges.some((r) => t >= r.from.getTime() && t < r.to.getTime());
  });
}
