import type { IntervalPhase } from "@/lib/intervalTimer";
import { formatClock } from "@/lib/programs";

// Timer section (GRIZZ, 2026-10-25): EMOM, Tabata and a custom work/rest
// interval timer, with how many rounds to repeat. Exercises are optional:
// add some and each effort names the one to do, or leave them out and just
// use the clock. Trainers can save one for a client (0152); anyone can save
// their own. The phases run in IntervalTimerModal.
// Boxing rounds (GRIZZ, 2026-10-26): 2-6 minute rounds, 30-90 seconds rest,
// up to 12 rounds, with a bell like a fight timer.

export type TimerKind = "emom" | "tabata" | "custom" | "boxing";

export type TimerSettings = {
  kind: TimerKind;
  // EMOM: the length of each interval (60 = every minute). Tabata and custom: work seconds.
  // Boxing: the round length (whole minutes, 2 to 6).
  work: number;
  // Tabata and custom: rest after each effort. Not used by EMOM.
  rest: number;
  // EMOM: how many intervals. Tabata: rounds in each Tabata. Custom: rounds.
  rounds: number;
  // Tabata: how many Tabatas. Not used by the others.
  sets: number;
  // Tabata: rest between Tabatas. Custom: rest between rounds, when it has
  // more than one exercise (0 = the normal rest).
  setRest: number;
  // Tabata only: change exercise every round (A, B, A, B...) or every Tabata.
  switchEach: "round" | "set";
  // What to do, e.g. "10 burpees" or "Kettlebell swings". Empty = just the timer.
  exercises: string[];
};

export const TIMER_KINDS: { kind: TimerKind; title: string; icon: string; summary: string }[] = [
  { kind: "emom", title: "EMOM", icon: "⏰", summary: "Every minute on the minute: do the work, rest what's left of the minute." },
  { kind: "tabata", title: "Tabata", icon: "🔥", summary: "20 seconds all-out, 10 seconds rest, 8 rounds. Repeat for more Tabatas." },
  { kind: "custom", title: "Intervals", icon: "⏱", summary: "Your own work and rest times, for as many rounds as you like." },
  { kind: "boxing", title: "Boxing", icon: "🥊", summary: "Fight rounds with a bell: 2 to 6 minute rounds, 30 to 90 seconds rest, up to 12 rounds. A clapper warns 10 seconds before each round ends." },
];

export const TIMER_MENU_ITEM = {
  key: "timers",
  title: "Timers (EMOM, Tabata, boxing)",
  icon: "⏱",
  summary: "EMOM, Tabata, boxing rounds and your own work and rest intervals, with or without exercises.",
};

export function defaultSettings(kind: TimerKind): TimerSettings {
  const base = { sets: 1, setRest: 0, switchEach: "round" as const, exercises: [] };
  if (kind === "emom") return { ...base, kind, work: 60, rest: 0, rounds: 10 };
  if (kind === "tabata") return { ...base, kind, work: 20, rest: 10, rounds: 8, setRest: 60 };
  if (kind === "boxing") return { ...base, kind, work: 180, rest: 60, rounds: 6 };
  return { ...base, kind, work: 40, rest: 20, rounds: 5, setRest: 60 };
}

// The steps each number moves by, and its limits.
export const LIMITS = {
  work: { min: 5, max: 600 },
  emomInterval: { min: 30, max: 600 },
  rest: { min: 0, max: 600 },
  rounds: { min: 1, max: 60 },
  sets: { min: 1, max: 10 },
  setRest: { min: 0, max: 600 },
  boxingRound: { min: 120, max: 360 },
  boxingRest: { min: 30, max: 90 },
  boxingRounds: { min: 1, max: 12 },
};

// Boxing seconds before the end of a round when the clapper sounds.
export const BOXING_WARNING_SECONDS = 10;

// Countdown sounds (GRIZZ, 2026-10-26): three round knocks with 30 seconds
// left, a clock tick through the last 10 seconds and a sharper beep for the
// last 3. Short phases (under 40 seconds) skip the knocks, and nothing plays
// on the phase's first second so it doesn't clash with the switch sound.
export const KNOCK_SECONDS = 30;
export const TICKER_SECONDS = 10;
export type CountdownCue = "knock" | "ticker" | "tick" | "clapper";

