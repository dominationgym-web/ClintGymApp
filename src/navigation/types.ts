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
  CheckIn: undefined;
  Habits: undefined;
  Reset: undefined;
  Exercises: undefined;
  // open: the Profile heading to show opened, e.g. "pay" from the plan-ending banner.
  Profile: { open?: "pay" } | undefined;
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
};

export type TrainerTabParamList = {
  Dashboard: undefined;
  Clients: undefined;
  Programs: undefined;
  TrainerProfile: undefined;
  // Only for the app owner (0029).
  Trainers: undefined;
};

export type TrainerStackParamList = {
  TrainerTabs: NavigatorScreenParams<TrainerTabParamList> | undefined;
  Search: undefined;
  SuggestionBox: undefined;
  // `tab` opens the client on that tab, e.g. "training" from the recovery check;
  // `open` opens one heading on it, e.g. "videos" from the Dashboard's Watch link.
  ClientDetail: { clientId: string; tab?: "training"; open?: "videos" };
  ProgramBuilder: undefined;
  Billing: undefined;
  TrainerGuide: { guideKey: TrainerGuideKey };
  AppGuide: undefined;
  // area opens that body area straight away (from an injury a client reported).
  Stability: { area?: StabilityArea } | undefined;
};

export type TrainerTabScreenProps<T extends keyof TrainerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TrainerTabParamList, T>,
  NativeStackScreenProps<TrainerStackParamList>
>;
