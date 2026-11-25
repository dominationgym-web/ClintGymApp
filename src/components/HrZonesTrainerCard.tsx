import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import NumberStepper from "@/components/NumberStepper";
import FoldSection from "@/components/FoldSection";
import HrZoneList from "@/components/HrZoneList";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { intakeDetails } from "@/lib/dietPlan";
import { toast } from "@/lib/toast";
import {
  HEART_RATE_ZONES_MESSAGE,
  HR_EXERCISES,
  HR_FITNESS,
  HR_GOALS,
  RESTING_RANGES,
  buildZones,
  zoneForGoal,
  type HrExercise,
  type HrFitness,
  type HrGoal,
  type HrSex,
} from "@/lib/heartRateZones";
import type { Client, ClientHrZones } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// Heart rate zones on the trainer's client page (GRIZZ, 2026-11-25): the
// client's weight, age and sex fill in from their profile, the rest is taps,
// and the app works out the zones with roughly the calories and fat for 30
// minutes in each. The trainer picks the main goal and sends them, and the
// client gets them as "Your heart rate zones, from Coach ..." (0237).

// Three different burns, in plain words (GRIZZ's screenshot, 2026-11-25:
// "teach trainers the difference").
export const THREE_BURNS = [
  {
    title: "1. Maximise fat burning",
    colour: "#22C55E",
    body: "The pace where fat gives the most fuel. Steady and comfortable, they can still talk. Great for beginners and long sessions.",
  },
  {
    title: "2. Maximise calorie burn",
    colour: "#F97316",
    body: "Harder pace, more calories in total, but most of it comes from carbs. Best when time is short.",
  },
  {
    title: "3. After-burn",
    colour: BRAND_GOLD,
    body: "Extra calories the body keeps burning for hours after hard sessions or intervals. Usually 6–15% on top: small each time, adds up over weeks.",
  },
];