/** The sound for this second of a countdown, or null for none. */
export function countdownCue(left: number, phaseSeconds: number, boxingRound = false): CountdownCue | null {
  if (left < 1 || left >= phaseSeconds) return null;
  if (left === KNOCK_SECONDS && phaseSeconds >= 40) return "knock";
  if (boxingRound && left === BOXING_WARNING_SECONDS) return "clapper";
  if (left <= 3) return "tick";
  if (left <= TICKER_SECONDS) return "ticker";
  return null;
}

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(max, Math.max(min, v));
};

export const MAX_EXERCISES = 12;

/** Settings read back from a saved timer, with anything odd put right. */
export function cleanSettings(raw: unknown): TimerSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<TimerSettings>;
  const kind: TimerKind = r.kind === "emom" || r.kind === "tabata" || r.kind === "custom" || r.kind === "boxing" ? r.kind : "custom";
  const d = defaultSettings(kind);
  const exercises = Array.isArray(r.exercises)
    ? r.exercises.filter((e): e is string => typeof e === "string").map((e) => e.trim()).filter(Boolean).slice(0, MAX_EXERCISES)
    : [];
  if (kind === "boxing") {
    return {
      ...d,
      // Whole minutes.
      work: Math.round(clamp(r.work, LIMITS.boxingRound.min, LIMITS.boxingRound.max, d.work) / 60) * 60,
      rest: clamp(r.rest, LIMITS.boxingRest.min, LIMITS.boxingRest.max, d.rest),
      rounds: clamp(r.rounds, LIMITS.boxingRounds.min, LIMITS.boxingRounds.max, d.rounds),
      exercises,
    };
  }
  return {
    kind,
    work: kind === "emom" ? clamp(r.work, LIMITS.emomInterval.min, LIMITS.emomInterval.max, d.work) : clamp(r.work, LIMITS.work.min, LIMITS.work.max, d.work),
    rest: clamp(r.rest, LIMITS.rest.min, LIMITS.rest.max, d.rest),
    rounds: clamp(r.rounds, LIMITS.rounds.min, LIMITS.rounds.max, d.rounds),
    sets: clamp(r.sets, LIMITS.sets.min, LIMITS.sets.max, d.sets),
    setRest: clamp(r.setRest, LIMITS.setRest.min, LIMITS.setRest.max, d.setRest),
    switchEach: r.switchEach === "set" ? "set" : "round",
    exercises,
  };
}

/** Seconds as "45 sec", "1 min" or "1 min 30 sec". */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

export const GET_READY_SECONDS = 10;

type Phase = IntervalPhase;

function phase(p: Omit<Phase, "rowId" | "countsAsSet">): Phase {
  return { ...p, rowId: "", countsAsSet: false };
}

/**
 * Every phase of the timer, in order, starting with a 10-second get ready.
 * EMOM: one phase per interval (do the work, rest the rest of it), exercises
 * taking turns. Tabata: work and rest for each round, a longer rest between
 * Tabatas. Custom: each round goes through every exercise (or one effort when
 * there are none) with the rest between, and the round rest between rounds.
 * No rest after the very last effort.
 */
