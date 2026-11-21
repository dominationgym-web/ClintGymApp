import { describe, expect, it } from "vitest";
import { badgeText, inboxIcon, inboxTitle, isCoachMessage, splitInbox, timeAgo } from "@/lib/inboxItems";

describe("inbox", () => {
  it("knows a coach message", () => {
    expect(isCoachMessage({ data: { type: "coach_message" } })).toBe(true);
    expect(isCoachMessage({ data: { type: "live_session" } })).toBe(false);
  });

  it("picks an icon by type, with a bell for anything else", () => {
    expect(inboxIcon({ data: { type: "coach_message" } })).toBe("💬");
    expect(inboxIcon({ data: { type: "live_session_confirm" } })).toBe("📅");
    expect(inboxIcon({ data: { type: "checkin_wellbeing" } })).toBe("🩹");
    expect(inboxIcon({ data: {} })).toBe("🔔");
  });

  it("moves a title's own emoji into the icon", () => {
    expect(inboxTitle({ title: "📅 Session confirmed", data: { type: "live_session" } })).toEqual({ icon: "📅", title: "Session confirmed" });
    expect(inboxTitle({ title: "🏋️ New week planned", data: {} })).toEqual({ icon: "🏋️", title: "New week planned" });
    expect(inboxTitle({ title: "Message from Clint", data: { type: "coach_message" } })).toEqual({ icon: "💬", title: "Message from Clint" });
  });

  it("puts unread first, each newest first", () => {
    const items = [
      { id: "a", created_at: "2026-11-20T08:00:00Z", read_at: null },
      { id: "b", created_at: "2026-11-21T08:00:00Z", read_at: "2026-11-21T09:00:00Z" },
      { id: "c", created_at: "2026-11-21T07:00:00Z", read_at: null },
    ];
    const { fresh, earlier } = splitInbox(items);
    expect(fresh.map((i) => i.id)).toEqual(["c", "a"]);
    expect(earlier.map((i) => i.id)).toEqual(["b"]);
  });

  it("says how long ago in plain words", () => {
    const now = new Date(2026, 10, 21, 12, 0);
    expect(timeAgo(new Date(2026, 10, 21, 11, 59, 40).toISOString(), now)).toBe("Just now");
    expect(timeAgo(new Date(2026, 10, 21, 11, 55).toISOString(), now)).toBe("5 min ago");
    expect(timeAgo(new Date(2026, 10, 21, 9, 0).toISOString(), now)).toBe("3 h ago");
    expect(timeAgo(new Date(2026, 10, 20, 9, 0).toISOString(), now)).toBe("Yesterday");
    expect(timeAgo(new Date(2026, 10, 17, 9, 0).toISOString(), now)).toBe("4 days ago");
  });

  it("keeps the badge small", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(14)).toBe("9+");
  });
});
