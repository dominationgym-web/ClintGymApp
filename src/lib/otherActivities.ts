// Exercise a client does outside their programs (0114, GRIZZ, 2026-10-18):
// walks, runs, rides, hikes, swims, sport, anything. They log how long, and
// can add the distance, average heart rate and how hard it felt. Used by the
// recovery suggestions and the trainer's daily summary.
import type { ClientActivity } from "@/types/database";

export type ActivityKind = ClientActivity["kind"];
export type ActivityEffort = NonNullable<ClientActivity["effort"]>;

export const ACTIVITY_KINDS: { key: ActivityKind; label: string; icon: string; distance: boolean }[] = [
  { key: "walk", label: "Walk", icon: "🚶", distance: true },
  { key: "run", label: "Run", icon: "🏃", distance: true },
  { key: "cycle", label: "Cycle", icon: "🚴", distance: true },
  { key: "hike", label: "Hike", icon: "🥾", distance: true },
  { key: "swim", label: "Swim", icon: "🏊", distance: true },
  { key: "sport", label: "Sport", icon: "⚽", distance: false },
  { key: "other", label: "Other", icon: "💪", distance: false },
];

export const ACTIVITY_EFFORTS: { key: ActivityEffort; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "moderate", label: "Moderate" },
  { key: "hard", label: "Hard" },
];

export function findActivityKind(key: string) {
  return ACTIVITY_KINDS.find((k) => k.key === key) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];
}

/** "Run", or the client's own name for it ("Padel"). */
export function activityTitle(a: Pick<ClientActivity, "kind" | "name">): string {
  return a.name?.trim() || findActivityKind(a.kind).label;
}

/** "45 min · 5.2 km · 142 bpm · Hard" */
export function activityDetails(a: Pick<ClientActivity, "minutes" | "distance_km" | "avg_hr" | "effort">): string {
  const parts = [`${a.minutes} min`];
  if (a.distance_km !== null && Number(a.distance_km) > 0) parts.push(`${Number(a.distance_km)} km`);
  if (a.avg_hr) parts.push(`${a.avg_hr} bpm`);
  if (a.effort) parts.push(ACTIVITY_EFFORTS.find((e) => e.key === a.effort)?.label ?? a.effort);
  return parts.join(" · ");
}

/** Minutes per km for runs and walks ("5:30 /km"), when a distance was given. */
export function activityPace(a: Pick<ClientActivity, "kind" | "minutes" | "distance_km">): string | null {
  const km = Number(a.distance_km);
  if (!km || !["walk", "run", "hike"].includes(a.kind)) return null;
  const perKm = a.minutes / km;
  if (perKm < 2 || perKm > 40) return null;
  const whole = Math.floor(perKm);
  const secs = Math.round((perKm - whole) * 60);
  return secs === 60 ? `${whole + 1}:00 /km` : `${whole}:${String(secs).padStart(2, "0")} /km`;
}

/**
 * Reads what the client typed: whole minutes, a distance with a comma or dot,
 * a heart rate. Returns an error message for anything that won't save.
 */
export function parseActivityForm(form: { minutes: string; distance: string; hr: string }):
  | { ok: true; minutes: number; distance_km: number | null; avg_hr: number | null }
  | { ok: false; error: string } {
  const minutes = Number(form.minutes.trim());
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return { ok: false, error: "Enter how many minutes it took." };
  const d = form.distance.trim().replace(",", ".");
  const distance = d ? Number(d) : null;
  if (distance !== null && (!Number.isFinite(distance) || distance < 0 || distance > 1000)) {
    return { ok: false, error: "The distance should be a number of km, like 5 or 5.2." };
  }
  const h = form.hr.trim();
  const hr = h ? Number(h) : null;
  if (hr !== null && (!Number.isInteger(hr) || hr < 30 || hr > 230)) {
    return { ok: false, error: "Average heart rate should be beats per minute, like 140." };
  }
  return { ok: true, minutes, distance_km: distance ? Math.round(distance * 100) / 100 : null, avg_hr: hr };
}

/** A hard or long session: counts as a training day for recovery. */
export function isBigActivity(a: Pick<ClientActivity, "minutes" | "effort">): boolean {
  return a.effort === "hard" || a.minutes >= 60;
}
