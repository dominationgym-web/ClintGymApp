import { describe, expect, it } from "vitest";
import { notificationRoute } from "@/lib/notificationRoutes";

describe("notificationRoute", () => {
  it("sends a client to the right tab", () => {
    expect(notificationRoute({ type: "coach_message", messageId: "m1" }, "client")).toEqual({ stack: "client", screen: "CheckIn" });
    expect(notificationRoute({ type: "catch_up" }, "client")).toEqual({ stack: "client", screen: "Exercises" });
    expect(notificationRoute({ type: "timer_workout", timerId: "t1" }, "client")).toEqual({ stack: "client", screen: "Timers" });
  });

  it("opens a trainer on the client the push is about", () => {
    expect(notificationRoute({ type: "form_video", client_id: "c1" }, "trainer")).toEqual({
      stack: "trainer",
      screen: "ClientDetail",
      clientId: "c1",
      tab: "training",
      open: "videos",
    });
    expect(notificationRoute({ type: "history_import", client_id: "c4" }, "trainer")).toEqual({
      stack: "trainer",
      screen: "ClientDetail",
      clientId: "c4",
      tab: "training",
      open: "history",
    });
    expect(notificationRoute({ type: "problem_reply", clientId: "c2" }, "trainer")).toEqual({ stack: "trainer", screen: "ClientDetail", clientId: "c2" });
    expect(notificationRoute({ type: "client_signup", clientId: "c3" }, "trainer")).toEqual({ stack: "trainer", screen: "Clients" });
  });

  it("sends a trainer's proof of payment to the owner's Billing", () => {
    expect(notificationRoute({ type: "payment_proof", client_id: null, trainer_id: "t1" }, "trainer")).toEqual({ stack: "trainer", screen: "Billing" });
    expect(notificationRoute({ type: "payment_proof", client_id: "c1" }, "trainer")).toEqual({ stack: "trainer", screen: "Clients" });
  });

  it("opens the problem a trainer sent, or the owner's reply", () => {
    expect(notificationRoute({ type: "trainer_problem", problemId: "p1" }, "trainer")).toEqual({
      stack: "trainer",
      screen: "TrainerProblems",
      problemId: "p1",
    });
    expect(notificationRoute({ type: "trainer_problem_reply" }, "trainer")).toEqual({ stack: "trainer", screen: "TrainerProblems", problemId: undefined });
  });

  it("ignores unknown pushes and missing roles", () => {
    expect(notificationRoute({ type: "billing_summary" }, "trainer")).toBeNull();
    expect(notificationRoute({ type: "coach_message" }, null)).toBeNull();
    expect(notificationRoute(undefined, "client")).toBeNull();
  });
});
