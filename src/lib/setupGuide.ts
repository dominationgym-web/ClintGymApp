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
export type GuideTarget = {
  tab: "OneToday" | "OneCalendar" | "OneClients" | "OneNutrition" | "OneInvoices" | "Dashboard" | "Clients" | "Programs" | "TrainerProfile";
  open?: GuideOpen;
};

// Something to open on the page once it's there.
export type GuideOpen = "setup" | "import" | "income" | "payments" | "logo" | "newClients";

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
  // Which part of the journey (Evolution guide).
  stage?: string;
  // 💡 How to get the most out of it.
  tip?: string;
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

// The Evolution guide, start to finish (GRIZZ, 2026-11-19: "a step by step
// guide through the evolution process ... so trainers fully understand how to
// maximise its benefits. From beginning to end"). Four stages; each step has
// a 💡 tip on getting the most out of it.
export const EVOLUTION_STAGES = ["Get ready", "Get clients", "Coach them", "Keep them"] as const;
export type EvolutionStage = (typeof EVOLUTION_STAGES)[number];

export const EVOLUTION_STEPS: GuideStep[] = [
  // Get ready
  {
    key: "free",
    stage: "Get ready",
    icon: "🎁",
    title: "Your free start",
    text: "Evolution is free for your first 30 days, and your first 5 clients are always free. You can switch it off any time in ☰ Menu (once you have no active online clients).",
    tip: "Use the 30 days to get your first few clients settled in.",
  },
  {
    key: "prices",
    stage: "Get ready",
    icon: "💵",
    title: "Set your client prices",
    text: "On Profile › Income, fill in what your online clients pay you a month. Local is your own currency. International ($) is for clients who live abroad.",
    target: { tab: "TrainerProfile", open: "income" },
    tip: "Leave International blank and everyone pays your Local price.",
  },
  {
    key: "pay",
    stage: "Get ready",
    icon: "💳",
    title: "How clients pay you",
    text: "Profile › Settings › How your clients pay you: your EFT details, and how clients abroad pay (PayPal or Wise). Clients see these on their payment page.",
    target: { tab: "TrainerProfile", open: "payments" },
    tip: "Clients upload their proof of payment in the app, and you get a notification.",
  },
  {
    key: "logo",
    stage: "Get ready",
    icon: "🖼",
    title: "Add your logo",
    text: "Profile › Code & logo: add your logo. Your clients see it when they log in and inside their app, so it feels like your own app.",
    target: { tab: "TrainerProfile", open: "logo" },
  },
  // Get clients
  {
    key: "code",
    stage: "Get clients",
    icon: "📣",
    title: "Send your code",
    text: "Clients sign up with your trainer code. They fill in an intake form as they join: goal, experience, injuries, food and training days.",
    shareCode: true,
    check: "clients",
    tip: "Put your code on your WhatsApp status and Instagram bio.",
  },
  {
    key: "approve",
    stage: "Get clients",
    icon: "🆕",
    title: "Approve new sign-ups",
    text: "Clients tab › New: open each one, read their intake, check they've paid, then tap Activate. Pick Evolution (online) and their prices.",
    target: { tab: "Clients", open: "newClients" },
    tip: "Activate asks how often they weigh in. Every 2 weeks suits most clients.",
  },
  // Coach them
  {
    key: "programs",
    stage: "Coach them",
    icon: "🏋️",
    title: "Where the programs are",
    text: "The Programs tab has every ready-made program in Gym, Performance and Functional. Tap one, then a heading (Beginner first), then a program to see its weeks.",
    target: { tab: "Programs" },
    tip: "+ Build a program at the top makes your own. Yours show under Your programs.",
  },
  {
    key: "give",
    stage: "Coach them",
    icon: "📅",
    title: "Put a client on a program",
    text: "Open a client, then Training. Tap the day they start, pick their goal (⭐ is the best fit), tap their training days, then Activate.",
    target: { tab: "Clients" },
    tip: "Tap any exercise on their calendar to swap it for this client only.",
  },
  {
    key: "how",
    stage: "Coach them",
    icon: "📈",
    title: "How a program works",
    text: "The client sees today's workout on their Today tab and logs every set. The first set of a new exercise finds their weight, then the app moves weights up as they get stronger.",
    tip: "The app suggests a deload week when they need one. Say yes to keep them fresh.",
  },
  {
    key: "diet",
    stage: "Coach them",
    icon: "🥗",
    title: "Their meal plan",
    text: "Open a client, then Diet. Let Daily Evolution work it out from their intake (two short pages), check the calories and tap Make the plan.",
    target: { tab: "Clients" },
    tip: "They get a shopping list with one tap, and the plan learns the foods they like.",
  },
  {
    key: "checkins",
    stage: "Coach them",
    icon: "✅",
    title: "Daily check-ins",
    text: "Clients check in each morning: sleep, energy, mood, food and coffee. Open a client, then Check-ins, and tap Send a check-in note to reply in your own words.",
    target: { tab: "Clients" },
    tip: "A short reply the same day makes clients feel coached, not just tracked.",
  },
  {
    key: "dashboard",
    stage: "Coach them",
    icon: "📊",
    title: "Your dashboard, once a day",
    text: "Who checked in, who trained, and problems in red (pain, fatigue, stress). Needs you at the top lists everything waiting on you.",
    target: { tab: "Dashboard" },
    tip: "Clear the red first: tap Busy fixing, then Fixed when it's sorted.",
  },
  {
    key: "summary",
    stage: "Coach them",
    icon: "🧠",
    title: "The daily summary",
    text: "At the top of each client's Overview, the AI reads their last 7 days and tells you their energy, with a suggestion: keep, lighten or push their training.",
    target: { tab: "Clients" },
    tip: "Look at it before you change anyone's program.",
  },
  // Keep them
  {
    key: "progress",
    stage: "Keep them",
    icon: "📸",
    title: "Progress they can see",
    text: "Client › Training › Progress graphs shows lifts, weight and measurements (Start, Best, Latest). Photos holds their progress photos.",
    target: { tab: "Clients" },
    tip: "Show them Start against Latest every month. Seeing progress keeps people going.",
  },
  {
    key: "video",
    stage: "Keep them",
    icon: "🎥",
    title: "Weekly video check-ins",
    text: "☰ Menu › Video check-ins: set your free times and your WhatsApp number. Clients book a weekly video call with you, and you both get reminders.",
    tip: "Ask clients to keep the same time every week: it books itself.",
  },
  {
    key: "challenges",
    stage: "Keep them",
    icon: "🏆",
    title: "Monthly challenges and habits",
    text: "☰ Menu › Monthly challenges: pick one a month for all your clients (steps, water, sleep and more). Add habits on a client's Habits tab.",
    tip: "You hear when a client wins. Congratulate them yourself.",
  },
  {
    key: "touch",
    stage: "Keep them",
    icon: "💬",
    title: "Stay in touch",
    text: "When you haven't been in touch with a client for 4 days, the dashboard shows Check in on… Message them yourself on WhatsApp, in your own words.",
    target: { tab: "Dashboard" },
    tip: "Regular client interaction improves client retention.",
  },
  {
    key: "guides",
    stage: "Keep them",
    icon: "📚",
    title: "Coaching guides",
    text: "☰ Menu › Coaching guides: short guides on client retention, nutrition, training each body part and recovery. Read Client retention first.",
    tip: "Run this guide again any time: ☰ Menu › Evolution guide.",
  },
];

