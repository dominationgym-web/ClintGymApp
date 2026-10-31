import React, { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { youtubeId, youtubeThumbnail } from "@/lib/watchOnline";
import { themedStyles } from "@/lib/theme";

// A small looping, silent exercise demo clip for the trainer's laptop layout
// (GRIZZ, 2026-10-27: see the videos without opening each exercise).
// Website only: a plain <video> tag. It only loads and plays while it's on
// screen, so a long list doesn't download every clip at once.
export default function ExerciseClip({
  url,
  width = "100%",
  height,
  controls,
}: {
  url: string | null | undefined;
  width?: number | "100%";
  height: number;
  controls?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const watcher = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        video.play().catch(() => {});
      } else video.pause();
    });
    watcher.observe(video);
    return () => watcher.disconnect();
  }, [url]);

  // A YouTube exercise (0171): its picture, which opens the video.
  const ytId = youtubeId(url);
  if (url && ytId) {
    return (
      <Pressable onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link" accessibilityLabel="Watch on YouTube">
        <Image source={{ uri: youtubeThumbnail(ytId) }} style={[styles.picture, { width, height }]} resizeMode="cover" />
        <View style={styles.play}>
          <Text style={styles.playText}>▶</Text>
        </View>
      </Pressable>
    );
  }
  if (!url) {
    return (
      <View style={[styles.none, { width, height }]}>
        <Text style={styles.noneText}>No clip yet</Text>
      </View>
    );
  }
  return React.createElement("video", {
    ref,
    src: seen ? url : undefined,
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: "metadata",
    controls,
    style: { width, height, objectFit: "contain", background: "#000", borderRadius: 8, display: "block", flexShrink: 0 },
  });
}

const styles = themedStyles({
  none: { backgroundColor: "#0F172A", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  noneText: { color: "#475569", fontSize: 11 },
  picture: { borderRadius: 8, backgroundColor: "#000" },
  play: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  playText: { color: "#FFFFFF", fontSize: 18, textShadowColor: "#000", textShadowRadius: 6 },
}, ["playText"]);
