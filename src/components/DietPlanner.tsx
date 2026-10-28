import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import {
  ACTIVITY_LEVELS,
  DIET_WEEKDAYS,
  amountLabel,
  bmr,
  dailyNeed,
  dayTotals,
  emptyWeek,
  intakeDetails,
  lowTargetWarning,
  normaliseWeek,
  referralReasons,
  sumTotals,
  targetStatus,
  weekdayIndex,
  type DietDay,
  type DietItem,
  type DietSex,
} from "@/lib/dietPlan";
import DietFoodPicker from "@/components/DietFoodPicker";
import type { Client } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

type Direction = "same" | "over" | "under";

const toNumber = (text: string) => {
  const n = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

// The ranges the database accepts (0071). Outside them a number counts as
// not filled in, and saving says what to fix in plain words.
const LIMITS = {
  weight: { min: 25, max: 400, problem: "Weight should be in kg, between 25 and 400." },
  height: { min: 100, max: 250, problem: "Height should be in cm, between 100 and 250 (for example 175, not 1.75)." },
  age: { min: 12, max: 100, problem: "Age should be between 12 and 100." },
  adjust: { min: 1, max: 2000, problem: "Over or under can be at most 2000 kcal a day." },
};
const inRange = (text: string, key: keyof typeof LIMITS) => {
  const n = toNumber(text);
  return n != null && n >= LIMITS[key].min && n <= LIMITS[key].max ? n : null;
};

// The trainer's diet planner on a client's Diet tab (0071): set the client's
// calorie target from their BMR, then build each day of the week meal by
// meal. Each day shows a red warning while it's over or under the target.
export default function DietPlanner({ client, onDirtyChange }: { client: Client; onDirtyChange?: (dirty: boolean) => void }) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<DietSex | null>(null);
  const [activity, setActivity] = useState(1.375);
  const [direction, setDirection] = useState<Direction>("same");
  const [adjust, setAdjust] = useState("300");
  const [days, setDays] = useState<DietDay[]>(emptyWeek());
  const [day, setDay] = useState(weekdayIndex(new Date()));
  const [targetOpen, setTargetOpen] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ meal: number; index: number } | null>(null);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChange?.(false), []);

  useEffect(() => {
    setLoading(true);
    setLoadFailed(false);
    supabase
      .from("client_diet_plans")
      .select("*")
      .eq("client_id", client.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // A failed load is not "no plan yet": showing an empty week here
        // would let one Save wipe the client's real plan.
        if (error) {
          setLoadFailed(true);
          setLoading(false);
          return;
        }
        // The client's intake answers fill in anything the trainer hasn't
        // set; once the trainer changes a number and saves, theirs is used.
        const intake = intakeDetails(client);
        const text = (n: number | null | undefined) => (n ? String(n) : "");
        if (data) {
          setWeight(text(data.weight_kg ?? intake.weight_kg));
          setHeight(text(data.height_cm ?? intake.height_cm));
          setAge(text(data.age ?? intake.age));
          setSex(data.sex ?? intake.sex);
          setActivity(Number(data.activity));
          setDirection(data.adjust_kcal > 0 ? "over" : data.adjust_kcal < 0 ? "under" : "same");
          if (data.adjust_kcal) setAdjust(String(Math.abs(data.adjust_kcal)));
          setDays(normaliseWeek(data.days));
        } else {
          setWeight(text(intake.weight_kg));
          setHeight(text(intake.height_cm));
          setAge(text(intake.age));
          setSex(intake.sex);
          if (intake.activity) setActivity(intake.activity);
          setTargetOpen(true);
        }
        setLoading(false);
      });
  }, [client.id, reload]);

  if (loading) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 20 }} />;
  if (loadFailed) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Couldn't load the diet plan</Text>
        <Text style={styles.helper}>Check your signal, then try again.</Text>
        <Pressable style={styles.retry} onPress={() => setReload((r) => r + 1)}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const details = { weight_kg: inRange(weight, "weight"), height_cm: inRange(height, "height"), age: inRange(age, "age"), sex };
  const adjustKcal = direction === "same" ? 0 : (direction === "over" ? 1 : -1) * Math.round(inRange(adjust, "adjust") ?? 0);
  const base = bmr(details);
  const need = dailyNeed({ ...details, activity });
  const target = need == null ? null : need + adjustKcal;
  // Safety (nutrition review, 2026-10-18): a target below the floors needs a
  // dietitian, and some clients need a doctor or dietitian before any deficit.
  const lowWarning = lowTargetWarning(target, base, need, sex);
  const referral = referralReasons(client, details.age);

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };
  const updateDays = (next: DietDay[]) => {
    setDays(next);
    setDirty(true);
  };
  const editMeal = (meal: number, items: DietItem[]) =>
    updateDays(days.map((d, i) => (i !== day ? d : { meals: d.meals.map((m, j) => (j === meal ? { ...m, items } : m)) })));

  const save = async () => {
    const problems = [
      weight.trim() && details.weight_kg == null ? LIMITS.weight.problem : null,
      height.trim() && details.height_cm == null ? LIMITS.height.problem : null,
      age.trim() && details.age == null ? LIMITS.age.problem : null,
      direction !== "same" && inRange(adjust, "adjust") == null ? LIMITS.adjust.problem : null,
    ].filter(Boolean);
    if (problems.length) {
      setTargetOpen(true);
      Alert.alert("Check the calorie target", problems.join("\n\n"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_diet_plans").upsert({
      client_id: client.id,
      weight_kg: details.weight_kg,
      height_cm: details.height_cm,
      age: details.age ? Math.round(details.age) : null,
      sex,
      activity,
      adjust_kcal: adjustKcal,
      days,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save the plan", error.message);
      return;
    }
    setDirty(false);
  };

  const copyToAll = () =>
    Alert.alert(`Copy ${DIET_WEEKDAYS[day]} to every day?`, "Every other day's meals are replaced with this day's.", [
      { text: "Cancel", style: "cancel" },
      { text: "Copy", onPress: () => updateDays(days.map(() => JSON.parse(JSON.stringify(days[day])))) },
    ]);

  const today = days[day];
  const totals = dayTotals(today);
  const status = target != null ? targetStatus(totals.kcal, target) : null;
  const editingItem = editing ? today.meals[editing.meal]?.items[editing.index] ?? null : null;

  return (
    <View>
      <Text style={styles.heading}>🥗 Diet plan for {client.name}</Text>
      {referral.length > 0 && (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>🩺 Refer before a calorie deficit</Text>
          <Text style={styles.warnText}>
            {client.name}'s intake shows {referral.join(" and ")}. Don't set a calorie deficit: ask them to check with their doctor or a
            registered dietitian (adsa.org.za) first, and keep them at what their body uses until then.
          </Text>
        </View>
      )}

      {/* Calorie target, tap to open */}
      <View style={styles.card}>
        <Pressable style={styles.cardHeader} onPress={() => setTargetOpen(!targetOpen)}>
          <Text style={styles.cardTitle}>{target != null ? `${lowWarning ? "⚠️ " : ""}Target: ${target.toLocaleString()} kcal a day` : "Set the calorie target"}</Text>
          <Text style={styles.chevron}>{targetOpen ? "▲" : "▼"}</Text>
        </Pressable>
        {targetOpen && (
          <View style={{ marginTop: 10 }}>
            {intakeDetails(client).height_cm != null && (
              <Text style={[styles.helper, { marginBottom: 8 }]}>
                Filled in from {client.name}'s intake. Change anything here as they progress, then save.
              </Text>
            )}
            <View style={styles.fieldRow}>
              <Field label="Weight (kg)" value={weight} onChange={change(setWeight)} />
              <Field label="Height (cm)" value={height} onChange={change(setHeight)} />
              <Field label="Age" value={age} onChange={change(setAge)} />
            </View>
            <View style={styles.chips}>
              <Chip label="Male" on={sex === "male"} onPress={() => change(setSex)("male")} />
              <Chip label="Female" on={sex === "female"} onPress={() => change(setSex)("female")} />
            </View>
            <Text style={styles.label}>Activity</Text>
            <View style={styles.chips}>
              {ACTIVITY_LEVELS.map((a) => (
                <Chip key={a.factor} label={a.label} on={activity === a.factor} onPress={() => change(setActivity)(a.factor)} />
              ))}
            </View>
            <Text style={styles.helper}>{ACTIVITY_LEVELS.find((a) => a.factor === activity)?.detail}</Text>
            {base != null ? (
              <Text style={styles.numbers}>
                BMR {base.toLocaleString()} kcal{activity !== 1 ? ` · with activity ${need?.toLocaleString()} kcal` : ""}
              </Text>
            ) : (
              <Text style={styles.helper}>
                {(weight.trim() && details.weight_kg == null && LIMITS.weight.problem) ||
                  (height.trim() && details.height_cm == null && LIMITS.height.problem) ||
                  (age.trim() && details.age == null && LIMITS.age.problem) ||
                  "Fill in weight, height, age and male or female to work out the BMR."}
              </Text>
            )}
            <Text style={styles.label}>Target</Text>
            <View style={styles.chips}>
              <Chip label="Same" on={direction === "same"} onPress={() => change(setDirection)("same")} />
              <Chip label="Over" on={direction === "over"} onPress={() => change(setDirection)("over")} />
              <Chip label="Under" on={direction === "under"} onPress={() => change(setDirection)("under")} />
            </View>
            {direction !== "same" && (
              <View style={styles.adjustRow}>
                <Text style={styles.helper}>{direction === "over" ? "Over by" : "Under by"}</Text>
                <TextInput style={styles.smallInput} value={adjust} onChangeText={change(setAdjust)} keyboardType="number-pad" maxLength={4} />
                <Text style={styles.helper}>kcal a day</Text>
              </View>
            )}
            {lowWarning && (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>⚠️ {lowWarning}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Days of the week */}
      <View style={styles.dayTabs}>
        {DIET_WEEKDAYS.map((d, i) => (
          <Pressable key={d} style={[styles.dayTab, i === day && styles.dayTabOn]} onPress={() => setDay(i)}>
            <Text style={[styles.dayTabText, i === day && styles.dayTabTextOn]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      {/* The day's total against the target */}
      <View style={[styles.status, status && status.state !== "on" ? styles.statusRed : styles.statusOk]}>
        <Text style={styles.statusTotal}>
          {totals.kcal.toLocaleString()}
          {target != null ? ` of ${target.toLocaleString()}` : ""} kcal
        </Text>
        {status ? (
          <Text style={[styles.statusText, { color: themeText(status.state === "on" ? "#22C55E" : "#F87171") }]}>
            {status.state === "on" ? "✓ On target" : `⚠ ${status.state === "over" ? "Over" : "Under"} by ${status.by.toLocaleString()} kcal`}
          </Text>
        ) : (
          <Text style={styles.helper}>Set the calorie target to check this day.</Text>
        )}
        <Text style={styles.macroLine}>
          Protein {totals.protein} g · Carbs {totals.carbs} g · Fat {totals.fat} g · Fibre {totals.fibre} g
        </Text>
      </View>

      {today.meals.map((meal, m) => {
        const mealTotal = sumTotals(meal.items);
        return (
          <View key={m} style={styles.meal}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealKcal}>{mealTotal.kcal} kcal</Text>
            </View>
            {meal.items.map((item, i) => {
              const t = sumTotals([item]);
              return (
                <View key={i} style={styles.itemRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => setEditing({ meal: m, index: i })}>
                    <Text style={styles.itemName}>{item.food}</Text>
                    <Text style={styles.helper}>
                      {amountLabel(item)} · {t.kcal} kcal · P {t.protein} · C {t.carbs} · F {t.fat}
                    </Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => editMeal(m, meal.items.filter((_, j) => j !== i))}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
            <Pressable onPress={() => setAdding(m)} hitSlop={6}>
              <Text style={styles.addFood}>＋ Add food</Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable style={styles.copyButton} onPress={copyToAll}>
        <Text style={styles.copyText}>Copy {DIET_WEEKDAYS[day]} to every day</Text>
      </Pressable>
      <Pressable style={[styles.saveButton, !dirty && styles.saved]} onPress={save} disabled={saving || !dirty}>
        {saving ? (
          <ActivityIndicator color={themeText("#0F172A")} />
        ) : (
          <Text style={[styles.saveText, !dirty && { color: themeText("#22C55E") }]}>{dirty ? "Save plan" : "Saved ✓"}</Text>
        )}
      </Pressable>
      <Text style={styles.helper}>{client.name} sees the saved plan under Nutrition.</Text>

      <DietFoodPicker
        mealName={adding != null ? today.meals[adding].name : editing && editingItem ? today.meals[editing.meal].name : null}
        editing={editingItem}
        onSave={(item) => {
          if (adding != null) editMeal(adding, [...today.meals[adding].items, item]);
          else if (editing) editMeal(editing.meal, today.meals[editing.meal].items.map((it, j) => (j === editing.index ? item : it)));
          setAdding(null);
          setEditing(null);
        }}
        onClose={() => {
          setAdding(null);
          setEditing(null);
        }}
      />
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" maxLength={5} />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles({
  warnBox: { backgroundColor: "#0F172A", borderRadius: 10, borderLeftWidth: 3, borderLeftColor: "#F87171", padding: 12, marginTop: 10 },
  warnTitle: { color: "#F87171", fontWeight: "800", marginBottom: 4 },
  warnText: { color: "#E2E8F0", fontSize: 13, lineHeight: 19 },
  heading: { color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 12, marginBottom: 10 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: BRAND_GOLD, fontSize: 15, fontWeight: "800" },
  chevron: { color: BRAND_GOLD, fontSize: 14 },
  fieldRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  fieldLabel: { color: "#94A3B8", fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 10, fontSize: 15 },
  smallInput: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, width: 70 },
  label: { color: "#94A3B8", fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  numbers: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  dayTabs: { flexDirection: "row", gap: 4, marginBottom: 10 },
  dayTab: { flex: 1, backgroundColor: "#1E293B", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  dayTabOn: { backgroundColor: BRAND_GOLD },
  dayTabText: { color: "#CBD5E1", fontWeight: "700", fontSize: 12 },
  dayTabTextOn: { color: "#0F172A" },
  status: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  statusRed: { backgroundColor: "#3B1218", borderColor: "#EF4444" },
  statusOk: { backgroundColor: "#0F2A1C", borderColor: "#22C55E" },
  statusTotal: { color: "#fff", fontSize: 18, fontWeight: "800" },
  statusText: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  macroLine: { color: "#CBD5E1", fontSize: 12, marginTop: 6 },
  meal: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  mealName: { color: "#fff", fontWeight: "800", fontSize: 14 },
  mealKcal: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#0F172A" },
  itemName: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  remove: { color: "#64748B", fontSize: 16, paddingHorizontal: 6 },
  addFood: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginTop: 8 },
  copyButton: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  copyText: { color: BRAND_GOLD, fontWeight: "700" },
  saveButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  saved: { backgroundColor: "#1E293B" },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  retry: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  retryText: { color: "#0F172A", fontWeight: "800" },
});
