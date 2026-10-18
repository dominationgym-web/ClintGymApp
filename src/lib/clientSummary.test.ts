import { describe, expect, it } from "vitest";
import { energyOf, habitDays, ruleSummary, weekFacts, type SummaryInputs } from "./clientSummary";

const TODAY = "2026-10-18";

const checkin = (date: string, over: Partial<SummaryInputs["checkins"][number]> = {}): SummaryInputs["checkins"][number] => ({
  checkin_date: date,
  sleep_bed_time: "22:00",
  sleep_wake_time: "06:00",
  sleep_quality: 4,
  alcohol_units: 0,
  water_litres: 3,
  pain_status: "ok",
  pain_area: null,
  fatigue_status: "ok",
  fatigue_cause: null,
  mental_status: "ok",
  mental_cause: null,
  ...over,
});

const session = (date: string, status: "complete" | "partial" | "missed" = "complete", over = {}) => ({
  session_date: date,
  status,
  reason: null,
  star: false,
  makeup_for: null,
  improvements: [],
  ...over,
});

const base = (over: Partial<SummaryInputs> = {}): SummaryInputs => ({
  checkins: [],
  flags: [],
  planned: [],
  sessions: [],
  sets: [],
  activities: [],
  habits: { due: 0, done: 0 },
  openProblems: [],
  injuries: [],
  ...over,
});

const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];

describe("weekFacts", () => {
  it("only counts the last 7 days", () => {
    const f = weekFacts(base({ checkins: [checkin("2026-10-11"), checkin("2026-10-12"), checkin("2026-10-18")] }), TODAY);
    expect(f.from).toBe("2026-10-12");
    expect(f.checkinDays).toBe(2);
    expect(f.sleepHours).toBe(8);
  });

  it("counts a planned day as missed only once it has passed with nothing done", () => {
    const f = weekFacts(
      base({
        planned: ["2026-10-13", "2026-10-15", "2026-10-16", "2026-10-18"],
        sessions: [session("2026-10-13"), session("2026-10-17", "complete", { makeup_for: "2026-10-15" })],
      }),
      TODAY,
    );
    expect(f.workoutsPlanned).toBe(4);
    // 15th was caught up on the 17th; 18th is today.
    expect(f.workoutsMissed).toBe(1);
    expect(f.workoutsDone).toBe(2);
  });

  it("works out effort shares without the gauge sets", () => {
    const f = weekFacts(
      base({
        sets: [
          { log_date: "2026-10-14", effort: "failure", gauge: true },
          { log_date: "2026-10-14", effort: "failure" },
          { log_date: "2026-10-14", effort: "comfortable" },
        ],
      }),
      TODAY,
    );
    expect(f.workingSets).toBe(3);
    expect(f.failureShare).toBe(0.5);
  });

  it("splits multi-area pain and keeps outside exercise", () => {
    const f = weekFacts(
      base({
        checkins: [checkin("2026-10-16", { pain_status: "reported", pain_area: "Knee, Lower back" })],
        activities: [{ activity_date: "2026-10-17", kind: "run", name: null, minutes: 70, distance_km: 10, avg_hr: 150, effort: "hard" }],
      }),
      TODAY,
    );
    expect(f.painAreas).toEqual(["Knee", "Lower back"]);
    expect(f.otherActivities[0]).toMatchObject({ what: "Run", minutes: 70, km: 10, hr: 150 });
    expect(f.bigOtherSessions).toBe(1);
  });
});

describe("energy and summary", () => {
  it("says there's nothing to go on with no data", () => {
    expect(ruleSummary(weekFacts(base(), TODAY)).energy).toBe("Not enough info");
  });

  it("rates a well-rested client who did every workout as high and says to go ahead", () => {
    const f = weekFacts(
      base({
        checkins: days.map((d) => checkin(d)),
        planned: ["2026-10-13", "2026-10-15"],
        sessions: [session("2026-10-13", "complete", { star: true }), session("2026-10-15")],
        sets: [{ log_date: "2026-10-13", effort: "close_to_failure" }],
      }),
      TODAY,
    );
    const s = ruleSummary(f);
    expect(s.energy).toBe("High");
    expect(s.summary).toContain("Checked in 7 of 7 days.");
    expect(s.suggestions.join(" ")).toContain("go ahead with next week");
  });

  it("rates a tired, short-sleeping client who missed workouts as very low and suggests lighter", () => {
    const f = weekFacts(
      base({
        checkins: days.slice(0, 4).map((d) =>
          checkin(d, { sleep_bed_time: "00:30", sleep_wake_time: "05:30", sleep_quality: 2, fatigue_status: "reported", fatigue_cause: "Work" }),
        ),
        planned: ["2026-10-13", "2026-10-15", "2026-10-16"],
        sessions: [session("2026-10-13", "missed", { reason: "Too tired" })],
      }),
      TODAY,
    );
    const s = ruleSummary(f);
    expect(energyOf(f)).toBe("Very low");
    expect(s.summary).toContain("3 missed");
    expect(s.summary).toContain("tired 4 days (Work)");
    expect(s.suggestions.join(" ")).toContain("lighter");
    expect(s.suggestions.length).toBeLessThanOrEqual(4);
  });

  it("puts an urgent flag and pain first", () => {
    const f = weekFacts(
      base({
        checkins: [checkin("2026-10-17", { pain_status: "reported", pain_area: "Shoulder" })],
        flags: [{ date: "2026-10-17", flag: "red", note: "Hurt my shoulder" }],
      }),
      TODAY,
    );
    const s = ruleSummary(f);
    expect(s.suggestions[0]).toContain("urgent");
    expect(s.suggestions[1]).toContain("Shoulder");
    expect(s.summary).toContain('"Hurt my shoulder"');
  });
});

describe("habitDays", () => {
  it("counts scheduled days and leaves today out until it's done", () => {
    // Mon, Wed, Fri habit; 12-18 Oct 2026 is Mon to Sun.
    const habits = [{ id: "h", active_days: [1, 3, 5], reps_target: 1, start_date: "2026-10-01", end_date: null }];
    const logs = [
      { habit_id: "h", log_date: "2026-10-12", reps_completed: 1 },
      { habit_id: "h", log_date: "2026-10-16", reps_completed: 1 },
    ];
    expect(habitDays(habits, logs, "2026-10-12", "2026-10-18")).toEqual({ due: 3, done: 2 });
    expect(habitDays(habits, [], "2026-10-12", "2026-10-12")).toEqual({ due: 0, done: 0 });
  });
});
