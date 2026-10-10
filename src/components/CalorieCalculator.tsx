import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { estimateCalories, parseGrams, type MacroKey } from "@/lib/nutrition";

const FIELDS: { key: MacroKey; label: string }[] = [
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "fibre", label: "Fibre" },
  { key: "fat", label: "Fat" },
];

// Optional calorie counter in the Nutrition section, for clients who want to
// count: type the grams of protein, carbs, fibre and fat and it estimates the
// calories. Nothing is saved.
export default function CalorieCalculator() {
  const [text, setText] = useState<Record<MacroKey, string>>({ protein: "", carbs: "", fibre: "", fat: "" });
  const grams = {
    protein: parseGrams(text.protein),
    carbs: parseGrams(text.carbs),
    fibre: parseGrams(text.fibre),
    fat: parseGrams(text.fat),
  };
  const { total, parts } = estimateCalories(grams);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Calorie calculator (optional)</Text>
      <Text style={styles.text}>
        For those who like to count. Enter the grams of protein, carbs, fibre and fat in your meal (from the food label or
        a nutrition table) and you'll get the estimated calories.
      </Text>
      <View style={styles.grid}>
        {FIELDS.map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label} (g)</Text>
            <TextInput
              style={styles.input}
              value={text[f.key]}
              onChangeText={(v) => setText((prev) => ({ ...prev, [f.key]: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#64748B"
              accessibilityLabel={`${f.label} in grams`}
            />
            <Text style={styles.part}>{parts[f.key]} kcal</Text>
          </View>
        ))}
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Estimated total</Text>
        <Text style={styles.total}>{total} kcal</Text>
      </View>
      <Text style={styles.note}>
        Raw or cooked makes a big difference. Cooking drives out water, so the same protein is packed into less weight:
        100 g of cooked chicken has far more protein than 100 g of raw chicken. Use the values for the way you weighed
        it, raw or cooked.
      </Text>
      <Text style={styles.note}>Protein and carbs ≈ 4 kcal per gram, fibre ≈ 2, fat ≈ 9. These are estimates.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  text: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  field: { width: "47%" },
  label: { color: "#CBD5E1", fontSize: 13, fontWeight: "600", marginBottom: 4 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 10, fontSize: 16 },
  part: { color: "#64748B", fontSize: 12, marginTop: 4 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    marginTop: 14,
    paddingTop: 12,
  },
  totalLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  total: { color: BRAND_GOLD, fontSize: 22, fontWeight: "800" },
  note: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginTop: 10 },
});
