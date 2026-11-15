import { describe, expect, it } from "vitest";
import { cardLabels, isTwoStep, programCards } from "@/lib/programCards";

// The built-in gym programs as they are in the database (2026-11-15), less the hidden "Retired workout exercises".
const GYM = "12-Week Endurance – American Football | 12-Week Endurance – Baseball | 12-Week Endurance – Basketball | 12-Week Endurance – Cycling | 12-Week Endurance – Enduro Riding | 12-Week Endurance – Mountain Biking | 12-Week Endurance – Rugby | 12-Week Endurance – Soccer | 12-Week Endurance – Tennis | 12-Week Speed – American Football | 12-Week Speed – Baseball | 12-Week Speed – Basketball | 12-Week Speed – Cycling | 12-Week Speed – Enduro Riding | 12-Week Speed – Mountain Biking | 12-Week Speed – Rugby | 12-Week Speed – Soccer | 12-Week Speed – Tennis | 12-Week Strength – American Football | 12-Week Strength – Baseball | 12-Week Strength – Basketball | 12-Week Strength – Cycling | 12-Week Strength – Enduro Riding | 12-Week Strength – Mountain Biking | 12-Week Strength – Rugby | 12-Week Strength – Soccer | 12-Week Strength – Tennis | APRE Program | Back & Tri 1 | Back & Tri 2 | Back & Tri 3 | Back & Tri 4 | Beginner Foundation - Bodybuilding | Beginner Foundation - Fat loss | Beginner Foundation - Fitness | Beginner Foundation - Strength | Bodybuilding 12-week program | Chest & Bi 1 | Chest & Bi 2 | Chest & Bi 3 | Chest & Bi 4 | Drop Set Back 1 | Drop Set Back 2 | Drop Set Back 3 | Drop Set Biceps 1 | Drop Set Biceps 2 | Drop Set Biceps 3 | Drop Set Calves 1 | Drop Set Calves 2 | Drop Set Calves 3 | Drop Set Chest 1 | Drop Set Chest 2 | Drop Set Chest 3 | Drop Set Glutes 1 | Drop Set Glutes 2 | Drop Set Glutes 3 | Drop Set Hamstrings 1 | Drop Set Hamstrings 2 | Drop Set Hamstrings 3 | Drop Set Quads 1 | Drop Set Quads 2 | Drop Set Quads 3 | Drop Set Shoulders 1 | Drop Set Shoulders 2 | Drop Set Shoulders 3 | Drop Set Triceps 1 | Drop Set Triceps 2 | Drop Set Triceps 3 | Explosive Power 1 – Jump & Throw Basics | Explosive Power 2 – Strength to Power | Explosive Power 3 – Elite Power | Fat loss 12-week program | Fight Conditioning – BJJ | Fight Conditioning – Boxing | Fight Conditioning – MMA | Fight Conditioning – Muay Thai | Fight Conditioning – Wrestling | Flexibility 1 – Lower Body | Flexibility 2 – Upper Body & Spine | Flexibility 3 – Splits & Deep Range | Flexibility 4 – Lower Back Release | Full Body 3 x week option 1 | Full Body 3 x week option 2 | Full Body 3 x week option 3 | Full Body 3 x week option 4 | Full Body 3 x week option 5 | HIIT 1 | HIIT 10 | HIIT 2 | HIIT 3 | HIIT 4 | HIIT 5 | HIIT 6 | HIIT 7 | HIIT 8 | HIIT 9 | Intermediate Foundation - Bodybuilding | Intermediate Foundation - Fat loss | Intermediate Foundation - Fitness | Intermediate Foundation - Strength | Legs 1 | Legs 2 | Legs 3 | Legs 4 | Lower Body 1 | Lower Body 11 | Lower Body 13 | Lower Body 15 | Lower Body 3 | Lower Body 5 | Lower Body 7 | Lower Body 9 | Lower Body Superset 10 | Lower Body Superset 12 | Lower Body Superset 14 | Lower Body Superset 2 | Lower Body Superset 4 | Lower Body Superset 6 | Lower Body Superset 8 | Mobility 1 – Hips & Ankles | Mobility 2 – Spine & Shoulders | Mobility 3 – Full-Body Flow | Muscle Year – 3 days a week | Muscle Year – 4 days a week | Muscle Year – 5 days a week | Off-Season – American Football | Off-Season – Baseball | Off-Season – Basketball | Off-Season – Cycling | Off-Season – Enduro Riding | Off-Season – Mountain Biking | Off-Season – Rugby | Off-Season – Soccer | Off-Season – Tennis | Older Adult 1 - Beginner Foundation | Older Adult 2 - Strength & Stability | Older Adult 3 - Functional Strength & Independence | Quick full body (35 min) | Quick lower body (30 min) | Quick upper body (30 min) | Speed 1 – Acceleration | Speed 2 – Top Speed | Speed 3 – Agility & Change of Direction | Sports Strength 1 – Base Strength | Sports Strength 2 – Single-Leg & Athletic | Sports Strength 3 – Max Strength | Sprint Intervals 1 | Sprint Intervals 10 | Sprint Intervals 2 | Sprint Intervals 3 | Sprint Intervals 4 | Sprint Intervals 5 | Sprint Intervals 6 | Sprint Intervals 7 | Sprint Intervals 8 | Sprint Intervals 9 | Strength 12-week program | Upper Body 1 | Upper Body 11 | Upper Body 13 | Upper Body 15 | Upper Body 3 | Upper Body 5 | Upper Body 7 | Upper Body 9 | Upper Body Pull 1 | Upper Body Pull 2 | Upper Body Pull 3 | Upper Body Pull 4 | Upper Body Pull 5 | Upper Body Pull 6 | Upper Body Push 1 | Upper Body Push 2 | Upper Body Push 3 | Upper Body Push 4 | Upper Body Push 5 | Upper Body Push 6 | Upper Body Superset 10 | Upper Body Superset 12 | Upper Body Superset 14 | Upper Body Superset 2 | Upper Body Superset 4 | Upper Body Superset 6 | Upper Body Superset 8".split(" | ");
const make = (names: string[], trainer_id: string | null = null) => names.map((name, i) => ({ id: `${trainer_id ?? "b"}${i}`, name, trainer_id }));
const find = (cards: ReturnType<typeof programCards>, title: string) => cards.find((c) => c.title === title)!;

