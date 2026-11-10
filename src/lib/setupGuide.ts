// Setup guide for new trainers (GRIZZ, 2026-11-10): "as a trainer joins, the
// app takes him straight to the 1 on 1 section", screenshot the weekly
// calendar, upload it, set the times, then nutrition, linking clients and so
// on. Then the same for the Evolution side once it's switched on: where the
// programs are and how they work.
//
// One step at a time in a small card above the tabs, so the trainer does each
// step on the real page underneath. "Show me" opens the right page; steps the
// app can check tick themselves.

export type GuideKind = "one" | "evo";

// Where "Show me" goes.
export type GuideTarget = { tab: "OneToday" | "OneCalendar" | "OneClients" | "OneNutrition" | "OneInvoices" | "Dashboard" | "Clients" | "Programs"; open?: GuideOpen };

// Something to open on the page once it's there.
export type GuideOpen = "setup" | "import";

// What the app can check to tick a step by itself.
export type GuideCheck = "settings" | "sessions" | "prices" | "clients";

export type GuideStep = {
  key: string;
  icon: string;
  title: string;
  // One or two short lines: what to do.
  text: string;
  target?: GuideTarget;
  check?: GuideCheck;
  // "Send my code" button (share the trainer code).
  shareCode?: boolean;
};

export const ONE_ON_ONE_STEPS: GuideStep[] = [
  {
    key: "day",
    icon: "⚙️",
    title: "Your working day",
    text: "Tap your normal fee, session length, first and last session time and cancellation rule. Then tap Save at the bottom.",
    target: { tab: "OneToday", open: "setup" },
    check: "settings",
  },
  {
    key: "screenshot",
    icon: "📸",
    title: "Screenshot your calendar",
    text: "Open the calendar you use now, in week view, and screenshot each week with clients in it (this week and next is enough). Names and times must be easy to read.",
  },
  {
    key: "upload",
    icon: "📤",
    title: "Upload the screenshots",
    text: "Tap Pick screenshots, choose them all, check each name and time, and tap Book. Leave Same every week ticked so they repeat.",
    target: { tab: "OneCalendar", open: "import" },
    check: "sessions",
  },
  {
    key: "prices",
    icon: "💰",
    title: "Check each client",
    text: "Every name from your calendar is on the Clients tab with their days and times. Tap a name to give them their own price if it isn't your normal fee.",
    target: { tab: "OneClients" },
    check: "prices",
  },
  {
    key: "link",
    icon: "🔗",
    title: "Get your clients on the app",
    text: "Send your clients your code to sign up with. When one joins, a pop-up asks which calendar name they are: one tap moves all their sessions to them.",
    shareCode: true,
    check: "clients",
  },
  {
    key: "nutrition",
    icon: "🥗",
    title: "Nutrition for your clients",
    text: "On the Nutrition tab, tap a client to make their meal plan, macros and shopping list. Clients need to be on the app for this.",
    target: { tab: "OneNutrition" },
  },
  {
    key: "everyday",
    icon: "✅",
    title: "Your everyday",
    text: "Today shows who's next and your free gaps. After each session tap it and pick Trained or Cancelled. At month end the Invoices tab makes each invoice for you.",
    target: { tab: "OneToday" },
  },
];

export const EVOLUTION_STEPS: GuideStep[] = [
  {
    key: "dashboard",
    icon: "📊",
    title: "Your Evolution dashboard",
    text: "Look here once a day: who checked in, who trained, and problems in red (pain, fatigue, stress) that need you.",
    target: { tab: "Dashboard" },
  },
  {
    key: "programs",
    icon: "🏋️",
    title: "Where the programs are",
    text: "The Programs tab has every ready-made program in Gym, Performance and Functional. Tap one, then a heading (Beginner first), then a program to see its weeks and days.",
    target: { tab: "Programs" },
  },
  {
    key: "own",
    icon: "🛠",
    title: "Make your own program",
    text: "Tap + Build a program at the top of the Programs tab. Yours show under Your programs, at the bottom.",
    target: { tab: "Programs" },
  },
  {
    key: "give",
    icon: "📅",
    title: "Put a client on a program",
    text: "Open a client, then Training. Tap a day on their calendar, pick their goal (⭐ is the best fit), tap their training days, then Activate. Check each day and you're done.",
    target: { tab: "Clients" },
  },
  {
    key: "how",
    icon: "📈",
    title: "How a program works",
    text: "The client sees today's workout on their Today tab and logs every set. The first set of a new exercise finds their weight, then the app moves the weights up as they get stronger.",
  },
  {
    key: "care",
    icon: "💬",
    title: "Check-ins and food",
    text: "Clients check in each morning (sleep, mood, food). Open a client to see Check-ins, and Diet for their meal plan.",
    target: { tab: "Clients" },
  },
];

export const guideSteps = (kind: GuideKind) => (kind === "one" ? ONE_ON_ONE_STEPS : EVOLUTION_STEPS);

export const GUIDE_TITLE: Record<GuideKind, string> = { one: "1 on 1 setup", evo: "Evolution setup" };

// Where the trainer is in each guide, kept on the phone.
export type GuideRun = { step: number; status: "running" | "done" | "stopped" };
export type GuideState = { one?: GuideRun; evo?: GuideRun };

export const guideKey = (trainerId: string) => `setup-guide:${trainerId}`;

export function readGuideState(raw: string | null): GuideState {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as GuideState) : {};
  } catch {
    return {};
  }
}

// The Evolution guide starts by itself only for trainers who switch it on
// from today (older Evolution trainers know their way). Owner never.
export const EVOLUTION_GUIDE_FROM = "2026-11-10";

export function shouldAutoStart(
  kind: GuideKind,
  state: GuideState,
  t: { is_owner: boolean; evolution_started_on?: string | null },
  info: { hasSettings: boolean; side: GuideKind; evolutionOn: boolean },
): boolean {
  if (t.is_owner || state[kind]) return false;
  if (kind === "one") return !info.hasSettings;
  return info.side === "evo" && info.evolutionOn && !!t.evolution_started_on && t.evolution_started_on >= EVOLUTION_GUIDE_FROM;
}

// The running guide to show: the one for the side the trainer is on first.
export function activeGuide(state: GuideState, side: GuideKind): GuideKind | null {
  const order: GuideKind[] = side === "one" ? ["one", "evo"] : ["evo", "one"];
  return order.find((k) => state[k]?.status === "running") ?? null;
}

// "Show me" on a page that isn't open yet: the page takes it when it appears.
type Listener = () => void;
let pending: GuideOpen | null = null;
const listeners = new Set<Listener>();

export function requestGuideOpen(what: GuideOpen) {
  pending = what;
  listeners.forEach((l) => l());
}

export function takeGuideOpen(what: GuideOpen): boolean {
  if (pending !== what) return false;
  pending = null;
  return true;
}

export function onGuideOpen(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
