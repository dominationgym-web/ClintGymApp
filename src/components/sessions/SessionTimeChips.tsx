import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { BRAND_GOLD } from "@/lib/brand";
import { cleanTime, slotTimes } from "@/lib/liveSessions";
import { themedStyles } from "@/lib/theme";

// Start times staggered by the session length from the trainer's first
// session of the day and from the end of each booked one (GRIZZ, 2026-10-31:
// 40-minute sessions from 05:10 give 05:10, 05:50, 06:30 ...), plus
// "Other time" for anything else.
export default function SessionTimeChips({
  dayStart,
  dayEnd,
  minutes,
  booked = [],
  selected,
  onPick,
}: {
  dayStart: string;
  dayEnd: string;
  minutes: number;
  /** Sessions already on that day: their time and length. */
  booked?: { time: string; minutes: number }[];
  /** Times shown as picked (one, or several for regular times). */
  selected: string[];
  onPick: (time: string) => void;
}) {
  const [other, setOther] = useState("");
  const times = [...new Set([...slotTimes(dayStart, dayEnd, minutes, booked), ...selected])].sort();
  const typed = cleanTime(other);
  return (
    <View>
      <View style={styles.chips}>
        {times.map((t) => {
          const on = selected.includes(t);
          return (
            <Pressable key={t} style={[styles.time, on && styles.on]} onPress={() => onPick(t)}>
              <Text style={[styles.text, on && styles.textOn]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
      {times.length === 0 ? <Text style={styles.meta}>No free {minutes}-minute times left in your day. Type one below.</Text> : null}
      <View style={styles.otherRow}>
        <TextInput
          style={styles.input}
          value={other}
          onChangeText={setOther}
          placeholder="Other time, e.g. 12:15"
          placeholderTextColor="#64748B"
          maxLength={5}
          keyboardType="numbers-and-punctuation"
        />
        <Pressable
          style={[styles.add, !typed && { opacity: 0.4 }]}
          disabled={!typed}
          onPress={() => {
            if (typed) onPick(typed);
            setOther("");
          }}
        >
          <Text style={styles.addText}>Use</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>
        {minutes}-minute sessions from {(cleanTime(dayStart) ?? "05:00")} to {(cleanTime(dayEnd) ?? "20:00")}. Change it under Setup.
      </Text>
    </View>
  );
}

const styles = themedStyles({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  time: { backgroundColor: "#1E293B", borderRadius: 8, width: 64, alignItems: "center", paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  on: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  text: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  textOn: { color: "#0F172A" },
  otherRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  input: { flex: 1, backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 10, fontSize: 15, borderWidth: 1, borderColor: "#334155" },
  add: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  addText: { color: BRAND_GOLD, fontWeight: "700" },
  meta: { color: "#64748B", fontSize: 12, marginTop: 6 },
});
