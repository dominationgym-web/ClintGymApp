import React from "react";
import { Text, View } from "react-native";
import { breakdownStyles as styles } from "@/components/breakdownStyles";
import { UNDERSTANDING_INSULIN as G } from "@/lib/nutrition";
import { themeText } from "@/lib/theme";

// "Understanding Insulin" on the Nutrition page: GRIZZ's talk on carbs,
// insulin and fat burning, laid out as a chain of steps, side-by-side
// comparisons and a closing line so it reads at a glance.
export default function InsulinGuide() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{G.title}</Text>
      <Text style={styles.subtitle}>{G.subtitle}</Text>

      <View style={styles.hook}>
        <Text style={styles.hookText}>{G.hook}</Text>
      </View>
      <Text style={styles.body}>{G.intro}</Text>

      <Text style={styles.sectionLabel}>WHAT HAPPENS</Text>
      {G.steps.map((step, i) => (
        <View key={step.title}>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepEmoji}>{step.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.small}>{step.text}</Text>
            </View>
          </View>
          {i < G.steps.length - 1 && <Text style={styles.arrow}>↓</Text>}
        </View>
      ))}

      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>{G.oneSweet.title}</Text>
        {G.oneSweet.points.map((p) => (
          <Text key={p} style={styles.body}>
            {p}
          </Text>
        ))}
      </View>

      <Text style={styles.sectionLabel}>SAME SWEET, DIFFERENT BODY</Text>
      <View style={styles.pair}>
        {G.whoFor.map((w) => (
          <View key={w.title} style={styles.tile}>
            <Text style={styles.tileEmoji}>{w.emoji}</Text>
            <Text style={styles.tileTitle}>{w.title}</Text>
            <Text style={styles.small}>{w.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{G.order.title.toUpperCase()}</Text>
      <View style={[styles.orderBox, styles.wrong]}>
        <Text style={[styles.orderLabel, { color: themeText("#F87171") }]}>✗ {G.order.wrong.label}</Text>
        <Text style={styles.small}>{G.order.wrong.text}</Text>
      </View>
      <View style={[styles.orderBox, styles.right]}>
        <Text style={[styles.orderLabel, { color: themeText("#4ADE80") }]}>✓ {G.order.right.label}</Text>
        <Text style={styles.small}>{G.order.right.text}</Text>
      </View>
      <Text style={styles.note}>{G.order.note}</Text>

      <Text style={styles.sectionLabel}>HORSES FOR COURSES</Text>
      <View style={styles.goals}>
        {G.goals.map((g) => (
          <View key={g.goal} style={styles.goal}>
            <Text style={styles.goalEmoji}>{g.emoji}</Text>
            <Text style={styles.goalText}>{g.goal}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.body}>{G.goalsLine}</Text>
      <Text style={styles.body}>{G.warning}</Text>

      <View style={styles.closing}>
        <Text style={styles.closingText}>{G.closing}</Text>
      </View>
    </View>
  );
}
