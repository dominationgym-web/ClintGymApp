import React from "react";
import { Text, View } from "react-native";
import { breakdownStyles as styles } from "@/components/breakdownStyles";
import type { GuidelineGroup, GuidelinePoint } from "@/lib/sleep";
import { UNDERSTANDING_CARBS as C } from "@/lib/nutrition";
import { themeBg, themeText } from "@/lib/theme";

function Step({ point, tint }: { point: GuidelinePoint; tint?: string }) {
  return (
    <View style={[styles.step, { marginBottom: 8 }]}>
      <View style={[styles.stepIcon, tint ? { backgroundColor: themeBg(tint + "33") } : null]}>
        <Text style={styles.stepEmoji}>{point.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{point.title}</Text>
        <Text style={styles.small}>{point.text}</Text>
      </View>
    </View>
  );
}

// One topic of a menu section, laid out like Understanding Insulin: a gold
// hook, a row per point with its emoji, and a closing line.
export function GuideGroupCard({ group, accent }: { group: GuidelineGroup; accent?: string }) {
  return (
    <View style={styles.card}>
      {group.hook ? (
        <View style={styles.hook}>
          <Text style={styles.hookText}>{group.hook}</Text>
        </View>
      ) : null}
      {group.points.map((point, i) => (
        <Step key={`${i}-${point.title}`} point={point} tint={accent} />
      ))}
      {group.closing ? (
        <View style={styles.closing}>
          <Text style={styles.closingText}>{group.closing}</Text>
        </View>
      ) : null}
    </View>
  );
}

// "Understanding Carbs" in GRIZZ's words, in the same visual blocks as
// Understanding Insulin.
export function CarbsGuide() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{C.title}</Text>
      <Text style={styles.subtitle}>{C.subtitle}</Text>

      <View style={styles.hook}>
        <Text style={styles.hookText}>{C.hook}</Text>
      </View>
      <Text style={styles.body}>{C.hookNote}</Text>

      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>{C.myth.title}</Text>
        {C.myth.points.map((p) => (
          <Text key={p} style={styles.body}>
            {p}
          </Text>
        ))}
      </View>

      <Text style={styles.sectionLabel}>WHAT CARB LOADING DOES</Text>
      <Text style={styles.body}>{C.loading.intro}</Text>
      {C.loading.steps.map((step, i) => (
        <View key={step.title}>
          <Step point={step} />
          {i < C.loading.steps.length - 1 && <Text style={[styles.arrow, { marginTop: -6, marginBottom: 2 }]}>+</Text>}
        </View>
      ))}
      <Text style={styles.note}>{C.loading.outro}</Text>

      <Text style={styles.sectionLabel}>{C.notRequired.title.toUpperCase()}</Text>
      {C.notRequired.steps.map((step) => (
        <Step key={step.title} point={step} />
      ))}
      <Text style={styles.body}>{C.notRequired.outro}</Text>

      <Text style={styles.sectionLabel}>WHAT YOUR BODY WAS BUILT FOR</Text>
      <Text style={styles.body}>{C.builtFor.intro}</Text>
      <View style={[styles.orderBox, styles.right]}>
        <Text style={[styles.orderLabel, { color: themeText("#4ADE80") }]}>✓ {C.builtFor.right.label}</Text>
        <Text style={styles.small}>{C.builtFor.right.text}</Text>
      </View>
      <View style={[styles.orderBox, styles.wrong]}>
        <Text style={[styles.orderLabel, { color: themeText("#F87171") }]}>✗ {C.builtFor.wrong.label}</Text>
        <Text style={styles.small}>{C.builtFor.wrong.text}</Text>
      </View>

      <Text style={styles.sectionLabel}>HEALTH VS PERFORMANCE</Text>
      <Text style={styles.body}>{C.whoFor.intro}</Text>
      <View style={styles.pair}>
        {C.whoFor.tiles.map((t) => (
          <View key={t.title} style={styles.tile}>
            <Text style={styles.tileEmoji}>{t.emoji}</Text>
            <Text style={styles.tileTitle}>{t.title}</Text>
            <Text style={styles.small}>{t.text}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.body, { marginTop: 10, fontWeight: "700" }]}>{C.whoFor.line}</Text>

      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>{C.leftOut.title}</Text>
        {C.leftOut.points.map((p) => (
          <Text key={p} style={styles.body}>
            {p}
          </Text>
        ))}
      </View>

      <View style={[styles.closing, { marginTop: 16 }]}>
        {C.myWhy.map((line) => (
          <Text key={line} style={styles.closingText}>
            {line}
          </Text>
        ))}
      </View>
      <View style={[styles.hook, { marginTop: 14, marginBottom: 0 }]}>
        <Text style={styles.hookText}>{C.question}</Text>
      </View>
    </View>
  );
}
