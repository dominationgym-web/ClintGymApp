import { describe, expect, it } from "vitest";
import { clientCounts, openProblemsByTrainer, ownerClientLine, problemAreaLabel, problemsWithStatus } from "@/lib/trainerProblems";
import type { OwnerTrainerClientRow, TrainerProblem } from "@/types/database";

const p = (id: string, trainer: string, status: TrainerProblem["status"]): TrainerProblem => ({
  id,
  trainer_id: trainer,
  trainer_name: "Trevor",
  area: "app",
  body: "Clients tab is empty",
  status,
  created_at: "2026-10-24T08:00:00Z",
  updated_at: "2026-10-24T08:00:00Z",
});

const c = (over: Partial<OwnerTrainerClientRow>): OwnerTrainerClientRow => ({
  id: "c",
  name: "Sipho",
  access_status: "active",
  plan_expires_at: null,
  archived: false,
  joined: "2026-10-01",
  last_checkin: null,
  last_workout: null,
  ...over,
});

describe("trainer problems", () => {
  it("splits problems by status", () => {
    const list = [p("1", "t1", "new"), p("2", "t1", "fixed"), p("3", "t2", "fixing")];
    expect(problemsWithStatus(list, "new").map((x) => x.id)).toEqual(["1"]);
  });

  it("counts only unfixed problems per trainer", () => {
    const counts = openProblemsByTrainer([p("1", "t1", "new"), p("2", "t1", "fixed"), p("3", "t1", "fixing"), p("4", "t2", "fixed")]);
    expect(counts.get("t1")).toBe(2);
    expect(counts.get("t2")).toBeUndefined();
  });

  it("labels the area", () => {
    expect(problemAreaLabel("billing")).toBe("💰 Billing");
  });

  it("splits a trainer's clients into active, waiting and archived", () => {
    const rows = [c({}), c({ access_status: "expiring_soon" }), c({ access_status: "expired" }), c({ archived: true, access_status: "expired" })];
    expect(clientCounts(rows)).toEqual({ active: 2, waiting: 1, archived: 1 });
  });

  it("describes a client for the owner", () => {
    expect(ownerClientLine(c({}))).toBe("Active · no check-ins yet");
    expect(ownerClientLine(c({ last_checkin: "2026-10-23", last_workout: "2026-10-22" }))).toMatch(/^Active · check-in 23 Oct · workout 22 Oct$/);
    expect(ownerClientLine(c({ archived: true }))).toMatch(/^Archived/);
  });
});
