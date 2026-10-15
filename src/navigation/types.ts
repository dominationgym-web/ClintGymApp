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

export type ClientTabParamList = {
  CheckIn: undefined;
  Habits: undefined;
  Reset: undefined;
  Training: undefined;
  Exercises: undefined;
  Profile: undefined;
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
  // `tab` opens the client on that tab, e.g. "training" from the recovery check.
  ClientDetail: { clientId: string; tab?: "training" };
  ProgramBuilder: undefined;
  Billing: undefined;
  TrainerGuide: { guideKey: TrainerGuideKey };
  AppGuide: undefined;
  Stability: undefined;
};

export type TrainerTabScreenProps<T extends keyof TrainerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TrainerTabParamList, T>,
  NativeStackScreenProps<TrainerStackParamList>
>;
