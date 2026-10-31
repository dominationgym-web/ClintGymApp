// Bringing a trainer's existing client sessions into Live sessions (GRIZZ,
// 2026-10-31: "log his client sessions into the App Calendar ... with
// screenshots or transfer from Google or Samsung or their phone calendar").
// Two ways in, one list to check: a screenshot of any calendar app (read by
// the read-calendar edge function), or the phone's own calendar (installed
// app from the next store build). The trainer ticks what to book, then
// import_live_sessions (0172, 0174) books them. Someone who isn't in the app
// yet goes in the diary by name (GRIZZ's week: Wasi, Rob V, Sharde ...).
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

/** Timed phone calendar events as sessions, matched to a client where the title names one. */
export function eventsToSessions(events: PhoneEvent[], clients: { id: string; name: string }[]): ReadSession[] {
  const out: ReadSession[] = [];
  for (const e of events) {
    if (e.allDay || !e.title) continue;
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    if (Number.isNaN(start.getTime())) continue;
    const client = matchClient(e.title, clients);
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

/** A calendar name with no real name in it: "???", "?", "". */
export const noName = (name: string) => !/\p{L}/u.test(name);

const nameKey = (name: string | null | undefined) => (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Why a row starts unticked, or the note on a ticked one. */
export function rowWhy(s: ReadSession, today: string, already: boolean, namesTicked: boolean): { tick: boolean; why: string | null } {
  if (already) return { tick: false, why: "Already in the app" };
  if (s.date < today) return { tick: false, why: "Before today" };
  if (s.client_id) return { tick: true, why: null };
  if (noName(s.seen_name)) return { tick: false, why: "No name in your calendar: pick who it is, or tick to keep it as \"???\"" };
  return namesTicked
    ? { tick: true, why: "Not in the app yet: goes in your diary by name" }
    : { tick: false, why: "Not matched to a client: tick to add it by name" };
}

/**
 * The list to check. Someone not in the app is booked by name; already in the
 * app, before today and "???" start unticked, with the reason shown. From
 * the phone's calendar (personal events too) only matched clients start ticked.
 */
export function reviewRows(
  read: ReadSession[],
  booked: { client_id: string | null; guest_name?: string | null; starts_at: string }[],
  today: string,
  namesTicked = true,
): ImportRow[] {
  const have = new Set(booked.map((b) => `${b.client_id ?? nameKey(b.guest_name)} ${new Date(b.starts_at).getTime()}`));
  return read.map((s, i) => {
    const already = have.has(`${s.client_id ?? nameKey(s.seen_name)} ${new Date(atTime(s.date, s.time)).getTime()}`);
    return { ...s, key: `${i}-${s.date}-${s.time}`, ...rowWhy(s, today, already, namesTicked) };
  });
}

/** A second person for the same slot ("J & C", or a name cut off like "Sharde &"). */
export function addPerson(rows: ImportRow[], key: string): ImportRow[] {
  const i = rows.findIndex((r) => r.key === key);
  if (i < 0) return rows;
  const r = rows[i];
  const extra: ImportRow = { ...r, key: `${r.key}+${rows.length}`, client_id: null, seen_name: "???", tick: false, why: "Second person: pick who it is" };
  return [...rows.slice(0, i + 1), extra, ...rows.slice(i + 1)];
}

/** Books the ticked rows: app clients by id, everyone else by name. */
export async function bookRows(rows: ImportRow[]): Promise<{ added: number; skipped: number } | { error: string }> {
  const ticked = rows.filter((r) => r.tick && (r.client_id || r.seen_name.trim()));
  const { data, error } = await supabase.rpc("import_live_sessions", {
    p_rows: ticked.map((r) => ({ client_id: r.client_id, name: r.seen_name.trim().slice(0, 60), starts_at: atTime(r.date, r.time), minutes: r.minutes })),
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
