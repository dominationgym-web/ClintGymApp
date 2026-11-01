import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { DELOAD_BLUE, deloadStartChoices } from "@/lib/deload";
import type { DeloadCheck } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// Deload weeks (0115, GRIZZ, 2026-10-18), above the client's calendar. When
// deload_check() says one is due (weeks of training in a row, or signs of
// fatigue), the trainer sees why and adds a deload week from a Monday with
// one tap: the calendar from that day moves back a week and the week that
// was there goes in lighter (half the sets, about 70% weight). Otherwise a
// small line says how many weeks they've trained and offers one anyway.
// Programs with their own easy weeks count those as deloads (0121).
export default function DeloadCard({
  clientId,
  clientName,
  refreshKey,
  onAdded,
}: {
  clientId: string;
  clientName: string;
  refreshKey?: number;
  onAdded: () => void;
}) {
  const today = todayIso();
  const [check, setCheck] = useState<DeloadCheck | null>(null);
  const [open, setOpen] = useState(false);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open, () => setOpen(false));
  const [adding, setAdding] = useState(false);
  const firstName = clientName.trim().split(/\s+/)[0] || "Your client";

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("deload_check", { p_client: clientId });
    setCheck((data as DeloadCheck | null) ?? null);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const add = (start: string, label: string) =>
    Alert.alert(
      `Deload week from ${label.replace(/ \(.*\)$/, "")}?`,
      `That week ${firstName} does the same workouts with half the sets at about 70% of the weight. Everything on the calendar from that day moves back one week, so their program carries on straight after. Let ${firstName} know it's coming.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add deload week",
          onPress: async () => {
            setAdding(true);
            const { data, error } = await supabase.rpc("add_deload_week", { p_client: clientId, p_start: start });
            setAdding(false);
            if (error) {
              Alert.alert("Couldn't add it", error.message);
              return;
            }
            if (!data) {
              Alert.alert("Added, but empty", `${firstName} had no workouts planned that week, so the deload week has none. Their program still moved back a week.`);
            }
            setOpen(false);
            await load();
            onAdded();
          },
        },
      ],
    );

  if (!check) return null;

  if (check.planned_deload) {
    return (
      <View style={[styles.card, styles.planned]}>
        <Text style={styles.plannedText}>
          🌙 Deload week on the calendar from {new Date(`${check.planned_deload}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}.
        </Text>
      </View>
    );
  }

  // The program has its own easy week coming (0121): no extra deload needed.
  if (check.program_easy_soon && !check.due) {
    const when = check.program_easy_next
      ? ` from ${new Date(`${check.program_easy_next}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}`
      : " in the next 2 weeks";
    return (
      <View style={[styles.card, styles.planned]}>
        <Text style={styles.plannedText}>🌙 {firstName}'s program has its own easy week{when}, so no extra deload is needed.</Text>
      </View>
    );
  }

  const choices = deloadStartChoices(today);
  return (
    <View style={[styles.card, check.due && styles.due]}>
      {check.due ? (
        <>
          <Text style={styles.title}>🌙 Time for a deload week</Text>
          <Text style={styles.text}>
            {firstName} has trained {check.weeks} week{check.weeks === 1 ? "" : "s"} in a row
            {check.reasons.length ? `, with ${check.reasons.join(", ")}` : ""}. A lighter week lets their body recover and come back stronger.
          </Text>
        </>
      ) : (
        <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6}>
          <Text style={styles.quiet}>
            🌙 Deload: not needed yet ({check.weeks} week{check.weeks === 1 ? "" : "s"} of steady training
            {check.reasons.length ? `; ${check.reasons.join(", ")}` : ""}). {open ? "▲" : "Add one anyway ▼"}
          </Text>
        </Pressable>
      )}
      {(check.due || open) &&
        (adding ? (
          <ActivityIndicator color={themeText(DELOAD_BLUE)} style={{ marginTop: 8 }} />
        ) : (
          <View style={styles.chips}>
            {choices.map((c) => (
              <Pressable key={c.date} style={styles.chip} onPress={() => add(c.date, c.label)}>
                <Text style={styles.chipText}>Start {c.label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = themedStyles({
  card: { borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#1E293B" },
  due: { borderColor: DELOAD_BLUE, backgroundColor: "rgba(96,165,250,0.08)" },
  planned: { borderColor: DELOAD_BLUE },
  plannedText: { color: DELOAD_BLUE, fontSize: 13, fontWeight: "600" },
  title: { color: DELOAD_BLUE, fontWeight: "700", fontSize: 15 },
  text: { color: "#E2E8F0", fontSize: 13, lineHeight: 18, marginTop: 4 },
  quiet: { color: "#94A3B8", fontSize: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: DELOAD_BLUE, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: "#0B1426", fontWeight: "700", fontSize: 13 },
});
