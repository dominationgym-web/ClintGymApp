import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { loadAvailablePrograms } from "@/lib/programQueries";
import { resetNotice } from "@/lib/resetProgram";
import {
  FOUNDATION_GOALS,
  foundationGoalFor,
  foundationLevelFor,
  foundationProgramName,
  levelLabel,
  type FoundationGoal,
  type FoundationLevel,
} from "@/lib/foundation";
import type { Client, Program } from "@/types/database";
import PlanProgramModal from "@/components/PlanProgramModal";
import { useAuth } from "@/context/AuthContext";

// On the client's Training tab (0087): their training experience, and for
// Never trained, Beginner and Intermediate an offer to put them on a 6-week
// foundation program (0086). Approving opens the calendar planner with the
// program already picked (review 2026-10-18: one way to give a program), so
// foundation clients get a calendar like everyone else. No message is sent.
export default function FoundationOfferCard({
  client,
  onChanged,
}: {
  client: Client;
  onChanged: (change: Partial<Client>) => void;
}) {
  const firstName = client.name.split(" ")[0];
  const [open, setOpen] = useState(client.foundation_status === "suggested");
  const [level, setLevel] = useState<FoundationLevel>(foundationLevelFor(client.training_level) ?? "Beginner");
  const [goal, setGoal] = useState<FoundationGoal>(foundationGoalFor(client.intake_responses?.training_goals));
  const [busy, setBusy] = useState(false);
  const { trainer } = useAuth();
  // The program picked, while the planner is open; all programs for its "comes off" check.
  const [planning, setPlanning] = useState<Program | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const programName = foundationProgramName(level, goal);

  const approve = async () => {
    setBusy(true);
    const all = await loadAvailablePrograms();
    setBusy(false);
    const program = all.find((p) => p.trainer_id === null && p.name === programName);
    if (!program) {
      Alert.alert("Couldn't find the program", `${programName} isn't in the app yet.`);
      return;
    }
    setPrograms(all);
    setPlanning(program);
  };

  // Activated on the calendar: the offer is done. No automatic note to the
  // client (GRIZZ: never ready-made messages from trainer to client).
  const planned = async () => {
    setPlanning(null);
    setOpen(false);
    await supabase.from("clients").update({ foundation_status: "approved" }).eq("id", client.id);
    onChanged({ foundation_status: "approved" });
    Alert.alert(
      "Program started",
      `${firstName} is on ${programName}. It's on their calendar now. If you'd like to tell them why, send them a message from their Overview.`,
    );
  };

  const notNow = async () => {
    setOpen(false);
    onChanged({ foundation_status: "declined" });
    await supabase.from("clients").update({ foundation_status: "declined" }).eq("id", client.id);
  };

  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <Text style={styles.title}>🌱 Training experience: {levelLabel(client.training_level)}</Text>
      {!open ? (
        <>
          {client.foundation_status === "approved" && <Text style={styles.helper}>Foundation program approved ✓</Text>}
          <Pressable onPress={() => setOpen(true)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 6 }}>
            <Text style={styles.link}>{client.foundation_status === "approved" ? "Change foundation program" : "Offer a foundation program"}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            Start {firstName} on a 6-week foundation program to prepare their body for real training: joint stability, core
            strength, and muscle and tendon development. It avoids injuries and gives you time to get to know them.
          </Text>
          <Text style={styles.label}>Level</Text>
          <View style={styles.chips}>
            {(["Beginner", "Intermediate"] as FoundationLevel[]).map((l) => (
              <Pressable key={l} style={[styles.chip, level === l && styles.chipOn]} onPress={() => setLevel(l)}>
                <Text style={[styles.chipText, level === l && styles.chipTextOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Goal</Text>
          <View style={styles.chips}>
            {FOUNDATION_GOALS.map((g) => (
              <Pressable key={g} style={[styles.chip, goal === g && styles.chipOn]} onPress={() => setGoal(g)}>
                <Text style={[styles.chipText, goal === g && styles.chipTextOn]}>{g}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>
            {level === "Beginner" ? "3 days a week, full body." : "4 days a week, upper/lower."} Next you pick the days they train, and it
            goes on their calendar from today.
          </Text>
          <View style={styles.buttons}>
            <Pressable style={styles.secondary} onPress={notNow} disabled={busy}>
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={approve} disabled={busy}>
              {busy ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>Approve: pick the days</Text>}
            </Pressable>
          </View>
        </>
      )}
      <PlanProgramModal
        date={planning ? todayIso() : null}
        clientId={client.id}
        clientName={firstName}
        trainerId={trainer?.id}
        trainingPlace={client.training_place}
        programs={programs}
        resetNotice={resetNotice(client, todayIso())}
        startWith={planning}
        onDone={planned}
        onClose={() => setPlanning(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12 },
  cardOpen: { borderWidth: 1.5, borderColor: BRAND_GOLD },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  text: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 6 },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 8 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  label: { color: "#64748B", fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondary: { flex: 1, borderWidth: 1, borderColor: "#334155", borderRadius: 10, padding: 12, alignItems: "center" },
  secondaryText: { color: "#CBD5E1", fontWeight: "700" },
  primary: { flex: 2, backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center" },
  primaryText: { color: "#0F172A", fontWeight: "800" },
});
