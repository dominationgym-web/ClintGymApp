import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";

// "What's a high-GI meal?" under the check-in's high-GI question (GRIZZ,
// 2026-10-25: some clients won't know). Tap to open, so the step stays short.
export const HIGH_GI_EXPLAINED =
  "A high-GI meal is one where most of the plate is fast carbs: food that turns into sugar in your blood quickly, gives a quick burst of energy and then a crash, and leaves you hungry again soon.";

export const HIGH_GI_EXAMPLES = [
  "White bread, rolls, vetkoek or pap",
  "White rice, potatoes or chips",
  "Sugary cereals, cakes, biscuits or muffins",
  "Sweets, chocolates or ice cream",
  "Fizzy drinks, energy drinks or fruit juice",
];

export const HIGH_GI_COUNT_IT =
  "Count a meal or snack if most of it was food like this. A meal built around meat, fish, eggs, beans or vegetables, with a small side of carbs, doesn't count.";

export default function HighGiInfo() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} accessibilityRole="button">
        <Text style={styles.toggle}>{open ? "▾" : "▸"} What's a high-GI meal?</Text>
      </Pressable>
      {open && (
        <View style={styles.box}>
          <Text style={styles.text}>{HIGH_GI_EXPLAINED}</Text>
          <Text style={styles.label}>For example:</Text>
          {HIGH_GI_EXAMPLES.map((e) => (
            <Text key={e} style={styles.text}>
              • {e}
            </Text>
          ))}
          <Text style={[styles.text, { marginTop: 8 }]}>{HIGH_GI_COUNT_IT}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  toggle: { color: BRAND_GOLD, fontWeight: "600", fontSize: 13 },
  box: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8 },
  label: { color: "#fff", fontWeight: "700", fontSize: 13, marginTop: 8, marginBottom: 2 },
  text: { color: "#CBD5E1", fontSize: 13, lineHeight: 19 },
});
