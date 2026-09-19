import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { HighGiTiming } from "@/types/database";

const todayIso = () => new Date().toISOString().slice(0, 10);

const HIGH_GI_OPTIONS: { key: HighGiTiming; label: string }[] = [
  { key: "before_training", label: "Before training" },
  { key: "before_bed", label: "Before bed" },
  { key: "other", label: "Other" },
];

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onToggle}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export default function CheckInScreen() {
  const { client } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [alcoholUnits, setAlcoholUnits] = useState("0");
  const [bedTime, setBedTime] = useState("");
  const [asleepTime, setAsleepTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [waterLitres, setWaterLitres] = useState("0");
  const [electrolytes, setElectrolytes] = useState(false);
  const [mealsTotal, setMealsTotal] = useState("0");
  const [highGiCount, setHighGiCount] = useState("0");
  const [highGiTiming, setHighGiTiming] = useState<HighGiTiming[]>([]);
  const [screenTimeMinutes, setScreenTimeMinutes] = useState("0");
  const [readNonBacklit, setReadNonBacklit] = useState(false);
  const [breathingOrStretching, setBreathingOrStretching] = useState(false);
  const [distressFlag, setDistressFlag] = useState(false);
  const [distressNotes, setDistressNotes] = useState("");

  useEffect(() => {
    const loadExisting = async () => {
      if (!client) return;
      const { data } = await supabase
        .from("checkins")
        .select("*")
        .eq("client_id", client.id)
        .eq("checkin_date", todayIso())
        .maybeSingle();
      if (data) setAlreadySubmitted(true);
      setLoading(false);
    };
    loadExisting();
  }, [client]);

  const toggleHighGiTiming = (key: HighGiTiming) => {
    setHighGiTiming((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    if (!client) return;
    if (distressFlag && !distressNotes.trim()) {
      Alert.alert("Add a note", "Since you've flagged distress or pain, add a quick note so your trainer has context.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("checkins").insert({
      client_id: client.id,
      checkin_date: todayIso(),
      alcohol_units: Number(alcoholUnits) || 0,
      sleep_bed_time: bedTime || null,
      sleep_asleep_time: asleepTime || null,
      sleep_wake_time: wakeTime || null,
      sleep_quality: sleepQuality,
      water_litres: Number(waterLitres) || 0,
      electrolytes,
      meals_total: Number(mealsTotal) || 0,
      high_gi_count: Number(highGiCount) || 0,
      high_gi_timing: highGiTiming,
      screen_time_before_bed_minutes: Number(screenTimeMinutes) || 0,
      read_non_backlit_device: readNonBacklit,
      breathing_or_stretching_done: breathingOrStretching,
      distress_flag: distressFlag,
      distress_notes: distressFlag ? distressNotes.trim() : null,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't submit check-in", error.message);
      return;
    }
    setAlreadySubmitted(true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (alreadySubmitted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>You're checked in for today ✅</Text>
        <Text style={styles.label}>Come back tomorrow morning for your next check-in.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Morning check-in</Text>

      <Text style={styles.sectionHeading}>Alcohol (units last night)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={alcoholUnits} onChangeText={setAlcoholUnits} />

      <Text style={styles.sectionHeading}>Sleep times (HH:MM, 24h)</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex1]} placeholder="Bed" value={bedTime} onChangeText={setBedTime} />
        <TextInput
          style={[styles.input, styles.flex1]}
          placeholder="Asleep"
          value={asleepTime}
          onChangeText={setAsleepTime}
        />
        <TextInput style={[styles.input, styles.flex1]} placeholder="Wake" value={wakeTime} onChangeText={setWakeTime} />
      </View>

      <Text style={styles.sectionHeading}>Sleep quality (1-5)</Text>
      <View style={styles.row}>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <Pressable
            key={n}
            style={[styles.scoreBubble, sleepQuality === n && styles.scoreBubbleSelected]}
            onPress={() => setSleepQuality(n)}
          >
            <Text style={styles.scoreText}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Water (litres)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={waterLitres} onChangeText={setWaterLitres} />
      <Toggle label="Took electrolytes" value={electrolytes} onToggle={() => setElectrolytes((v) => !v)} />

      <Text style={styles.sectionHeading}>Meals yesterday (total)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={mealsTotal} onChangeText={setMealsTotal} />

      <Text style={styles.sectionHeading}>High-GI meals (count)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={highGiCount} onChangeText={setHighGiCount} />
      {HIGH_GI_OPTIONS.map((opt) => (
        <Toggle
          key={opt.key}
          label={opt.label}
          value={highGiTiming.includes(opt.key)}
          onToggle={() => toggleHighGiTiming(opt.key)}
        />
      ))}

      <Text style={styles.sectionHeading}>Screen time before bed (minutes)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={screenTimeMinutes}
        onChangeText={setScreenTimeMinutes}
      />
      <Toggle
        label="Read before bed on a non-backlit device (e.g. Kindle - not phone, tablet, or laptop)"
        value={readNonBacklit}
        onToggle={() => setReadNonBacklit((v) => !v)}
      />
      <Toggle
        label="Did breathing/stretching"
        value={breathingOrStretching}
        onToggle={() => setBreathingOrStretching((v) => !v)}
      />

      <Text style={styles.sectionHeading}>Anything wrong?</Text>
      <Toggle
        label="Flag real distress or pain (not just a rough day)"
        value={distressFlag}
        onToggle={() => setDistressFlag((v) => !v)}
      />
      {distressFlag && (
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          placeholder="Briefly describe what's going on - your trainer will follow up outside the app."
          value={distressNotes}
          onChangeText={setDistressNotes}
        />
      )}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Submit check-in</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A", padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16, textAlign: "center" },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 18, marginBottom: 8 },
  label: { color: "#E2E8F0", fontSize: 14 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12 },
  multiline: { minHeight: 80, textAlignVertical: "top", marginTop: 8 },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  scoreBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBubbleSelected: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  scoreText: { color: "#fff", fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#64748B" },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  button: {
    backgroundColor: "#22C55E",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 40,
  },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
});
