import { Platform, useWindowDimensions } from "react-native";
import { useAuth } from "@/context/AuthContext";

// The trainer's laptop layout (GRIZZ, 2026-10-27): a sidebar of every section,
// the client list beside the client's page and the exercise videos beside the
// program builder. Only for trainers on the website, in a window at least this
// wide; phones, narrow windows and clients keep the phone layout.
export const WIDE_SCREEN_MIN = 1000;

export function useWideScreen() {
  const { width } = useWindowDimensions();
  const { role } = useAuth();
  return Platform.OS === "web" && role === "trainer" && width >= WIDE_SCREEN_MIN;
}

// The client's laptop view (GRIZZ, 2026-10-27): a sidebar, and fuller pages
// for their week, weights lifted, body and food. Same rule as the trainer's:
// the website, in a window at least WIDE_SCREEN_MIN wide.
export function useClientWideScreen() {
  const { width } = useWindowDimensions();
  const { role } = useAuth();
  return Platform.OS === "web" && role === "client" && width >= WIDE_SCREEN_MIN;
}