export default function HrZonesTrainerCard({ client, trainerId }: { client: Client; trainerId: string | undefined }) {
  const first = client.name.split(" ")[0];
  // The trainer's own training row (0146: id = trainer_id): the same card for themselves.
  const self = client.id === client.trainer_id;
  const who = self ? "you" : first;
  const whose = self ? "your" : `${first}'s`;
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const intake = intakeDetails(client);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<ClientHrZones | null>(null);
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<HrSex | null>(intake.sex);
  const [fitness, setFitness] = useState<HrFitness>("average");
  const [exercise, setExercise] = useState<HrExercise>("walk");
  const [resting, setResting] = useState<number | null>(null);
  const [goal, setGoal] = useState<HrGoal>("fat");
  const [sending, setSending] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  // Back from measuring their resting heart rate: show the new reading.
  const [reload, setReload] = useState(0);
  useEffect(() => navigation.addListener("focus", () => setReload((r) => r + 1)), [navigation]);

  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from("client_hr_zones").select("*").eq("client_id", client.id).maybeSingle(),
      supabase
        .from("client_body_stats")
        .select("weight_kg, measured_on")
        .eq("client_id", client.id)
        .not("weight_kg", "is", null)
        .order("measured_on", { ascending: false })
        .limit(1),
    ]).then(([{ data: row }, { data: stats }]) => {
      if (!live) return;
      const z = (row as ClientHrZones | null) ?? null;
      const latestWeight = stats?.[0]?.weight_kg != null ? Number(stats[0].weight_kg) : null;
      setSaved(z);
      // Newest first: their latest weigh-in, then what was used last time, then the sign-up form.
      const w = latestWeight ?? (z?.weight_kg != null ? Number(z.weight_kg) : null) ?? intake.weight_kg;
      setWeight(w ? String(Math.round(w)) : "");
      const a = z?.age ?? intake.age;
      setAge(a ? String(a) : "");
      setSex(z?.sex ?? intake.sex);
      if (z?.fitness) setFitness(z.fitness);
      if (z?.exercise) setExercise(z.exercise);
      if (z?.goal) setGoal(z.goal);
      // A reading from their own strap beats a guess.
      setResting(z?.measured_resting_hr ?? z?.resting_hr ?? null);
      setLoading(false);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, reload]);

  const weightKg = Number(weight);
  const ageYears = Number(age);
  const ready = weightKg >= 25 && weightKg <= 400 && ageYears >= 12 && ageYears <= 100 && !!sex && resting != null;
  const inputs = ready ? { weightKg, age: ageYears, sex: sex!, fitness, exercise, restingHr: resting! } : null;
  const zones = useMemo(() => (inputs ? buildZones(inputs) : null), [inputs?.weightKg, inputs?.age, inputs?.sex, fitness, exercise, resting]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = zones ? zoneForGoal(zones, goal) : null;
  const measured = saved?.measured_resting_hr ?? null;

  const send = async () => {
    if (!inputs || !trainerId) return;
    setSending(true);
    const row = {
      client_id: client.id,
      trainer_id: trainerId,
      weight_kg: inputs.weightKg,
      age: inputs.age,
      sex: inputs.sex,
      fitness,
      exercise,
      resting_hr: inputs.restingHr,
      goal,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("client_hr_zones").upsert(row);
    if (error) {
      setSending(false);
      return Alert.alert("Couldn't save the zones", error.message);
    }
    // Their own profile gets the sex too, if it was missing.
    if (!client.sex) await supabase.from("clients").update({ sex: inputs.sex }).eq("id", client.id);
    setSaved((s) => ({ ...(s ?? { measured_resting_hr: null, measured_on: null }), ...row }) as ClientHrZones);
    if (self) {
      setSending(false);
      return toast("Saved", "Tap ❤️ HR at the top of My workout to train in your zone.");
    }
    const { error: told } = await supabase.from("coach_messages").insert({ client_id: client.id, trainer_id: trainerId, body: HEART_RATE_ZONES_MESSAGE });
    setSending(false);
    if (told) return Alert.alert(`Saved, but ${first} wasn't told`, told.message);
    toast(`Sent to ${first}`, "They'll find them in ☰ Menu › Heart rate zones.");
  };

  if (loading) return <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 12 }} />;

  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <Pressable key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={styles.helper}>
        Filled in from {whose} profile. Tap anything to change it.
        {saved?.sent_at ? ` Last sent ${new Date(saved.sent_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}.` : ""}
      </Text>

      <Text style={styles.label}>Weight (kg)</Text>
      <NumberStepper value={weight} onChange={setWeight} step={1} min={25} start={70} accessibilityLabel="weight" />
      <Text style={styles.label}>Age</Text>
      <NumberStepper value={age} onChange={setAge} step={1} min={12} start={30} accessibilityLabel="age" />
      <Text style={styles.label}>Sex</Text>
      <View style={styles.chips}>
        {chip(sex === "male", "Male", () => setSex("male"), "m")}
        {chip(sex === "female", "Female", () => setSex("female"), "f")}
      </View>

      <Text style={styles.label}>{self ? "How fit are you?" : `How fit is ${first}?`}</Text>
      <View style={styles.chips}>{HR_FITNESS.map((f) => chip(fitness === f.key, f.label, () => setFitness(f.key), f.key))}</View>

      <Text style={styles.label}>{self ? "What will you do?" : `What will ${first} do?`}</Text>
      <View style={styles.chips}>{HR_EXERCISES.map((e) => chip(exercise === e.key, e.label, () => setExercise(e.key), e.key))}</View>

      <Text style={styles.label}>Resting heart rate</Text>
      {measured != null && (
        <Pressable style={[styles.measured, resting === measured && styles.measuredOn]} onPress={() => setResting(measured)} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.measuredTitle}>Measured by {whose} strap or watch</Text>
            {saved?.measured_on && <Text style={styles.helper}>On {saved.measured_on}</Text>}
          </View>
          <Text style={styles.measuredBpm}>{measured}</Text>
        </Pressable>
      )}
      <Text style={styles.helper}>
        {measured != null ? "Or tap a guess:" : self ? "Measure it with your strap or watch below, or tap a guess:" : `${first} can measure it in the app with a strap or watch (☰ Menu › Heart rate zones). Until then, tap a guess:`}
      </Text>
      <View style={styles.chips}>
        {RESTING_RANGES.map((r) => chip(resting === r.bpm && resting !== measured, r.label, () => setResting(r.bpm), r.label))}
      </View>

      {zones && target ? (
        <>
          <Text style={styles.label}>
            {self ? "Your" : `${first}'s`} zones · {HR_EXERCISES.find((e) => e.key === exercise)?.label.toLowerCase()}
          </Text>
          <Text style={styles.helper}>About 30 minutes in each zone. Good estimates from heart rate, body and fitness; exact numbers need a lab breathing test.</Text>
          <HrZoneList zones={zones} target={target} mode="estimates" />
          <Text style={styles.label}>{self ? "Your main goal" : `${first}'s main goal`}</Text>
          <View style={styles.chips}>{HR_GOALS.map((g) => chip(goal === g.key, g.label, () => setGoal(g.key), g.key))}</View>
          <Pressable style={[styles.send, (sending || !trainerId) && { opacity: 0.6 }]} onPress={send} disabled={sending || !trainerId} accessibilityRole="button">
            <Text style={styles.sendText}>{self ? (sending ? "Saving…" : "Save my zones") : sending ? "Sending…" : saved?.sent_at ? `Send the new zones to ${first}` : `Send to ${first}`}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={[styles.helper, { marginTop: 10 }]}>Fill in the weight, age, sex and resting heart rate above to see the zones.</Text>
      )}

      {/* The same heart rate tools the client has, on the trainer's phone (GRIZZ, 2026-11-25). */}
      <View style={styles.liveRow}>
        <Pressable
          style={styles.live}
          onPress={() => navigation.navigate("HeartRateLive", { clientId: client.id, name: client.name, mode: "session" })}
          accessibilityRole="button"
        >
          <Text style={styles.liveText}>❤️ Speedometer{self ? "" : ` with ${first}`}</Text>
        </Pressable>
        <Pressable
          style={styles.live}
          onPress={() => navigation.navigate("HeartRateLive", { clientId: client.id, name: client.name, mode: "resting" })}
          accessibilityRole="button"
        >
          <Text style={styles.liveText}>Measure {whose} resting heart rate</Text>
        </Pressable>
      </View>
      <Text style={styles.helper}>{self ? "Also in My workout: tap ❤️ HR at the top." : "Also in a live workout: tap ❤️ HR at the top."}</Text>

      <View style={{ marginTop: 12 }}>
        <FoldSection icon="💡" title="Three different burns" hint="Fat burning, calorie burn and after-burn" open={tipOpen} onToggle={() => setTipOpen((o) => !o)}>
          {THREE_BURNS.map((b) => (
            <View key={b.title} style={[styles.burn, { borderLeftColor: b.colour }]}>
              <Text style={[styles.burnTitle, { color: b.colour }]}>{b.title}</Text>
              <Text style={styles.burnBody}>{b.body}</Text>
            </View>
          ))}
          <Text style={styles.burnBody}>For fat loss, food decides most of it. Mix fat-burning sessions with a few harder ones.</Text>
        </FoldSection>
      </View>
    </View>
  );
}

const styles = themedStyles({
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginTop: 2 },
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "800", marginTop: 14, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B" },
  chipOn: { borderColor: BRAND_GOLD, borderWidth: 2, backgroundColor: "#2A2614" },
  chipText: { color: "#F1F5F9", fontWeight: "700", fontSize: 14 },
  chipTextOn: { color: BRAND_GOLD },
  measured: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", marginBottom: 6 },
  measuredOn: { borderColor: "#22C55E", borderWidth: 2 },
  measuredTitle: { color: "#F1F5F9", fontWeight: "800", fontSize: 14 },
  measuredBpm: { color: "#22C55E", fontWeight: "900", fontSize: 26 },
  send: { marginTop: 14, backgroundColor: BRAND_GOLD, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  sendText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  liveRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  live: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  liveText: { color: "#F1F5F9", fontWeight: "700", fontSize: 14, textAlign: "center" },
  burn: { borderLeftWidth: 4, paddingLeft: 10, marginBottom: 10 },
  burnTitle: { fontWeight: "800", fontSize: 15 },
  burnBody: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 2 },
});
