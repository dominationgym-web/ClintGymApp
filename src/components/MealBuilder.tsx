import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { FOOD_GROUPS, FOODS, foodUnits, itemTotals, mealTotals, type Food, type FoodGroup, type MealItem } from "@/lib/foods";
import { parseGrams } from "@/lib/nutrition";

type Row = { id: number; food: Food; amountText: string; unitIndex: number };

const toItem = (row: Row): MealItem => ({
  food: row.food,
  amount: parseGrams(row.amountText),
  unit: foodUnits(row.food)[row.unitIndex],
});

// Optional meal builder in the Nutrition section: the client taps foods, sets
// how much of each (grams, teaspoons, eggs...) and sees the meal's calories,
// protein, carbs and fat added up. Nothing is saved.
export default function MealBuilder() {
  const [group, setGroup] = useState<FoodGroup>("Protein");
  const [rows, setRows] = useState<Row[]>([]);
  const [nextId, setNextId] = useState(1);

  const add = (food: Food) => {
    setRows((prev) => [...prev, { id: nextId, food, amountText: String(food.usual), unitIndex: 0 }]);
    setNextId((n) => n + 1);
  };
  const update = (id: number, change: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const remove = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));

  const totals = mealTotals(rows.map(toItem));

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Meal builder</Text>
      <Text style={styles.text}>
        Tap the foods in your meal, set how much of each, and it works out the calories, protein, carbs and fat for you.
      </Text>

      <View style={styles.chips}>
        {FOOD_GROUPS.map((g) => (
          <Pressable
            key={g}
            onPress={() => setGroup(g)}
            style={[styles.groupChip, g === group && styles.groupChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: g === group }}
          >
            <Text style={[styles.groupChipText, g === group && styles.groupChipTextActive]}>{g}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chips}>
        {FOODS.filter((f) => f.group === group).map((f) => (
          <Pressable key={f.name} onPress={() => add(f)} style={styles.foodChip} accessibilityRole="button" accessibilityLabel={`Add ${f.name}`}>
            <Text style={styles.foodChipText}>+ {f.name}</Text>
          </Pressable>
        ))}
      </View>

      {rows.length > 0 ? (
        <View style={styles.meal}>
          <Text style={styles.sectionLabel}>YOUR MEAL</Text>
          {rows.map((row) => {
            const units = foodUnits(row.food);
            const t = itemTotals(toItem(row));
            return (
              <View key={row.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName}>{row.food.name}</Text>
                  <Pressable onPress={() => remove(row.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${row.food.name}`}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.rowAmount}>
                  <TextInput
                    style={styles.input}
                    value={row.amountText}
                    onChangeText={(v) => update(row.id, { amountText: v })}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    accessibilityLabel={`How much ${row.food.name}`}
                  />
                  {units.map((u, i) => (
                    <Pressable
                      key={u.label}
                      onPress={() => update(row.id, { unitIndex: i })}
                      style={[styles.unitChip, i === row.unitIndex && styles.unitChipActive]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.unitText, i === row.unitIndex && styles.unitTextActive]}>{u.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.rowTotals}>
                  {Math.round(t.kcal)} kcal · {Math.round(t.protein)} g protein · {Math.round(t.carbs)} g carbs ·{" "}
                  {Math.round(t.fat)} g fat
                </Text>
              </View>
            );
          })}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Meal total</Text>
            <Text style={styles.total}>{totals.kcal} kcal</Text>
          </View>
          <View style={styles.macros}>
            <Macro label="Protein" grams={totals.protein} />
            <Macro label="Carbs" grams={totals.carbs} />
            <Macro label="Fat" grams={totals.fat} />
          </View>
          <Pressable onPress={() => setRows([])} style={styles.clear} accessibilityRole="button">
            <Text style={styles.clearText}>Start a new meal</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.note}>
        Weigh food the way it's listed, cooked or raw, because cooking changes the weight a lot. The numbers are close
        estimates from standard food tables.
      </Text>
    </View>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{grams} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: BRAND_GOLD, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  text: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  groupChip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  groupChipActive: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  groupChipText: { color: "#CBD5E1", fontSize: 13, fontWeight: "700" },
  groupChipTextActive: { color: "#0F172A" },
  foodChip: { backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  foodChipText: { color: "#E2E8F0", fontSize: 13 },
  meal: { marginTop: 6, borderTopWidth: 1, borderTopColor: "#334155", paddingTop: 12 },
  sectionLabel: { color: "#64748B", fontSize: 12, fontWeight: "700", letterSpacing: 2, marginBottom: 8 },
  row: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 8 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  rowName: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  remove: { color: "#94A3B8", fontSize: 16 },
  rowAmount: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 16, width: 80 },
  unitChip: { borderWidth: 1, borderColor: "#334155", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  unitChipActive: { borderColor: BRAND_GOLD },
  unitText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  unitTextActive: { color: BRAND_GOLD },
  rowTotals: { color: "#94A3B8", fontSize: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  totalLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  total: { color: BRAND_GOLD, fontSize: 24, fontWeight: "800" },
  macros: { flexDirection: "row", gap: 8, marginTop: 10 },
  macro: { flex: 1, backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  macroValue: { color: "#fff", fontSize: 17, fontWeight: "800" },
  macroLabel: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  clear: { alignSelf: "center", marginTop: 12, paddingVertical: 6, paddingHorizontal: 12 },
  clearText: { color: BRAND_GOLD, fontWeight: "700" },
  note: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginTop: 10 },
});
