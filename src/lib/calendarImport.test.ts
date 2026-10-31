import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

import { eventsToSessions, matchClient, reviewRows } from "./calendarImport";
import { cleanClock, cleanSessions } from "../../supabase/functions/read-calendar/shape";
import { atTime } from "./liveSessions";

const CLIENTS = [
  { id: "a", name: "Nancy Smith" },
  { id: "b", name: "Mike Botha" },
  { id: "c", name: "Mike Jones" },
  { id: "d", name: "Sarah Jacobs" },
];

describe("matchClient", () => {
  it("matches a full name or a first name only one client has", () => {
    expect(matchClient("PT - Nancy", CLIENTS)).toBe("a");
    expect(matchClient("Session with Sarah J", CLIENTS)).toBe("d");
    expect(matchClient("Mike Botha 1:1", CLIENTS)).toBe("b");
    expect(matchClient("Botha", CLIENTS)).toBe("b");
  });

  it("leaves it to the trainer when it could be two people or nobody", () => {
    expect(matchClient("Mike", CLIENTS)).toBeNull();
    expect(matchClient("Dentist", CLIENTS)).toBeNull();
  });
});

describe("eventsToSessions", () => {
  it("turns timed events that name a client into sessions, with their length", () => {
    const out = eventsToSessions(
      [
        { title: "Nancy", startDate: new Date(2026, 10, 4, 6, 0), endDate: new Date(2026, 10, 4, 6, 40) },
        { title: "Gym day", startDate: new Date(2026, 10, 4, 8, 0), endDate: new Date(2026, 10, 4, 9, 0) },
        { title: "Nancy birthday", startDate: new Date(2026, 10, 5), endDate: new Date(2026, 10, 6), allDay: true },
      ],
      CLIENTS,
    );
    expect(out).toEqual([{ date: "2026-11-04", time: "06:00", minutes: 40, client_id: "a", seen_name: "Nancy" }]);
  });
});

describe("cleanSessions", () => {
  it("keeps real dates and times for this trainer's clients, once each", () => {
    const out = cleanSessions(
      {
        sessions: [
          { date: "2026-11-04", time: "6:00", minutes: 40, client_id: "a", seen_name: "Nancy" },
          { date: "2026-11-04", time: "06:00", minutes: 40, client_id: "a", seen_name: "Nancy" },
          { date: "2026-11-02", time: "05:50", client_id: "someone-else", seen_name: "Bob" },
          { date: "2026-13-01", time: "05:50", client_id: "a", seen_name: "Nancy" },
          { date: "2026-11-03", time: "25:00", client_id: "a", seen_name: "Nancy" },
          { date: "2019-11-03", time: "06:00", client_id: "a", seen_name: "Nancy" },
        ],
        note: " One event was cut off. ",
      },
      ["a", "b"],
      "2026-10-31",
    );
    expect(out.sessions).toEqual([
      { date: "2026-11-02", time: "05:50", minutes: null, client_id: null, seen_name: "Bob" },
      { date: "2026-11-04", time: "06:00", minutes: 40, client_id: "a", seen_name: "Nancy" },
    ]);
    expect(out.note).toBe("One event was cut off.");
    expect(cleanClock("7:5")).toBeNull();
  });
});

describe("reviewRows", () => {
  it("unticks what's already booked, before today or not matched", () => {
    const rows = reviewRows(
      [
        { date: "2026-11-04", time: "06:00", minutes: null, client_id: "a", seen_name: "Nancy" },
        { date: "2026-11-06", time: "06:00", minutes: null, client_id: "a", seen_name: "Nancy" },
        { date: "2026-10-28", time: "06:00", minutes: null, client_id: "a", seen_name: "Nancy" },
        { date: "2026-11-05", time: "06:00", minutes: null, client_id: null, seen_name: "Bob" },
      ],
      [{ client_id: "a", starts_at: atTime("2026-11-06", "06:00") }],
      "2026-10-31",
    );
    expect(rows.map((r) => [r.tick, r.why])).toEqual([
      [true, null],
      [false, "Already in the app"],
      [false, "Before today"],
      [false, "Pick who this is"],
    ]);
  });
});
