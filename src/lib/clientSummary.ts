// The trainer's daily summary of a client's energy and needs (GRIZZ,
// 2026-10-18: "Based on the clients daily login and there weekly training and
// performance ... a brief summary and suggestion on the client's energy and
// needs ... Not just end of week. Daily based on the weeks training.").
//
// weekFacts() boils the last 7 days down to plain numbers: daily check-ins and
// "How are you doing?" answers, workouts planned and done, how hard the sets
// were, outside exercise and habits. ruleSummary() turns those into an energy
// level, a short summary and suggestions with plain rules, so there's always
// something to show. The client-daily-summary edge function sends the same
// facts to Claude for a better written version (src/components/ClientDailySummaryCard.tsx).
import { addDays } from "@/lib/programSchedule";
import { sleepHours } from "@/lib/checkinFeedback";
import { activityTitle, isBigActivity } from "@/lib/otherActivities";
import type { Checkin, ClientActivity, ClientStatusFlag, SetEffort, WorkoutSessionStatus } from "@/types/database";

export type SummaryInputs = {
  checkins: Pick<
    Checkin,
    | "checkin_date"
    | "sleep_bed_time"
    | "sleep_wake_time"
    | "sleep_quality"
    | "alcohol_units"
    | "water_litres"
    | "pain_status"
    | "pain_area"
    | "fatigue_status"
    | "fatigue_cause"
    | "mental_status"
    | "mental_cause"
  >[];
  /** The client's own "How are you doing?" answers (client_status_flag_events). */
  flags: { date: string; flag: ClientStatusFlag; note: string | null }[];
  /** Days with a main workout on the calendar. */
  planned: string[];
  sessions: {
    session_date: string;
    status: WorkoutSessionStatus;
    reason: string | null;
    star: boolean;
    makeup_for: string | null;
    improvements: unknown[] | null;
  }[];
  /** Working sets (warm-ups left out). */
  sets: { log_date: string; effort: SetEffort; gauge?: boolean | null }[];
  activities: Pick<ClientActivity, "activity_date" | "kind" | "name" | "minutes" | "distance_km" | "avg_hr" | "effort">[];
  /** Habit days due and done in the window. */
  habits: { due: number; done: number };
  /** Open problems (pain, fatigue, mental, flag) the trainer hasn't fixed yet. */
  openProblems: string[];
  /** Injuries not yet healed. */
  injuries: string[];
  /** Nights from the client's watch (0124), dated the morning they woke. */
  sleep?: { sleep_date: string; asleep_minutes: number }[];
};

export type WeekFacts = {
  from: string;
  to: string;
  days: number;
  checkinDays: number;
  /** Days the client opened the app and answered something (check-in or status). */
  activeDays: number;
  /** Average hours a night: the watch's asleep time where there is one, else the check-in's bed and wake times. */
  sleepHours: number | null;
  sleepQuality: number | null;
  /** Hours asleep each night the watch recorded, oldest first. */
  watchSleep: { date: string; hours: number }[];
  alcoholUnits: number;
  waterLitres: number | null;
  painDays: number;
  painAreas: string[];
  fatigueDays: number;
  fatigueCauses: string[];
  mentalDays: number;
  mentalCauses: string[];
  redFlags: number;
  orangeFlags: number;
  flagNotes: string[];
  workoutsPlanned: number;
  workoutsDone: number;
  workoutsPartial: number;
  workoutsMissed: number;
  missedReasons: string[];
  stars: number;
  improvements: number;
  workingSets: number;
  /** Share of working sets taken to failure (0-1), gauge sets left out. */
  failureShare: number | null;
  /** Share of working sets that felt comfortable (0-1). */
  comfortableShare: number | null;
  otherActivities: { date: string; what: string; minutes: number; km: number | null; hr: number | null; effort: string | null }[];
  otherMinutes: number;
  bigOtherSessions: number;
  habitsDue: number;
  habitsDone: number;
  openProblems: string[];
  injuries: string[];
};

