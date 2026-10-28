import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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

const styles = StyleSheet.create({
  none: { backgroundColor: "#0F172A", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  noneText: { color: "#475569", fontSize: 11 },
});
