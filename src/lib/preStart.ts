import { parseIsoDate, toIsoDate } from "@/lib/dates";

// Pre-start health and safety form for the Longevity (60+) programs (GRIZZ,
// 2026-10-20: "put together form that needs to be filled in before clients
// starts ... if the app can assess the intake form and identify any risks").
// The trainer fills it in with the client on the client's Training tab, and
// again every 8 weeks to re-test. preStartRisks reads it and lists what needs
// attention: red means get medical clearance or a clinician's assessment
// before starting or progressing, amber means adjust and watch. It follows the
// usual pre-exercise screening and fall-risk cut-offs, and it is a prompt for
// the trainer, not a clinical assessment.

export type YesNo = boolean | null;

export type PreStartAnswers = {
  conditions: string[];
  conditionNotes: string;
  /** A condition that is new, getting worse or not under control. */
  unstable: YesNo;
  symptoms: string[];
  medications: string[];
  medicationNotes: string;
  falls: "0" | "1" | "2+" | null;
  fallInjury: YesNo;
  fearOfFalling: YesNo;
  /** A broken bone since turning 50, or one from a minor fall. */
  fracture: YesNo;
  jointReplacements: string[];
  /** Surgery or a hospital stay in the last 6 months. */
  recentSurgery: YesNo;
  activity: "none" | "light" | "regular" | null;
  walkingAid: "none" | "stick" | "walker" | null;
  stairs: "easy" | "rail" | "hard" | null;
  painLevel: number | null;
  painAreas: string[];
  painNotes: string;
  bpSystolic: string;
  bpDiastolic: string;
  restingHr: string;
  clearance: "not_needed" | "requested" | "received" | null;
  clearanceNotes: string;
  /** Seconds for 5 sit-to-stands, blank when not done. */
  sitToStand: string;
  sitToStandUnsafe: boolean;
  walkMinutes: string;
  walkMetres: string;
  tandemSeconds: string;
  singleLegLeft: string;
  singleLegRight: string;
  shoulder: "full" | "limited" | "painful" | null;
  postureNotes: string;
};

export const BLANK_PRE_START: PreStartAnswers = {
  conditions: [],
  conditionNotes: "",
  unstable: null,
  symptoms: [],
  medications: [],
  medicationNotes: "",
  falls: null,
  fallInjury: null,
  fearOfFalling: null,
  fracture: null,
  jointReplacements: [],
  recentSurgery: null,
  activity: null,
  walkingAid: null,
  stairs: null,
  painLevel: null,
  painAreas: [],
  painNotes: "",
  bpSystolic: "",
  bpDiastolic: "",
  restingHr: "",
  clearance: null,
  clearanceNotes: "",
  sitToStand: "",
  sitToStandUnsafe: false,
  walkMinutes: "",
  walkMetres: "",
  tandemSeconds: "",
  singleLegLeft: "",
  singleLegRight: "",
  shoulder: null,
  postureNotes: "",
};

export const CONDITIONS = [
  "Heart disease",
  "High blood pressure",
  "Stroke",
  "Diabetes",
  "Kidney disease",
  "Lung disease (COPD, asthma)",
  "Osteoporosis or osteopenia",
  "Arthritis",
  "Parkinson's or another neurological condition",
  "Cancer (in treatment)",
];
export const SYMPTOMS = [
  "Chest pain or pressure",
  "Fainting or dizziness",
  "Unusual breathlessness",
  "Racing or irregular heartbeat",
  "New numbness, weakness or trouble speaking",
];
export const MEDICATIONS = [
  "Blood pressure",
  "Heart rate (e.g. beta blockers)",
  "Blood thinners",
  "Insulin or diabetes tablets",
  "Sleeping tablets, sedatives or others that affect balance",
];
export const JOINT_REPLACEMENTS = ["Hip", "Knee", "Shoulder"];
export const PAIN_SPOTS = ["Neck", "Shoulder", "Back", "Hip", "Knee", "Ankle or foot", "Hand or wrist"];

/** Heart, metabolic or kidney disease: the conditions screening asks about. */
const CARDIO_METABOLIC = ["Heart disease", "Stroke", "Diabetes", "Kidney disease"];