export type Energy = "High" | "Good" | "Low" | "Very low" | "Not enough info";
export const ENERGY_LEVELS: Energy[] = ["High", "Good", "Low", "Very low", "Not enough info"];
export const ENERGY_COLOR: Record<Energy, string> = {
  High: "#22C55E",
  Good: "#84CC16",
  Low: "#F59E0B",
  "Very low": "#EF4444",
  "Not enough info": "#94A3B8",
};

export type DailySummary = { energy: Energy; summary: string; suggestions: string[] };

const avg = (v: number[]) => (v.length ? v.reduce((t, x) => t + x, 0) / v.length : null);
const half = (n: number) => Math.round(n * 2) / 2;
const uniq = (v: (string | null | undefined)[]) => [...new Set(v.map((x) => x?.trim()).filter((x): x is string => !!x))];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Habit days due from `from` to `today` and how many were done (today counts only once done). */
export function habitDays(
  habits: { id: string; active_days: number[]; reps_target: number; start_date: string; end_date: string | null }[],
  logs: { habit_id: string; log_date: string; reps_completed: number }[],
  from: string,
  today: string,
): { due: number; done: number } {
  const reps = new Map(logs.map((l) => [`${l.habit_id}|${l.log_date}`, l.reps_completed]));
  let due = 0;
  let done = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const weekday = new Date(`${d}T12:00:00`).getDay();
    for (const h of habits) {
      if (d < h.start_date || (h.end_date && d > h.end_date) || !h.active_days.includes(weekday)) continue;
      const ok = (reps.get(`${h.id}|${d}`) ?? 0) >= h.reps_target;
      if (d === today && !ok) continue;
      due += 1;
      if (ok) done += 1;
    }
  }
  return { due, done };
}

/** The last 7 days up to and including `today`. */
export function weekFacts(input: SummaryInputs, today: string): WeekFacts {
  const from = addDays(today, -6);
  const inWeek = (d: string) => d >= from && d <= today;
  const checkins = input.checkins.filter((c) => inWeek(c.checkin_date));
  const flags = input.flags.filter((f) => inWeek(f.date));
  const sessions = input.sessions.filter((s) => inWeek(s.session_date));
  const sets = input.sets.filter((s) => inWeek(s.log_date));
  const activities = input.activities.filter((a) => inWeek(a.activity_date));
  const watchNights = (input.sleep ?? []).filter((n) => inWeek(n.sleep_date) && n.asleep_minutes > 0);

  const doneDays = new Set(sessions.filter((s) => s.status !== "missed").map((s) => s.session_date));
  const madeUp = new Set(sessions.map((s) => s.makeup_for).filter((d): d is string => !!d));
  const planned = [...new Set(input.planned.filter(inWeek))];
  // A planned day that has passed with nothing done (and wasn't caught up later).
  const missedDays = planned.filter((d) => d < today && !doneDays.has(d) && !madeUp.has(d));

  const counted = sets.filter((s) => !s.gauge);
  const share = (e: SetEffort) => (counted.length ? counted.filter((s) => s.effort === e).length / counted.length : null);

  const pain = checkins.filter((c) => c.pain_status === "reported");
  const fatigue = checkins.filter((c) => c.fatigue_status === "reported");
  const mental = checkins.filter((c) => c.mental_status === "reported");

  return {
    from,
    to: today,
    days: 7,
    checkinDays: new Set(checkins.map((c) => c.checkin_date)).size,
    activeDays: new Set([...checkins.map((c) => c.checkin_date), ...flags.map((f) => f.date)]).size,
    sleepHours: (() => {
      const byDay = new Map<string, number>();
      for (const c of checkins) {
        const h = sleepHours(c.sleep_bed_time, c.sleep_wake_time);
        if (h !== null) byDay.set(c.checkin_date, h);
      }
      for (const n of watchNights) byDay.set(n.sleep_date, n.asleep_minutes / 60);
      const h = avg([...byDay.values()]);
      return h === null ? null : half(h);
    })(),
    sleepQuality: (() => {
      const q = avg(checkins.map((c) => c.sleep_quality).filter((x): x is NonNullable<typeof x> => x !== null));
      return q === null ? null : half(q);
    })(),
    watchSleep: watchNights
      .slice()
      .sort((a, b) => a.sleep_date.localeCompare(b.sleep_date))
      .map((n) => ({ date: n.sleep_date, hours: Math.round((n.asleep_minutes / 60) * 10) / 10 })),
    alcoholUnits: checkins.reduce((t, c) => t + (Number(c.alcohol_units) || 0), 0),
    waterLitres: (() => {
      const w = avg(checkins.map((c) => Number(c.water_litres) || 0));
      return w === null ? null : Math.round(w * 10) / 10;
    })(),
    painDays: pain.length,
    painAreas: uniq(pain.flatMap((c) => (c.pain_area ?? "").split(","))),
    fatigueDays: fatigue.length,
    fatigueCauses: uniq(fatigue.map((c) => c.fatigue_cause)),
    mentalDays: mental.length,
    mentalCauses: uniq(mental.map((c) => c.mental_cause)),
    redFlags: flags.filter((f) => f.flag === "red").length,
    orangeFlags: flags.filter((f) => f.flag === "orange").length,
    flagNotes: uniq(flags.filter((f) => f.flag !== "green").map((f) => f.note)).slice(0, 3),
    workoutsPlanned: planned.length,
    workoutsDone: sessions.filter((s) => s.status === "complete").length,
    workoutsPartial: sessions.filter((s) => s.status === "partial").length,
    workoutsMissed: missedDays.length,
    missedReasons: uniq(sessions.filter((s) => s.status !== "complete").map((s) => s.reason)).slice(0, 3),
    stars: sessions.filter((s) => s.star).length,
    improvements: sessions.reduce((t, s) => t + (s.improvements?.length ?? 0), 0),
    workingSets: sets.length,
    failureShare: share("failure"),
    comfortableShare: share("comfortable"),
    otherActivities: activities.map((a) => ({
      date: a.activity_date,
      what: activityTitle(a),
      minutes: a.minutes,
      km: a.distance_km === null ? null : Number(a.distance_km),
      hr: a.avg_hr,
      effort: a.effort,
    })),
    otherMinutes: activities.reduce((t, a) => t + a.minutes, 0),
    bigOtherSessions: activities.filter(isBigActivity).length,
    habitsDue: input.habits.due,
    habitsDone: input.habits.done,
    openProblems: input.openProblems,
    injuries: input.injuries,
  };
}

