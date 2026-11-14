import { describe, expect, it, vi } from "vitest";
import { isMainProgram } from "./programRemoval";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

describe("isMainProgram", () => {
  it("counts training programs, not mobility or flexibility", () => {
    expect(isMainProgram({ name: "Beginner Foundation - Bodybuilding", trainer_id: null })).toBe(true);
    expect(isMainProgram({ name: "Mobility 1 – Hips & Ankles", trainer_id: null })).toBe(false);
    expect(isMainProgram({ name: "Flexibility 2 – Upper Body & Spine", trainer_id: null })).toBe(false);
    expect(isMainProgram({ name: "My own plan", trainer_id: "t1" })).toBe(true);
  });
});
