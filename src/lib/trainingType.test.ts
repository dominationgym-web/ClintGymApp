import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Modal: () => null, Pressable: () => null, Text: () => null, View: () => null, Appearance: { getColorScheme: () => "dark" }, StyleSheet: { create: (s: unknown) => s } }));
vi.mock("@/lib/theme", () => ({ themedStyles: (s: unknown) => s }));

describe("1 on 1 / Evolution / Both", async () => {
  const { trainingTypeFields, trainingTypeOf } = await import("@/components/TrainingTypePicker");
  it("stores each choice in live_only and one_on_one", () => {
    expect(trainingTypeFields("one")).toEqual({ live_only: true, one_on_one: true });
    expect(trainingTypeFields("both")).toEqual({ live_only: false, one_on_one: true });
    expect(trainingTypeFields("evolution")).toEqual({ live_only: false, one_on_one: false });
  });
  it("reads it back", () => {
    for (const t of ["one", "both", "evolution"] as const) expect(trainingTypeOf(trainingTypeFields(t))).toBe(t);
    // Older 1 on 1 clients from before one_on_one existed.
    expect(trainingTypeOf({ live_only: true })).toBe("one");
    expect(trainingTypeOf({})).toBe("evolution");
  });
});
