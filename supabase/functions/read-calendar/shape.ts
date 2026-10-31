// The sessions Claude reads off a trainer's calendar screenshots, and the
// checks that make them safe to book (GRIZZ, 2026-10-31: "the trainer is
// gonna need to log his client sessions into the App Calendar ... Can this be
// done with screenshots"). Plain TypeScript with no Deno or app imports, so
// the edge function and the app's tests both use it.

export type ReadSession = {
  date: string; // yyyy-mm-dd
  time: string; // HH:MM, 24-hour
  minutes: number | null;
  // The trainer's client it matched, or null when unsure.
  client_id: string | null;
  // The name as it appears in the calendar.
  seen_name: string;
};

export type CalendarRead = { sessions: ReadSession[]; note: string | null };

const MAX_SESSIONS = 400;

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** "6:40" → "06:40", "18:05" stays; anything else null. */
export function cleanClock(v: unknown): string | null {
  const m = typeof v === "string" ? /^(\d{1,2}):(\d{2})$/.exec(v.trim()) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * Keeps only sessions with a real date and time, near today (a year either
 * way), a client of this trainer (or none), and no repeats.
 */
export function cleanSessions(input: unknown, clientIds: string[], today: string): CalendarRead {
  const raw = (input ?? {}) as { sessions?: unknown; note?: unknown };
  const ids = new Set(clientIds);
  const base = Date.parse(today);
  const seen = new Set<string>();
  const sessions: ReadSession[] = [];
  for (const s of Array.isArray(raw.sessions) ? raw.sessions : []) {
    const r = (s ?? {}) as Record<string, unknown>;
    const time = cleanClock(r.time);
    if (!isDate(r.date) || !time) continue;
    if (Math.abs(Date.parse(r.date) - base) > 366 * 86400000) continue;
    const client = typeof r.client_id === "string" && ids.has(r.client_id) ? r.client_id : null;
    const name = typeof r.seen_name === "string" ? r.seen_name.trim().slice(0, 80) : "";
    const minutes = typeof r.minutes === "number" && r.minutes >= 15 && r.minutes <= 180 ? Math.round(r.minutes) : null;
    const key = `${r.date} ${time} ${client ?? name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sessions.push({ date: r.date, time, minutes, client_id: client, seen_name: name });
    if (sessions.length >= MAX_SESSIONS) break;
  }
  sessions.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, 500) : null;
  return { sessions, note };
}