export const guideSteps = (kind: GuideKind) => (kind === "one" ? ONE_ON_ONE_STEPS : EVOLUTION_STEPS);

export const GUIDE_TITLE: Record<GuideKind, string> = { one: "1 on 1 setup", evo: "Evolution guide" };

// Where the trainer is in each guide, kept on the phone.
export type GuideRun = { step: number; status: "running" | "done" | "stopped" };
// evoV: which Evolution guide the trainer was offered (2 = start to finish).
export type GuideState = { one?: GuideRun; evo?: GuideRun; evoV?: number };

// Bump when the Evolution guide changes enough to offer it to everyone again.
export const EVO_GUIDE_VERSION = 2;

export const guideKey = (trainerId: string) => `setup-guide:${trainerId}`;

export function readGuideState(raw: string | null): GuideState {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return {};
    const state = v as GuideState;
    // Steps changed since it was saved: keep the place inside the list.
    for (const k of ["one", "evo"] as const) {
      const run = state[k];
      if (run && typeof run.step === "number") run.step = Math.min(Math.max(0, run.step), guideSteps(k).length - 1);
    }
    return state;
  } catch {
    return {};
  }
}

// The 1 on 1 guide starts by itself for a trainer with no session setup. The
// Evolution guide (start to finish) is offered once to every trainer on the
// Evolution side, also those who saw the shorter first one. Owner never.
export function shouldAutoStart(
  kind: GuideKind,
  state: GuideState,
  t: { is_owner: boolean; evolution_started_on?: string | null },
  info: { hasSettings: boolean; side: GuideKind; evolutionOn: boolean },
): boolean {
  if (t.is_owner) return false;
  if (kind === "one") return !state.one && !info.hasSettings;
  if ((state.evoV ?? 0) >= EVO_GUIDE_VERSION) return false;
  if (state.evo?.status === "running") return false;
  return info.side === "evo" && info.evolutionOn;
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
