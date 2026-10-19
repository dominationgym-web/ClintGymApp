// Sleep from the client's watch (0124, GRIZZ, 2026-10-19: "track their sleep
// as well ... log their sleep when the client logs into the app"). Apple
// Health and Health Connect keep sleep as pieces: time in bed, asleep (light,
// deep, REM) and awake. This file turns those pieces into one row per night;
// src/lib/healthLink.ts reads them from the phone each time the app opens.
import { toIsoDate } from "@/lib/dates";
import type { HealthSource } from "@/lib/healthSync";

/** One piece of a night as the health app has it. */
export type SleepPiece = { start: Date; end: Date; kind: "in_bed" | "asleep" | "awake" };

export type SleepNight = {
  client_id: string;
  /** The morning the client woke up (the check-in day it belongs to). */
  sleep_date: string;
  bed_at: string;
  wake_at: string;
  asleep_minutes: number;
  awake_minutes: number;
  source: HealthSource;
};

const HOUR = 60 * 60 * 1000;

// Apple Health CategoryValueSleepAnalysis: 0 in bed, 1 asleep, 2 awake, 3 core, 4 deep, 5 REM.
export function applePieceKind(value: number): SleepPiece["kind"] | null {
  if (value === 0) return "in_bed";
  if (value === 2) return "awake";
  if (value === 1 || value === 3 || value === 4 || value === 5) return "asleep";
  return null;
}

// Health Connect SleepStageType: 1 awake, 2 sleeping, 3 out of bed, 4 light, 5 deep, 6 REM, 7 awake in bed.
export function healthConnectStageKind(stage: number): SleepPiece["kind"] | null {
  if (stage === 1 || stage === 3 || stage === 7) return "awake";
  if (stage === 2 || stage === 4 || stage === 5 || stage === 6) return "asleep";
  return null;
}

/**
 * The morning a piece belongs to. Anything that starts from midday the day
 * before up to midday counts toward that morning, so 22:30 to 06:00 belongs
 * to the day the client woke up.
 */
export function nightOf(start: Date): string {
  return toIsoDate(new Date(start.getTime() + 12 * HOUR));
}

/** Total minutes covered, counting overlaps once (a phone and a watch can both record the same night). */
export function coveredMinutes(pieces: { start: Date; end: Date }[]): number {
  const sorted = pieces.filter((p) => p.end > p.start).sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let curStart = 0;
  let curEnd = -1;
  for (const p of sorted) {
    const s = p.start.getTime();
    const e = p.end.getTime();
    if (s > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) {
      curEnd = e;
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return Math.round(total / 60000);
}

/**
 * One row per night. Asleep time is the asleep pieces; when the health app only
 * records time in bed (some phones without a watch), that counts instead.
 * Nights under an hour are left out (a nap or a watch left on the bedside).
 */
export function nightsFromPieces(clientId: string, source: HealthSource, pieces: SleepPiece[]): SleepNight[] {
  const byNight = new Map<string, SleepPiece[]>();
  for (const p of pieces) {
    if (!(p.end > p.start) || Number.isNaN(p.start.getTime()) || Number.isNaN(p.end.getTime())) continue;
    const key = nightOf(p.start);
    byNight.set(key, [...(byNight.get(key) ?? []), p]);
  }
  const nights: SleepNight[] = [];
  for (const [date, list] of byNight) {
    const asleepPieces = list.filter((p) => p.kind === "asleep");
    const asleep = coveredMinutes(asleepPieces.length ? asleepPieces : list.filter((p) => p.kind === "in_bed"));
    if (asleep < 60) continue;
    const bed = Math.min(...list.map((p) => p.start.getTime()));
    const wake = Math.max(...list.map((p) => p.end.getTime()));
    nights.push({
      client_id: clientId,
      sleep_date: date,
      bed_at: new Date(bed).toISOString(),
      wake_at: new Date(wake).toISOString(),
      asleep_minutes: Math.min(asleep, 1440),
      awake_minutes: Math.min(coveredMinutes(list.filter((p) => p.kind === "awake")), 1440),
      source,
    });
  }
  return nights.sort((a, b) => a.sleep_date.localeCompare(b.sleep_date));
}

/** "7 h 20 min" */
export function sleepLength(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The phone's local time as "22:30", for the check-in's sleep boxes. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
