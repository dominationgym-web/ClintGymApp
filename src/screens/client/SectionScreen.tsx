import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Switch, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { findSection } from "@/lib/sections";
import { BRAND_GOLD } from "@/lib/brand";
import { getSleepReminderEnabled, setSleepReminderEnabled } from "@/lib/sleepReminderSetting";
import { scheduleSleepReminders } from "@/lib/notifications";
import CycleTracker from "@/components/CycleTracker";
import CalorieCalculator from "@/components/CalorieCalculator";
import MealBuilder from "@/components/MealBuilder";
import SupplementCard, { LEVEL_COLOURS, SupplementLevelsKey } from "@/components/SupplementCard";
import { SUPPLEMENTS, type SupplementLevel } from "@/lib/supplements";
import FoodGroupExamples from "@/components/FoodGroupExamples";
import InsulinGuide from "@/components/InsulinGuide";
import { UNDERSTANDING_CARBS } from "@/lib/nutrition";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<ClientStackParamList, "Section">;

// One of the menu sections. A section with content shows each part as a
// heading the client taps to open (one at a time), so they can jump to what
// they want without scrolling; one without content shows what it will cover.
export default function SectionScreen({ route }: Props) {
  const section = findSection(route.params.sectionKey);
  const [open, setOpen] = useState<string | null>(route.params.open ?? null);
  if (!section) return <View style={styles.container} />;

  const parts: { title: string; body: React.ReactNode; icon?: string; tag?: SupplementLevel }[] = [];
  if (section.key === "nutrition") {
    parts.push({ title: "Meal builder", icon: "🍽️", body: <MealBuilder /> });
    parts.push({ title: "Calorie calculator", icon: "🔢", body: <CalorieCalculator /> });
    parts.push({ title: "Build your plate", icon: "🥦", body: <FoodGroupExamples /> });
  }
  if (section.key === "womensHealthReset") parts.push({ title: "Cycle tracker", icon: "🗓️", body: <CycleTracker /> });
  for (const group of section.content ?? []) {
    parts.push({
      title: group.heading,
      icon: group.icon,
      body: (
        <View style={styles.tips}>
          {group.points.map((point, i) => (
            <View key={point} style={styles.tip}>
              <View style={[styles.tipNumber, { backgroundColor: section.accent }]}>
                <Text style={styles.tipNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.tipText}>{point}</Text>
            </View>
          ))}
        </View>
      ),
    });
  }
  if (section.key === "supplementation") {
    // Each supplement gets its own heading, after "Food first" and before the routine.
    const supplementParts = [
      { title: "What the labels mean", icon: "🏷️", body: <SupplementLevelsKey /> },
      ...SUPPLEMENTS.map((s) => ({ title: s.name, icon: s.icon, tag: s.level, body: <SupplementCard supplement={s} /> })),
    ];
    parts.splice(1, 0, ...supplementParts);
  }
  if (section.key === "nutrition") {
    parts.push({ title: UNDERSTANDING_CARBS.title, icon: "🍚", body: <UnderstandingCarbs /> });
    parts.push({ title: "Understanding Insulin", icon: "📈", body: <InsulinGuide /> });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[styles.hero, { borderColor: section.accent }]}>
        <View style={[styles.heroIcon, { backgroundColor: section.accent + "26" }]}>
          <Text style={styles.heroIconText}>{section.icon}</Text>
        </View>
        <Text style={styles.heroTitle}>{section.title}</Text>
        <Text style={styles.summary}>{section.summary}</Text>
        {parts.length > 0 ? <Text style={[styles.heroHint, { color: section.accent }]}>Tap a topic to open it</Text> : null}
      </View>
      {section.key === "sleepRecovery" && <SleepReminderToggle />}
      {section.key === "womensHealthReset" && <ResetProgramLink />}
      {parts.length > 0 ? (
        parts.map((part) => {
          const isOpen = open === part.title;
          return (
            <View key={part.title}>
              <Pressable
                style={[styles.partHeader, { borderLeftColor: section.accent }, isOpen && styles.partHeaderOpen]}
                onPress={() => setOpen(isOpen ? null : part.title)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
              >
                {part.icon ? (
                  <View style={[styles.partIcon, { backgroundColor: section.accent + "1F" }]}>
                    <Text style={styles.partIconText}>{part.icon}</Text>
                  </View>
                ) : null}
                <Text style={styles.partTitle}>{part.title}</Text>
                {part.tag ? (
                  <Text style={[styles.partTag, { color: LEVEL_COLOURS[part.tag], borderColor: LEVEL_COLOURS[part.tag] }]}>
                    {part.tag}
                  </Text>
                ) : null}
                <Text style={[styles.partArrow, { color: section.accent }]}>{isOpen ? "▲" : "▼"}</Text>
              </Pressable>
              {isOpen ? part.body : null}
            </View>
          );
        })
      ) : (
        <View style={styles.card}>
          <Text style={styles.badge}>Coming soon</Text>
          <Text style={styles.cardText}>Your coach is putting this section together. It will cover:</Text>
          {section.topics.map((topic) => (
            <Text key={topic} style={styles.topic}>
              {"•"} {topic}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function UnderstandingCarbs() {
  return (
    <View style={styles.card}>
      <Text style={styles.bigHeading}>{UNDERSTANDING_CARBS.title}</Text>
      {UNDERSTANDING_CARBS.paragraphs.map((p) => (
        <Text key={p} style={styles.paragraph}>
          {p}
        </Text>
      ))}
      <Text style={[styles.paragraph, styles.question]}>{UNDERSTANDING_CARBS.question}</Text>
    </View>
  );
}

// Clients on the 12-week Reset get a shortcut to their Reset tab.
function ResetProgramLink() {
  const { client } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  if (!client?.lifestyle_reset_started_at) return null;
  return (
    <Pressable style={styles.card} onPress={() => navigation.navigate("ClientTabs", { screen: "Reset" })}>
      <Text style={styles.toggleTitle}>🌿 Your 12-week Reset program ›</Text>
      <Text style={[styles.cardText, { marginBottom: 0 }]}>Week by week plan, daily ticks and Reset Training.</Text>
    </Pressable>
  );
}

function SleepReminderToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getSleepReminderEnabled().then(setEnabled);
  }, []);

  const onChange = (next: boolean) => {
    setEnabled(next);
    setSleepReminderEnabled(next);
    scheduleSleepReminders(next);
  };

  return (
    <View style={[styles.card, styles.toggleRow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>Nightly wind-down tip</Text>
        <Text style={styles.cardText}>A short sleep tip every evening at 6pm.</Text>
      </View>
      <Switch
        value={enabled ?? true}
        disabled={enabled === null}
        onValueChange={onChange}
        trackColor={{ true: BRAND_GOLD, false: "#334155" }}
        accessibilityLabel="Nightly wind-down tip"
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  partIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  partIconText: { fontSize: 20 },
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
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 6 },
  heroHint: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: 10, textTransform: "uppercase" },
  tips: { marginBottom: 12 },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  tipNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 1 },
  tipNumberText: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  tipText: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, flex: 1 },
  partHeaderOpen: { backgroundColor: "#273449", marginBottom: 8 },
  partTitle: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1, marginRight: 10 },
  partTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, fontSize: 11, fontWeight: "700", marginRight: 10 },
  partArrow: { color: BRAND_GOLD, fontSize: 13 },
  container: { flex: 1, backgroundColor: "#0F172A" },
  summary: { color: "#CBD5E1", fontSize: 15, lineHeight: 22, textAlign: "center" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  bigHeading: { color: BRAND_GOLD, fontSize: 26, fontWeight: "800", marginBottom: 12 },
  paragraph: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginBottom: 10 },
  question: { color: "#fff", fontWeight: "800", marginBottom: 0 },
  badge: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  cardText: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  topic: { color: "#CBD5E1", fontSize: 14, lineHeight: 21, marginBottom: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleTitle: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 2 },
});
