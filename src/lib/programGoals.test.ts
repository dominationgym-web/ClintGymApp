import { describe, expect, it } from "vitest";
import type { Program } from "@/types/database";
import { levelOf, programGoal, programsForGoal } from "@/lib/programGoals";

const p = (name: string, place = "gym", kind = "weekly", trainer_id: string | null = null) =>
  ({ name, place, kind, trainer_id }) as Pick<Program, "name" | "place" | "kind" | "trainer_id">;

describe("programGoal", () => {
  it("sorts every built-in whole program into a goal", () => {
    expect(programGoal(p("Older Adult 1 - Beginner Foundation"))).toBe("longevity");
    expect(programGoal(p("Muscle Year – 4 days a week"))).toBe("muscle");
    expect(programGoal(p("Sports Strength 1 – Base Strength"))).toBe("sport");
    expect(programGoal(p("Fight Conditioning – Boxing"))).toBe("sport");
    expect(programGoal(p("Flexibility 4 – Lower Back Release"))).toBe("mobility");
    expect(programGoal(p("Beginner Foundation - Bodybuilding"))).toBe("muscle");
    expect(programGoal(p("Strength 12-week program"))).toBe("strength");
    expect(programGoal(p("Intermediate Foundation - Fat loss"))).toBe("fatLoss");
    expect(programGoal(p("Beginner Foundation - Fitness"))).toBe("fitness");
    expect(programGoal(p("Full Body 3 x week option 2"))).toBe("muscle");
    expect(programGoal(p("My plan", "gym", "weekly", "t1"))).toBe("own");
  });
});

describe("programsForGoal", () => {
  const all = [
    p("Beginner Foundation - Strength"),
    p("Intermediate Foundation - Strength"),
    p("Strength 12-week program"),
    p("Mobility 1 – Hips & Ankles", "home"),
    p("Mobility 1 – Hips & Ankles"),
    p("Upper Body 1", "gym", "quick"),
  ];

  it("puts the program for the client's level first", () => {
    const { best, others } = programsForGoal(all, "strength", "gym", levelOf("advanced"));
    expect(best?.name).toBe("Strength 12-week program");
    expect(others.map((o) => o.name)).toEqual(["Beginner Foundation - Strength", "Intermediate Foundation - Strength"]);
  });

  it("treats never trained as beginner and keeps to where they train", () => {
    expect(programsForGoal(all, "strength", "gym", levelOf("never")).best?.name).toBe("Beginner Foundation - Strength");
    const home = programsForGoal(all, "mobility", "home", null);
    expect(home.best?.place).toBe("home");
    expect(home.others).toEqual([]);
  });

  it("shows gym programs for a home client when there are none at home", () => {
    expect(programsForGoal(all, "strength", "home", null).best?.name).toBe("Beginner Foundation - Strength");
  });
});