/** Points up for signs of good energy, down for signs of low energy. */
export function energyOf(f: WeekFacts): Energy {
  const hasData = f.checkinDays + f.workoutsDone + f.workoutsPartial + f.otherActivities.length > 0;
  if (!hasData) return "Not enough info";
  let score = 0;
  if (f.sleepHours !== null) score += f.sleepHours < 6 ? -2 : f.sleepHours < 7 ? -1 : f.sleepHours >= 7.5 ? 1 : 0;
  if (f.sleepQuality !== null) score += f.sleepQuality <= 2.5 ? -1 : f.sleepQuality >= 4 ? 1 : 0;
  score -= f.fatigueDays >= 2 ? 2 : f.fatigueDays;
  if (f.mentalDays >= 2) score -= 1;
  score -= f.redFlags > 0 ? 2 : f.orangeFlags > 0 ? 1 : 0;
  if (f.workoutsMissed >= 2) score -= 1;
  if (f.failureShare !== null && f.workingSets >= 10 && f.failureShare >= 0.4) score -= 1;
  if (f.alcoholUnits >= 14) score -= 1;
  if (f.workoutsPlanned > 0 && f.workoutsMissed === 0 && f.workoutsDone >= f.workoutsPlanned - f.workoutsPartial) score += 1;
  if (f.improvements > 0 || f.stars > 0) score += 1;
  return score >= 2 ? "High" : score >= 0 ? "Good" : score >= -2 ? "Low" : "Very low";
}