describe("programCards", () => {
  const cards = programCards(make(GYM));

  it("folds the 184 built-in gym programs into about 30 cards, losing none", () => {
    expect(GYM.length).toBe(184);
    expect(cards.length).toBe(31);
    expect(cards.reduce((n, c) => n + c.options.length, 0)).toBe(184);
  });

  it("gives numbered sets a button per number, in number order", () => {
    expect(find(cards, "Chest & Bi").options.map((o) => o.label)).toEqual(["1", "2", "3", "4"]);
    expect(find(cards, "HIIT").options.map((o) => o.label)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(find(cards, "Full Body 3 x week").options).toHaveLength(5);
  });

  it("keeps the foundations one card per goal, Beginner then Intermediate", () => {
    expect(find(cards, "Foundation · Strength").options.map((o) => o.label)).toEqual(["Beginner", "Intermediate"]);
  });

  it("picks drop sets and 12-week sport programs in two steps", () => {
    const drop = find(cards, "Drop sets");
    expect(isTwoStep(drop)).toBe(true);
    expect(cardLabels(drop)).toHaveLength(9);
    const sport = find(cards, "12-week sport programs");
    expect(sport.options).toHaveLength(27);
    expect(sport.options.filter((o) => o.label === "Rugby").map((o) => o.sub)).toEqual(["Endurance", "Speed", "Strength"]);
  });

  it("names sport cards by the part after the dash, in program order", () => {
    expect(find(cards, "Off-season: 8 weeks").options.map((o) => o.label)).toContain("Rugby");
    expect(find(cards, "Explosive power").options.map((o) => o.label)).toEqual(["Jump & Throw Basics", "Strength to Power", "Elite Power"]);
  });

  it("shows a one-program card as that program", () => {
    expect(find(cards, "APRE Program").options).toHaveLength(1);
    expect(find(cards, "Quick full body (35 min)")).toBeTruthy();
  });

  it("follows the heading order: Beginner first, gym before sport", () => {
    expect(cards[0].title).toBe("Foundation · Bodybuilding");
    expect(cards.findIndex((c) => c.group === "sport")).toBeGreaterThan(cards.findIndex((c) => c.title === "APRE Program"));
  });

  it("drops Home from home card names and trims shared words", () => {
    const home = programCards(make(["Home Chest & Bi 1", "Home Chest & Bi 2", "Home quick upper body (30 min)", "Home quick lower body (30 min)"]));
    expect(home.map((c) => c.title)).toEqual(["Quick upper & lower", "Chest & Bi"]);
    expect(home[0].options.map((o) => o.label)).toEqual(["Lower body (30 min)", "Upper body (30 min)"]);
  });

  it("gives every program a trainer built its own card", () => {
    const own = programCards(make(["My Legs 1", "My Legs 2"], "t1"));
    expect(own.map((c) => c.title)).toEqual(["My Legs 1", "My Legs 2"]);
    expect(own.every((c) => c.family === "own")).toBe(true);
  });
});
