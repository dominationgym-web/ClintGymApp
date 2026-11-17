// Home-screen calendar widget (GRIZZ, 2026-11-16, migration 0214; same day
// as 1 on 1 Today since 2026-11-17, migration 0217). Kept free of React
// Native so it can be tested; the Android widget draws these rows and the
// iPhone widget (targets/calendar-widget) does the same in Swift.
//
// What shows: today's list exactly as 1 on 1 Today shows it (dayRows, the
// same code): every session, joint sessions as one line ("Jade & Camilla"),
// catch-ups with their Catch-up tag, a slot whose person is away or cancelled
// in green, free to book, anyone out of a slot in red underneath the people
// training in it, and the green Available gaps still to come. A name only
// drops off once it's marked trained (or the slot's time is over and nobody
// is in it). One that's over but not marked stays at the top with a "?"
// (orange). The session on now, or else the next one, is gold. When no
// sessions are left today, tomorrow's day shows under "Tomorrow".

import { allOut, dayRows, isAway, isOnHold, jointLines } from "@/lib/liveSessions";

export type WidgetSession = {
  id: string;
  starts_at: string;
  minutes: number;
  name: string;
  status: "booked" | "done" | "cancelled" | "no_show" | "removed";
  charge: "charge" | "credit" | "makeup" | null;
  cancelled_by: "client" | "trainer" | null;
  away_id?: string | null;
  stop_id?: string | null;
  note?: string | null;
  makeup_for?: string | null;
  makeup_session_id?: string | null;
  client_id?: string | null;
  guest_name?: string | null;
  client_disputed_at?: string | null;
  repeat_id?: string | null;
};

export type WidgetSettings = { day_start?: string | null; day_end?: string | null; minutes?: number | null } | null;

export type WidgetRow = {
  /** The session a tap opens; "" opens the Today page. */
  id: string;
  /** "07:10" */
  time: string;
  /** "Sarah K.", "Jade & Camilla" for a joint session, "Available" for a gap. */
  name: string;
  /**
   * over = over but not marked (orange ?); now = on now or next (gold);
   * later = booked; free = everyone in the slot is away or cancelled (green,
   * free to book); open = an Available gap (green).
   */
  state: "over" | "now" | "later" | "free" | "open";
  /** Booked as a catch-up: the yellow Catch-up tag. */
  catchUp: boolean;
  /** Why a free slot is free: "Away · free", "Cancelled · free". */
  note: string | null;
  /** Someone out of a slot others train in, shown in red: "Bianca away". */
  out: string | null;
  /** Tomorrow's day, when no sessions are left today. */
  tomorrow: boolean;
};

export type WidgetView = { title: string; rows: WidgetRow[]; more: number; sessions: number };

/** Android scrolls inside the widget; the iPhone shows as many as fit. */
export const WIDGET_MAX_ROWS = 40;

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isOut = (s: WidgetSession) => s.status === "cancelled" || s.status === "no_show";
const endOf = (s: WidgetSession) => new Date(s.starts_at).getTime() + s.minutes * 60000;

/** "Sarah Kruger" → "Sarah K.", "Sharde" → "Sharde". */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Client";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** One person: "Sarah K."; two or more: "Jade & Camilla" (as they're booked). */
function names(list: WidgetSession[]): string {
  if (list.length === 1) return shortName(list[0].name);
  return list.map((s) => shortName(s.name).split(" ")[0]).join(" & ");
}

/** Why someone is out, short: "away", "on hold", "cancelled", "no-show". */
function whyOut(s: WidgetSession): string {
  if (isAway(s)) return isOnHold(s) ? "on hold" : "away";
  return s.status === "no_show" ? "no-show" : "cancelled";
}

/** The day's rows for the widget, from the same list 1 on 1 Today shows. */
function dayView(sessions: WidgetSession[], day: string, settings: WidgetSettings, now: Date, tomorrow: boolean): WidgetRow[] {
  const out: WidgetRow[] = [];
  for (const { time, line } of dayRows(sessions, day, settings, now).rows) {
    if (!line) {
      out.push({ id: "", time, name: "Available", state: "open", catchUp: false, note: null, out: null, tomorrow });
      continue;
    }
    const all = [line.s, ...line.with];
    if (allOut(line, now)) {
      // An away slot keeps its card all day on Today; the widget lets it go once its time is over.
      if (Math.max(...all.map(endOf)) <= now.getTime()) continue;
      const why = [...new Set(all.map(whyOut))].join(" / ");
      out.push({ id: line.s.id, time, name: names(all), state: "free", catchUp: false, note: `${why[0].toUpperCase()}${why.slice(1)} · free`, out: null, tomorrow });
      continue;
    }
    const here = all.filter((s) => !isOut(s));
    // A name drops off once it's marked trained (GRIZZ 2026-11-16).
    const booked = here.filter((s) => s.status === "booked");
    if (!booked.length) continue;
    const gone = all.filter(isOut);
    out.push({
      id: booked[0].id,
      time,
      name: names(here),
      state: "later",
      catchUp: here.some((s) => !!s.makeup_for),
      note: null,
      out: gone.length ? gone.map((s) => `${shortName(s.name).split(" ")[0]} ${whyOut(s)}`).join(" · ") : null,
      tomorrow,
    });
  }
  const next = out.findIndex((r) => r.state === "later");
  if (next >= 0) out[next] = { ...out[next], state: "now" };
  return out;
}

export function widgetView(sessions: WidgetSession[], settings: WidgetSettings = null, now: Date = new Date()): WidgetView {
  const today = dayOf(now);
  const tomorrow = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  // Over but not marked, today or the days before: orange "?" on top.
  const over: WidgetRow[] = jointLines(sessions.filter((s) => s.status === "booked" && endOf(s) <= now.getTime())).map((l) => {
    const all = [l.s, ...l.with];
    return { id: l.s.id, time: clock(new Date(l.s.starts_at)), name: names(all), state: "over", catchUp: all.some((s) => !!s.makeup_for), note: null, out: null, tomorrow: false };
  });

  const todayRows = dayView(sessions, today, settings, now, false);
  const anyLeft = todayRows.some((r) => r.state === "now" || r.state === "later");
  const tomorrowRows = anyLeft ? [] : dayView(sessions, tomorrow, settings, now, true);
  const showTomorrow = !anyLeft && tomorrowRows.some((r) => r.state === "now" || r.state === "later");
  const coming = showTomorrow ? tomorrowRows : todayRows;
  const all = [...over, ...coming];
  return {
    title: showTomorrow ? "Tomorrow" : "Today",
    rows: all.slice(0, WIDGET_MAX_ROWS),
    more: Math.max(0, all.length - WIDGET_MAX_ROWS),
    sessions: all.filter((r) => r.state === "over" || r.state === "now" || r.state === "later").length,
  };
}

/** The link a widget tap opens: that session's sheet, or the Today page. */
export function widgetLink(sessionId?: string | null): string {
  return sessionId ? `consistentchange://widget-session/${sessionId}` : "consistentchange://widget-session";
}

/** The session id in a widget link, "" for the Today page, null when it isn't one. */
export function sessionFromWidgetLink(url: string | null | undefined): string | null {
  const m = /^consistentchange:\/\/widget-session\/?([0-9a-f-]{36})?\/?(?:[?#].*)?$/i.exec((url ?? "").trim());
  if (!m) return null;
  return m[1] ?? "";
}
