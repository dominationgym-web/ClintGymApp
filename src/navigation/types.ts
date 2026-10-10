import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SectionKey } from "@/lib/sections";

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
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
  ClientDetail: { clientId: string };
  ProgramBuilder: undefined;
};

export type TrainerTabScreenProps<T extends keyof TrainerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TrainerTabParamList, T>,
  NativeStackScreenProps<TrainerStackParamList>
>;
