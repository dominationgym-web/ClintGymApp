import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));

import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_GROUPS, groupsOff, toNotificationPrefs } from "@/lib/notificationPrefs";

describe("toNotificationPrefs", () => {
  it("is all on with nothing saved", () => {
    expect(toNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(toNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("keeps saved switches and turns missing ones on", () => {
    expect(toNotificationPrefs({ training: false, habits: false })).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      training: false,
      habits: false,
    });
  });

  it("ignores anything that isn't a true/false switch", () => {
    expect(toNotificationPrefs({ progress: "no", client_id: "x", junk: false })).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
});

describe("groupsOff", () => {
  it("lists the switched-off groups", () => {
    expect(groupsOff(DEFAULT_NOTIFICATION_PREFS)).toEqual([]);
    expect(groupsOff({ ...DEFAULT_NOTIFICATION_PREFS, progress: false, womens_health: false })).toEqual([
      "progress",
      "womens_health",
    ]);
  });
});

describe("NOTIFICATION_GROUPS", () => {
  it("has one switch per saved setting", () => {
    expect(NOTIFICATION_GROUPS.map((g) => g.key).sort()).toEqual(Object.keys(DEFAULT_NOTIFICATION_PREFS).sort());
  });

  it("only shows women's health to women", () => {
    expect(NOTIFICATION_GROUPS.filter((g) => g.womenOnly).map((g) => g.key)).toEqual(["womens_health"]);
  });
});