export type PreStartRisk = { level: "red" | "amber"; title: string; detail: string };

const num = (s: string) => {
  const n = Number(String(s).replace(",", ".").trim());
  return s.trim() && Number.isFinite(n) ? n : null;
};

/** What needs attention, red first. An empty list means nothing was flagged. */
export function preStartRisks(a: PreStartAnswers): PreStartRisk[] {
  const out: PreStartRisk[] = [];
  const red = (title: string, detail: string) => out.push({ level: "red", title, detail });
  const amber = (title: string, detail: string) => out.push({ level: "amber", title, detail });
  const has = (c: string) => a.conditions.includes(c);
  const cleared = a.clearance === "received";

  if (a.symptoms.length > 0)
    red(
      `Symptoms: ${a.symptoms.join(", ").toLowerCase()}`,
      "Don't start until a doctor has checked these. Chest pain, fainting, unusual breathlessness or new nerve symptoms during a session mean stop and get urgent help.",
    );
  if (a.unstable)
    red("A condition is new, getting worse or not under control", "Get medical clearance before starting.");

  const sys = num(a.bpSystolic);
  const dia = num(a.bpDiastolic);
  if ((sys != null && sys >= 180) || (dia != null && dia >= 110))
    red(`Resting blood pressure ${a.bpSystolic}/${a.bpDiastolic}`, "Too high to start training. Refer to their doctor and re-check before any session.");
  else if ((sys != null && sys >= 160) || (dia != null && dia >= 100))
    amber(
      `Resting blood pressure ${a.bpSystolic}/${a.bpDiastolic}`,
      "High. Ask their doctor to check it, re-measure before sessions, avoid heavy straining and breath-holding.",
    );
  const hr = num(a.restingHr);
  if (hr != null && hr > 100) amber(`Resting heart rate ${a.restingHr}`, "Above 100 at rest. Ask their doctor to check it before progressing.");

  const cm = CARDIO_METABOLIC.filter(has);
  if (cm.length > 0 && !cleared) {
    if (a.activity === "none" || a.activity === null)
      red(
        `${cm.join(", ")}, and not exercising now`,
        "Screening guidelines advise medical clearance before starting exercise. Mark it received once you have it.",
      );
    else amber(`${cm.join(", ")}`, "Already active: carry on at light to moderate effort, and get clearance before harder training.");
  }

  if (a.recentSurgery && !cleared)
    red("Surgery or hospital stay in the last 6 months", "Get clearance from their doctor or surgeon before starting.");

  if (has("Parkinson's or another neurological condition") || has("Stroke"))
    amber("Neurological condition", "May need a physiotherapist's assessment before progressing. Keep balance work supported.");

  if (a.falls === "2+" || a.fallInjury)
    red(
      a.falls === "2+" ? "2 or more falls in the last year" : "A fall with an injury",
      "Recurrent falls: a physiotherapist or clinician should assess them before you progress balance work. Always give a support and stay close.",
    );
  else if (a.falls === "1" || a.fearOfFalling)
    amber(
      a.falls === "1" ? "A fall in the last year" : "Afraid of falling",
      "Higher fall risk: use a stable support for balance work and stay close.",
    );

  if (has("Osteoporosis or osteopenia") || a.fracture)
    (a.fracture ? red : amber)(
      a.fracture ? "Broken bone since 50 or from a minor fall" : "Osteoporosis or osteopenia",
      a.fracture
        ? "Possible osteoporotic fracture: get a clinician's or physiotherapist's assessment before progressing. No loaded bending or twisting of the spine."
        : "No loaded bending or twisting of the spine (sit-ups, toe touches, weighted twists). Strength and balance training help the bones.",
    );

  if (a.jointReplacements.length > 0)
    amber(
      `Joint replacement: ${a.jointReplacements.join(", ").toLowerCase()}`,
      "Follow their surgeon's movement limits (for a hip, often no deep bending past 90° or crossing the legs).",
    );

  if (a.medications.includes("Blood pressure"))
    amber("Blood pressure medicine", "Can cause dizziness when standing up: rise slowly, cool down gradually and avoid quick changes of position.");
  if (a.medications.includes("Heart rate (e.g. beta blockers)"))
    amber("Heart rate medicine", "Heart rate stays low, so judge effort with the 0-10 scale (RPE), not heart rate.");
  if (a.medications.includes("Blood thinners")) amber("Blood thinners", "Bruise and bleed easily: take extra care to prevent falls and knocks.");
  if (a.medications.includes("Insulin or diabetes tablets") || has("Diabetes"))
    amber("Diabetes", "Risk of low blood sugar: check it before and after sessions if they test, and keep a sugary drink or sweets nearby.");
  if (a.medications.includes("Sleeping tablets, sedatives or others that affect balance"))
    amber("Medicine that affects balance", "Higher fall risk: keep balance work supported.");

  if (a.painLevel != null && a.painLevel >= 5)
    amber(
      `Pain ${a.painLevel}/10${a.painAreas.length ? ` (${a.painAreas.join(", ").toLowerCase()})` : ""}`,
      "Modify exercises that make it worse and use This hurts swaps. Sharp pain, swelling, the joint giving way or pain that keeps getting worse needs assessment.",
    );

  const sts = num(a.sitToStand);
  if (a.sitToStandUnsafe)
    amber("Couldn't do 5 sit-to-stands safely", "Low leg strength: start with Program 1 from a higher chair, using the arms if needed.");
  else if (sts != null && sts > 15)
    amber(`5 sit-to-stands took ${sts} s`, "Over 15 seconds is linked with a higher fall risk. Build leg strength first and keep balance work supported.");

  const tandem = num(a.tandemSeconds);
  if (tandem != null && tandem < 10)
    amber(`Tandem stance ${tandem} s`, "Under 10 seconds: balance needs work. Keep a support within reach for all standing exercises.");
  const legs = [num(a.singleLegLeft), num(a.singleLegRight)].filter((n): n is number => n != null);
  if (legs.length > 0 && Math.min(...legs) < 5)
    amber(`Single-leg stance ${Math.min(...legs)} s`, "Under 5 seconds is linked with falls. Supported single-leg work only.");

  if (a.walkingAid === "walker")
    amber("Uses a walker", "Supervise closely, and a physiotherapist's assessment is advised before progressing.");
  else if (a.walkingAid === "stick") amber("Uses a walking stick", "Keep supports close and progress balance slowly.");
  if (a.stairs === "hard") amber("Struggles with stairs", "Build up with low step-ups holding a rail.");

  if (a.shoulder === "painful")
    amber("Painful shoulder movement", "No overhead work. Use pressing at a kinder angle (This hurts swaps), and refer if it doesn't settle.");

  const order = { red: 0, amber: 1 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}

export type PreStartOutcome = { level: "green" | "amber" | "red"; headline: string; program: string };

/** The overall sign and which Longevity program fits. */
export function preStartOutcome(a: PreStartAnswers, risks = preStartRisks(a)): PreStartOutcome {
  if (risks.some((r) => r.level === "red"))
    return {
      level: "red",
      headline: "Don't start yet: get medical clearance or a clinician's assessment first",
      program: "Older Adult 1 - Beginner Foundation, once cleared",
    };
  const sts = num(a.sitToStand);
  const fit = a.activity === "regular" && sts != null && sts <= 12 && !a.sitToStandUnsafe && risks.length <= 1;
  return {
    level: risks.length > 0 ? "amber" : "green",
    headline: risks.length > 0 ? "OK to start, with the adjustments below" : "No risks found: OK to start",
    program: fit
      ? "Older Adult 2 - Strength & Stability (already active and moving well)"
      : "Older Adult 1 - Beginner Foundation",
  };
}

/** Re-test date: 8 weeks after the form was filled in. */
export function reassessDue(filledOn: string): string {
  const due = parseIsoDate(filledOn);
  due.setDate(due.getDate() + 56);
  return toIsoDate(due);
}

/** "11 s (was 14 s)": a re-test against the first one. */
export function compareTest(now: string, first: string | undefined, unit: string): string {
  if (!now.trim()) return "";
  return first && first.trim() && first !== now ? `${now} ${unit} (was ${first} ${unit})` : `${now} ${unit}`;
}

/** Is this one of the Longevity programs? */
export function isOlderAdultProgram(name: string): boolean {
  return name.toLowerCase().startsWith("older adult ");
}
