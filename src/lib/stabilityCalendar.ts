import { supabase } from "@/lib/supabase";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { findArea, findProgram } from "@/lib/stability";
import type { ClientStabilityDay, ClientStabilityProgram, StabilityLog } from "@/types/database";

// Stability sessions on the calendar (0110, GRIZZ, 2026-10-18): days the
// trainer put a stability program on, and days the client logged one, in
// their own purple so they stand apart from workouts.

export const STABILITY_PURPLE = "#C084FC";

export type StabilityCalendarItem = { programId: string; label: string; done: boolean };

type ProgramLite = Pick<ClientStabilityProgram, "id" | "area" | "level" | "ended_at">;

/** Short calendar label for a stability program, e.g. "Knee". */
export function stabilityShortName(program: Pick<ClientStabilityProgram, "area">): string {
  return findArea(program.area).title;
}

/** Date → that day's stability sessions: logged ones as done, planned ones not yet. */
export function stabilityCalendarMap(
  programs: ProgramLite[],
  days: Pick<ClientStabilityDay, "stability_program_id" | "day">[],
  logs: Pick<StabilityLog, "stability_program_id" | "log_date">[],
): Record<string, StabilityCalendarItem[]> {
  const byId = new Map(programs.map((p) => [p.id, p]));
  const map: Record<string, StabilityCalendarItem[]> = {};
  const add = (date: string, programId: string, done: boolean) => {
    const p = byId.get(programId);
    if (!p) return;
    const list = (map[date] ??= []);
    const there = list.find((i) => i.programId === programId);
    if (there) there.done = there.done || done;
    else list.push({ programId, label: stabilityShortName(p), done });
  };
  for (const l of logs) add(l.log_date, l.stability_program_id, true);
  for (const d of days) {
    // Days planned after a program was stopped drop off the calendar.
    const p = byId.get(d.stability_program_id);
    if (p?.ended_at && d.day > toIsoDate(new Date(p.ended_at))) continue;
    add(d.day, d.stability_program_id, false);
  }
  return map;
}

/** The last day of a stability program, from its start and length in weeks. */
export function stabilityEndDate(program: Pick<ClientStabilityProgram, "area" | "level" | "started_on">): string {
  const end = parseIsoDate(program.started_on);
  end.setDate(end.getDate() + findProgram(program.area, program.level).weeks * 7 - 1);
  return toIsoDate(end);
}

/** `from` and the same weekday each week after it, up to and including `until`. */
export function sameWeekdayUntil(from: string, until: string): string[] {
  const out: string[] = [];
  const d = parseIsoDate(from);
  for (let date = from; date <= until; date = toIsoDate(d)) {
    out.push(date);
    d.setDate(d.getDate() + 7);
  }
  return out;
}

/** A client's stability programs, running or not, newest first. */
export async function loadStabilityPrograms(clientId: string): Promise<ClientStabilityProgram[]> {
  const { data } = await supabase
    .from("client_stability_programs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Planned stability days between two dates (removed ones left out). */
export async function loadStabilityDays(clientId: string, from: string, to: string): Promise<ClientStabilityDay[]> {
  const { data } = await supabase
    .from("client_stability_days")
    .select("*")
    .eq("client_id", clientId)
    .is("removed_at", null)
    .gte("day", from)
    .lte("day", to);
  return data ?? [];
}

// Which days a stability program was logged. Read a page at a time: one set
// is one row, so a month can pass Supabase's 1000-row cap.
async function loadLoggedDays(clientId: string, from: string, to: string) {
  const rows: Pick<StabilityLog, "stability_program_id" | "log_date">[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await supabase
      .from("stability_logs")
      .select("stability_program_id, log_date")
      .eq("client_id", clientId)
      .gte("log_date", from)
      .lte("log_date", to)
      .order("log_date")
      .range(start, start + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadStabilityCalendar(clientId: string, from: string, to: string) {
  const [programs, days, logs] = await Promise.all([
    loadStabilityPrograms(clientId),
    loadStabilityDays(clientId, from, to),
    loadLoggedDays(clientId, from, to),
  ]);
  return { programs, days, map: stabilityCalendarMap(programs, days, logs) };
}

/** Put a stability program on these days, skipping any it's already on. */
export async function addStabilityDays(clientId: string, programId: string, dates: string[]): Promise<string | null> {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  const { data: existing, error: readError } = await supabase
    .from("client_stability_days")
    .select("day")
    .eq("stability_program_id", programId)
    .is("removed_at", null)
    .gte("day", sorted[0])
    .lte("day", sorted[sorted.length - 1]);
  if (readError) return readError.message;
  const have = new Set((existing ?? []).map((d) => d.day));
  const rows = sorted.filter((day) => !have.has(day)).map((day) => ({ client_id: clientId, stability_program_id: programId, day }));
  if (rows.length === 0) return null;
  const { error } = await supabase.from("client_stability_days").insert(rows);
  return error?.message ?? null;
}

export async function removeStabilityDay(id: string): Promise<string | null> {
  const { error } = await supabase.from("client_stability_days").update({ removed_at: new Date().toISOString() }).eq("id", id);
  return error?.message ?? null;
}
