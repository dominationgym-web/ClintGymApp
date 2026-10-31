import React from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { youtubeId, youtubeThumbnail } from "@/lib/watchOnline";
import { themedStyles } from "@/lib/theme";

// For exercises added from YouTube (0171): the video's picture, so a client
// who doesn't know the name can see the move, and a tap opens the video in
// the YouTube app (GRIZZ, 2026-10-31).
export default function YouTubeCard({ url, height = 190 }: { url: string; height?: number }) {
  const id = youtubeId(url);
  if (!id) return null;
  return (
    <Pressable
      style={styles.card}
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel="Watch how to do it on YouTube"
    >
      <View>
        <Image source={{ uri: youtubeThumbnail(id) }} style={[styles.picture, { height }]} resizeMode="cover" />
        <View style={styles.play}>
          <Text style={styles.playText}>▶</Text>
        </View>
      </View>
      <Text style={styles.watchText}>▶ Watch how to do it on YouTube ›</Text>
    </Pressable>
  );
}

/** A small picture of the move for exercise lists; nothing for exercises without a YouTube video. */
export function ExerciseThumb({ url, width = 64, height = 40 }: { url: string | null | undefined; width?: number; height?: number }) {
  const id = youtubeId(url);
  if (!id) return null;
  return <Image source={{ uri: youtubeThumbnail(id) }} style={[styles.thumb, { width, height }]} resizeMode="cover" />;
}

const styles = themedStyles({
  card: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 10,
  },
  picture: { width: "100%", backgroundColor: "#000" },
  play: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playText: {
    color: "#FFFFFF",
    fontSize: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 56,
    height: 56,
    lineHeight: 56,
    textAlign: "center",
    borderRadius: 28,
    overflow: "hidden",
  },
  watchText: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700", paddingVertical: 10, paddingHorizontal: 12 },
  thumb: { borderRadius: 6, backgroundColor: "#000", marginRight: 10 },
}, ["playText"]);
