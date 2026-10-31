// Bringing a trainer's existing client sessions into Live sessions (GRIZZ,
// 2026-10-31: "log his client sessions into the App Calendar ... with
// screenshots or transfer from Google or Samsung or their phone calendar").
// Two ways in, one list to check: a screenshot of any calendar app (read by
// the read-calendar edge function), or the phone's own calendar (installed
// app from the next store build). The trainer ticks what to book, then
// import_live_sessions (0171) books them.
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { atTime, dayKey } from "@/lib/liveSessions";
import type { ReadSession } from "../../supabase/functions/read-calendar/shape";

export type { ReadSession };
export type ImportFile = { name: string; type: string; data: string };
export type ImportRow = ReadSession & { key: string; tick: boolean; why: string | null };

const ERRORS: Record<string, string> = {
  no_key: "The AI reader isn't switched on yet. The app owner needs to add the Claude key first.",
  too_many: "Send up to 6 screenshots at a time.",
  too_big: "That's too much in one go. Try fewer screenshots.",
  bad_type: "Only screenshots (pictures) can be read.",
  ai_failed: "The screenshots couldn't be read. Try clearer ones, in week or list view.",
};

export async function readScreenshots(files: ImportFile[], today: string): Promise<{ sessions: ReadSession[]; note: string | null } | { error: string }> {
  const { data, error } = await supabase.functions.invoke("read-calendar", { method: "POST", body: { today, files } });
  if (!error) return data as { sessions: ReadSession[]; note: string | null };
  let code: string | null = null;
  try {
    const ctx = (error as { context?: Response }).context;
    code = ctx ? (await ctx.clone().json())?.error ?? null : null;
  } catch {
    // Not a JSON answer.
  }
  return { error: (code && ERRORS[code]) || "Something went wrong. Please try again." };
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);

/**
 * The one client a calendar title names: their full name, or a first name
 * (or surname) no other client shares. Null when it's nobody or unclear.
 */
export function matchClient(title: string, clients: { id: string; name: string }[]): string | null {
  const t = words(title);
  const has = (w: string[]) => w.length > 0 && w.every((x) => t.includes(x));
  const full = clients.filter((c) => has(words(c.name)));
  if (full.length === 1) return full[0].id;
  if (full.length > 1) return null;
  const hits = clients.filter((c) => words(c.name).some((w) => w.length > 1 && t.includes(w)));
  return hits.length === 1 ? hits[0].id : null;
}

type PhoneEvent = { title?: string | null; startDate: string | Date; endDate: string | Date; allDay?: boolean };

/** Phone calendar events that name one of the trainer's clients, as sessions. */
export function eventsToSessions(events: PhoneEvent[], clients: { id: string; name: string }[]): ReadSession[] {
  const out: ReadSession[] = [];
  for (const e of events) {
    if (e.allDay || !e.title) continue;
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    if (Number.isNaN(start.getTime())) continue;
    const client = matchClient(e.title, clients);
    if (!client) continue;
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    out.push({
      date: dayKey(start),
      time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      minutes: mins >= 15 && mins <= 180 ? mins : null,
      client_id: client,
      seen_name: e.title.trim().slice(0, 80),
    });
  }
  return out.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

/**
 * The list to check: already in the app, before today or not matched to a
 * client starts unticked, with the reason shown.
 */
export function reviewRows(read: ReadSession[], booked: { client_id: string; starts_at: string }[], today: string): ImportRow[] {
  const have = new Set(booked.map((b) => `${b.client_id} ${new Date(b.starts_at).getTime()}`));
  return read.map((s, i) => {
    const already = !!s.client_id && have.has(`${s.client_id} ${new Date(atTime(s.date, s.time)).getTime()}`);
    const why = already ? "Already in the app" : !s.client_id ? "Pick who this is" : s.date < today ? "Before today" : null;
    return { ...s, key: `${i}-${s.date}-${s.time}`, tick: why === null, why };
  });
}

/** Books the ticked rows. */
export async function bookRows(rows: ImportRow[]): Promise<{ added: number; skipped: number } | { error: string }> {
  const ticked = rows.filter((r) => r.tick && r.client_id);
  const { data, error } = await supabase.rpc("import_live_sessions", {
    p_rows: ticked.map((r) => ({ client_id: r.client_id, starts_at: atTime(r.date, r.time), minutes: r.minutes })),
  });
  if (error) return { error: error.message };
  return data as { added: number; skipped: number };
}

// The phone's calendar: only in an installed app built with expo-calendar
// (the next store build). Older installs and the website get null.
type CalendarModule = typeof import("expo-calendar/legacy");
let calendarModule: CalendarModule | null | undefined;
function phoneCalendar(): CalendarModule | null {
  if (calendarModule !== undefined) return calendarModule;
  calendarModule = null;
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    calendarModule = require("expo-calendar/legacy") as CalendarModule;
  } catch {
    calendarModule = null;
  }
  return calendarModule;
}

export function canReadPhoneCalendar(): boolean {
  return phoneCalendar() !== null;
}

/** Events from every calendar on the phone between two dates, or an error to show. */
export async function readPhoneCalendar(from: Date, to: Date): Promise<PhoneEvent[] | { error: string }> {
  const C = phoneCalendar();
  if (!C) return { error: "Reading the phone's calendar comes with the next app update from the store. Use a screenshot for now." };
  try {
    const permission = await C.requestCalendarPermissionsAsync();
    if (!permission.granted) return { error: "Allow calendar access in your phone's settings to bring sessions in from it." };
    const calendars = await C.getCalendarsAsync(C.EntityTypes.EVENT);
    if (!calendars.length) return [];
    return await C.getEventsAsync(
      calendars.map((c) => c.id),
      from,
      to,
    );
  } catch {
    return { error: "Reading the phone's calendar comes with the next app update from the store. Use a screenshot for now." };
  }
}
