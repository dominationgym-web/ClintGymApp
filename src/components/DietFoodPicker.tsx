import React, { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import ModalSafeArea from "./ModalSafeArea";
import { BRAND_GOLD } from "@/lib/brand";
import { FOODS, searchFoods, type Food, type FoodGroup } from "@/lib/foods";
import {
  DEFAULT_TARGET,
  PLANNER_GROUPS,
  gramsFor,
  itemTotals,
  setByFor,
  type DietItem,
  type SetBy,
} from "@/lib/dietPlan";
import KeyboardSafe from "@/components/KeyboardSafe";
import { themedStyles } from "@/lib/theme";

const SET_BY_LABEL: Record<SetBy, string> = {
  protein: "Protein",
  carbs: "Carbs",
  fibre: "Fibre",
  fat: "Fat",
  weight: "Food weight",
};

// Adding a food to a meal in the trainer's diet planner (0071): tap a group
// (or search), tap a food, then say how many grams of protein, carbs, fibre
// or fat the meal should get from it. The app works out how much food that is.
export default function DietFoodPicker({
  mealName,
  editing,
  onSave,
  onClose,
}: {
  /** The meal being added to, or null when closed. */
  mealName: string | null;
  /** An item being changed, instead of a new one. */
  editing: DietItem | null;
  onSave: (item: DietItem) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<FoodGroup>("Protein");
  const [search, setSearch] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [setBy, setSetBy] = useState<SetBy>("protein");
  const [amount, setAmount] = useState("");

  const choose = (f: Food, grams?: number) => {
    const by = setByFor(f);
    setFood(f);
    if (grams != null) {
      // Changing a saved item opens on its exact weight, so opening it and
      // tapping Save leaves it as it was (going via rounded protein grams
      // used to nudge 100 g of eggs to 105 g).
      setSetBy("weight");
      setAmount(String(grams));
    } else {
      setSetBy(by);
      setAmount(String(DEFAULT_TARGET[by]));
    }
  };

  useEffect(() => {
    if (mealName == null) return;
    setSearch("");
    const existing = editing ? FOODS.find((f) => f.name === editing.food) ?? null : null;
    if (existing && editing) {
      setGroup(existing.group);
      choose(existing, editing.grams);
    } else {
      setFood(null);
    }
  }, [mealName, editing?.food]);

  if (mealName == null) return null;

  const term = search.trim().toLowerCase();
  const foods = term ? searchFoods(term) : FOODS.filter((f) => f.group === group);
  const number = Number(amount.replace(",", "."));
  const grams = food ? gramsFor(food, setBy, number) : 0;
  const totals = food ? itemTotals({ food: food.name, grams }) : null;
  const unit = food?.name.endsWith("(ml)") ? "ml" : "g";
  const options: SetBy[] = food ? [...new Set<SetBy>([setByFor(food), "weight"])] : [];

  const close = () => {
    setFood(null);
    onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={food && !editing ? () => setFood(null) : close}>
      <KeyboardSafe>
      <ModalSafeArea style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>{food ? food.name : `Add to ${mealName}`}</Text>
          <Pressable onPress={food && !editing ? () => setFood(null) : close} hitSlop={8}>
            <Text style={styles.close}>{food && !editing ? "Back" : "Close"}</Text>
          </Pressable>
        </View>

        {!food ? (
          <>
            <TextInput
              style={[styles.input, { marginHorizontal: 20 }]}
              placeholder="🔍 Search foods, e.g. rice or salmon"
              placeholderTextColor="#64748B"
              value={search}
              onChangeText={setSearch}
            />
            {!term && (
              <View style={styles.groups}>
                {PLANNER_GROUPS.map((g) => (
                  <Pressable key={g.group} style={[styles.chip, group === g.group && styles.chipOn]} onPress={() => setGroup(g.group)}>
                    <Text style={[styles.chipText, group === g.group && styles.chipTextOn]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <FlatList
              data={foods}
              keyExtractor={(f) => f.name}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              ListEmptyComponent={<Text style={styles.helper}>No foods match "{search}".</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.foodRow} onPress={() => choose(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodName}>{item.name}</Text>
                    <Text style={styles.helper}>
                      Per 100 {item.name.endsWith("(ml)") ? "ml" : "g"}: {item.kcal} kcal · P {item.protein} · C {item.carbs} · F {item.fat}
                      {item.fibre ? ` · Fibre ${item.fibre}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.add}>＋</Text>
                </Pressable>
              )}
            />
          </>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Set it by</Text>
            <View style={styles.chipsRow}>
              {options.map((o) => (
                <Pressable
                  key={o}
                  style={[styles.chip, setBy === o && styles.chipOn]}
                  onPress={() => {
                    setSetBy(o);
                    // Keep the same amount of food, shown the new way.
                    setAmount(String(o === "weight" ? grams || DEFAULT_TARGET.weight : totals && grams > 0 ? Math.round(totals[o]) : DEFAULT_TARGET[o]));
                  }}
                >
                  <Text style={[styles.chipText, setBy === o && styles.chipTextOn]}>{SET_BY_LABEL[o]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>
              {setBy === "weight" ? `How much ${food.name.toLowerCase()} (${unit})?` : `How many grams of ${SET_BY_LABEL[setBy].toLowerCase()} for ${mealName.toLowerCase()}?`}
            </Text>
            <TextInput
              style={styles.bigInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={5}
            />

            {totals && grams > 0 ? (
              <View style={styles.result}>
                <Text style={styles.resultWeight}>
                  {setBy === "weight" ? `${grams} ${unit}` : `Weigh out ${grams} ${unit}`}
                </Text>
                <Text style={styles.resultMacros}>
                  {Math.round(totals.kcal)} kcal · Protein {Math.round(totals.protein)} g · Carbs {Math.round(totals.carbs)} g · Fat{" "}
                  {Math.round(totals.fat)} g{totals.fibre >= 0.5 ? ` · Fibre ${Math.round(totals.fibre)} g` : ""}
                </Text>
              </View>
            ) : (
              <Text style={styles.helper}>Type an amount above.</Text>
            )}

            <Pressable
              style={[styles.saveButton, !(grams > 0) && { opacity: 0.5 }]}
              disabled={!(grams > 0)}
              onPress={() => {
                onSave({ food: food.name, grams });
                setFood(null);
              }}
            >
              <Text style={styles.saveText}>{editing ? "Save" : `Add to ${mealName}`}</Text>
            </Pressable>
            {!editing && (
              <Pressable style={styles.otherFood} onPress={() => setFood(null)}>
                <Text style={styles.otherFoodText}>Pick a different food</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </ModalSafeArea>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1, marginRight: 12 },
  close: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14 },
  groups: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  foodRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  foodName: { color: "#fff", fontWeight: "600", fontSize: 14 },
  helper: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  add: { color: BRAND_GOLD, fontSize: 22, fontWeight: "700", marginLeft: 10 },
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  bigInput: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 14, fontSize: 24, fontWeight: "800", width: 140 },
  result: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginTop: 16, borderLeftWidth: 3, borderLeftColor: BRAND_GOLD },
  resultWeight: { color: BRAND_GOLD, fontSize: 20, fontWeight: "800" },
  resultMacros: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  saveButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  otherFood: { alignItems: "center", paddingVertical: 14 },
  otherFoodText: { color: "#94A3B8", fontWeight: "600" },
});
