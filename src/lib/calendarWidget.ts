// Home-screen calendar widget (GRIZZ, 2026-11-16, migration 0214). Kept free
// of React Native so it can be tested; the Android widget draws these rows
// and the iPhone widget (targets/calendar-widget) does the same in Swift.
//
// What shows: the trainer's booked 1 on 1 sessions. A name only drops off
// once it's marked trained or cancelled in the app (status leaves "booked").
// One that's over but not marked stays at the top with a "?" (orange). The
// session on now, or else the next one, is gold. Up to 6 show. When nothing
// is left today, tomorrow's sessions show under "Tomorrow".

export type WidgetSession = { id: string; starts_at: string; minutes: number; name: string };

export type WidgetRow = {
  /** The first session's id: tapping opens it. */
  id: string;
  /** "07:10" */
  time: string;
  /** "Sarah K." or "Thandi & Jo" for a joint session. */
  name: string;
  /** over = over but not marked (orange ?); now = on now or next (gold). */
  state: "over" | "now" | "later";
  /** Tomorrow's sessions, when nothing is left today. */
  tomorrow: boolean;
};

export type WidgetView = { title: string; rows: WidgetRow[]; more: number };

export const WIDGET_MAX_ROWS = 6;

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "Sarah Kruger" → "Sarah K.", "Sharde" → "Sharde". */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Client";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function widgetView(sessions: WidgetSession[], now: Date = new Date()): WidgetView {
  const today = dayOf(now);
  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrow = dayOf(tomorrowDate);

  // Joint sessions (same start time) are one row: "Thandi & Jo".
  const groups = new Map<string, WidgetSession[]>();
  for (const s of [...sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.name.localeCompare(b.name))) {
    const key = new Date(s.starts_at).getTime().toString();
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const over: WidgetRow[] = [];
  const todayRows: WidgetRow[] = [];
  const tomorrowRows: WidgetRow[] = [];
  for (const list of groups.values()) {
    const first = list[0];
    const start = new Date(first.starts_at);
    const end = new Date(start.getTime() + Math.max(...list.map((s) => s.minutes)) * 60000);
    const name = list.length === 1 ? shortName(first.name) : list.map((s) => shortName(s.name).split(" ")[0]).join(" & ");
    const row: WidgetRow = { id: first.id, time: clock(start), name, state: "later", tomorrow: false };
    if (end <= now) over.push({ ...row, state: "over" });
    else if (dayOf(start) === today) todayRows.push(row);
    else if (dayOf(start) === tomorrow) tomorrowRows.push({ ...row, tomorrow: true });
  }

  const coming = todayRows.length ? todayRows : tomorrowRows;
  if (coming.length) coming[0] = { ...coming[0], state: "now" };
  const all = [...over, ...coming];
  return {
    title: todayRows.length || !tomorrowRows.length ? "Today" : "Tomorrow",
    rows: all.slice(0, WIDGET_MAX_ROWS),
    more: Math.max(0, all.length - WIDGET_MAX_ROWS),
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
