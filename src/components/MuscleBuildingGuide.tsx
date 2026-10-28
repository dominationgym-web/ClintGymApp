import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { bmr, dailyNeed, intakeDetails, INTAKE_ACTIVITY_LEVELS, REFERRAL_NOTE, referralReasons, type DietSex } from "@/lib/dietPlan";
import { goalKcal, macroTargets } from "@/lib/mealPlanMaker";
import {
  BLOCK_WEEK_GUIDE,
  MUSCLE_YEAR_BLOCKS,
  RECOVERY_BASICS,
  muscleLevel,
  proteinPerMeal,
  weeklyGainKg,
  weightCheck,
  type WeightCheck,
} from "@/lib/muscleYear";

// Nutrition > Muscle building: your BMR and macros (GRIZZ, 2026-10-24: "They
// need to est their BMR so we can guide them through their macros"). One
// page at a time: their details, their BMR, their calories and macros, the
// 2-weekly weight check, and the year block by block with recovery. The sums
// are the meal plan maker's, so "Make my meal plan" gives the same numbers.

const PAGES = ["You", "BMR", "Macros", "Check", "Your year"] as const;

type Details = { height: string; weight: string; age: string; sex: DietSex | null; activity: string };

const num = (text: string) => Number(text.replace(",", "."));

