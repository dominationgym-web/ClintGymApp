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

export function progressPhotoPath(clientId: string, mimeType: string | null | undefined, now = Date.now()): string {
  return `${clientId}/progress-${now}.${imageExtension(mimeType)}`;
}
