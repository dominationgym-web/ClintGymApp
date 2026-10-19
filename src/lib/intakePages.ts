// The intake form one page per section, like the check-in (app-flow review
// C6, 2026-10-18): Next checks the page before moving on, so a missed answer
// shows on its own page instead of in a pop-up after Submit.

export const INTAKE_PAGES = ["About you", "Goals", "Work", "Meals", "Day", "Training", "Health", "Injuries"] as const;

export type IntakeRequired = {
  sex: string;
  age: string;
  heightCm: string;
  weightKg: string;
  activity: string;
  goals: string[];
  experience: string;
  occupationType: string;
  eatsBreakfast: boolean | null;
  currentlyTraining: boolean | null;
  hasInjury: boolean | null;
};

export type IntakeProblem = { title: string; message: string };

const number = (text: string) => Number(text.trim().replace(",", "."));

/** What's still missing on one page, or null when it's fine to move on. */
export function intakePageProblem(page: number, a: IntakeRequired): IntakeProblem | null {
  switch (INTAKE_PAGES[page]) {
    case "About you": {
      if (!a.sex) return { title: "Male or female?", message: "Tap Male or Female." };
      if (!a.age.trim()) return { title: "Your age", message: "Type your age, for example 34." };
      const height = number(a.heightCm);
      if (!(height >= 100 && height <= 250)) return { title: "Your height", message: "Type your height in centimetres, for example 175." };
      const weight = number(a.weightKg);
      if (!(weight >= 25 && weight <= 400)) return { title: "Your weight", message: "Type your weight in kilograms, for example 82." };
      if (!a.activity) return { title: "How active are you?", message: "Tap the option that fits you best." };
      return null;
    }
    case "Goals":
      if (a.goals.length === 0) return { title: "Your goals", message: "Tap at least one goal." };
      if (!a.experience) return { title: "Your training experience", message: "Tap the option that fits you best." };
      return null;
    case "Work":
      return a.occupationType ? null : { title: "Your work", message: "Tap the kind of work you do." };
    case "Meals":
      return a.eatsBreakfast === null ? { title: "Breakfast", message: "Tap Yes or No: do you eat breakfast?" } : null;
    case "Training":
      return a.currentlyTraining === null ? { title: "Training", message: "Tap Yes or No: are you training at the moment?" } : null;
    case "Injuries":
      return a.hasInjury === null ? { title: "Any injuries or pain?", message: "Tap Yes or No." } : null;
    default:
      return null;
  }
}

/** The first page with something missing, for Submit; null when every page is done. */
export function firstIntakeProblem(a: IntakeRequired): { page: number; problem: IntakeProblem } | null {
  for (let page = 0; page < INTAKE_PAGES.length; page++) {
    const problem = intakePageProblem(page, a);
    if (problem) return { page, problem };
  }
  return null;
}
