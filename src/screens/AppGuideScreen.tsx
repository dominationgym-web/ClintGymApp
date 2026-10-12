import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { CLIENT_APP_GUIDE, TRAINER_APP_GUIDE } from "@/lib/appGuide";

export const ClientAppGuideScreen = () => <AppGuideScreen who="client" />;
export const TrainerAppGuideScreen = () => <AppGuideScreen who="trainer" />;

// "How to use the app" from the menu, for clients or trainers. Each topic is
// a heading that opens one at a time, so there's no long page to scroll.
export default function AppGuideScreen({ who }: { who: "client" | "trainer" }) {
  const guide = who === "client" ? CLIENT_APP_GUIDE : TRAINER_APP_GUIDE;
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>📘</Text>
        <Text style={styles.heroTitle}>How to use the app</Text>
        <Text style={styles.summary}>{guide.intro}</Text>
      </View>
      {guide.topics.map((topic) => {
        const isOpen = open === topic.key;
        return (
          <View key={topic.key}>
            <Pressable
              style={[styles.partHeader, isOpen && styles.partHeaderOpen]}
              onPress={() => setOpen(isOpen ? null : topic.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={styles.partIcon}>{topic.icon}</Text>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.partTitle}>{topic.title}</Text>
                <Text style={styles.where}>{topic.where}</Text>
              </View>
              <Text style={styles.partArrow}>{isOpen ? "▲" : "▼"}</Text>
            </Pressable>
            {isOpen ? (
              <View style={styles.card}>
                {topic.points.map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.point}>{point}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      <View style={styles.bottomLine}>
        <Text style={styles.bottomLineText}>💪 {guide.bottomLine}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  hero: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderTopWidth: 4,
    borderColor: BRAND_GOLD,
    padding: 20,
    alignItems: "center",
    marginBottom: 18,
  },
  heroIcon: { fontSize: 36, marginBottom: 6 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  summary: { color: "#CBD5E1", fontSize: 15, lineHeight: 22, textAlign: "center" },
  partHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_GOLD,
  },
  partHeaderOpen: { backgroundColor: "#273449", marginBottom: 8 },
  partIcon: { fontSize: 22, marginRight: 12 },
  partTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  where: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  partArrow: { color: BRAND_GOLD, fontSize: 13 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 10 },
  pointRow: { flexDirection: "row", marginBottom: 8 },
  bullet: { color: BRAND_GOLD, fontSize: 15, lineHeight: 22, marginRight: 8 },
  point: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, flex: 1 },
  bottomLine: { borderLeftWidth: 3, borderLeftColor: BRAND_GOLD, backgroundColor: "#1E293B", borderRadius: 8, padding: 12, marginTop: 8 },
  bottomLineText: { color: "#F1F5F9", fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
