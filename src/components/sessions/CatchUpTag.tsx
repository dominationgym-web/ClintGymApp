import { Text } from "react-native";
import { themedStyles } from "@/lib/theme";

// A yellow "Catch-up" label on a session booked to make up a missed one, so
// the trainer and client can see it at a glance (GRIZZ, 2026-11-05: "put that
// it's a catch-up in that session. Maybe in yellow"). Sits inside a row title.
export function CatchUpTag({ show }: { show: unknown }) {
  if (!show) return null;
  return <Text style={styles.tag}> Catch-up </Text>;
}

const styles = themedStyles(
  {
    tag: {
      backgroundColor: "#FACC15",
      color: "#1F2937",
      fontSize: 12,
      fontWeight: "800",
      borderRadius: 6,
      overflow: "hidden",
    },
  },
  // Same bright yellow in light and dark mode.
  ["tag"]
);
