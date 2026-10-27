import { createNavigationContainerRef } from "@react-navigation/native";

// The app's one navigation container, so things outside the screens (notification
// taps, the trainer's laptop sidebar) can move between them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const navigationRef = createNavigationContainerRef<any>();
