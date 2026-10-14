import React from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { watchOnlineUrl } from "@/lib/sportsGuides";
import { youtubeSearchUrl } from "@/lib/watchOnline";

// For a move with no demo video yet (GRIZZ, 2026-10-14: every exercise or
// movement without a video): opens examples online. search is a short search
// term when the name alone wouldn't find good examples.
export default function WatchOnlineLink({ name, search }: { name: string; search?: string }) {
  const url = search ? youtubeSearchUrl(search) : watchOnlineUrl(name);
  return (
    <Pressable
      style={styles.watch}
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={`Watch examples of ${name} online`}
    >
      <Text style={styles.watchText}>▶ No video in the app yet: watch examples online ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  watch: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  watchText: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700" },
});
