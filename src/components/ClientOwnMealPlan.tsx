import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import MealPlanMaker from "@/components/MealPlanMaker";
import type { Client } from "@/types/database";
import { themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// The trainer's Diet tab (GRIZZ, 2026-11-02: "we need to word this
// differently, very confusing"): two clear choices, each under a tap-to-open
// heading.
// 1. Daily Evolution works out the diet: the meal plan maker (0077, 0182,
//    0186). The client sees it under Nutrition and can swap foods, leave foods
//    out and put in their own meals.
// 2. The trainer works out their own diet, food by food (the diet planner,
//    0071). While it has meals in it, the client sees this one instead.
export default function ClientOwnMealPlan({
  client,
  trainerId,
  onDetailsSaved,
  ownPlan,
}: {
  client: Client;
  trainerId: string;
  onDetailsSaved?: () => void;
  /** The diet planner, kept mounted so unsaved changes survive closing its heading. */
  ownPlan: React.ReactNode;
}) {
  const [open, setOpen] = useState<"de" | "own" | null>(null);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open !== null, () => setOpen(null));
  const first = client.name.trim().split(/\s+/)[0] || client.name;
  const toggle = (which: "de" | "own") => setOpen(open === which ? null : which);

  const heading = (which: "de" | "own", icon: string, title: string, detail: string) => (
    <Pressable
      style={styles.header}
      onPress={() => toggle(which)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open === which }}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>{open === which ? "▲" : "▼"}</Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={styles.intro}>How would you like to plan {first}'s diet? Pick one.</Text>
      <View style={styles.card}>
        {heading(
          "de",
          "🤖",
          `Let Daily Evolution work out ${first}'s diet`,
          "Answer a few questions and the app builds the meals from their BMR and goal. They can swap foods they don't like.",
        )}
        {open === "de" && (
          <View style={{ marginTop: 12 }}>
            <MealPlanMaker forTrainer={{ client, trainerId, onDetailsSaved }} />
          </View>
        )}
      </View>
      <View style={styles.card}>
        {heading(
          "own",
          "✍️",
          `Work out your own diet for ${first}`,
          `Add each food yourself, day by day. While it has meals in it, ${first} sees this one instead of the app's.`,
        )}
        {/* Kept mounted (clipped, never display:none) so unsaved foods aren't lost. */}
        <View style={open === "own" ? { marginTop: 12 } : styles.clipped}>{ownPlan}</View>
      </View>
    </View>
  );
}

const styles = themedStyles({
  intro: { color: "#CBD5E1", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 24 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  detail: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginTop: 2 },
  chevron: { color: BRAND_GOLD, fontSize: 14 },
  clipped: { height: 0, overflow: "hidden" },
});