export default function MuscleBuildingGuide({ onMakeMealPlan }: { onMakeMealPlan?: () => void }) {
  const { client, refreshProfile } = useAuth();
  const [page, setPage] = useState(0);
  const [details, setDetails] = useState<Details>({ height: "", weight: "", age: "", sex: null, activity: "" });
  const [weighIns, setWeighIns] = useState<{ measured_on: string; weight_kg: number | null }[] | null>(null);
  const [openBlock, setOpenBlock] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;
    const intake = intakeDetails(client);
    setDetails({
      height: intake.height_cm ? String(intake.height_cm) : "",
      weight: intake.weight_kg ? String(intake.weight_kg) : "",
      age: intake.age ? String(intake.age) : "",
      sex: intake.sex,
      activity: INTAKE_ACTIVITY_LEVELS.find((a) => a.factor === intake.activity)?.label ?? "",
    });
    supabase
      .from("client_body_stats")
      .select("measured_on, weight_kg")
      .eq("client_id", client.id)
      .not("weight_kg", "is", null)
      .order("measured_on", { ascending: false })
      .limit(60)
      .then(({ data }) => setWeighIns((data ?? []).map((w) => ({ measured_on: w.measured_on, weight_kg: w.weight_kg == null ? null : Number(w.weight_kg) }))));
  }, [client?.id]);

  if (!client) return null;

  const factor = INTAKE_ACTIVITY_LEVELS.find((a) => a.label === details.activity)?.factor ?? null;
  const body = { height_cm: num(details.height), weight_kg: num(details.weight), age: num(details.age), sex: details.sex, activity: factor ?? 1 };
  const detailsOk =
    body.height_cm >= 100 && body.height_cm <= 250 && body.weight_kg >= 25 && body.weight_kg <= 400 && body.age >= 12 && body.age <= 100 && !!body.sex && !!factor;
  const base = detailsOk ? bmr(body) : null;
  const need = detailsOk ? dailyNeed(body) : null;
  // Diabetes, kidney disease, pregnancy, an eating disorder or under 18: no
  // surplus until a doctor or dietitian says so (the meal plan maker's rule).
  const referral = referralReasons(client, detailsOk ? body.age : null);
  const kcal = need ? (referral.length ? need : goalKcal(need, "gain", null)) : null;
  const macros = kcal ? macroTargets(kcal, body.weight_kg, referral.length ? "maintain" : "gain", body.height_cm) : null;
  const level = muscleLevel(client.training_level);
  const gain = detailsOk ? weeklyGainKg(body.weight_kg, level) : null;
  const check: WeightCheck | null = weighIns ? weightCheck(weighIns, level) : null;

  // Their details go on their profile too, for the meal plan maker and their coach's diet planner.
  const saveDetails = async () => {
    const fail = (title: string, message: string) => {
      Alert.alert(title, message);
      return false;
    };
    if (!(body.height_cm >= 100 && body.height_cm <= 250)) return fail("Your height", "Type your height in centimetres, for example 178.");
    if (!(body.weight_kg >= 25 && body.weight_kg <= 400)) return fail("Your weight", "Type your weight in kilograms, for example 75.");
    if (!(body.age >= 12 && body.age <= 100)) return fail("Your age", "Type your age in years, for example 28.");
    if (!body.sex) return fail("Male or female?", "Tap the one that fits you. It changes your BMR.");
    if (!factor) return fail("How active are you?", "Tap the option that fits you best.");
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({
        ...(client.sex ? {} : { sex: body.sex }),
        intake_responses: {
          ...(client.intake_responses ?? {}),
          height_cm: String(body.height_cm),
          weight_kg: String(body.weight_kg),
          age: String(body.age),
          activity_level: details.activity,
        },
      })
      .eq("id", client.id);
    setSaving(false);
    if (error) return fail("Couldn't save your details", error.message);
    refreshProfile();
    return true;
  };

  const next = async () => {
    if (page === 0 && !(await saveDetails())) return;
    setPage(Math.min(PAGES.length - 1, page + 1));
  };

  const chip = (on: boolean, label: string, onPress: () => void) => (
    <Pressable key={label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  const big = (value: string, label: string) => (
    <View style={styles.bigBox}>
      <Text style={styles.bigValue}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );

  const name = PAGES[page];
  return (
    <View style={styles.card}>
      <View style={styles.tabs}>
        {PAGES.map((p, i) => (
          <Pressable key={p} onPress={() => (i === 0 || i >= 3 || detailsOk ? setPage(i) : null)} hitSlop={4} style={[styles.tab, i === page && styles.tabOn]}>
            <Text style={[styles.tabText, i === page && styles.tabTextOn]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      {name === "You" && (
        <View>
          <Text style={styles.text}>
            To build muscle you need to eat a little more than your body uses. First we work out your BMR: what your body burns
            at rest. Check your details:
          </Text>
          <View style={styles.detailRow}>
            {([["height", "Height (cm)", "178"], ["weight", "Weight (kg)", "75"], ["age", "Age", "28"]] as const).map(([key, label, hint]) => (
              <View key={key} style={styles.detailBox}>
                <Text style={styles.detailLabel}>{label}</Text>
                <TextInput
                  style={styles.detailInput}
                  value={details[key]}
                  onChangeText={(v) => setDetails({ ...details, [key]: v })}
                  placeholder={hint}
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </View>
            ))}
          </View>
          {!client.sex && (
            <View style={styles.chips}>
              {chip(details.sex === "female", "Female", () => setDetails({ ...details, sex: "female" }))}
              {chip(details.sex === "male", "Male", () => setDetails({ ...details, sex: "male" }))}
            </View>
          )}
          <Text style={styles.label}>How active are you?</Text>
          <View style={styles.chips}>
            {INTAKE_ACTIVITY_LEVELS.map((a) => chip(details.activity === a.label, a.label, () => setDetails({ ...details, activity: a.label })))}
          </View>
          <Text style={styles.note}>
            {details.activity
              ? INTAKE_ACTIVITY_LEVELS.find((a) => a.label === details.activity)?.detail
              : "Training 3 days a week is Light, 4-5 days is Active. A physical job makes it Very active."}
          </Text>
        </View>
      )}

      {name === "BMR" && base && need && (
        <View>
          {big(`${base.toLocaleString()} kcal`, "Your BMR: what your body burns in a day at complete rest")}
          {big(`${need.toLocaleString()} kcal`, `What you burn in a day with your activity (${details.activity}): eat this and your weight stays the same`)}
          <Text style={styles.text}>
            Your BMR keeps your heart, brain and organs going. Your daily burn adds your training, walking and work on top. To
            build muscle you eat a little more than your daily burn, so your body has what it needs to grow.
          </Text>
        </View>
      )}

      {name === "Macros" && kcal && macros && (
        <View>
          {referral.length ? (
            <View style={[styles.box, { borderLeftColor: "#F87171" }]}>
              <Text style={[styles.boxTitle, { color: "#F87171" }]}>🩺 Check with a doctor or dietitian first</Text>
              <Text style={styles.boxText}>
                Because of {referral.join(" and ")}, {REFERRAL_NOTE.charAt(0).toLowerCase() + REFERRAL_NOTE.slice(1)} Until then these are
                your numbers to stay the same.
              </Text>
            </View>
          ) : null}
          {big(`${kcal.toLocaleString()} kcal a day`, referral.length ? "What your body uses" : `Your daily burn + ${kcal - (need ?? kcal)} kcal to build muscle`)}
          <View style={styles.macroRow}>
            {[
              ["Protein", macros.protein],
              ["Carbs", macros.carbs],
              ["Fat", macros.fat],
            ].map(([label, g]) => (
              <View key={label} style={styles.macroBox}>
                <Text style={styles.macroValue}>{g} g</Text>
                <Text style={styles.macroLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.text}>
            • Protein builds the muscle: about {proteinPerMeal(macros.protein, 4)} g in each of 4 meals (chicken, beef, fish, eggs, maas,
            Greek yoghurt, beans).{"\n"}• Carbs fuel your training: put most of them in the meals before and after you train (rice,
            potatoes, sweet potato, pap, bread, fruit).{"\n"}• Fat keeps your hormones healthy (avocado, nuts, olive oil, eggs).
            {"\n"}• Fibre 25-35 g a day from veg, fruit and beans, and about {(Math.round(body.weight_kg * 0.035 * 10) / 10).toFixed(1)} litres of water,
            more on training days.
          </Text>
          {onMakeMealPlan ? (
            <Pressable style={[styles.button, styles.primary]} onPress={onMakeMealPlan}>
              <Text style={styles.primaryText}>🤖 Make my meal plan from these</Text>
            </Pressable>
          ) : null}
          {onMakeMealPlan ? <Text style={styles.note}>Pick "Build muscle" as your goal: it uses these same numbers.</Text> : null}
        </View>
      )}

      {name === "Check" && (
        <View>
          {gain ? big(`+${gain.low.toFixed(2)} to ${gain.high.toFixed(2)} kg`, "A week: the right speed to gain mostly muscle") : null}
          <Text style={styles.text}>
            Weigh in every 2 weeks, first thing in the morning after the toilet. Faster than this is mostly fat; slower means
            you need a bit more food. Your weight goes up and down a little from day to day, so look at the trend.
          </Text>
          {!check ? (
            <ActivityIndicator color={BRAND_GOLD} />
          ) : (
            <View
              style={[
                styles.box,
                { borderLeftColor: check.kind === "onTrack" ? "#4ADE80" : check.kind === "slow" || check.kind === "fast" ? "#FBBF24" : BRAND_GOLD },
              ]}
            >
              <Text style={styles.boxTitle}>
                {check.kind === "onTrack" ? "✅ On track" : check.kind === "slow" ? "⬆️ Eat a bit more" : check.kind === "fast" ? "⬇️ Eat a bit less" : "⚖️ Your weigh-ins"}
              </Text>
              <Text style={styles.boxText}>{check.message}</Text>
            </View>
          )}
        </View>
      )}

      {name === "Your year" && (
        <View>
          <Text style={styles.text}>The Muscle Year programs run in four 3-month blocks. Tap a block to see what to focus on.</Text>
          {MUSCLE_YEAR_BLOCKS.map((b) => {
            const open = openBlock === b.number;
            return (
              <View key={b.number} style={styles.block}>
                <Pressable onPress={() => setOpenBlock(open ? null : b.number)} style={styles.blockHeader} accessibilityRole="button">
                  <Text style={styles.blockTitle}>
                    Block {b.number}: {b.title}
                  </Text>
                  <Text style={styles.blockWeeks}>
                    {b.weeks} {open ? "▲" : "▼"}
                  </Text>
                </Pressable>
                {open ? (
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.blockLine}>🏋️ {b.training}</Text>
                    <Text style={styles.blockLine}>😴 {b.recovery}</Text>
                    <Text style={styles.blockLine}>🍽 {b.food}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
          <Text style={styles.label}>Inside every block</Text>
          {BLOCK_WEEK_GUIDE.map((l) => (
            <Text key={l} style={styles.bullet}>• {l}</Text>
          ))}
          <Text style={styles.label}>Recovery, all year</Text>
          {RECOVERY_BASICS.map((l) => (
            <Text key={l} style={styles.bullet}>• {l}</Text>
          ))}
        </View>
      )}

      <View style={styles.buttons}>
        {page > 0 && (
          <Pressable style={[styles.button, styles.secondary]} onPress={() => setPage(page - 1)}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        )}
        {page < PAGES.length - 1 && (
          <Pressable style={[styles.button, styles.primary]} onPress={next} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? "Saving..." : page === 0 ? "Work out my BMR" : "Next"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tab: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: "#0F172A" },
  tabOn: { backgroundColor: BRAND_GOLD },
  tabText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  tabTextOn: { color: "#0F172A" },
  text: { color: "#CBD5E1", fontSize: 14, lineHeight: 21, marginBottom: 8 },
  note: { color: "#94A3B8", fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { color: "#fff", fontWeight: "700", marginTop: 12, marginBottom: 6 },
  detailRow: { flexDirection: "row", gap: 8 },
  detailBox: { flex: 1 },
  detailLabel: { color: "#CBD5E1", fontSize: 12, fontWeight: "600", marginBottom: 4 },
  detailInput: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 10, fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700" },
  chipTextOn: { color: "#0F172A" },
  bigBox: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 8 },
  bigValue: { color: BRAND_GOLD, fontSize: 22, fontWeight: "900" },
  bigLabel: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  macroRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  macroBox: { flex: 1, backgroundColor: "#0F172A", borderRadius: 10, padding: 10, alignItems: "center" },
  macroValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  macroLabel: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  box: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, borderLeftWidth: 4, marginBottom: 8 },
  boxTitle: { color: "#fff", fontWeight: "800", marginBottom: 4 },
  boxText: { color: "#CBD5E1", fontSize: 14, lineHeight: 20 },
  block: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginBottom: 6 },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  blockTitle: { color: "#fff", fontWeight: "800", flex: 1 },
  blockWeeks: { color: BRAND_GOLD, fontWeight: "700", fontSize: 12 },
  blockLine: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 4 },
  bullet: { color: "#CBD5E1", fontSize: 13, lineHeight: 19, marginBottom: 3 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 14 },
  button: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  primary: { backgroundColor: BRAND_GOLD },
  primaryText: { color: "#0F172A", fontWeight: "800" },
  secondary: { backgroundColor: "#334155" },
  secondaryText: { color: "#fff", fontWeight: "700" },
});