/** The summary and suggestions worked out with plain rules. */
export function ruleSummary(f: WeekFacts): DailySummary {
  const energy = energyOf(f);
  const lines: string[] = [];
  const tips: string[] = [];

  if (energy === "Not enough info") {
    return {
      energy,
      summary: `No check-ins or workouts logged in the last 7 days, so there's nothing to go on yet.`,
      suggestions: ["Check in with them personally to see how they're doing and remind them about the daily check-in."],
    };
  }

  lines.push(`Checked in ${f.checkinDays} of 7 days.`);
  if (f.sleepHours !== null) {
    lines.push(`Sleeping about ${f.sleepHours} hours${f.sleepQuality !== null ? `, quality ${f.sleepQuality}/5` : ""}.`);
  }
  if (f.workoutsPlanned > 0 || f.workoutsDone > 0) {
    const done = f.workoutsDone + f.workoutsPartial;
    lines.push(
      `Training: ${done} workout${done === 1 ? "" : "s"} done${f.workoutsPlanned ? ` of ${f.workoutsPlanned} planned` : ""}` +
        (f.workoutsPartial ? ` (${f.workoutsPartial} not finished)` : "") +
        (f.workoutsMissed ? `, ${f.workoutsMissed} missed` : "") +
        (f.missedReasons.length ? ` (${f.missedReasons.join("; ")})` : "") +
        ".",
    );
  }
  if (f.otherActivities.length) {
    lines.push(`Also did ${plural(f.otherActivities.length, "other session")} (${uniq(f.otherActivities.map((a) => a.what)).join(", ")}), ${f.otherMinutes} min in total.`);
  }
  const body: string[] = [];
  if (f.painDays) body.push(`pain ${plural(f.painDays, "day")}${f.painAreas.length ? ` (${f.painAreas.join(", ")})` : ""}`);
  if (f.fatigueDays) body.push(`tired ${plural(f.fatigueDays, "day")}${f.fatigueCauses.length ? ` (${f.fatigueCauses.join(", ")})` : ""}`);
  if (f.mentalDays) body.push(`stressed ${plural(f.mentalDays, "day")}${f.mentalCauses.length ? ` (${f.mentalCauses.join(", ")})` : ""}`);
  if (body.length) lines.push(`Reported ${body.join(", ")}.`);
  if (f.habitsDue) lines.push(`Habits: ${f.habitsDone} of ${f.habitsDue} done.`);
  if (f.redFlags || f.orangeFlags) lines.push(`Asked for help ${plural(f.redFlags + f.orangeFlags, "time")}${f.flagNotes.length ? `: "${f.flagNotes[0]}"` : ""}.`);

  // What to do about it, most important first.
  if (f.redFlags) tips.push("They flagged something urgent this week: talk to them before changing their training.");
  if (f.painDays || f.injuries.length) {
    const areas = uniq([...f.painAreas, ...f.injuries]).join(", ");
    tips.push(`Check their ${areas || "pain"} before the next sessions and swap any exercise that loads it.`);
  }
  if (energy === "Very low" || energy === "Low") {
    tips.push(
      f.workoutsMissed >= 2 || f.fatigueDays >= 2
        ? "Keep next week the same or lighter (fewer sets or a deload) rather than adding more."
        : "Hold the weights where they are for now and focus on getting through the sessions.",
    );
  }
  if (f.sleepHours !== null && f.sleepHours < 6.5) tips.push("Sleep is short: an earlier bedtime will help their energy more than more training.");
  if (f.mentalDays >= 2 || f.mentalCauses.length) tips.push("Life stress is up: keep sessions short and doable, and check in with them personally.");
  if (f.failureShare !== null && f.workingSets >= 10 && f.failureShare >= 0.4) {
    tips.push(`${Math.round(f.failureShare * 100)}% of sets went to failure: they may be pushing too hard. Keep weights steady.`);
  }
  if (f.bigOtherSessions >= 2) tips.push("Several long or hard sessions outside the program: count them as training load and plan a rest day.");
  if ((energy === "High" || energy === "Good") && f.workoutsMissed === 0 && f.workoutsDone > 0) {
    tips.push(
      f.comfortableShare !== null && f.comfortableShare >= 0.6
        ? "Most sets felt comfortable: they're ready for a little more weight next week."
        : "On track: go ahead with next week as planned.",
    );
  }
  if (f.checkinDays <= 3) tips.push("Few check-ins this week: remind them the daily check-in helps you plan their training.");
  if (f.alcoholUnits >= 14) tips.push(`About ${f.alcoholUnits} units of alcohol this week will slow recovery.`);

  return { energy, summary: lines.slice(0, 6).join(" "), suggestions: tips.slice(0, 4) };
}
