import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Pressable, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { describeTimeSince, toIsoDate, todayIso } from "@/lib/dates";
import type { Checkin, Client, CoachMessage, Habit, WorkoutLog } from "@/types/database";
import { useAuth } from "@/context/AuthContext";
import ReplyToClientModal from "@/components/ReplyToClientModal";
import type { TrainerStackParamList } from "@/navigation/types";
import ClientAvatar from "@/components/ClientAvatar";
import TrainerProgressPhotos from "@/components/TrainerProgressPhotos";
import { calculateHabitTier, DAYS_PER_TIER, STREAK_TIERS } from "@/lib/habitStreak";
import { BRAND_GOLD } from "@/lib/brand";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<TrainerStackParamList, "ClientDetail">;

const PACKAGE_LABEL: Record<string, string> = {
  training_only: "Training only",
  training_nutrition: "Training + Nutrition",
  training_nutrition_lifestyle: "Training + Nutrition + Lifestyle",
};

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function describeDays(activeDays: number[]) {
  if (activeDays.length === 7) return "Every day";
  return activeDays
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(" ");
}

const EFFORT_LABEL: Record<string, string> = {
  comfortable: "Comfortable",
  close_to_failure: "Close to failure",
  failure: "Failure",
};

type IconName = keyof typeof Ionicons.glyphMap;
type TabKey = "overview" | "checkins" | "habits" | "training" | "photos" | "notes";

// Bottom bar so the trainer can jump straight to one kind of info instead of
// scrolling past everything else. Every icon must have an "-outline" variant.
const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "overview", label: "Overview", icon: "person" },
  { key: "checkins", label: "Check-ins", icon: "checkbox" },
  { key: "habits", label: "Habits", icon: "repeat" },
  { key: "training", label: "Training", icon: "barbell" },
  { key: "photos", label: "Photos", icon: "images" },
  { key: "notes", label: "Notes", icon: "create" },
];

function formatIntakeLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClientDetailScreen({ route }: Props) {
  const { clientId } = route.params;
  const { trainer } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogsByHabit, setHabitLogsByHabit] = useState<Record<string, Record<string, number>>>({});
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [replying, setReplying] = useState(false);

  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitReps, setNewHabitReps] = useState(1);
  const [newHabitStart, setNewHabitStart] = useState(() => todayIso());
  const [newHabitEnd, setNewHabitEnd] = useState("");
  const [addingHabit, setAddingHabit] = useState(false);

  const loadHabits = async () => {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    const list = data ?? [];
    setHabits(list);

    if (list.length > 0) {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data: logRows } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("log_date", toIsoDate(since))
        .in("habit_id", list.map((h) => h.id));
      const byHabit: Record<string, Record<string, number>> = {};
      for (const l of logRows ?? []) {
        byHabit[l.habit_id] = byHabit[l.habit_id] ?? {};
        byHabit[l.habit_id][l.log_date] = l.reps_completed;
      }
      setHabitLogsByHabit(byHabit);
    } else {
      setHabitLogsByHabit({});
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5);
    setMessages(data ?? []);
  };

  useEffect(() => {
    const load = async () => {
      const [{ data: clientRow }, { data: checkinRows }, { data: workoutRows }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase
          .from("checkins")
          .select("*")
          .eq("client_id", clientId)
          .order("checkin_date", { ascending: false })
          .limit(14),
        supabase
          .from("workout_logs")
          .select("*")
          .eq("client_id", clientId)
          .order("log_date", { ascending: false })
          .order("set_number", { ascending: true })
          .limit(30),
      ]);
      if (clientRow) {
        setClient(clientRow);
        setNotes(clientRow.trainer_notes ?? "");
      }
      setCheckins(checkinRows ?? []);
      setWorkoutLogs(workoutRows ?? []);
      await Promise.all([loadHabits(), loadMessages()]);
      setLoading(false);
    };
    load();
  }, [clientId]);

  const addHabit = async () => {
    if (!newHabitName.trim()) {
      Alert.alert("Missing name", "Give the habit a name first.");
      return;
    }
    setAddingHabit(true);
    // Starts covering every day - the client narrows it down to whichever
    // specific days and reminder time actually fit their own schedule.
    const { error } = await supabase.from("habits").insert({
      client_id: clientId,
      name: newHabitName.trim(),
      active_days: [0, 1, 2, 3, 4, 5, 6],
      reps_target: newHabitReps,
      start_date: newHabitStart || todayIso(),
      end_date: newHabitEnd || null,
    });
    setAddingHabit(false);
    if (error) {
      Alert.alert("Couldn't add habit", error.message);
      return;
    }
    setNewHabitName("");
    setNewHabitReps(1);
    setNewHabitEnd("");
    await loadHabits();
  };

  const deleteHabit = async (habitId: string) => {
    const { error } = await supabase.from("habits").delete().eq("id", habitId);
    if (error) {
      Alert.alert("Couldn't remove habit", error.message);
      return;
    }
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
  };

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("clients").update({ trainer_notes: notes }).eq("id", clientId);
    setSaving(false);
    if (error) Alert.alert("Couldn't save notes", error.message);
  };

  const markResolved = async () => {
    const { error } = await supabase
      .from("clients")
      .update({ status_flag: "green", status_flag_note: null, status_flag_updated_at: new Date().toISOString() })
      .eq("id", clientId);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setClient((c) => (c ? { ...c, status_flag: "green", status_flag_note: null } : c));
  };

  const toggleLifestyleReset = async () => {
    const next = client?.lifestyle_reset_started_at ? null : todayIso();
    const { error } = await supabase.from("clients").update({ lifestyle_reset_started_at: next }).eq("id", clientId);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setClient((c) => (c ? { ...c, lifestyle_reset_started_at: next } : c));
  };

  if (loading || !client) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  const timeWithYou = describeTimeSince(new Date(client.created_at));

  return (
    <View style={styles.container}>
      <ScrollView key={tab} contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <View style={styles.headerRow}>
          <ClientAvatar name={client.name} path={client.avatar_path} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{client.name}</Text>
            <Text style={styles.helper}>{client.email}</Text>
            <Text style={styles.memberSince}>
              {timeWithYou === "Joined today" ? timeWithYou : `With you ${timeWithYou}`} · since{" "}
              {new Date(client.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        {tab === "overview" && (
          <>
            {client.package_type && (
              <View style={styles.packageBadge}>
                <Text style={styles.packageBadgeText}>{PACKAGE_LABEL[client.package_type] ?? client.package_type}</Text>
              </View>
            )}

            {client.plan_type && (
              <View style={styles.planBox}>
                <Text style={styles.planLabel}>{client.plan_type === 'intro_1mo' ? '1 Month' : client.plan_type === 'sub_6mo' ? '6 Month' : '12 Month'} Plan</Text>
                {client.plan_started_at && (
                  <Text style={styles.planDate}>
                    Started: {new Date(client.plan_started_at).toLocaleDateString()}
                  </Text>
                )}
                {client.plan_expires_at && (
                  <Text style={[styles.planDate, (new Date(client.plan_expires_at) < new Date()) && styles.expired]}>
                    Expires: {new Date(client.plan_expires_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.resetBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resetTitle}>12-Week Lifestyle Reset</Text>
                {client.lifestyle_reset_started_at ? (
                  <Text style={styles.helper}>Started {client.lifestyle_reset_started_at}</Text>
                ) : (
                  <Text style={styles.helper}>Not enrolled</Text>
                )}
              </View>
              <Pressable style={styles.resetButton} onPress={toggleLifestyleReset}>
                <Text style={styles.resetButtonText}>
                  {client.lifestyle_reset_started_at ? "End program" : "Enroll"}
                </Text>
              </Pressable>
            </View>

            {client.status_flag !== "green" && (
              <View style={[styles.flagBanner, client.status_flag === "red" ? styles.flagBannerRed : styles.flagBannerOrange]}>
                <Text style={styles.flagBannerTitle}>
                  {client.status_flag === "red" ? "🚩 Urgent - needs guidance" : "🟠 Wants feedback"}
                </Text>
                {client.status_flag_note && <Text style={styles.flagBannerNote}>{client.status_flag_note}</Text>}
                {client.status_flag_updated_at && (
                  <Text style={styles.flagBannerTime}>
                    Set {new Date(client.status_flag_updated_at).toLocaleString()}
                  </Text>
                )}
                <View style={styles.flagActions}>
                  <Pressable style={[styles.resolveButton, styles.flex1]} onPress={() => setReplying(true)}>
                    <Text style={styles.resolveButtonText}>💬 Reply</Text>
                  </Pressable>
                  <Pressable style={[styles.resolveButton, styles.flex1]} onPress={markResolved}>
                    <Text style={styles.resolveButtonText}>Mark as resolved</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Text style={styles.sectionHeading}>Messages to {client.name}</Text>
            {messages.length === 0 ? (
              <Text style={styles.helper}>No messages sent yet.</Text>
            ) : (
              messages.map((m) => (
                <View key={m.id} style={styles.messageRow}>
                  <Text style={styles.body}>{m.body}</Text>
                  <Text style={styles.helper}>
                    {new Date(m.created_at).toLocaleString()} · {m.read_at ? "Seen" : "Not seen yet"}
                  </Text>
                </View>
              ))
            )}
            <Pressable style={styles.button} onPress={() => setReplying(true)}>
              <Text style={styles.buttonText}>Send a message</Text>
            </Pressable>
            {trainer && replying && (
              <ReplyToClientModal
                client={client}
                trainerId={trainer.id}
                onClose={() => setReplying(false)}
                onSent={(resolved) => {
                  if (resolved) setClient((c) => (c ? { ...c, status_flag: "green", status_flag_note: null } : c));
                  loadMessages();
                }}
              />
            )}

            {client.injuries && <Text style={styles.body}>Injuries: {client.injuries}</Text>}
            {client.goals && <Text style={styles.body}>Goals: {client.goals}</Text>}

            <Text style={styles.sectionHeading}>Intake form</Text>
            {Object.keys(client.intake_responses ?? {}).length === 0 ? (
              <Text style={styles.helper}>No intake form completed yet.</Text>
            ) : (
              <View style={styles.intakeBox}>
                {Object.entries(client.intake_responses).map(([key, value]) => (
                  <View key={key} style={styles.intakeRow}>
                    <Text style={styles.intakeLabel}>{formatIntakeLabel(key)}</Text>
                    <Text style={styles.intakeValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {tab === "checkins" && (
          <>
            <Text style={styles.sectionHeading}>Last 14 check-ins</Text>
            {checkins.length === 0 && <Text style={styles.helper}>No check-ins yet.</Text>}
            {checkins.map((c) => (
              <View key={c.id} style={[styles.checkinRow, c.distress_flag && styles.checkinDistress]}>
                <Text style={styles.checkinDate}>{c.checkin_date}</Text>
                {c.distress_flag && <Text style={styles.distressText}>⚠ {c.distress_notes}</Text>}
                <Text style={styles.checkinDetail}>
                  Sleep {c.sleep_quality ?? "-"}/5 · Water {c.water_litres}L · Alcohol {c.alcohol_units}u · High-GI{" "}
                  {c.high_gi_count}
                  {c.wound_down !== null && ` · Wind-down ${c.wound_down ? "yes" : "no"}`}
                </Text>
              </View>
            ))}
          </>
        )}
        {tab === "habits" && (
          <>
            <Text style={styles.sectionHeading}>Habits</Text>
            <Text style={styles.helper}>
              You set what's needed and how often - the client picks which days and reminder time actually
              fit their schedule.
            </Text>
            {habits.length === 0 && <Text style={styles.helper}>No habits set up yet.</Text>}
            {habits.map((h) => {
              const tierResult = calculateHabitTier(h, habitLogsByHabit[h.id] ?? {});
              const isMaxTier = tierResult.tier === STREAK_TIERS.length - 1;
              return (
                <View key={h.id} style={styles.habitRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.habitNameRow}>
                      <Text style={styles.habitName}>{h.name}</Text>
                      <View style={[styles.streakDot, { backgroundColor: tierResult.color }]} />
                      <Text style={[styles.streakText, { color: tierResult.color }]}>
                        {tierResult.label}
                        {!isMaxTier ? ` ${tierResult.progress}/${DAYS_PER_TIER}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.habitDetail}>
                      {h.reps_target}x/day · {describeDays(h.active_days)}
                      {h.reminder_enabled && h.reminder_time ? ` · Reminder ${h.reminder_time.slice(0, 5)}` : ""}
                      {h.end_date ? ` · Ends ${h.end_date}` : ""}
                    </Text>
                  </View>
                  <Pressable onPress={() => deleteHabit(h.id)}>
                    <Text style={styles.habitDelete}>Remove</Text>
                  </Pressable>
                </View>
              );
            })}

            <View style={styles.addHabitBox}>
              <Text style={styles.addHabitTitle}>Add a habit</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Take supplements"
                placeholderTextColor="#64748B"
                value={newHabitName}
                onChangeText={setNewHabitName}
              />

              <Text style={styles.fieldLabel}>Times per day</Text>
              <View style={styles.stepperRow}>
                <Pressable style={styles.stepperButton} onPress={() => setNewHabitReps((r) => Math.max(1, r - 1))}>
                  <Text style={styles.stepperButtonText}>-</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{newHabitReps}</Text>
                <Pressable style={styles.stepperButton} onPress={() => setNewHabitReps((r) => r + 1)}>
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>

              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Start date</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748B"
                    value={newHabitStart}
                    onChangeText={setNewHabitStart}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>End date (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ongoing"
                    placeholderTextColor="#64748B"
                    value={newHabitEnd}
                    onChangeText={setNewHabitEnd}
                  />
                </View>
              </View>

              <Pressable style={styles.button} onPress={addHabit} disabled={addingHabit}>
                {addingHabit ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Add habit</Text>}
              </Pressable>
            </View>
          </>
        )}
        {tab === "training" && (
          <>
            <Text style={styles.sectionHeading}>Recent training log</Text>
            {workoutLogs.length === 0 && <Text style={styles.helper}>No sets logged yet.</Text>}
            {workoutLogs.map((w) => (
              <View key={w.id} style={styles.workoutRow}>
                <Text style={styles.workoutExercise}>
                  {w.exercise_name} - Set {w.set_number}
                </Text>
                <Text style={styles.workoutDetail}>
                  {w.log_date} · {w.weight_kg ? `${w.weight_kg}kg x ` : ""}
                  {w.reps} reps · {EFFORT_LABEL[w.effort] ?? w.effort}
                </Text>
              </View>
            ))}
          </>
        )}
        {tab === "photos" && (
          <>
            <Text style={styles.sectionHeading}>Progress photos</Text>
            <TrainerProgressPhotos clientId={client.id} clientName={client.name} shared={client.progress_photos_shared} />
          </>
        )}
        {tab === "notes" && (
          <>
            <Text style={styles.sectionHeading}>Trainer notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Private notes about this client"
              placeholderTextColor="#64748B"
            />
            <Pressable style={styles.button} onPress={saveNotes} disabled={saving}>
              {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Save notes</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const focused = t.key === tab;
          const showDot =
            (t.key === "overview" && client.status_flag !== "green") ||
            (t.key === "checkins" && checkins.some((c) => c.distress_flag));
          return (
            <Pressable key={t.key} style={styles.tabButton} onPress={() => setTab(t.key)}>
              <View>
                <Ionicons
                  name={focused ? t.icon : (`${t.icon}-outline` as IconName)}
                  size={22}
                  color={focused ? BRAND_GOLD : "#64748B"}
                />
                {showDot && (
                  <View
                    style={[
                      styles.tabDot,
                      { backgroundColor: client.status_flag === "red" || t.key === "checkins" ? "#EF4444" : "#F59E0B" },
                    ]}
                  />
                )}
              </View>
              <Text style={[styles.tabLabel, focused && { color: BRAND_GOLD }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingTop: 8,
  },
  tabButton: { flex: 1, alignItems: "center", gap: 2 },
  tabLabel: { color: "#64748B", fontSize: 10, fontWeight: "600" },
  tabDot: { position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: 5 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  memberSince: { color: BRAND_GOLD, fontSize: 13, fontWeight: "600" },
  packageBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#1E293B",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  packageBadgeText: { color: "#22C55E", fontSize: 12, fontWeight: "600" },
  planBox: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#22C55E",
  },
  planLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },
  planDate: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  expired: { color: "#EF4444" },
  resetBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  resetTitle: { color: "#fff", fontWeight: "600", fontSize: 14 },
  resetButton: { backgroundColor: "#22C55E", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  resetButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  body: { color: "#E2E8F0", fontSize: 14, marginBottom: 4 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 20, marginBottom: 8 },
  flagBanner: { borderRadius: 10, padding: 14, marginTop: 12, marginBottom: 4, borderWidth: 1.5 },
  flagBannerRed: { backgroundColor: "#2A1414", borderColor: "#EF4444" },
  flagBannerOrange: { backgroundColor: "#2A2114", borderColor: "#F59E0B" },
  flagBannerTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  flagBannerNote: { color: "#E2E8F0", fontSize: 14, marginTop: 6 },
  flagBannerTime: { color: "#94A3B8", fontSize: 11, marginTop: 6 },
  resolveButton: {
    backgroundColor: "#22C55E",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 10,
  },
  flagActions: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
  messageRow: { backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginBottom: 6 },
  resolveButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  intakeBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12 },
  intakeRow: { marginBottom: 10 },
  intakeLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 2 },
  intakeValue: { color: "#E2E8F0", fontSize: 14 },
  notesInput: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#0F172A", fontWeight: "700" },
  checkinRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  checkinDistress: { borderWidth: 1.5, borderColor: "#EF4444" },
  checkinDate: { color: "#fff", fontWeight: "600" },
  distressText: { color: "#F87171", fontSize: 13, marginTop: 4, fontWeight: "600" },
  checkinDetail: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  workoutRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  workoutExercise: { color: "#fff", fontWeight: "600", fontSize: 14 },
  workoutDetail: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  habitNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  habitName: { color: "#fff", fontWeight: "600", fontSize: 14 },
  streakDot: { width: 8, height: 8, borderRadius: 4 },
  streakText: { fontSize: 11, fontWeight: "600" },
  habitDetail: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  habitDelete: { color: "#F87171", fontSize: 13, fontWeight: "600" },
  addHabitBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginTop: 4 },
  addHabitTitle: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 10 },
  fieldLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  textInput: {
    backgroundColor: "#0F172A",
    color: "#fff",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { color: "#22C55E", fontSize: 18, fontWeight: "700" },
  stepperValue: { color: "#fff", fontSize: 16, fontWeight: "700", minWidth: 20, textAlign: "center" },
  dateRow: { flexDirection: "row", gap: 10 },
});
