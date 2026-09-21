import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type ClientTabParamList = {
  CheckIn: undefined;
  Habits: undefined;
  Reset: undefined;
  Training: undefined;
  Exercises: undefined;
  Profile: undefined;
};

export type TrainerTabParamList = {
  Dashboard: undefined;
  Clients: undefined;
};

export type TrainerStackParamList = {
  TrainerTabs: undefined;
  ClientDetail: { clientId: string };
};

export type TrainerTabScreenProps<T extends keyof TrainerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TrainerTabParamList, T>,
  NativeStackScreenProps<TrainerStackParamList>
>;
