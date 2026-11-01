import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { cleanMessage, MAX_MESSAGE_LENGTH } from "@/lib/coachMessages";
import RehabSuggestion from "@/components/stability/RehabSuggestion";
import { reportsByTopic, WELLBEING_TOPICS, type WellbeingKey, type WellbeingReport } from "@/lib/wellbeing";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// On the trainer's Check-ins tab (review 2026-10-18, moved from Notes): what the client reported on their check-ins
// (0055), in three sections (Injury or pain, Fatigue, Mental exhaustion), so
// the trainer can adjust their program. Tap a section to open it, and send
// the client a check-in note about it (GRIZZ, 2026-10-17): it shows at the top
// of their Check-in screen with a phone notification, and when the problem is
// still open they can reply to it (0075).
export default function WellbeingReports({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { trainer } = useAuth();
  const [reports, setReports] = useState<Record<WellbeingKey, WellbeingReport[]> | null>(null);
  const [open, setOpen] = useState<WellbeingKey | null>(null);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open !== null, () => setOpen(null));
  const [writing, setWriting] = useState<WellbeingKey | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sentFor, setSentFor] = useState<WellbeingKey | null>(null);
  const firstName = clientName.trim().split(/\s+/)[0] || clientName;

  const sendNote = async (topic: WellbeingKey) => {
    const body = cleanMessage(draft);
    if (!body || !trainer) return;
    setSending(true);
    // Link it to the open problem for this topic, so the client gets a reply box.
    const { data: problem } = await supabase
      .from("client_problems")
      .select("id")
      .eq("client_id", clientId)
      .eq("topic", topic === "symptoms" ? "medical" : topic)
      .neq("status", "fixed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("coach_messages")
      .insert({ client_id: clientId, trainer_id: trainer.id, body, problem_id: problem?.id ?? null });
    setSending(false);
    if (error) return Alert.alert("Couldn't send", error.message);
    setDraft("");
    setWriting(null);
    setSentFor(topic);
  };

  useEffect(() => {
    supabase
      .from("checkins")
      .select("*")
      .eq("client_id", clientId)
      .or("pain_status.eq.reported,fatigue_status.eq.reported,mental_status.eq.reported,balance_status.eq.reported,symptoms_status.eq.reported")
      .order("checkin_date", { ascending: false })
      .limit(60)
      .then(({ data }) => setReports(reportsByTopic(data ?? [])));
  }, [clientId]);

  if (!reports) return <ActivityIndicator color={themeText("#22C55E")} style={{ marginVertical: 12 }} />;

  return (
    <View>
      <Text style={styles.heading}>Body and mind</Text>
      <Text style={styles.helper}>What the client reported on their check-ins.</Text>
      {WELLBEING_TOPICS.map((t) => {
        const list = reports[t.key];
        const isOpen = open === t.key;
        return (
          <View key={t.key} style={[styles.card, list.length > 0 && styles.cardFlagged]}>
            <Pressable style={styles.header} onPress={() => setOpen(isOpen ? null : t.key)}>
              <Text style={styles.icon}>{t.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.latest}>
                  {list.length === 0 ? "Nothing reported" : `Latest: ${list[0].date} · ${list[0].kind}`}
                </Text>
              </View>
              {list.length > 0 && <Text style={styles.count}>{list.length}</Text>}
              <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
            </Pressable>
            {isOpen &&
              (list.length === 0 ? (
                <Text style={styles.entryNotes}>Nothing reported yet.</Text>
              ) : (
                <>
                  {writing === t.key ? (
                    <View style={styles.composer}>
                      <TextInput
                        style={styles.input}
                        multiline
                        autoFocus
                        maxLength={MAX_MESSAGE_LENGTH}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={`Your note to ${firstName}`}
                        placeholderTextColor="#64748B"
                      />
                      <View style={styles.composerButtons}>
                        <Pressable style={[styles.smallButton, styles.cancel]} onPress={() => setWriting(null)} disabled={sending}>
                          <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.smallButton, styles.send, !cleanMessage(draft) && { opacity: 0.5 }]}
                          onPress={() => sendNote(t.key)}
                          disabled={!cleanMessage(draft) || sending}
                        >
                          {sending ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.sendText}>Send to {firstName}</Text>}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.noteButton}
                      onPress={() => {
                        setDraft("");
                        setSentFor(null);
                        setWriting(t.key);
                      }}
                    >
                      <Text style={styles.noteButtonText}>💬 Send {firstName} a check-in note</Text>
                    </Pressable>
                  )}
                  {sentFor === t.key && (
                    <Text style={styles.sent}>✓ Sent. {firstName} sees it at the top of their Check-in and can reply.</Text>
                  )}
                  {t.key === "pain" && <RehabSuggestion clientName={clientName} texts={[list[0].kind, list[0].notes]} />}
                  {list.slice(0, 10).map((r) => (
                    <View key={r.date} style={styles.entry}>
                      <Text style={styles.entryHead}>
                        {r.date} · {r.kind}
                      </Text>
                      <Text style={styles.entryNotes}>{r.notes}</Text>
                    </View>
                  ))}
                </>
              ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
  heading: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 16, marginBottom: 2 },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 6, marginBottom: 8, borderWidth: 1.5, borderColor: "transparent" },
  cardFlagged: { borderColor: "#F59E0B" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  icon: { fontSize: 22 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  latest: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  count: { color: "#F59E0B", fontWeight: "800", fontSize: 14 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  entry: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, margin: 6, marginTop: 0 },
  entryHead: { color: "#FBBF24", fontWeight: "700", fontSize: 13 },
  noteButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, alignItems: "center", margin: 6, marginTop: 0 },
  noteButtonText: { color: "#0F172A", fontWeight: "800" },
  composer: { margin: 6, marginTop: 0 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 12, minHeight: 90, textAlignVertical: "top" },
  composerButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  smallButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  cancel: { backgroundColor: "#334155" },
  cancelText: { color: "#fff", fontWeight: "600" },
  send: { backgroundColor: BRAND_GOLD },
  sendText: { color: "#0F172A", fontWeight: "800" },
  sent: { color: "#22C55E", fontSize: 13, fontWeight: "700", marginHorizontal: 10, marginBottom: 6 },
  entryNotes: { color: "#E2E8F0", fontSize: 13, marginTop: 4, paddingHorizontal: 4 },
});
