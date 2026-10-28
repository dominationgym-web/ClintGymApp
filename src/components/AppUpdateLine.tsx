import React from "react";
import { Text } from "react-native";
import * as Updates from "expo-updates";
import { themedStyles } from "@/lib/theme";

// Which update the phone is running (GRIZZ, 2026-10-19: a tester's app
// looked out of date). Shown under Log out so anyone can read it out.
export function appUpdateLabel(createdAt: Date | null, embedded: boolean): string {
  if (embedded || !createdAt) return "App version: as installed (no update downloaded yet)";
  const day = createdAt.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const time = createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `App update: ${day}, ${time}`;
}

export default function AppUpdateLine() {
  return <Text style={styles.line}>{appUpdateLabel(Updates.createdAt ?? null, Updates.isEmbeddedLaunch)}</Text>;
}

const styles = themedStyles({
  line: { color: "#64748B", fontSize: 12, textAlign: "center", marginTop: 16 },
});
