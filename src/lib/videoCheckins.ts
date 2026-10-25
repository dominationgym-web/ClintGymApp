import type { VideoCheckin, VideoCheckinSettings, VideoCheckinSlot } from "@/types/database";

// Weekly video check-ins (0152, GRIZZ 2026-10-25). The trainer sets the times
// they're free each week; a client books one, the trainer confirms, and both
// get reminders the day before and 15 minutes before, plus a pop-up on the
// day. The call itself happens on WhatsApp (GRIZZ: "Can do that via WhatsApp
// easier"), so the app only opens the chat.

export const VIDEO_CHECKIN_MENU_ITEM = {
  key: "videoCheckin",
  title: "Video check-in",
  icon: "📹",
  summary: "Book a weekly video call with your coach. You get a reminder the day before and 15 minutes before.",
};

export const TRAINER_VIDEO_CHECKINS_MENU_ITEM = {
  key: "videoCheckins",
  title: "Video check-ins",
  icon: "📹",
  summary: "Set the times you're free each week. Clients book one, you confirm, and you both get reminders.",
};

// Sunday is 0, as Date.getDay() and Postgres's extract(dow).
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Monday first, the way people think of their week.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const CALL_LENGTHS = [15, 20, 30, 45, 60];

// Times a trainer can add, every half hour from 05:00 to 21:30.
export const SLOT_TIMES: string[] = Array.from({ length: 34 }, (_, i) => {
  const mins = 5 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

/** "17:00:00" from the database → "17:00". */
export function slotTime(t: string): string {
  return t.slice(0, 5);
}

/** The trainer's active slots for one weekday, earliest first. */
export function slotsForDay(slots: VideoCheckinSlot[], weekday: number): VideoCheckinSlot[] {
  return slots.filter((s) => s.active && s.weekday === weekday).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/** The phone's own time zone, saved with the trainer's times. */
export function phoneTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg";
  } catch {
    return "Africa/Johannesburg";
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 28 Oct, 17:00" in the phone's own time. */
export function checkinWhen(startsAt: string | Date): string {
  const d = new Date(startsAt);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "17:00" in the phone's own time. */
export function checkinClock(startsAt: string | Date): string {
  const d = new Date(startsAt);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Today", "Tomorrow" or "Tue 28 Oct" for the day of a booking. */
export function checkinDay(startsAt: string | Date, now: Date = new Date()): string {
  const d = new Date(startsAt);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Open times grouped by day (phone time), in order. */
export function groupByDay<T extends { starts_at: string }>(rows: T[], now: Date = new Date()): { day: string; rows: T[] }[] {
  const groups: { day: string; rows: T[] }[] = [];
  for (const r of [...rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const day = checkinDay(r.starts_at, now);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else groups.push({ day, rows: [r] });
  }
  return groups;
}

/** The Monday a time's week starts on (phone time), e.g. "2026-10-26": one booking per week. */
export function weekKey(startsAt: string | Date): string {
  const d = new Date(startsAt);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

/** Splits open times into this week (to Sunday) and next week, phone time. */
export function splitWeeks<T extends { starts_at: string }>(rows: T[], now: Date = new Date()): { thisWeek: T[]; nextWeek: T[] } {
  const daysToSunday = (7 - now.getDay()) % 7;
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday + 1).getTime();
  return {
    thisWeek: rows.filter((r) => new Date(r.starts_at).getTime() < endOfWeek),
    nextWeek: rows.filter((r) => new Date(r.starts_at).getTime() >= endOfWeek),
  };
}

/** Still to come (or happening now): booked or confirmed, not over yet. */
export function isUpcoming(v: Pick<VideoCheckin, "status" | "starts_at" | "minutes">, now: Date = new Date()): boolean {
  if (v.status !== "requested" && v.status !== "confirmed") return false;
  return new Date(v.starts_at).getTime() + v.minutes * 60000 > now.getTime();
}

/** The WhatsApp button shows from 15 minutes before until the call's time is up. */
export function canJoin(v: Pick<VideoCheckin, "status" | "starts_at" | "minutes">, now: Date = new Date()): boolean {
  if (v.status !== "confirmed") return false;
  const start = new Date(v.starts_at).getTime();
  return now.getTime() >= start - 15 * 60000 && now.getTime() <= start + v.minutes * 60000;
}

/** Can still be cancelled (it hasn't started). */
export function canCancel(v: Pick<VideoCheckin, "status" | "starts_at">, now: Date = new Date()): boolean {
  return (v.status === "requested" || v.status === "confirmed") && new Date(v.starts_at).getTime() > now.getTime();
}

/** A phone number as wa.me wants it: digits only, a leading 0 becomes 27 (South Africa). */
export function whatsappDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^0/, "27");
  return digits.length >= 9 ? digits : null;
}

/**
 * Opens WhatsApp with the other person: the client gets their coach's chat,
 * the trainer gets the client's. WhatsApp can't open straight into a video
 * call, so they tap the video button there.
 */
export function whatsappLink(phone: string | null | undefined): string | null {
  const number = whatsappDigits(phone);
  return number ? `https://wa.me/${number}` : null;
}

/** Ready for clients to book: has times and a WhatsApp number, and isn't paused. */
export function setupReady(settings: VideoCheckinSettings | null, slots: VideoCheckinSlot[]): boolean {
  if (!settings || settings.paused) return false;
  return slots.some((s) => s.active) && !!whatsappDigits(settings.whatsapp);
}

/** Today's confirmed check-in that isn't over yet, for the pop-up on the day. */
export function todaysCheckin<T extends Pick<VideoCheckin, "status" | "starts_at" | "minutes">>(rows: T[], now: Date = new Date()): T | null {
  return (
    [...rows]
      .filter((v) => v.status === "confirmed" && isUpcoming(v, now) && checkinDay(v.starts_at, now) === "Today")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
  );
}

export const STATUS_LABEL: Record<VideoCheckin["status"], string> = {
  requested: "Waiting for your coach to confirm",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};
