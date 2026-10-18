import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { breakdownStyles as styles } from "@/components/breakdownStyles";
import { UNDERSTANDING_INSULIN } from "@/lib/nutrition";
import InsulinGuide from "@/components/InsulinGuide";
import { CarbsGuide } from "@/components/GuideBreakdown";

// One short carb card instead of two long guides (nutrition review,
// "one carb story", 2026-10-18). The short version says what matters; the
// insulin resistance tile stays in view; GRIZZ's full Understanding Insulin
// and Understanding Carbs open underneath for anyone who wants to read on.
export const CARBS_IN_SHORT = {
  title: "Carbs and insulin",
  hook: "Carbs don't make you fat. Eating more than your body uses does.",
  points: [
    { emoji: "⚡", title: "Carbs fuel training", text: "Have most of them around your workouts if it helps your energy." },
    { emoji: "🥔", title: "Whole-food carbs are healthy", text: "Vegetables, fruit, beans, lentils, whole grains, potatoes and pap bring fibre, vitamins and minerals." },
    { emoji: "⚖️", title: "Fat loss comes from a calorie deficit", text: "Total calories and enough protein matter most. Fewer carbs is fine if you prefer it, but burns no more fat at the same calories." },
    { emoji: "🍬", title: "Cut sugar first", text: "Sweets and sugary drinks don't fill you up and are easy to overeat. Keep them for now and then." },
  ],
};

const insulinResistance =
  UNDERSTANDING_INSULIN.whoFor.find((w) => w.title.toLowerCase().includes("insulin")) ?? UNDERSTANDING_INSULIN.whoFor[0];

export default function CarbsInShort() {
  const [more, setMore] = useState<"insulin" | "carbs" | null>(null);
  return (
    <View>
      <View style={styles.card}>
        <View style={styles.hook}>
          <Text style={styles.hookText}>{CARBS_IN_SHORT.hook}</Text>
        </View>
        {CARBS_IN_SHORT.points.map((p) => (
          <View key={p.title} style={[styles.step, { marginBottom: 8 }]}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepEmoji}>{p.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{p.title}</Text>
              <Text style={styles.small}>{p.text}</Text>
            </View>
          </View>
        ))}
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>
            {insulinResistance.emoji} {insulinResistance.title}
          </Text>
          <Text style={styles.body}>{insulinResistance.text}</Text>
        </View>
      </View>
      {(
        [
          { key: "insulin", label: "Read more: Understanding Insulin" },
          { key: "carbs", label: "Read more: Understanding Carbs" },
        ] as const
      ).map((m) => (
        <View key={m.key}>
          <Pressable onPress={() => setMore(more === m.key ? null : m.key)} hitSlop={6} accessibilityRole="button">
            <Text style={[styles.sectionLabel, { marginTop: 4 }]}>
              {m.label} {more === m.key ? "▲" : "▼"}
            </Text>
          </Pressable>
          {more === m.key && (m.key === "insulin" ? <InsulinGuide /> : <CarbsGuide />)}
        </View>
      ))}
    </View>
  );
}
