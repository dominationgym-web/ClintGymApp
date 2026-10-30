import React, { useCallback, useEffect, useState } from "react";
import { useStepBack } from "@/hooks/useStepBack";
import { View, Text, Switch, Pressable } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { findSection } from "@/lib/sections";
import { BRAND_GOLD } from "@/lib/brand";
import { getSleepReminderEnabled, setSleepReminderEnabled } from "@/lib/sleepReminderSetting";
import { scheduleSleepReminders } from "@/lib/notifications";
import CycleTracker from "@/components/CycleTracker";
import CalorieCalculator from "@/components/CalorieCalculator";
import MealBuilder from "@/components/MealBuilder";
import ClientDietPlanView from "@/components/ClientDietPlanView";
import { COACH_MEAL_PLAN_TITLE } from "@/hooks/useHasMealPlan";
import MealPlanMaker from "@/components/MealPlanMaker";
import MuscleBuildingGuide from "@/components/MuscleBuildingGuide";
import SupplementCard, { LEVEL_COLOURS, SupplementLevelsKey } from "@/components/SupplementCard";
import { SUPPLEMENTS, type SupplementLevel } from "@/lib/supplements";
import FoodGroupExamples from "@/components/FoodGroupExamples";
import ProteinCookingIdeas, { LightSauces } from "@/components/ProteinCookingIdeas";
import CarbsInShort, { CARBS_IN_SHORT } from "@/components/CarbsInShort";
import { GuideGroupCard } from "@/components/GuideBreakdown";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/context/AuthContext";
import { cancelMenuReturn } from "@/lib/menuReturn";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

type Props = NativeStackScreenProps<ClientStackParamList, "Section">;

const MEAL_PLAN_TITLE = "Work out your own meal plan and diet";
const MUSCLE_GUIDE_TITLE = "Muscle building: your BMR and macros";
export const PROTEIN_COOKING_TITLE = "Cooking ideas for your protein";
export const LIGHT_SAUCES_TITLE = "Low-calorie sauces";

// One of the menu sections. A section with content shows each part as a
// heading the client taps to open (one at a time), so they can jump to what
// they want without scrolling; one without content shows what it will cover.
export default function SectionScreen({ route }: Props) {
  const section = findSection(route.params.sectionKey);
  const [open, setOpen] = useState<string | null>(route.params.open ?? null);
  const closeTopic = useCallback(() => setOpen(null), []);
  useStepBack(open !== null, closeTopic);
  if (!section) return <View style={styles.container} />;

  const parts: { title: string; body: React.ReactNode; icon?: string; tag?: SupplementLevel }[] = [];
  if (section.key === "nutrition") {
    parts.push({ title: COACH_MEAL_PLAN_TITLE, icon: "🥗", body: <ClientDietPlanView /> });
    // Muscle Year (GRIZZ, 2026-10-24): BMR, macros and the 2-weekly weight check.
    parts.push({
      title: MUSCLE_GUIDE_TITLE,
      icon: "💪",
      body: <MuscleBuildingGuide onMakeMealPlan={() => setOpen(MEAL_PLAN_TITLE)} />,
    });
    parts.push({ title: MEAL_PLAN_TITLE, icon: "🤖", body: <MealPlanMaker /> });
    // Five simple ways to cook each protein, and light sauces (GRIZZ, 2026-10-27).
    parts.push({ title: PROTEIN_COOKING_TITLE, icon: "🍳", body: <ProteinCookingIdeas /> });
    parts.push({ title: LIGHT_SAUCES_TITLE, icon: "🥣", body: <LightSauces /> });
    parts.push({ title: "Meal builder", icon: "🍽️", body: <MealBuilder /> });
    parts.push({ title: "Calorie calculator", icon: "🔢", body: <CalorieCalculator /> });
    // Right under the calorie calculator (GRIZZ, 2026-10-12). One short card; the
    // full Understanding Insulin and Understanding Carbs open inside it (2026-10-18).
    parts.push({ title: CARBS_IN_SHORT.title, icon: "🍚", body: <CarbsInShort /> });
    parts.push({ title: "Build your plate", icon: "🥦", body: <FoodGroupExamples /> });
  }
  if (section.key === "womensHealthReset") parts.push({ title: "Cycle tracker", icon: "🗓️", body: <CycleTracker /> });
  for (const group of section.content ?? []) {
    parts.push({
      title: group.heading,
      icon: group.icon,
      body: <GuideGroupCard group={group} accent={section.accent} />,
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[styles.hero, { borderColor: themeBorder(section.accent) }]}>
        <View style={[styles.heroIcon, { backgroundColor: themeBg(section.accent + "26") }]}>
          <Text style={styles.heroIconText}>{section.icon}</Text>
        </View>
        <Text style={styles.heroTitle}>{section.title}</Text>
        <Text style={styles.summary}>{section.summary}</Text>
        {parts.length > 0 ? <Text style={[styles.heroHint, { color: themeText(section.accent) }]}>Tap a topic to open it</Text> : null}
      </View>
      {section.key === "sleepRecovery" && <SleepReminderToggle />}
      {section.key === "womensHealthReset" && <ResetProgramLink />}
      {parts.length > 0 ? (
        parts.map((part) => {
          const isOpen = open === part.title;
          return (
            <View key={part.title}>
              <Pressable
                style={[styles.partHeader, { borderLeftColor: themeBorder(section.accent) }, isOpen && styles.partHeaderOpen]}
                onPress={() => setOpen(isOpen ? null : part.title)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
              >
                {part.icon ? (
                  <View style={[styles.partIcon, { backgroundColor: themeBg(section.accent + "1F") }]}>
                    <Text style={styles.partIconText}>{part.icon}</Text>
                  </View>
                ) : null}
                <Text style={styles.partTitle}>{part.title}</Text>
                {part.tag ? (
                  <Text style={[styles.partTag, { color: themeText(LEVEL_COLOURS[part.tag]), borderColor: themeBorder(LEVEL_COLOURS[part.tag]) }]}>
                    {part.tag}
                  </Text>
                ) : null}
                <Text style={[styles.partArrow, { color: themeText(section.accent) }]}>{isOpen ? "▲" : "▼"}</Text>
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

// Clients on the 12-week Reset get a shortcut to their Reset tab.
function ResetProgramLink() {
  const { client } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  if (!client?.lifestyle_reset_started_at) return null;
  return (
    <Pressable style={styles.card} onPress={() => {
        cancelMenuReturn();
        navigation.navigate("ClientTabs", { screen: "Reset" });
      }}>
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
        trackColor={{ true: themeBg(BRAND_GOLD), false: themeBg("#334155") }}
        accessibilityLabel="Nightly wind-down tip"
      />
    </View>
  );
}

const styles = themedStyles({
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
  partHeaderOpen: { backgroundColor: "#273449", marginBottom: 8 },
  partTitle: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1, marginRight: 10 },
  partTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, fontSize: 11, fontWeight: "700", marginRight: 10 },
  partArrow: { color: BRAND_GOLD, fontSize: 13 },
  container: { flex: 1, backgroundColor: "#0F172A" },
  summary: { color: "#CBD5E1", fontSize: 15, lineHeight: 22, textAlign: "center" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  badge: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  cardText: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  topic: { color: "#CBD5E1", fontSize: 14, lineHeight: 21, marginBottom: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleTitle: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 2 },
});
