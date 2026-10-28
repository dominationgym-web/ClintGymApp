import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (s: unknown) => s },
  Text: "Text",
  Platform: { OS: "ios" },
  Appearance: { getColorScheme: () => "dark" },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("expo-updates", () => ({ createdAt: null, isEmbeddedLaunch: true }));
const { appUpdateLabel } = await import("@/components/AppUpdateLine");

describe("appUpdateLabel", () => {
  it("says when no update has been downloaded", () => {
    expect(appUpdateLabel(null, true)).toContain("no update downloaded yet");
    expect(appUpdateLabel(new Date(2026, 9, 19), true)).toContain("no update downloaded yet");
  });
  it("shows the update's date", () => {
    expect(appUpdateLabel(new Date(2026, 9, 19, 8, 44), false)).toMatch(/^App update: .*2026/);
  });
});
