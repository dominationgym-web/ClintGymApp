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

/**
 * The first session from now for each regular day and time, as ISO times in
 * the phone's time: today when the time is still to come, otherwise that
 * weekday next time round. Used to put someone who isn't in the app on the
 * calendar every week (GRIZZ, 2026-11-01).
 */
export function firstStarts(regular: RegularTime[], now = new Date()): string[] {
  return regular.map((r) => {
    const [h, m] = r.time.split(":").map(Number);
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    let ahead = (r.weekday - now.getDay() + 7) % 7;
    if (ahead === 0 && at.getTime() <= now.getTime()) ahead = 7;
    at.setDate(at.getDate() + ahead);
    return at.toISOString();
  });
}

/** Everyone on the calendar who isn't in the app, by name (first spelling seen), A to Z. */
export function diaryNames(sessions: Pick<LiveSession, "client_id" | "guest_name" | "status">[]): string[] {
  const byKey = new Map<string, string>();
  for (const s of sessions) {
    if (s.client_id || !s.guest_name || s.status === "removed") continue;
    const k = diaryKey(s.guest_name);
    if (k && !k.includes("???") && /\p{L}/u.test(k) && !byKey.has(k)) byKey.set(k, s.guest_name.trim());
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * A typed name, split into the people in it (GRIZZ, 2026-11-01: "I will
 * always use the same words as in the calendar. For eg Jade & Camilla").
 * A name already on the calendar as one person (e.g. a couple booked as
 * "Pieter & Anna") stays one; otherwise "&", "and", "+" and commas split it.
 * Each part takes the spelling already on the calendar when there is one.
 */
export function splitNames(typed: string, known: string[]): string[] {
  const name = typed.trim().replace(/\s+/g, " ");
  if (!name) return [];
  const byKey = new Map(known.map((k) => [diaryKey(k), k]));
  const whole = byKey.get(diaryKey(name));
  if (whole) return [whole];
  const parts = name
    .split(/\s*(?:&|\+|,|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return [name];
  return [...new Set(parts.map((p) => byKey.get(diaryKey(p)) ?? p))];
}

/**
 * People who train together: names booked at the same time as each other at
 * least twice, as groups like ["Camilla", "Jade"] (people not in the app).
 */
export function usualGroups(sessions: Pick<LiveSession, "client_id" | "guest_name" | "status" | "starts_at">[]): string[][] {
  const bySlot = new Map<string, string[]>();
  for (const s of sessions) {
    if (s.client_id || !s.guest_name || s.status === "removed") continue;
    const k = diaryKey(s.guest_name);
    if (!k || k.includes("???")) continue;
    bySlot.set(s.starts_at, [...(bySlot.get(s.starts_at) ?? []), s.guest_name.trim()]);
  }
  const counts = new Map<string, { names: string[]; n: number }>();
  for (const names of bySlot.values()) {
    const uniq = [...new Map(names.map((n) => [diaryKey(n), n])).values()].sort((a, b) => a.localeCompare(b));
    if (uniq.length < 2) continue;
    const key = uniq.map(diaryKey).join("|");
    const row = counts.get(key) ?? { names: uniq, n: 0 };
    row.n += 1;
    counts.set(key, row);
  }
  return [...counts.values()].filter((r) => r.n >= 2).map((r) => r.names);
}
