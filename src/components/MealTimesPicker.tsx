import React from "react";
import { Pressable, Text, View } from "react-native";
import TimeSlotButton from "@/components/TimeSlotButton";
import { BRAND_GOLD } from "@/lib/brand";
import { MAX_MEALS, MAX_SNACKS, MIN_MEALS, mealTimesFor, snackTimesFor } from "@/lib/mealPlanMaker";
import { themedStyles } from "@/lib/theme";

// How many meals and snacks a client eats, and when (GRIZZ, 2026-11-02).
// The same picker in the Daily Evolution plan and the trainer's own diet.
export default function MealTimesPicker({
  first,
  meals,
  snacks,
  training = null,
  onChange,
}: {
  first: string;
  meals: string[];
  snacks: string[];
  /** When they train, so the times sit around it. */
  training?: string | null;
  onChange: (meals: string[], snacks: string[]) => void;
}) {
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <Pressable key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
  const pickMeals = (n: number) => {
    const next = mealTimesFor(n, training);
    onChange(next, snackTimesFor(next, snacks.length, training));
  };
  // One button per meal and snack: tap it and pick a half hour (GRIZZ, 2026-11-07).
  const times = (list: string[], set: (next: string[]) => void, name: string) => (
    <View>
      {list.map((t, i) => (
        <TimeSlotButton
          key={i}
          label={name === "Snack" && list.length === 1 ? "Snack" : `${name} ${i + 1}`}
          value={t || null}
          after={name === "Meal" && i > 0 ? list[i - 1] : null}
          onChange={(v) => v && set(list.map((x, j) => (j === i ? v : x)))}
        />
      ))}
    </View>
  );

  return (
    <View>
      <Text style={styles.label}>How many meals does {first} eat in a day?</Text>
      <View style={styles.chips}>
        {Array.from({ length: MAX_MEALS - MIN_MEALS + 1 }, (_, i) => MIN_MEALS + i).map((n) =>
          chip(meals.length === n, String(n), () => pickMeals(n), `meals${n}`),
        )}
      </View>
      <Text style={styles.label}>And how many snacks?</Text>
      <View style={styles.chips}>
        {Array.from({ length: MAX_SNACKS + 1 }, (_, n) => n).map((n) =>
          chip(snacks.length === n, n === 0 ? "None" : String(n), () => onChange(meals, snackTimesFor(meals, n, training)), `snacks${n}`),
        )}
      </View>
      <Text style={styles.label}>{first}'s meal times</Text>
      <Text style={styles.note}>Tap a meal to change its time.</Text>
      {times(meals, (next) => onChange(next, snacks), "Meal")}
      {snacks.length > 0 && (
        <>
          <Text style={styles.label}>{first}'s snack times</Text>
          {times(snacks, (next) => onChange(meals, next), "Snack")}
        </>
      )}
    </View>
  );
}

const styles = themedStyles({
  label: { color: "#fff", fontWeight: "700", marginTop: 12, marginBottom: 6 },
  note: { color: "#64748B", fontSize: 12, marginTop: -2, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  chip: { backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignItems: "center" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700" },
  chipTextOn: { color: "#0F172A" },
});
