import type { StabilityArea } from "@/lib/stability";
import type { TrainerGuideKey } from "@/lib/trainerGuides";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SectionKey } from "@/lib/sections";

export type AuthStackParamList = {
  Welcome: undefined;
  // `coach` shows the coach version of the login screen (same sign-in,
  // coach-facing wording and an "apply to coach" link).
  Login: { coach?: boolean } | undefined;
  Signup: undefined;
  TrainerSignup: undefined;
};

// "Exercises" is the tab called Training (app-flow review C1, 2026-10-18); the
// key stays so notification taps and old links still land on it. The old
// Video log tab is now the FormVideos page, opened from Profile or the set log.
export type ClientTabParamList = {
  // The client's laptop view (GRIZZ, 2026-10-27): only on a wide website window.
  MyWeek: undefined;
  Lifts: undefined;
  Body: undefined;
  Food: undefined;
  CheckIn: undefined;
  Habits: undefined;
  Reset: undefined;
  Exercises: undefined;
  // open: the Profile heading to show opened, e.g. "pay" from the plan-ending banner.
  Profile: { open?: "pay" | "progress" } | undefined;
};

export type ClientStackParamList = {
  ClientTabs: NavigatorScreenParams<ClientTabParamList> | undefined;
  // open: the heading to show opened on arrival, e.g. "Cycle tracker".
  Section: { sectionKey: SectionKey; open?: string };
  Search: undefined;
  SuggestionBox: undefined;
  Welcome: undefined;
  AppGuide: undefined;
  Stability: undefined;
  Recovery: undefined;
  // The client's form videos and their coach's feedback (was the Video log tab).
  FormVideos: undefined;
  // EMOM, Tabata and interval timers (0152); tab "saved" from a coach's new timer.
  Timers: { tab?: "saved" } | undefined;
  // Weekly video check-in with the coach (0155).
  VideoCheckIn: undefined;
  // Which notification groups the client gets (0159).
  NotificationSettings: undefined;
  // How to use the app, notifications and the welcome, on one menu line (2026-10-27).
  HelpSettings: undefined;
};

export type TrainerTabParamList = {
  Dashboard: undefined;
  Clients: undefined;
  Programs: undefined;
  TrainerProfile: undefined;
  // Only for the app owner (0029). openId opens that trainer's row, e.g. from a problem they sent (0151).
  Trainers: { openId?: string } | undefined;
};

export type TrainerStackParamList = {
  TrainerTabs: NavigatorScreenParams<TrainerTabParamList> | undefined;
  Search: undefined;
  SuggestionBox: undefined;
  // Trainer problems (0151): problemId opens that one, e.g. from its notification.
  TrainerProblems: { problemId?: string } | undefined;
  // Monthly challenges (0153): pick one for all clients and see who's winning.
  Challenges: undefined;
  // Weekly video check-ins (0155): bookings, free times and call setup.
  VideoCheckIns: undefined;
  // `tab` opens the client on that tab, e.g. "training" from the recovery check;
  // `open` opens one heading on it, e.g. "videos" from the Dashboard's Watch link.
  // With no `tab` it opens on the tab the trainer used last (2026-10-27).
  ClientDetail: { clientId: string; tab?: "training" | "overview"; open?: "videos" | "history" };
  // Live 1-on-1: the client's own workout screen, run by their trainer (0134).
  // `self`: the trainer training themselves (0146).
  LiveWorkout: { clientId: string; name: string; self?: boolean };
  // Group live session (0138): up to 4 clients at once, starting with this one.
  GroupLive: { clientId?: string } | undefined;
  ProgramBuilder: undefined;
  Billing: undefined;
  TrainerGuide: { guideKey: TrainerGuideKey };
  // Every coaching guide, on one menu line (2026-10-27).
  CoachingGuides: undefined;
  AppGuide: undefined;
  // area opens that body area straight away (from an injury a client reported).
  Stability: { area?: StabilityArea } | undefined;
  Timers: undefined;
};

export type TrainerTabScreenProps<T extends keyof TrainerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TrainerTabParamList, T>,
  NativeStackScreenProps<TrainerStackParamList>
>;
