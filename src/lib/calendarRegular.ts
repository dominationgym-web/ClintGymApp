import { WEEK_ORDER, clockLabel } from "@/lib/liveSessions";
import type { LiveSession, RegularTime } from "@/types/database";

// A client's regular days and times worked out from the sessions already on
// the calendar (GRIZZ, 2026-11-01: "Can the app not extrapolate their
// training times and days from the downloaded screenshot and calendar?").
// Weekly sessions (🔁, from a calendar import) count straight away; other
// sessions count when the same day and time comes up at least twice.

type Fields = Pick<LiveSession, "client_id" | "starts_at" | "status" | "minutes" | "repeat_id"> & { guest_name?: string | null };

/** Same as diary_name_key() in the database (0174). */
export const diaryKey = (name: string | null | undefined) => (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** `who`: an app client's id, or { name } for a diary-only person (0174). */
export function regularFromCalendar(sessions: Fields[], who: string | { name: string }, now: Date = new Date()): { regular: RegularTime[]; minutes: number | null } {
  const isMine = (s: Fields) => (typeof who === "string" ? s.client_id === who : !s.client_id && diaryKey(s.guest_name) === diaryKey(who.name));
  const from = now.getTime() - 28 * 86400000;
  const to = now.getTime() + 35 * 86400000;
  const mine = sessions.filter((s) => {
    const t = new Date(s.starts_at).getTime();
    return isMine(s) && s.status !== "removed" && t >= from && t < to;
  });
  const seen = new Map<string, { weekday: number; time: string; count: number; weekly: boolean }>();
  for (const s of mine) {
    const d = new Date(s.starts_at);
    const time = clockLabel(d);
    const key = `${d.getDay()} ${time}`;
    const row = seen.get(key) ?? { weekday: d.getDay(), time, count: 0, weekly: false };
    row.count += 1;
    row.weekly = row.weekly || !!s.repeat_id;
    seen.set(key, row);
  }
  // One time per day: the most booked one.
  const byDay = new Map<number, { time: string; count: number; weekly: boolean }>();
  for (const r of seen.values()) {
    if (!r.weekly && r.count < 2) continue;
    const best = byDay.get(r.weekday);
    if (!best || r.count > best.count) byDay.set(r.weekday, r);
  }
  const regular = WEEK_ORDER.filter((d) => byDay.has(d)).map((d) => ({ weekday: d, time: byDay.get(d)!.time }));
  const lengths = mine.map((s) => s.minutes);
  const minutes = lengths.length ? [...lengths].sort((a, b) => lengths.filter((x) => x === b).length - lengths.filter((x) => x === a).length)[0] : null;
  return { regular, minutes };
}
