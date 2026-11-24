import type { InboxItem } from "@/types/database";

// The pure parts of the 🔔 inbox (0232), kept apart so they can be tested.

/** How many the inbox page loads. Older ones stay in the database. */
export const INBOX_PAGE = 60;

export function inboxType(item: Pick<InboxItem, "data">): string {
  const t = item.data?.type;
  return typeof t === "string" ? t : "";
}

/** A coach message gets its own page; everything else opens what it's about. */
export function isCoachMessage(item: Pick<InboxItem, "data">): boolean {
  return inboxType(item) === "coach_message";
}

const ICONS: [RegExp, string][] = [
  [/^coach_message$/, "💬"],
  [/^problem_reply$/, "💬"],
  [/^(checkin_wellbeing|injury_check)$/, "🩹"],
  [/^video_checkin/, "📹"],
  [/^live_session/, "📅"],
  [/^(session_invoice|session_invoices|payment_proof|client_fees|billing|plan_|trainer_plan|trainer_fees|client_plan)/, "🧾"],
  [/^(achievement|workout_star|habit_win|challenge|award)/, "🏆"],
  [/^(workout_session|workout_swap|catch_up|plan_next_week|deload_due|training_level|timer_workout)/, "🏋️"],
  [/^(client_signup|client_activated|trainer_signup|trainer_approved|referral)/, "👋"],
  [/^coach_holiday$/, "🏖️"],
  [/^(steps|weigh_in)$/, "📈"],
  [/^(login_help|trainer_problem)/, "🛟"],
];

/**
 * Many push titles already start with an emoji ("📅 Session confirmed"): that
 * one becomes the row's icon and leaves the title, so it isn't shown twice.
 */
export function inboxTitle(item: Pick<InboxItem, "data" | "title">): { icon: string; title: string } {
  const m = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u.exec(item.title);
  if (m && item.title.length > m[0].length) return { icon: m[1], title: item.title.slice(m[0].length) };
  return { icon: inboxIcon(item), title: item.title };
}

export function inboxIcon(item: Pick<InboxItem, "data">): string {
  const type = inboxType(item);
  for (const [re, icon] of ICONS) if (re.test(type)) return icon;
  return "🔔";
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Unread first ("New"), the rest under "Earlier", each newest first. */
export function splitInbox<T extends Pick<InboxItem, "read_at" | "created_at">>(items: T[]): { fresh: T[]; earlier: T[] } {
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { fresh: sorted.filter((i) => !i.read_at), earlier: sorted.filter((i) => !!i.read_at) };
}

/** "9+" past nine, so the bell's badge stays small. */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/** A notification sitting on the phone, with the inbox row it came from. */
export type ShownNotification = { identifier: string; data: unknown };

/** The inbox id a push carries (push_to_user adds 'inboxId' since 0232). */
export function shownInboxId(n: Pick<ShownNotification, "data">): string | null {
  const data = n.data && typeof n.data === "object" ? (n.data as Record<string, unknown>) : null;
  const id = data?.inboxId;
  return typeof id === "string" && id ? id : null;
}

/**
 * Which phone notifications to take away: the ones whose inbox row is already
 * dealt with (read, or cleared by the server once the session was marked, 0236).
 * Anything without an inbox id, or still unread, stays.
 */
export function notificationsToClear(shown: ShownNotification[], dealtWith: Set<string>): string[] {
  return shown.filter((n) => {
    const id = shownInboxId(n);
    return id !== null && dealtWith.has(id);
  }).map((n) => n.identifier);
}
