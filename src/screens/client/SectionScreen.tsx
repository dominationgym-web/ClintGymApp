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

  const parts: { title: string; body: React.ReactNode }[] = [];
  if (section.key === "nutrition") {
    parts.push({ title: "Meal builder", body: <MealBuilder /> });
    parts.push({ title: "Calorie calculator", body: <CalorieCalculator /> });
    parts.push({ title: "Build your plate", body: <FoodGroupExamples /> });
  }
  if (section.key === "womensHealthReset") parts.push({ title: "Cycle tracker", body: <CycleTracker /> });
  for (const group of section.content ?? []) {
    parts.push({
      title: group.heading,
      body: (
        <View style={styles.card}>
          {group.points.map((point) => (
            <Text key={point} style={styles.topic}>
              {"•"} {point}
            </Text>
          ))}
        </View>
      ),
    });
  }
  if (section.key === "nutrition") {
    parts.push({ title: UNDERSTANDING_CARBS.title, body: <UnderstandingCarbs /> });
    parts.push({ title: "Understanding Insulin", body: <InsulinGuide /> });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.summary}>{section.summary}</Text>
      {section.key === "sleepRecovery" && <SleepReminderToggle />}
      {section.key === "womensHealthReset" && <ResetProgramLink />}
      {parts.length > 0 ? (
        parts.map((part) => {
          const isOpen = open === part.title;
          return (
            <View key={part.title}>
              <Pressable
                style={[styles.partHeader, isOpen && styles.partHeaderOpen]}
                onPress={() => setOpen(isOpen ? null : part.title)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
              >
                <Text style={styles.partTitle}>{part.title}</Text>
                <Text style={styles.partArrow}>{isOpen ? "▲" : "▼"}</Text>
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
  },
  partHeaderOpen: { backgroundColor: "#273449" },
  partTitle: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1, marginRight: 10 },
  partArrow: { color: BRAND_GOLD, fontSize: 13 },
  container: { flex: 1, backgroundColor: "#0F172A" },
  summary: { color: "#E2E8F0", fontSize: 16, lineHeight: 23, marginBottom: 20 },
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
