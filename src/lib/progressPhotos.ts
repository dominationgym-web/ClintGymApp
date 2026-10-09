// Plain helpers for private progress photos (see migration 0027). No Supabase
// or React Native imports, so they can be unit tested.
import { parseIsoDate } from "@/lib/dates";
import { imageExtension } from "@/lib/avatars";

export const PROGRESS_BUCKET = "progress-photos";

// The trainer wants a new progress photo every 6 weeks.
export const PROGRESS_PHOTO_INTERVAL_DAYS = 42;

export type ProgressPhotoStatus =
  // No photos yet: time for the "before" picture.
  | { kind: "before" }
  | { kind: "due"; daysOverdue: number }
  | { kind: "not_due"; daysLeft: number };

/** Whether a progress photo is due, from the date of the latest one (`YYYY-MM-DD`). */
export function progressPhotoStatus(lastTakenOn: string | null, today: string): ProgressPhotoStatus {
  if (!lastTakenOn) return { kind: "before" };
  // Round, because a daylight-saving change would make the gap a few hours off
  // a whole number of days (South Africa has none, but phones travel).
  const days = Math.round((parseIsoDate(today).getTime() - parseIsoDate(lastTakenOn).getTime()) / 86_400_000);
  const left = PROGRESS_PHOTO_INTERVAL_DAYS - days;
  return left <= 0 ? { kind: "due", daysOverdue: days - PROGRESS_PHOTO_INTERVAL_DAYS } : { kind: "not_due", daysLeft: left };
}

// Hour of the day (local time) the phone notification goes off on the day
// photos fall due.
export const PROGRESS_PHOTO_REMINDER_HOUR = 9;

/**
 * When to send the "time for your progress photos" phone notification: 9am on
 * the day the next set is due. Null when there is nothing to schedule, either
 * because the client hasn't opted in (no before photo) or because that moment
 * has already passed, in which case the in-app banner is doing the reminding.
 */
export function progressPhotoReminderAt(lastTakenOn: string | null, now: Date): Date | null {
  if (!lastTakenOn) return null;
  const at = parseIsoDate(lastTakenOn);
  // setDate rather than adding milliseconds, so it stays 9am local whatever
  // the calendar does in between.
  at.setDate(at.getDate() + PROGRESS_PHOTO_INTERVAL_DAYS);
  at.setHours(PROGRESS_PHOTO_REMINDER_HOUR, 0, 0, 0);
  return at.getTime() > now.getTime() ? at : null;
}

export type ProgressPhotoAngle = "front" | "side" | "back";

// Every update is a set of these three, full body from feet to head.
export const PROGRESS_ANGLES: ProgressPhotoAngle[] = ["front", "side", "back"];

export const ANGLE_LABEL: Record<ProgressPhotoAngle, string> = { front: "Front", side: "Side", back: "Back" };

// How long a half-finished set stays open for its missing angles before the
// next photo starts a new set instead.
export const OPEN_SET_DAYS = 7;

export type ProgressPhotoSet<T> = { takenOn: string; byAngle: Partial<Record<ProgressPhotoAngle, T>> };

/** Groups photos into sets by date, oldest set first. */
export function groupIntoSets<T extends { takenOn: string; angle: ProgressPhotoAngle }>(photos: T[]): ProgressPhotoSet<T>[] {
  const byDate = new Map<string, ProgressPhotoSet<T>>();
  for (const p of photos) {
    const set = byDate.get(p.takenOn) ?? { takenOn: p.takenOn, byAngle: {} };
    set.byAngle[p.angle] = p;
    byDate.set(p.takenOn, set);
  }
  return Array.from(byDate.values()).sort((a, b) => (a.takenOn < b.takenOn ? -1 : a.takenOn > b.takenOn ? 1 : 0));
}

export function isCompleteSet(set: ProgressPhotoSet<unknown>): boolean {
  return PROGRESS_ANGLES.every((a) => set.byAngle[a] !== undefined);
}

/**
 * The date new photos are filed under. A set the client started in the last
 * week but hasn't finished stays open, so front on Monday and side and back on
 * Tuesday still make one set. Otherwise it's a new set dated today.
 */
export function openSetDate(sets: ProgressPhotoSet<unknown>[], today: string): string {
  const latest = sets[sets.length - 1];
  if (!latest || latest.takenOn === today) return today;
  const age = Math.round((parseIsoDate(today).getTime() - parseIsoDate(latest.takenOn).getTime()) / 86_400_000);
  return !isCompleteSet(latest) && age < OPEN_SET_DAYS ? latest.takenOn : today;
}

export function progressPhotoPath(
  clientId: string,
  angle: ProgressPhotoAngle,
  mimeType: string | null | undefined,
  now = Date.now()
): string {
  return `${clientId}/progress-${angle}-${now}.${imageExtension(mimeType)}`;
}

/** Whole weeks from one `YYYY-MM-DD` date to a later one, rounded down. */
export function weeksBetween(from: string, to: string): number {
  const days = Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}

/** How a set is named in the history: the first is the before set, every
 * later one says how far into the journey it was taken. */
export function setLabel(sets: ProgressPhotoSet<unknown>[], index: number): string {
  if (index === 0) return "Before";
  const weeks = weeksBetween(sets[0].takenOn, sets[index].takenOn);
  return weeks === 0 ? `Set ${index + 1}` : `Week ${weeks}`;
}
