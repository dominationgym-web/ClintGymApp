import { afterEach, describe, expect, it, vi } from "vitest";

// An installed app built before expo-calendar was added (runtime
// 2026-10-26-sound) gets this code by instant update. Loading the missing
// native module closed the app when Live sessions › Calendar opened
// (GRIZZ, 2026-10-31), so it must not even be required there.
const loaded = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-calendar/legacy", () => {
  loaded();
  return { requestCalendarPermissionsAsync: vi.fn() };
});

afterEach(() => {
  delete (globalThis as { expo?: unknown }).expo;
  vi.resetModules();
  loaded.mockClear();
});

describe("phone calendar on an older install", () => {
  it("says it isn't there yet without loading expo-calendar", async () => {
    (globalThis as { expo?: unknown }).expo = { modules: { ExpoUpdates: {} } };
    const { canReadPhoneCalendar, readPhoneCalendar } = await import("./calendarImport");
    expect(canReadPhoneCalendar()).toBe(false);
    const res = await readPhoneCalendar(new Date(), new Date());
    expect("error" in res && res.error).toMatch(/next app update/);
    expect(loaded).not.toHaveBeenCalled();
  });

  it("only counts the calendar as there when the build installed it", async () => {
    const { buildHasCalendar } = await import("./calendarImport");
    expect(buildHasCalendar()).toBe(false);
    (globalThis as { expo?: unknown }).expo = { modules: { ExpoUpdates: {} } };
    expect(buildHasCalendar()).toBe(false);
    (globalThis as { expo?: unknown }).expo = { modules: { ExpoCalendar: {} } };
    expect(buildHasCalendar()).toBe(true);
  });
});
