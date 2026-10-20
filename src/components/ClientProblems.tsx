import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { PROBLEM_LABELS, PROBLEM_ORANGE, PROBLEM_RED } from "@/lib/clientProblems";
import type { ClientProblem } from "@/types/database";
import MedicalClearanceModal from "@/components/MedicalClearanceModal";

// The client's open problems at the top of their Overview tab (0075). Busy
// fixing turns the red dot orange, and the app checks in with the client the
// next day; Fixed makes the dot go away.
export default function ClientProblems({
  clientId,
  clientName = "the client",
  problems,
  onChanged,
  onReply,
}: {
  clientId: string;
  clientName?: string;
  problems: ClientProblem[];
  onChanged: () => void;
  onReply?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  // Serious symptoms (0133) clear only through the medical check.
  const [clearing, setClearing] = useState<ClientProblem | null>(null);
  const unfixed = problems.filter((p) => p.status !== "fixed");
  if (unfixed.length === 0) return null;

  const setStatus = async (p: ClientProblem, status: "fixing" | "fixed") => {
    setBusy(p.id + status);
    const { error } = await supabase.rpc("set_client_problem_status", { p_client: clientId, p_status: status, p_problem: p.id });
    setBusy(null);
    if (error) Alert.alert("Couldn't update", error.message);
    onChanged();
  };

  return (
    <View style={styles.wrap}>
      <MedicalClearanceModal
        problem={clearing}
        clientName={clientName}
        onClose={() => setClearing(null)}
        onCleared={() => {
          setClearing(null);
          onChanged();
        }}
      />
      <Text style={styles.heading}>Problems to deal with</Text>
      {unfixed.map((p) => {
        const { icon, title } = PROBLEM_LABELS[p.topic];
        const medical = p.topic === "medical";
        const fixing = p.status === "fixing" && !medical;
        return (
          <View key={p.id} style={[styles.card, { borderColor: fixing ? PROBLEM_ORANGE : PROBLEM_RED }]}>
            <View style={styles.headRow}>
              <View style={[styles.dot, { backgroundColor: fixing ? PROBLEM_ORANGE : PROBLEM_RED }]} />
              <Text style={styles.title}>
                {icon} {title}
              </Text>
              <Text style={[styles.state, { color: fixing ? PROBLEM_ORANGE : PROBLEM_RED }]}>{fixing ? "Busy fixing" : "New"}</Text>
            </View>
            {p.detail ? <Text style={styles.detail}>{p.detail}</Text> : null}
            <Text style={styles.meta}>
              Reported {p.reported_on}
              {p.last_reported_on !== p.reported_on ? ` · again ${p.last_reported_on}` : ""}
            </Text>
            {medical && (
              <Text style={[styles.meta, { color: "#FCA5A5" }]}>
                Their workouts are on hold. They were told to stop exercising and get medical help. Clear it once a doctor or other health
                professional has assessed them.
              </Text>
            )}
            {fixing && (
              <Text style={styles.meta}>
                {p.followup_sent_at
                  ? `The app checked in with them on ${new Date(p.followup_sent_at).toLocaleDateString()}`
                  : "The app will check in with them tomorrow morning"}
              </Text>
            )}
            {p.client_reply && (
              <View style={styles.reply}>
                <Text style={styles.replyHead}>Their reply</Text>
                <Text style={styles.replyText}>{p.client_reply}</Text>
              </View>
            )}
            <View style={styles.buttons}>
              {onReply && (
                <Pressable style={[styles.button, styles.replyButton]} onPress={onReply} disabled={!!busy}>
                  <Text style={styles.buttonText}>💬 Reply</Text>
                </Pressable>
              )}
              {!fixing && !medical && (
                <Pressable style={[styles.button, styles.fixing]} onPress={() => setStatus(p, "fixing")} disabled={!!busy}>
                  {busy === p.id + "fixing" ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>🟠 Busy fixing</Text>}
                </Pressable>
              )}
              {medical ? (
                <Pressable style={[styles.button, styles.fixed]} onPress={() => setClearing(p)} disabled={!!busy}>
                  <Text style={styles.buttonText}>🩺 Clear the hold</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.button, styles.fixed]} onPress={() => setStatus(p, "fixed")} disabled={!!busy}>
                  {busy === p.id + "fixed" ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>✅ Fixed</Text>}
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1.5 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  state: { fontWeight: "700", fontSize: 12 },
  detail: { color: "#E2E8F0", marginTop: 6 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  reply: { backgroundColor: "#0F172A", borderRadius: 8, padding: 10, marginTop: 8 },
  replyHead: { color: "#22C55E", fontWeight: "700", fontSize: 12 },
  replyText: { color: "#E2E8F0", marginTop: 2 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 10 },
  button: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  replyButton: { backgroundColor: BRAND_GOLD },
  fixing: { backgroundColor: PROBLEM_ORANGE },
  fixed: { backgroundColor: "#22C55E" },
  buttonText: { color: "#0F172A", fontWeight: "700" },
});
