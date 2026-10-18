// When the app suggests a recovery activity (GRIZZ, 2026-10-17): plain rules
// from the client's last week of training (how many days, how hard, which
// muscles), their check-ins (pain, tiredness, stress, sleep) and the
// recovery they've already done. No AI model. Shown to the client on their
// Recovery screen and Check-in, and to the coach on the client's Training tab.
import { addDays } from "@/lib/programSchedule";
import type { MuscleGroup } from "@/lib/recovery";
import type { RecoveryActivityKey } from "@/lib/recoveryActivities";
import type { SetEffort } from "@/types/database";

export type RecoveryInputs = {
  /** Working sets from the last 7 days (warm-ups left out). */
  sets: { date: string; effort: SetEffort; groups: MuscleGroup[] }[];
  checkins: {
    date: string;
    sleepQuality: number | null;
    pain: boolean;
    painArea: string | null;
    fatigue: boolean;
    mental: boolean;
  }[];
  /** Recovery activities done (or planned) recently. */
  recovery: { activity: string; planned_on: string; done_on: string | null }[];
  /** Exercise outside the programs (0114): runs, rides, hikes. big = 60+ min or hard. */
  activities?: { date: string; what: string; minutes: number; big: boolean }[];
  /** The client's recovery program (0108). Cold is only suggested on Sports. */
  recoveryProgram?: string | null;
};

export type RecoverySuggestion = { activity: RecoveryActivityKey; reason: string };

// A session this big or this hard counts as a hard day.
const HARD_SETS = 4;
const BIG_SESSION_SETS = 18;
const BIG_LEG_SETS = 8;

/** The day's numbers: sets, hard sets (close to or at failure) and leg sets. */
function dayLoad(sets: RecoveryInputs["sets"], date: string) {
  const day = sets.filter((s) => s.date === date);
  return {
    sets: day.length,
    hard: day.filter((s) => s.effort !== "comfortable").length,
    legs: day.filter((s) => s.groups.includes("Legs")).length,
  };
}

/** Days in a row with training, counting back from `from`. */
function streakBack(trainedDays: Set<string>, from: string): number {
  let n = 0;
  for (let d = from; trainedDays.has(d); d = addDays(d, -1)) n += 1;
  return n;
}

/**
 * Up to `limit` recovery suggestions for today, most important first. Skips
 * an activity already planned or done for today.
 */
export function suggestRecovery(inputs: RecoveryInputs, today: string, limit = 2): RecoverySuggestion[] {
  const yesterday = addDays(today, -1);
  const weekStart = addDays(today, -6);
  const out: RecoverySuggestion[] = [];
  const handledToday = new Set(
    inputs.recovery.filter((r) => r.planned_on === today || r.done_on === today).map((r) => r.activity),
  );
  const add = (activity: RecoveryActivityKey, reason: string) => {
    if (handledToday.has(activity) || out.some((s) => s.activity === activity)) return;
    out.push({ activity, reason });
  };

  const recentCheckins = inputs.checkins.filter((c) => c.date >= yesterday);
  const pain = recentCheckins.find((c) => c.pain);
  const tired = recentCheckins.find((c) => c.fatigue || (c.sleepQuality !== null && c.sleepQuality <= 2));
  const stressed = recentCheckins.find((c) => c.mental);

  const activities = inputs.activities ?? [];
  const trainedDays = new Set(
    [...inputs.sets.map((s) => s.date), ...activities.filter((a) => a.big).map((a) => a.date)].filter((d) => d >= weekStart),
  );
  const daysThisWeek = trainedDays.size;
  const streak = streakBack(trainedDays, trainedDays.has(today) ? today : yesterday);
  const y = dayLoad(inputs.sets, yesterday);
  const t = dayLoad(inputs.sets, today);
  const doneThisWeek = inputs.recovery.filter((r) => r.done_on && r.done_on >= weekStart).length;

  // Pain gets easy movement, not stretching: stretching a fresh strain hard
  // can make it worse (review 2026-10-18).
  if (pain) {
    add(
      "easy_movement",
      `You reported pain${pain.painArea ? ` (${pain.painArea.toLowerCase()})` : ""}. Keep moving gently within comfort. Don't stretch a fresh strain hard. Your coach will adjust your plan.`,
    );
  }
  if (tired) {
    add("sleep", "You've been tired or sleeping badly. An early night is the best recovery you can do today.");
  }
  if (streak >= 5 || (tired && streak >= 3)) {
    add(
      "easy_movement",
      `You've trained ${streak} days in a row. Take a rest day from training: an easy walk is plenty, and your body comes back stronger.`,
    );
  }
  if (stressed) {
    add("breathing", "You've had a lot on your mind. Five minutes of slow breathing helps you switch off and sleep better.");
  }
  // Cold straight after weights can blunt muscle growth, so it's only
  // suggested to clients on Sports Recovery; everyone else gets easy movement.
  if (y.legs >= BIG_LEG_SETS) {
    if (inputs.recoveryProgram === "sports") {
      add(
        "cold",
        `Big leg day yesterday (${y.legs} sets). A cold shower or ice bath can ease sore legs before your next session. Not within 4 hours of weights if you're building muscle.`,
      );
    } else {
      add("easy_movement", `Big leg day yesterday (${y.legs} sets). An easy walk or ride today helps sore legs recover.`);
    }
  }
  if (y.hard >= HARD_SETS || y.sets >= BIG_SESSION_SETS) {
    add(
      "foam_rolling",
      y.hard >= HARD_SETS
        ? `You pushed hard yesterday (${y.hard} sets close to or at failure). Foam rolling helps tight, sore muscles.`
        : `Yesterday was a big session (${y.sets} sets). Foam rolling helps tight, sore muscles.`,
    );
  }
  const bigYesterday = activities.find((a) => a.date === yesterday && a.big);
  if (bigYesterday) {
    add("foam_rolling", `${bigYesterday.what} yesterday (${bigYesterday.minutes} min). Foam rolling helps tired legs and back recover.`);
  }
  const bigToday = activities.find((a) => a.date === today && a.big);
  if (t.sets >= BIG_SESSION_SETS || bigToday) {
    add(
      "hydration",
      t.sets >= BIG_SESSION_SETS
        ? `Big session today (${t.sets} sets). Replace the fluid you sweated out.`
        : `${bigToday!.what} today (${bigToday!.minutes} min). Replace the fluid you sweated out.`,
    );
  }
  if (streak >= 3 && !trainedDays.has(today)) {
    add("easy_movement", `${streak} training days in a row. An easy walk, swim or ride today keeps you moving while you recover.`);
  }
  if (daysThisWeek >= 3 && doneThisWeek === 0) {
    add("stretching", `You've trained ${daysThisWeek} days this week with no recovery yet. Ten minutes of stretching keeps you moving well.`);
  }
  return out.slice(0, limit);
}
