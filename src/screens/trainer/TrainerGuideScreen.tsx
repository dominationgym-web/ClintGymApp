import React, { useCallback, useState } from "react";
import { useStepBack } from "@/hooks/useStepBack";
import { View, Text, ScrollView, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { trainerGuide } from "@/lib/trainerGuides";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

type Props = NativeStackScreenProps<TrainerStackParamList, "TrainerGuide">;

// One coaching guide from the trainer menu. Each topic is a heading the
// trainer taps to open (one at a time), so there's no long page to scroll.
export default function TrainerGuideScreen({ route }: Props) {
  const guide = trainerGuide(route.params.guideKey);
  const [open, setOpen] = useState<string | null>(null);
  const closeTopic = useCallback(() => setOpen(null), []);
  useStepBack(open !== null, closeTopic);
  if (!guide) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={[styles.hero, { borderColor: themeBorder(guide.accent) }]}>
        <View style={[styles.heroIcon, { backgroundColor: themeBg(guide.accent + "26") }]}>
          <Text style={styles.heroIconText}>{guide.icon}</Text>
        </View>
        <Text style={styles.heroTitle}>{guide.title}</Text>
        <Text style={styles.summary}>{guide.summary}</Text>
        <Text style={[styles.heroHint, { color: themeText(guide.accent) }]}>Tap a topic to open it</Text>
      </View>
      {guide.topics.map((topic) => {
        const isOpen = open === topic.title;
        return (
          <View key={topic.title}>
            <Pressable
              style={[styles.partHeader, { borderLeftColor: themeBorder(guide.accent) }, isOpen && styles.partHeaderOpen]}
              onPress={() => setOpen(isOpen ? null : topic.title)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <View style={[styles.partIcon, { backgroundColor: themeBg(guide.accent + "1F") }]}>
                <Text style={styles.partIconText}>{topic.icon}</Text>
              </View>
              <Text style={styles.partTitle}>{topic.title}</Text>
              <Text style={[styles.partArrow, { color: themeText(guide.accent) }]}>{isOpen ? "▲" : "▼"}</Text>
            </Pressable>
            {isOpen ? (
              <View style={{ marginBottom: 8 }}>
                {topic.intro ? <Text style={styles.intro}>{topic.intro}</Text> : null}
                {topic.groups.map((group) => (
                  <View key={group.heading} style={styles.card}>
                    <Text style={[styles.heading, { color: themeText(guide.accent) }]}>{group.heading}</Text>
                    {group.points.map((point) => (
                      <View key={point} style={styles.pointRow}>
                        <Text style={[styles.bullet, { color: themeText(guide.accent) }]}>•</Text>
                        <Text style={styles.point}>{point}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  hero: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderTopWidth: 4,
    padding: 20,
    alignItems: "center",
    marginBottom: 18,
  },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  heroIconText: { fontSize: 32 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  heroHint: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: 10, textTransform: "uppercase" },
  summary: { color: "#CBD5E1", fontSize: 15, lineHeight: 22, textAlign: "center" },
  partHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  partHeaderOpen: { backgroundColor: "#273449", marginBottom: 8 },
  partIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  partIconText: { fontSize: 20 },
  partTitle: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1, marginRight: 10 },
  partArrow: { fontSize: 13 },
  intro: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginBottom: 10, fontStyle: "italic" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 10 },
  heading: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  pointRow: { flexDirection: "row", marginBottom: 8 },
  bullet: { fontSize: 15, lineHeight: 22, marginRight: 8 },
  point: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, flex: 1 },
});
