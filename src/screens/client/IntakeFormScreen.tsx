import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={[styles.pill, value === true && styles.pillSelected]} onPress={() => onChange(true)}>
          <Text style={[styles.pillText, value === true && styles.pillTextSelected]}>Yes</Text>
        </Pressable>
        <Pressable style={[styles.pill, value === false && styles.pillSelected]} onPress={() => onChange(false)}>
          <Text style={[styles.pillText, value === false && styles.pillTextSelected]}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TimeField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.timeInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="HH:MM"
        placeholderTextColor="#64748B"
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}

function ChoiceField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.pill, value === opt && styles.pillSelected]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.pillText, value === opt && styles.pillTextSelected]}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const OCCUPATION_TYPES = ["Desk / office", "Physical / labour", "Healthcare", "Education", "Self-employed", "Other"];
const TRAINING_DURATIONS = ["Under 30 min", "30-45 min", "45-60 min", "Over 60 min"];
const CAFFEINE_AMOUNTS = ["None", "1 cup", "2-3 cups", "4+ cups"];

export default function IntakeFormScreen() {
  const { client, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const [age, setAge] = useState("");

  const [occupationType, setOccupationType] = useState("");
  const [occupationOther, setOccupationOther] = useState("");
  const [jobStress, setJobStress] = useState("");
  const [workSetting, setWorkSetting] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [workFinish, setWorkFinish] = useState("");
  const [homeArrival, setHomeArrival] = useState("");

  const [eatsBreakfast, setEatsBreakfast] = useState<boolean | null>(null);
  const [firstMealTime, setFirstMealTime] = useState("");
  const [dinnerTime, setDinnerTime] = useState("");
  const [properLunchBreak, setProperLunchBreak] = useState<boolean | null>(null);
  const [eatsDuringLunch, setEatsDuringLunch] = useState<boolean | null>(null);

  const [wakeTime, setWakeTime] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [bedtimeConsistent, setBedtimeConsistent] = useState<boolean | null>(null);
  const [hasCaregiving, setHasCaregiving] = useState<boolean | null>(null);

  const [currentlyTraining, setCurrentlyTraining] = useState<boolean | null>(null);
  const [trainingTime, setTrainingTime] = useState("");
  const [trainingDuration, setTrainingDuration] = useState("");
  const [trainsAfterWork, setTrainsAfterWork] = useState<boolean | null>(null);

  const [hasHealthCondition, setHasHealthCondition] = useState<boolean | null>(null);
  const [healthDetail, setHealthDetail] = useState("");
  const [smoker, setSmoker] = useState<boolean | null>(null);
  const [caffeineAmount, setCaffeineAmount] = useState("");
  const [lastCaffeineTime, setLastCaffeineTime] = useState("");

  if (!client) return null;

  const yn = (v: boolean | null) => (v === null ? "Not answered" : v ? "Yes" : "No");

  const handleSubmit = async () => {
    if (!age.trim() || !occupationType || eatsBreakfast === null || currentlyTraining === null) {
      Alert.alert("Almost done", "Fill in at least your age, occupation, breakfast, and training habits.");
      return;
    }

    const responses: Record<string, string> = {
      age: age.trim(),
      occupation_type: occupationType === "Other" ? occupationOther.trim() || "Other" : occupationType,
      job_stress_level: jobStress || "Not answered",
      work_setting: workSetting || "Not answered",
      work_start_time: workStart.trim() || "Not answered",
      work_finish_time: workFinish.trim() || "Not answered",
      home_arrival_time: homeArrival.trim() || "Not answered",
      eats_breakfast: yn(eatsBreakfast),
      dinner_time: dinnerTime.trim() || "Not answered",
      proper_lunch_break: yn(properLunchBreak),
      eats_during_lunch: yn(eatsDuringLunch),
      wake_time: wakeTime.trim() || "Not answered",
      bedtime: bedtime.trim() || "Not answered",
      bedtime_consistent: yn(bedtimeConsistent),
      has_caregiving_responsibilities: yn(hasCaregiving),
      currently_training: yn(currentlyTraining),
      smoker_or_vaper: yn(smoker),
      caffeine_amount: caffeineAmount || "Not answered",
      last_caffeine_time: lastCaffeineTime.trim() || "Not answered",
      has_health_condition_or_medication: yn(hasHealthCondition),
    };

    if (!eatsBreakfast) {
      responses.first_meal_time = firstMealTime.trim() || "Not answered";
    }
    if (currentlyTraining) {
      responses.training_time_of_day = trainingTime.trim() || "Not answered";
      responses.training_duration = trainingDuration || "Not answered";
      responses.trains_after_work = yn(trainsAfterWork);
    }
    if (hasHealthCondition) {
      responses.health_condition_detail = healthDetail.trim() || "Not specified";
    }

    setSaving(true);
    const { error } = await supabase.from("clients").update({ intake_responses: responses }).eq("id", client.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    await refreshProfile();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Before we get started</Text>
      <Text style={styles.intro}>Quick taps, no essays. Two minutes and your trainer knows your routine.</Text>

      <Text style={styles.sectionHeading}>About you</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.timeInput}
          value={age}
          onChangeText={setAge}
          placeholder="e.g. 34"
          placeholderTextColor="#64748B"
          keyboardType="number-pad"
        />
      </View>

      <Text style={styles.sectionHeading}>Work</Text>
      <ChoiceField label="What kind of work do you do?" options={OCCUPATION_TYPES} value={occupationType} onChange={setOccupationType} />
      {occupationType === "Other" && (
        <View style={styles.field}>
          <TextInput
            style={styles.timeInput}
            value={occupationOther}
            onChangeText={setOccupationOther}
            placeholder="What do you do?"
            placeholderTextColor="#64748B"
          />
        </View>
      )}
      <ChoiceField label="How stressful is it?" options={["Low", "Moderate", "High"]} value={jobStress} onChange={setJobStress} />
      <ChoiceField label="Where do you mostly work?" options={["Office", "Home", "Shift work", "Other"]} value={workSetting} onChange={setWorkSetting} />
      <TimeField label="Start time" value={workStart} onChangeText={setWorkStart} />
      <TimeField label="Finish time" value={workFinish} onChangeText={setWorkFinish} />
      <TimeField label="Time you usually get home" value={homeArrival} onChangeText={setHomeArrival} />

      <Text style={styles.sectionHeading}>Meals</Text>
      <YesNo label="Do you eat breakfast?" value={eatsBreakfast} onChange={setEatsBreakfast} />
      {eatsBreakfast === false && <TimeField label="Time of your first meal" value={firstMealTime} onChangeText={setFirstMealTime} />}
      <TimeField label="Usual dinner time" value={dinnerTime} onChangeText={setDinnerTime} />
      <YesNo label="Do you get a proper lunch break?" value={properLunchBreak} onChange={setProperLunchBreak} />
      <YesNo label="Do you actually eat during it?" value={eatsDuringLunch} onChange={setEatsDuringLunch} />

      <Text style={styles.sectionHeading}>Daily structure</Text>
      <TimeField label="Wake time" value={wakeTime} onChangeText={setWakeTime} />
      <TimeField label="Bedtime" value={bedtime} onChangeText={setBedtime} />
      <YesNo label="Same bedtime most nights?" value={bedtimeConsistent} onChange={setBedtimeConsistent} />
      <YesNo label="Kids or caregiving that shapes your day?" value={hasCaregiving} onChange={setHasCaregiving} />

      <Text style={styles.sectionHeading}>Training habits</Text>
      <YesNo label="Do you currently train elsewhere or on your own?" value={currentlyTraining} onChange={setCurrentlyTraining} />
      {currentlyTraining && (
        <>
          <TimeField label="What time of day?" value={trainingTime} onChangeText={setTrainingTime} />
          <ChoiceField label="Session length" options={TRAINING_DURATIONS} value={trainingDuration} onChange={setTrainingDuration} />
          <YesNo label="Is that after work?" value={trainsAfterWork} onChange={setTrainsAfterWork} />
        </>
      )}

      <Text style={styles.sectionHeading}>Health &amp; lifestyle</Text>
      <YesNo label="Any health conditions or medication we should know about?" value={hasHealthCondition} onChange={setHasHealthCondition} />
      {hasHealthCondition && (
        <View style={styles.field}>
          <TextInput
            style={[styles.timeInput, styles.multiline]}
            value={healthDetail}
            onChangeText={setHealthDetail}
            placeholder="Briefly, what should we know?"
            placeholderTextColor="#64748B"
            multiline
          />
        </View>
      )}
      <YesNo label="Do you smoke or vape?" value={smoker} onChange={setSmoker} />
      <ChoiceField label="Caffeine per day" options={CAFFEINE_AMOUNTS} value={caffeineAmount} onChange={setCaffeineAmount} />
      {caffeineAmount && caffeineAmount !== "None" && (
        <TimeField label="Time of your last one" value={lastCaffeineTime} onChangeText={setLastCaffeineTime} />
      )}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Submit</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 8 },
  intro: { color: "#94A3B8", fontSize: 13, lineHeight: 19, marginBottom: 8 },
  sectionHeading: { color: "#22C55E", fontWeight: "700", fontSize: 15, marginTop: 22, marginBottom: 10 },
  field: { marginBottom: 16 },
  label: { color: "#E2E8F0", fontSize: 14, marginBottom: 8, lineHeight: 19 },
  timeInput: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, maxWidth: 160 },
  multiline: { minHeight: 70, textAlignVertical: "top", maxWidth: "100%" },
  row: { flexDirection: "row", gap: 10 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  pillSelected: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  pillText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  pillTextSelected: { color: "#0F172A" },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 24, marginBottom: 40 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
});