export function buildTimerPhases(s: TimerSettings): Phase[] {
  const ex = s.exercises;
  const out: Phase[] = [
    phase({ kind: "easy", name: "Get ready", detail: ex[0] ? `First up: ${ex[0]}` : "Starting soon", seconds: GET_READY_SECONDS, round: 0, rounds: s.rounds, getReady: true }),
  ];

  if (s.kind === "emom") {
    for (let r = 1; r <= s.rounds; r++) {
      const name = ex.length ? ex[(r - 1) % ex.length] : `Interval ${r}`;
      out.push(phase({ kind: "work", name, detail: `Do it, then rest for what's left of the ${s.work === 60 ? "minute" : formatSeconds(s.work)}`, seconds: s.work, round: r, rounds: s.rounds }));
    }
    return out;
  }

  if (s.kind === "boxing") {
    for (let r = 1; r <= s.rounds; r++) {
      out.push(phase({ kind: "work", name: ex.length ? ex[(r - 1) % ex.length] : `Round ${r}`, detail: `${formatSeconds(s.work)} round`, seconds: s.work, round: r, rounds: s.rounds, bell: true }));
      if (r < s.rounds) out.push(phase({ kind: "easy", name: "Rest", detail: `Round ${r + 1} next`, seconds: s.rest, round: r, rounds: s.rounds, bell: true }));
    }
    return out;
  }

  if (s.kind === "tabata") {
    for (let t = 1; t <= s.sets; t++) {
      for (let r = 1; r <= s.rounds; r++) {
        const pick = s.switchEach === "set" ? t - 1 : r - 1;
        const name = ex.length ? ex[pick % ex.length] : "Work";
        out.push(phase({ kind: "work", name, detail: `All-out for ${formatSeconds(s.work)}`, seconds: s.work, round: r, rounds: s.rounds, set: t, sets: s.sets }));
        const lastRound = r === s.rounds;
        if (lastRound && t === s.sets) continue;
        if (lastRound) {
          if (s.setRest > 0) out.push(phase({ kind: "easy", name: "Rest", detail: `Before Tabata ${t + 1} of ${s.sets}`, seconds: s.setRest, round: r, rounds: s.rounds, set: t, sets: s.sets }));
        } else if (s.rest > 0) {
          out.push(phase({ kind: "easy", name: "Rest", detail: "", seconds: s.rest, round: r, rounds: s.rounds, set: t, sets: s.sets }));
        }
      }
    }
    return out;
  }

  const list = ex.length ? ex : ["Work"];
  for (let r = 1; r <= s.rounds; r++) {
    list.forEach((name, i) => {
      out.push(phase({ kind: "work", name, detail: `${formatSeconds(s.work)} work`, seconds: s.work, round: r, rounds: s.rounds }));
      const lastInRound = i === list.length - 1;
      if (lastInRound && r === s.rounds) return;
      const seconds = lastInRound && list.length > 1 && s.setRest > 0 ? s.setRest : s.rest;
      if (seconds > 0) out.push(phase({ kind: "easy", name: "Rest", detail: lastInRound && list.length > 1 ? `Before round ${r + 1} of ${s.rounds}` : "", seconds, round: r, rounds: s.rounds }));
    });
  }
  return out;
}

/** Total time in seconds, not counting the get ready. */
export function totalSeconds(s: TimerSettings): number {
  return buildTimerPhases(s).reduce((t, p) => t + (p.getReady ? 0 : p.seconds ?? 0), 0);
}

/** A one-line description, e.g. "EMOM · 10 x 1 min · 10 min". */
export function describeTimer(s: TimerSettings): string {
  const total = formatClock(totalSeconds(s));
  if (s.kind === "emom") return `EMOM · ${s.rounds} x ${formatSeconds(s.work)} · ${total}`;
  if (s.kind === "boxing") return `Boxing · ${s.rounds} x ${formatSeconds(s.work)} · ${s.rest} sec rest · ${total}`;
  if (s.kind === "tabata") return `Tabata · ${s.work}/${s.rest} x ${s.rounds}${s.sets > 1 ? ` · ${s.sets} Tabatas` : ""} · ${total}`;
  const per = s.exercises.length > 1 ? ` · ${s.exercises.length} exercises` : "";
  return `Intervals · ${s.work}/${s.rest} x ${s.rounds} rounds${per} · ${total}`;
}

/** A name for a timer saved without one. */
export function defaultTimerName(s: TimerSettings): string {
  const title = TIMER_KINDS.find((k) => k.kind === s.kind)?.title ?? "Timer";
  return s.exercises.length ? `${title}: ${s.exercises.slice(0, 2).join(", ")}${s.exercises.length > 2 ? "..." : ""}` : `${title} ${s.rounds} rounds`;
}

export type SavedTimer = {
  id: string;
  owner_id: string;
  client_id: string | null;
  name: string;
  settings: TimerSettings;
  created_at: string;
};
