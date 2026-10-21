import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { CARDIO_ALL, CARDIO_OPTIONS, cardioDuration, cardioLabel } from "@/lib/programs";
import CardioDurationPicker from "@/components/CardioDurationPicker";
import type { Client, ExtraCardio } from "@/types/database";

// Abs and cardio for every workout a client does (0136, GRIZZ, 2026-10-21).
// Which workouts take them is in src/lib/clientExtras.ts: never Longevity,
// mobility or flexibility; bodybuilding gets abs and cardio at the end only.
const ABS_CHOICES = [
  { key: "off", label: "Off" },
  { key: "program", label: "Where built in" },
  { key: "all", label: "Every workout" },
] as const;
type AbsChoice = (typeof ABS_CHOICES)[number]["key"];

// Between exercises 1 to 7 covers every built-in workout; a later spot comes out at the end.
const POSITIONS: (number | null)[] = [1, 2, 3, 4, 5, 6, 7, null];

export default function ClientExtrasCard({ client, onChanged }: { client: Client; onChanged: (change: Partial<Client>) => void }) {
  const first = client.name.split(" ")[0];
  const abs: AbsChoice = client.abs_between_sets === false ? "off" : client.abs_all ? "all" : "program";
  const extras = client.extra_cardio ?? [];
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [after, setAfter] = useState<number | null>(null);
  const [name, setName] = useState(CARDIO_OPTIONS[0]);
  const [reps, setReps] = useState(cardioDuration(30));

  const save = async (change: Partial<Client>) => {
    setBusy(true);
    const { error } = await supabase.from("clients").update(change).eq("id", client.id);
    setBusy(false);
    if (error) return Alert.alert("Couldn't save", error.message);
    onChanged(change);
  };

  const pickAbs = (key: AbsChoice) => save({ abs_between_sets: key !== "off", abs_all: key === "all" });
  const saveCardio = (next: ExtraCardio[]) => save({ extra_cardio: next });
  const where = (a: number | null) => (a == null ? "At the end" : `After exercise ${a}`);

  return (
    <View>
      <Text style={styles.label}>Abs between sets</Text>
      <View style={styles.chips}>
        {ABS_CHOICES.map((c) => (
          <Pressable key={c.key} style={[styles.chip, abs === c.key && styles.chipOn]} onPress={() => pickAbs(c.key)} disabled={busy}>
            <Text style={[styles.chipText, abs === c.key && styles.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.helper}>
        Ab reps after each set; the rest timer starts when {first} taps Complete. Never on Longevity, mobility or flexibility, or after heavy squats,
        deadlifts and rows.
      </Text>

      <Text style={styles.label}>🚴 Cardio</Text>
      <Text style={styles.helper}>
        Added to every workout on {first}'s calendar. Bodybuilding only takes cardio at the end. Never on Longevity, mobility or flexibility.
      </Text>
      {extras.map((extra, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.rowText}>
            {where(extra.after)}: {cardioLabel({ exercise_name: extra.name, reps: extra.reps })}
          </Text>
          <Pressable onPress={() => saveCardio(extras.filter((_, j) => j !== i))} disabled={busy} hitSlop={8}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {adding ? (
        <View>
          <Text style={styles.label}>Where</Text>
          <View style={styles.chips}>
            {POSITIONS.map((a) => (
              <Pressable
                key={String(a)}
                style={[styles.chip, after === a && styles.chipOn]}
                onPress={() => {
                  setAfter(a);
                  if (a != null && name === CARDIO_ALL) setName(CARDIO_OPTIONS[0]);
                }}
              >
                <Text style={[styles.chipText, after === a && styles.chipTextOn]}>{where(a)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Machine</Text>
          <View style={styles.chips}>
            {[...CARDIO_OPTIONS, ...(after == null ? [CARDIO_ALL] : [])].map((n) => (
              <Pressable key={n} style={[styles.chip, name === n && styles.chipOn]} onPress={() => setName(n)}>
                <Text style={[styles.chipText, name === n && styles.chipTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>How long</Text>
          <CardioDurationPicker value={reps} onChange={setReps} />
          <View style={styles.buttons}>
            <Pressable
              style={styles.button}
              disabled={busy || extras.length >= 10}
              onPress={async () => {
                await saveCardio([...extras, { after, name, reps }]);
                setAdding(false);
              }}
            >
              <Text style={styles.buttonText}>Add</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setAdding(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        extras.length < 10 && (
          <Pressable style={styles.add} onPress={() => setAdding(true)} disabled={busy}>
            <Text style={styles.addText}>+ Add cardio</Text>
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: "#E2E8F0", fontWeight: "700", marginTop: 12, marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#0F172A" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontSize: 13 },
  chipTextOn: { color: "#0F172A", fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#0F172A", borderRadius: 8, padding: 8, marginTop: 6 },
  rowText: { color: "#fff", flex: 1 },
  remove: { color: "#F87171", fontWeight: "600" },
  add: { marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: BRAND_GOLD, alignItems: "center" },
  addText: { color: BRAND_GOLD, fontWeight: "700" },
  buttons: { flexDirection: "row", gap: 8, marginTop: 12 },
  button: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "800" },
  cancel: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: "#334155" },
  cancelText: { color: "#E2E8F0", fontWeight: "700" },
});
