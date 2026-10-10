import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));

import { isEmptyDraft, type ProgramDraft } from "@/lib/programDraft";
import { DEFAULT_WARM_UP } from "@/lib/programs";

const blank: ProgramDraft = {
  name: "",
  howTo: "",
  warmUp: DEFAULT_WARM_UP,
  sessions: [{ day: 1, title: "", exercises: [{ exerciseId: null, exerciseName: "", sets: 3, reps: "8-12", restSeconds: 120 }] }],
  activeDay: 1,
  place: "gym",
};

describe("isEmptyDraft", () => {
  it("is empty before anything is typed or picked", () => {
    expect(isEmptyDraft(blank)).toBe(true);
  });
  it("keeps a draft with a name, a note or a picked exercise", () => {
    expect(isEmptyDraft({ ...blank, name: "3-day strength" })).toBe(false);
    expect(isEmptyDraft({ ...blank, howTo: "Brace" })).toBe(false);
    const picked = { ...blank.sessions[0], exercises: [{ ...blank.sessions[0].exercises[0], exerciseId: "x", exerciseName: "Squat" }] };
    expect(isEmptyDraft({ ...blank, sessions: [picked] })).toBe(false);
  });
});
