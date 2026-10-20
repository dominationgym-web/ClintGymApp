import CheckinFeedbackCard from "@/components/CheckinFeedbackCard";
import { checkinFeedback } from "@/lib/checkinFeedback";
import { intakeDetails } from "@/lib/dietPlan";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Switch } from "react-native";
import TextInput from "@/components/TextInput";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { describeTimeSince, parseIsoDate, toIsoDate, todayIso } from "@/lib/dates";
import { renewedPlanDates } from "@/lib/planRenewal";
import { clientGoals } from "@/lib/clientGoals";
import DropSetRoundsCard from "@/components/DropSetRoundsCard";
import type { Checkin, Client, ClientProblem, CoachMessage, Habit, WorkoutLog } from "@/types/database";
import { TRAINING_LEVELS, levelLabel } from "@/lib/foundation";
import { useAuth } from "@/context/AuthContext";
import ClientPricePicker from "@/components/ClientPricePicker";
import ReplyToClientModal from "@/components/ReplyToClientModal";
import FoundationOfferCard from "@/components/FoundationOfferCard";
import ClientFormVideos from "@/components/ClientFormVideos";
import type { TrainerStackParamList } from "@/navigation/types";
import ClientAvatar from "@/components/ClientAvatar";
import HomeEquipmentCard from "@/components/HomeEquipmentCard";
import HabitOptionsPicker from "@/components/HabitOptionsPicker";
import TrainerProgressPhotos from "@/components/TrainerProgressPhotos";
import GymHomeTabs from "@/components/GymHomeTabs";
import ClientProgramPicker from "@/components/ClientProgramPicker";
import InjuryCheckCard from "@/components/InjuryCheckCard";
import ExercisePainList from "@/components/ExercisePainList";
import InjuryList from "@/components/InjuryList";
import ClientDailySummaryCard from "@/components/ClientDailySummaryCard";
import type { StabilityArea } from "@/lib/stability";
import ClientCalendarCard from "@/components/ClientCalendarCard";
import RecoveryCheckCard from "@/components/RecoveryCheckCard";
import RecoveryCoachCard from "@/components/RecoveryCoachCard";
import OtherActivityCard from "@/components/OtherActivityCard";
import TrainerTrainingLog from "@/components/TrainerTrainingLog";
import { useWorkoutSessions } from "@/components/useWorkoutSessions";
import { trainingLogStart } from "@/lib/trainingLog";
import { calculateHabitTier, DAYS_PER_TIER, STREAK_TIERS } from "@/lib/habitStreak";
import { BRAND_GOLD } from "@/lib/brand";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import DietPlanner from "@/components/DietPlanner";
import ClientOwnMealPlan from "@/components/ClientOwnMealPlan";
import WorkoutsSavedButton from "@/components/WorkoutsSavedButton";
import TrainerResetNotes from "@/components/reset/TrainerResetNotes";
import TrainerStabilityCard from "@/components/stability/TrainerStabilityCard";
import RehabSuggestion from "@/components/stability/RehabSuggestion";
import { stabilityAreasFor } from "@/lib/stability";
import WellbeingReports from "@/components/WellbeingReports";
import ClientProblems from "@/components/ClientProblems";
import ComebackCompareCard from "@/components/ComebackCompareCard";
import { archiveChanges, bringBackChanges } from "@/lib/comeback";
import { problemColor, problemLevel } from "@/lib/clientProblems";
import { RESET_WEEKS_TOTAL, resetName, resetNotice, resetWeekNumber } from "@/lib/resetProgram";
import FoldSection from "@/components/FoldSection";
import { HABIT_LENGTHS, habitEndDate, habitLengthLabel, habitStartChoices } from "@/lib/habitDates";

type Props = NativeStackScreenProps<TrainerStackParamList, "ClientDetail">;

// What the client ticked at sign-up. Only shown for reference: the trainer's
// own price picker ("What they pay you") is the one that counts for income
// (review 2026-10-18).
const PACKAGE_LABEL: Record<string, string> = {
  training_only: "Training only",
  training_nutrition: "Training + Nutrition",
  training_nutrition_lifestyle: "Training + Nutrition + Lifestyle",
};

const PLAN_LABEL: Record<string, string> = { intro_1mo: "1 Month", sub_6mo: "6 Month", sub_12mo: "12 Month" };

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function describeDays(activeDays: number[]) {
  if (activeDays.length === 7) return "Every day";
  return activeDays
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(" ");
}

type TabKey = "overview" | "checkins" | "habits" | "training" | "diet" | "photos" | "notes";

// Bottom bar so the trainer can jump straight to one kind of info instead of
// scrolling past everything else.
const TABS: ScreenTab<TabKey>[] = [
  { key: "overview", label: "Overview", icon: "person" },
  { key: "checkins", label: "Check-ins", icon: "checkbox" },
  { key: "habits", label: "Habits", icon: "repeat" },
  { key: "training", label: "Training", icon: "barbell" },
  { key: "diet", label: "Diet", icon: "nutrition" },
  { key: "photos", label: "Photos", icon: "images" },
  { key: "notes", label: "Notes", icon: "create" },
];

function formatIntakeLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClientDetailScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const { trainer } = useAuth();
  // Bumped when a foundation program is approved, so the program card reloads.
  const [programKey, setProgramKey] = useState(0);
  const [stabilityKey, setStabilityKey] = useState(0);
  // Bumped when a stability program starts or stops, so the calendar's stability days reload.
  const [stabilityDaysKey, setStabilityDaysKey] = useState(0);
  // Injury check (GRIZZ, 2026-10-17): planKey bumps after any program pick to put up the check sign.
  const [planKey, setPlanKey] = useState(0);
  const [injuryKey, setInjuryKey] = useState(0);
  const [injuredAreas, setInjuredAreas] = useState<StabilityArea[]>([]);
  const planChanged = () => setPlanKey((k) => k + 1);
  // Which tap-to-open heading on the Training tab is open.
  const [trainingOpen, setTrainingOpen] = useState<string | null>(route.params.open ?? null);
  const toggleTraining = (key: string) => setTrainingOpen((k) => (k === key ? null : key));
  // Which tap-to-open heading on the Overview is open (review 2026-10-18: a shorter Overview).
  const [overviewOpen, setOverviewOpen] = useState<string | null>(null);
  const toggleOverview = (key: string) => setOverviewOpen((k) => (k === key ? null : key));
  const [client, setClient] = useState<Client | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogsByHabit, setHabitLogsByHabit] = useState<Record<string, Record<string, number>>>({});
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [tab, setTab] = useState<TabKey>(route.params.tab ?? "overview");
  // Unsaved diet plan changes: ask before leaving the Diet tab or the client.
  // A ref, so "Leave" takes effect at once rather than on the next render.
  const dietDirty = useRef(false);
  const setDietDirty = (dirty: boolean) => {
    dietDirty.current = dirty;
  };
  const confirmLeaveDiet = (leave: () => void) => {
    if (!dietDirty.current) return leave();
    Alert.alert("Leave without saving?", "Your changes to the diet plan haven't been saved.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          dietDirty.current = false;
          leave();
        },
      },
    ]);
  };
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!dietDirty.current) return;
        e.preventDefault();
        confirmLeaveDiet(() => navigation.dispatch(e.data.action));
      }),
    [navigation]
  );
  // Problems not yet fixed (0075): red dot while one is open, orange while
  // they're all being fixed.
  const [problems, setProblems] = useState<ClientProblem[]>([]);
  // How each workout in the training log went, with gold stars (0076).
  const { byDate: workoutSessions } = useWorkoutSessions(clientId, trainingLogStart(todayIso()), todayIso());
  const reloadProblems = async () => {
    const { data } = await supabase
      .from("client_problems")
      .select("*")
      .eq("client_id", clientId)
      .neq("status", "fixed")
      .order("created_at", { ascending: true });
    setProblems(data ?? []);
    // Fixing the last flag problem turns the client's flag green.
    const { data: row } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (row) setClient(row);
  };
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [replying, setReplying] = useState(false);

  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitReps, setNewHabitReps] = useState(1);
  const [newHabitStart, setNewHabitStart] = useState(() => todayIso());
  // Weeks it runs, or null for no end.
  const [newHabitWeeks, setNewHabitWeeks] = useState<number | null>(null);
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

  const loadNotes = async () => {
    const { data } = await supabase.from("client_trainer_notes").select("notes").eq("client_id", clientId).maybeSingle();
    setNotes(data?.notes ?? "");
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
          .gte("log_date", trainingLogStart(todayIso()))
          .order("log_date", { ascending: false })
          .order("set_number", { ascending: true })
          .limit(1000),
      ]);
      if (clientRow) setClient(clientRow);
      setCheckins(checkinRows ?? []);
      setWorkoutLogs(workoutRows ?? []);
      await Promise.all([loadHabits(), loadMessages(), loadNotes(), reloadProblems()]);
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
      start_date: newHabitStart,
      end_date: habitEndDate(newHabitStart, newHabitWeeks),
    });
    setAddingHabit(false);
    if (error) {
      Alert.alert("Couldn't add habit", error.message);
      return;
    }
    setNewHabitName("");
    setNewHabitReps(1);
    setNewHabitWeeks(null);
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
  // Removing deletes the habit and every day ticked off, so ask first.
  const confirmDeleteHabit = (habit: Habit) =>
    Alert.alert(
      `Remove "${habit.name}"?`,
      `This deletes the habit and its whole streak history for ${client?.name ?? "this client"}. It can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteHabit(habit.id) },
      ]
    );

  // Plan and payment, from the Overview: renew after a payment (the new plan
  // starts when the current one ends) or close their access.
  const renewPlan = () => {
    if (!client) return;
    const next = renewedPlanDates(client, new Date());
    if (!next) return Alert.alert("No plan", "This client has no plan length picked.");
    const renewing = client.access_status !== "expired";
    Alert.alert(
      renewing ? "Renew plan?" : "Activate client?",
      `Confirm payment received for ${client.name}. ${renewing ? "The new plan starts when the current one ends" : "Their access opens now"} and runs to ${parseIsoDate(next.plan_expires_at).toLocaleDateString()}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: renewing ? "Renew" : "Activate",
          onPress: async () => {
            const { error } = await supabase.from("clients").update(next).eq("id", client.id);
            if (error) return Alert.alert("Couldn't update", error.message);
            setClient((c) => (c ? { ...c, ...next } : c));
          },
        },
      ]
    );
  };
  const markExpired = () => {
    if (!client) return;
    Alert.alert("Mark as expired?", `This closes ${client.name}'s access now. Are you sure?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark expired",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("clients").update({ access_status: "expired" }).eq("id", client.id);
          if (error) return Alert.alert("Couldn't update", error.message);
          setClient((c) => (c ? { ...c, access_status: "expired" } : c));
        },
      },
    ]);
  };

  // Goals: filled in from the intake form, and the trainer can change them.
  const [goalsDraft, setGoalsDraft] = useState<string | null>(null);
  const saveGoals = async () => {
    if (goalsDraft === null) return;
    const goals = goalsDraft.trim() || null;
    const { error } = await supabase.from("clients").update({ goals }).eq("id", clientId);
    if (error) return Alert.alert("Couldn't save goals", error.message);
    setClient((c) => (c ? { ...c, goals } : c));
    setGoalsDraft(null);
  };

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("client_trainer_notes")
      .upsert({ client_id: clientId, notes, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
    setSaving(false);
    if (error) Alert.alert("Couldn't save notes", error.message);
    else setNotesSaved(true);
  };

  // Archive (0097): hides an old client and closes their access. Nothing is
  // deleted, so they can be brought back with all their history.
  const archiveOrBringBack = () => {
    if (!client) return;
    const archived = !!client.archived_at;
    Alert.alert(
      archived ? `Bring ${client.name} back?` : `Archive ${client.name}?`,
      archived
        ? "All their old data is still here. They'll be asked to fill in the intake form again, so you can compare then and now below. Tap Activate on the Clients list once they've paid."
        : "They move off your client lists and their access closes. Nothing is deleted: if they come back, open Dormant on the Clients tab and tap Bring back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: archived ? "Bring back" : "Archive",
          onPress: async () => {
            const now = new Date().toISOString();
            const changes = archived ? bringBackChanges(client, now) : archiveChanges(client, now);
            const { error } = await supabase.from("clients").update(changes).eq("id", client.id);
            if (error) return Alert.alert("Couldn't update", error.message);
            setClient((c) => (c ? { ...c, ...changes } : c));
          },
        },
      ]
    );
  };

  const toggleLifestyleReset = async () => {
    const next = client?.lifestyle_reset_started_at ? null : todayIso();
    // Ending clears her start date too, so a later enrolment starts at week 1.
    const changes = next ? { lifestyle_reset_started_at: next } : { lifestyle_reset_started_at: null, reset_started_on: null };
    const { error } = await supabase.from("clients").update(changes).eq("id", clientId);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setClient((c) => (c ? { ...c, ...changes } : c));
  };

  const setTrainingPlace = async (next: "gym" | "home") => {
    if (!client || next === client.training_place) return;
    const previous = client.training_place;
    setClient((c) => (c ? { ...c, training_place: next } : c));
    const { error } = await supabase.from("clients").update({ training_place: next }).eq("id", clientId);
    if (error) {
      setClient((c) => (c ? { ...c, training_place: previous } : c));
      Alert.alert("Couldn't update", error.message);
    }
  };

  const toggleLibraryAccess = async (next: boolean) => {
    setClient((c) => (c ? { ...c, library_access: next } : c));
    const { error } = await supabase.from("clients").update({ library_access: next }).eq("id", clientId);
    if (error) {
      setClient((c) => (c ? { ...c, library_access: !next } : c));
      Alert.alert("Couldn't update", error.message);
    }
  };

  const toggleAbs = async (next: boolean) => {
    setClient((c) => (c ? { ...c, abs_between_sets: next } : c));
    const { error } = await supabase.from("clients").update({ abs_between_sets: next }).eq("id", clientId);
    if (error) {
      setClient((c) => (c ? { ...c, abs_between_sets: !next } : c));
      Alert.alert("Couldn't update", error.message);
    }
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
            {client.archived_at && (
              <View style={styles.archivedBanner}>
                <Text style={styles.archivedText}>
                  🗄 Archived on {new Date(client.archived_at).toLocaleDateString()}. All their data is kept.
                </Text>
                <Pressable style={styles.button} onPress={archiveOrBringBack}>
                  <Text style={styles.buttonText}>Bring back</Text>
                </Pressable>
              </View>
            )}
            <ClientDailySummaryCard clientId={client.id} clientName={client.name} />
            <ComebackCompareCard client={client} />
            <TrainingLevelBanner level={client.training_level} />
            <ClientProblems clientId={client.id} problems={problems} onChanged={reloadProblems} onReply={() => setReplying(true)} />
            <Text style={styles.sectionHeading}>Check-in notes to {client.name}</Text>
            {messages.length === 0 ? (
              <Text style={styles.helper}>No notes sent yet.</Text>
            ) : (
              messages.slice(0, 3).map((m) => (
                <View key={m.id} style={styles.messageRow}>
                  <Text style={styles.body}>{m.body}</Text>
                  <Text style={styles.helper}>
                    {new Date(m.created_at).toLocaleString()} · {m.read_at ? "Seen" : "Not seen yet"}
                  </Text>
                </View>
              ))
            )}
            {/* The one way to message a client (review 2026-10-18): the trainer's own words, shown at the top of their Check-in. */}
            <Pressable style={styles.button} onPress={() => setReplying(true)}>
              <Text style={styles.buttonText}>💬 Send {client.name.split(" ")[0]} a check-in note</Text>
            </Pressable>
            {trainer && replying && (
              <ReplyToClientModal
                client={client}
                trainerId={trainer.id}
                onClose={() => setReplying(false)}
                onSent={(resolved) => {
                  if (resolved) setClient((c) => (c ? { ...c, status_flag: "green", status_flag_note: null } : c));
                  loadMessages();
                  reloadProblems();
                }}
              />
            )}

            {/* The rest under tap-to-open headings (review 2026-10-18: GRIZZ hates scrolling). */}
            <FoldSection
              icon="💳"
              title="Plan & payment"
              hint={
                client.plan_type
                  ? `${PLAN_LABEL[client.plan_type] ?? "12 Month"} plan${client.plan_expires_at ? ` · ends ${new Date(client.plan_expires_at).toLocaleDateString()}` : ""}`
                  : "No plan picked"
              }
              open={overviewOpen === "plan"}
              onToggle={() => toggleOverview("plan")}
            >
              <ClientPricePicker
                clientId={client.id}
                value={client.price_package}
                onChanged={(next) => setClient((c) => (c ? { ...c, price_package: next } : c))}
              />
              {client.package_type && (
                <Text style={styles.helper}>
                  At sign-up they ticked "{PACKAGE_LABEL[client.package_type] ?? client.package_type}". That's only for reference: "What they pay you" above is the one that counts.
                </Text>
              )}
              {client.plan_type && (
                <View style={styles.planBox}>
                  <Text style={styles.planLabel}>{PLAN_LABEL[client.plan_type] ?? "12 Month"} Plan</Text>
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
                  {!client.archived_at && (
                    <View style={styles.planButtons}>
                      <Pressable style={styles.planButton} onPress={renewPlan}>
                        <Text style={styles.planButtonText}>{client.access_status === "expired" ? "Paid: activate" : "Paid: renew plan"}</Text>
                      </Pressable>
                      {client.access_status !== "expired" && (
                        <Pressable style={styles.planButtonDanger} onPress={markExpired}>
                          <Text style={styles.planButtonDangerText}>Mark expired</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              )}
            </FoldSection>

            <FoldSection
              icon="🌿"
              title={`12-Week ${resetName(client.sex)}`}
              hint={
                (client.lifestyle_reset_started_at
                  ? client.reset_started_on
                    ? `On week ${Math.min(resetWeekNumber(client.reset_started_on, todayIso()), RESET_WEEKS_TOTAL)}`
                    : "Enrolled, waiting for them to tap Start"
                  : "Not enrolled") +
                (client.intake_responses?.high_stress_or_anxiety === "Yes" ? " · ⚠️ stressed or anxious (intake)" : "")
              }
              open={overviewOpen === "reset"}
              onToggle={() => toggleOverview("reset")}
            >
              <View style={styles.resetBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.helper}>
                    {client.lifestyle_reset_started_at
                      ? client.reset_started_on
                        ? `On week ${Math.min(resetWeekNumber(client.reset_started_on, todayIso()), RESET_WEEKS_TOTAL)} (started ${client.reset_started_on})`
                        : "Enrolled. Waiting for them to tap Start"
                      : "Not enrolled"}
                  </Text>
                </View>
                <Pressable style={styles.resetButton} onPress={toggleLifestyleReset}>
                  <Text style={styles.resetButtonText}>
                    {client.lifestyle_reset_started_at ? "End program" : "Enroll"}
                  </Text>
                </Pressable>
              </View>
              {client.intake_responses?.high_stress_or_anxiety === "Yes" && (
                <View style={styles.stressFlag}>
                  <Text style={styles.stressFlagText}>
                    ⚠️ On the intake form they said they often feel highly stressed or suffer with anxiety.
                    {!client.lifestyle_reset_started_at
                      ? ` The ${resetName(client.sex)} could be a good fit: tap Enroll above.`
                      : " Ease them in and keep an eye on sleep and recovery."}
                  </Text>
                </View>
              )}
              {client.reset_started_on && client.lifestyle_reset_started_at && (
                <View style={styles.resetNotes}>
                  <Text style={styles.resetTitle}>Reset notes</Text>
                  <TrainerResetNotes clientId={client.id} />
                </View>
              )}
            </FoldSection>

            <FoldSection
              icon="🩹"
              title="Injuries"
              hint={client.injuries && !client.injuries_healed_on ? `Noted earlier: ${client.injuries}` : null}
              open={overviewOpen === "injuries"}
              onToggle={() => toggleOverview("injuries")}
            >
              {client.injuries && (
                <Text style={styles.body}>
                  Injuries (noted earlier): {client.injuries}
                  {client.injuries_healed_on ? ` (healed ${client.injuries_healed_on})` : ""}{" "}
                  {/* Marking it healed stops the injury check flagging it (0119). */}
                  <Text
                    style={{ color: BRAND_GOLD, fontWeight: "700" }}
                    onPress={async () => {
                      const healed = client.injuries_healed_on ? null : todayIso();
                      const { error } = await supabase.from("clients").update({ injuries_healed_on: healed }).eq("id", client.id);
                      if (error) Alert.alert("Couldn't save", error.message);
                      else {
                        setClient((c) => (c ? { ...c, injuries_healed_on: healed } : c));
                        setInjuryKey((k) => k + 1);
                      }
                    }}
                  >
                    {client.injuries_healed_on ? "Not healed" : "Mark healed"}
                  </Text>
                </Text>
              )}
              <InjuryList clientId={client.id} role="trainer" clientName={client.name} onChanged={() => setInjuryKey((k) => k + 1)} />
              {client.injuries && !client.injuries_healed_on && stabilityAreasFor(client.injuries).length > 0 && <RehabSuggestion clientName={client.name} texts={[client.injuries]} />}
            </FoldSection>

            <FoldSection
              icon="🎯"
              title="Goals"
              hint={clientGoals(client) || "None yet"}
              open={overviewOpen === "goals"}
              onToggle={() => toggleOverview("goals")}
            >
              {goalsDraft === null ? (
                <Pressable onPress={() => setGoalsDraft(clientGoals(client))} hitSlop={6}>
                  <Text style={styles.body}>{clientGoals(client) || "None yet."}</Text>
                  <Text style={styles.editLink}>Edit goals</Text>
                </Pressable>
              ) : (
                <>
                  <TextInput
                    style={styles.textInput}
                    multiline
                    maxLength={500}
                    value={goalsDraft}
                    onChangeText={setGoalsDraft}
                    placeholder="e.g. Lose 8kg by March, deadlift 100kg"
                    placeholderTextColor="#64748B"
                  />
                  <View style={styles.planButtons}>
                    <Pressable style={styles.planButton} onPress={saveGoals}>
                      <Text style={styles.planButtonText}>Save goals</Text>
                    </Pressable>
                    <Pressable onPress={() => setGoalsDraft(null)} hitSlop={6}>
                      <Text style={styles.editLink}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </FoldSection>

            <FoldSection
              icon="📝"
              title="Intake form"
              hint={Object.keys(client.intake_responses ?? {}).length === 0 ? "Not filled in yet" : null}
              open={overviewOpen === "intake"}
              onToggle={() => toggleOverview("intake")}
            >
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
            </FoldSection>

            {!client.archived_at && (
              <FoldSection icon="🗄" title="Archive" open={overviewOpen === "archive"} onToggle={() => toggleOverview("archive")}>
                <Text style={styles.helper}>For a client who has stopped. Nothing is deleted and you can bring them back.</Text>
                <Pressable style={styles.archiveButton} onPress={archiveOrBringBack}>
                  <Text style={styles.archiveButtonText}>🗄 Archive this client</Text>
                </Pressable>
              </FoldSection>
            )}
          </>
        )}
        {tab === "checkins" && (
          <>
            {/* Body and mind reports here, where the red dot is (review 2026-10-18). */}
            <WellbeingReports clientId={client.id} clientName={client.name} />
            <CheckinFeedbackCard feedback={checkinFeedback(checkins, todayIso(), intakeDetails(client).weight_kg)} forTrainer />
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
                  {c.sleep_bed_time && c.sleep_wake_time ? ` · Bed ${c.sleep_bed_time.slice(0, 5)}, up ${c.sleep_wake_time.slice(0, 5)}` : ""}
                  {` · Meals ${c.meals_total}`}
                  {c.pain_status === "reported" ? " · 🩹 Pain" : ""}
                  {c.fatigue_status === "reported" ? " · 😴 Tired" : ""}
                  {c.mental_status === "reported" ? " · 🧠 Stressed" : ""}
                </Text>
              </View>
            ))}
          </>
        )}
        {tab === "habits" && (
          <>
            <Text style={styles.sectionHeading}>Habits</Text>
            <Text style={styles.helper}>
              Habits you set stay until you remove them. Clients can also choose their own habits from a list
              (marked "Chosen by client") and stop those themselves.
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
                      {h.end_date ? ` · ${h.end_date < todayIso() ? "Stopped" : "Ends"} ${h.end_date}` : ""}
                      {h.chosen_by_client ? " · Chosen by client" : ""}
                    </Text>
                  </View>
                  <Pressable onPress={() => confirmDeleteHabit(h)}>
                    <Text style={styles.habitDelete}>Remove</Text>
                  </Pressable>
                </View>
              );
            })}

            <View style={styles.addHabitBox}>
              <Text style={styles.addHabitTitle}>Add a habit</Text>
              <HabitOptionsPicker
                habits={habits}
                selected={newHabitName}
                onPick={(name, reps) => {
                  setNewHabitName(name);
                  setNewHabitReps(reps);
                }}
                onAdd={addHabit}
                adding={addingHabit}
              />
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

              {/* Quick taps instead of typed dates (review 2026-10-18), so a typo can't break it. */}
              <Text style={styles.fieldLabel}>Starts</Text>
              <View style={styles.chipRow}>
                {habitStartChoices(todayIso()).map((c) => (
                  <Pressable key={c.label} style={[styles.dateChip, newHabitStart === c.date && styles.dateChipOn]} onPress={() => setNewHabitStart(c.date)}>
                    <Text style={[styles.dateChipText, newHabitStart === c.date && styles.dateChipTextOn]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>How long</Text>
              <View style={styles.chipRow}>
                {HABIT_LENGTHS.map((w) => (
                  <Pressable key={String(w)} style={[styles.dateChip, newHabitWeeks === w && styles.dateChipOn]} onPress={() => setNewHabitWeeks(w)}>
                    <Text style={[styles.dateChipText, newHabitWeeks === w && styles.dateChipTextOn]}>{habitLengthLabel(w)}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={styles.button} onPress={addHabit} disabled={addingHabit}>
                {addingHabit ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Add habit</Text>}
              </Pressable>
            </View>
          </>
        )}
        {tab === "training" && (
          <>
            <RecoveryCheckCard clientId={client.id} clientName={client.name} />
            <FoundationOfferCard
              client={client}
              onChanged={(change) => {
                setClient((c) => (c ? { ...c, ...change } : c));
                if (change.foundation_status === "approved") {
                  // The calendar reloads with the new program, and the injury check runs.
                  setProgramKey((k) => k + 1);
                  planChanged();
                }
              }}
            />
            <InjuryCheckCard
              key={injuryKey}
              clientId={client.id}
              clientName={client.name}
              injuries={client.injuries_healed_on ? null : client.injuries}
              trainingPlace={client.training_place}
              refreshKey={planKey}
              onAreas={setInjuredAreas}
            />
            <ExercisePainList clientId={client.id} clientName={client.name} />
            {/* Calendar first (GRIZZ, 2026-10-17): tap a day to start a program. The rest is tucked under tap-to-open headings. */}
            <ClientCalendarCard
              key={programKey}
              clientId={client.id}
              clientName={client.name}
              trainingPlace={client.training_place}
              resetNotice={resetNotice(client, todayIso())}
              trainerId={trainer?.id}
              onStabilityStarted={() => setStabilityKey((k) => k + 1)}
              onPlanChanged={planChanged}
              injuries={injuredAreas}
              stabilityKey={stabilityDaysKey}
            />
            {/* Right under the calendar, so the trainer sees how to tell the client (GRIZZ, 2026-10-19). */}
            {trainer && <WorkoutsSavedButton clientId={client.id} clientName={client.name} trainerId={trainer.id} />}
            <TrainerStabilityCard
              key={stabilityKey}
              clientId={client.id}
              clientName={client.name}
              trainerId={trainer?.id}
              onChanged={() => setStabilityDaysKey((k) => k + 1)}
            />
            <TrainingSection title="🎥 Form videos" open={trainingOpen === "videos"} onToggle={() => toggleTraining("videos")}>
              {trainer && <ClientFormVideos client={client} trainerId={trainer.id} />}
            </TrainingSection>
            <TrainingSection title="🏃 Other exercise" open={trainingOpen === "other"} onToggle={() => toggleTraining("other")}>
              <OtherActivityCard clientId={client.id} role="trainer" />
            </TrainingSection>
            <TrainingSection title="🌿 Recovery" open={trainingOpen === "recovery"} onToggle={() => toggleTraining("recovery")}>
              <RecoveryCoachCard
                clientId={client.id}
                clientName={client.name}
                program={client.recovery_program}
                onProgramChanged={(next) => setClient((c) => (c ? { ...c, recovery_program: next } : c))}
              />
            </TrainingSection>
            <TrainingSection title="🏠 Where they train" open={trainingOpen === "place"} onToggle={() => toggleTraining("place")}>
              <View style={{ marginTop: 12 }}>
                <Text style={styles.libraryTitle}>Trains at</Text>
                <Text style={[styles.helper, { marginBottom: 8 }]}>
                  {client.training_place === "home"
                    ? `The program list shows home programs first. Gym-only exercises in ${client.name}'s program are swapped for home ones of the same body part that their equipment list covers.`
                    : `The program list shows gym programs first. ${client.name} does their program as written.`}
                </Text>
                <GymHomeTabs current={client.training_place} onChange={setTrainingPlace} accent={BRAND_GOLD} />
              </View>
              {client.training_place === "home" && (
                <HomeEquipmentCard
                  client={client}
                  trainer
                  onChanged={(items) => setClient((c) => (c ? { ...c, home_equipment: items } : c))}
                />
              )}
            </TrainingSection>
            <TrainingSection title="📈 Training log, last 2 weeks" open={trainingOpen === "log"} onToggle={() => toggleTraining("log")}>
              <TrainerTrainingLog logs={workoutLogs} sessions={workoutSessions} />
              <DropSetRoundsCard clientId={client.id} />
            </TrainingSection>
            <TrainingSection title="⚙️ More options" open={trainingOpen === "more"} onToggle={() => toggleTraining("more")}>
              <ClientProgramPicker
                key={programKey}
                clientId={client.id}
                clientName={client.name}
                trainingPlace={client.training_place}
                injuries={injuredAreas}
              />
              <View style={styles.libraryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.libraryTitle}>Abs between sets</Text>
                  <Text style={styles.helper}>
                    Ab reps after every set on the upper body, lower body, full body, Chest & Bi and Back & Tri workouts, and on your own programs where you added abs. The rest timer starts when {client.name} taps Complete.
                  </Text>
                </View>
                <Switch
                  value={client.abs_between_sets !== false}
                  onValueChange={toggleAbs}
                  trackColor={{ true: BRAND_GOLD, false: "#334155" }}
                  accessibilityLabel="Abs between sets"
                />
              </View>
              <View style={styles.libraryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.libraryTitle}>Full workout video library</Text>
                  <Text style={styles.helper}>Switch this on to allow client access to full workout videos. Not suggested.</Text>
                </View>
                <Switch
                  value={client.library_access}
                  onValueChange={toggleLibraryAccess}
                  trackColor={{ true: BRAND_GOLD, false: "#334155" }}
                  accessibilityLabel="Full workout video library"
                />
              </View>
            </TrainingSection>
          </>
        )}
        {tab === "diet" && (
          <>
            <DietPlanner client={client} onDirtyChange={setDietDirty} />
            <ClientOwnMealPlan clientId={client.id} clientName={client.name} />
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
            <Text style={styles.sectionHeading}>Private notes</Text>
            <Text style={styles.notesHelper}>Only you see these.</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              value={notes}
              onChangeText={(text) => {
                setNotes(text);
                setNotesSaved(false);
              }}
              placeholder="Private notes about this client"
              placeholderTextColor="#64748B"
            />
            <Pressable style={styles.button} onPress={saveNotes} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.buttonText}>{notesSaved ? "✓ Notes saved" : "Save notes"}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>

      <ScreenTabBar
        current={tab}
        onChange={(next) => (next === tab ? undefined : confirmLeaveDiet(() => setTab(next)))}
        tabs={TABS.map((t) => ({
          ...t,
          dot:
            t.key === "overview"
              ? (problemColor(problemLevel(problems)) ?? null)
              : t.key === "checkins"
                ? (problemColor(problemLevel(problems.filter((p) => p.topic !== "flag"))) ?? null)
                : null,
        }))}
      />
    </View>
  );
}

const LEVEL_LOOK: Record<string, { emoji: string; color: string }> = {
  never: { emoji: "🌱", color: "#22C55E" },
  beginner: { emoji: "🌱", color: "#22C55E" },
  intermediate: { emoji: "💪", color: "#F59E0B" },
  advanced: { emoji: "🔥", color: "#EF4444" },
};

// The client's training experience from their intake form, at the top of the
// Overview so the trainer is reminded every time they open the client
// (GRIZZ, 2026-10-14).
// A tap-to-open heading on the Training tab.
function TrainingSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <View style={[styles.trainingSection, open && styles.trainingSectionOpen]}>
      <Pressable style={styles.trainingSectionHeader} onPress={onToggle} accessibilityRole="button">
        <Text style={styles.trainingSectionTitle}>{title}</Text>
        <Text style={styles.trainingSectionChevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open && <View style={styles.trainingSectionBody}>{children}</View>}
    </View>
  );
}

function TrainingLevelBanner({ level }: { level: Client["training_level"] }) {
  const look = (level && LEVEL_LOOK[level]) || { emoji: "❔", color: "#64748B" };
  const detail = TRAINING_LEVELS.find((l) => l.key === level)?.detail;
  return (
    <View style={[styles.levelBanner, { borderColor: look.color }]}>
      <Text style={styles.levelEmoji}>{look.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.levelKicker}>TRAINING LEVEL</Text>
        <Text style={[styles.levelName, { color: look.color }]}>{levelLabel(level)}</Text>
        {detail ? <Text style={styles.levelDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  archivedBanner: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 12 },
  archivedText: { color: "#CBD5E1", fontSize: 13 },
  archiveButton: { borderWidth: 1, borderColor: "#475569", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 24 },
  archiveButtonText: { color: "#94A3B8", fontWeight: "600" },
  levelBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  levelEmoji: { fontSize: 30 },
  levelKicker: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  levelName: { fontSize: 20, fontWeight: "800", marginTop: 1 },
  levelDetail: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  stressFlag: { backgroundColor: "#422006", borderRadius: 10, padding: 12, marginBottom: 12 },
  stressFlagText: { color: "#FDE68A", fontSize: 13, lineHeight: 18 },
  libraryRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12 },
  libraryTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  memberSince: { color: BRAND_GOLD, fontSize: 13, fontWeight: "600" },
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
  planButtons: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 10 },
  planButton: { backgroundColor: "#22C55E", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  planButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
  planButtonDanger: { borderWidth: 1, borderColor: "#EF4444", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  planButtonDangerText: { color: "#EF4444", fontWeight: "700", fontSize: 12 },
  editLink: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginTop: 4, marginBottom: 8 },
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
  resetNotes: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8 },
  resetButton: { backgroundColor: "#22C55E", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  resetButtonText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  body: { color: "#E2E8F0", fontSize: 14, marginBottom: 4 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 20, marginBottom: 8 },
  trainingSection: { backgroundColor: "#111C33", borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: "#1E293B" },
  trainingSectionOpen: { borderColor: BRAND_GOLD },
  trainingSectionHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  trainingSectionTitle: { color: "#fff", fontWeight: "800", fontSize: 16, flex: 1 },
  trainingSectionChevron: { color: "#94A3B8", fontSize: 18 },
  trainingSectionBody: { paddingHorizontal: 10, paddingBottom: 12 },
  flex1: { flex: 1 },
  messageRow: { backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginBottom: 6 },
  intakeBox: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12 },
  intakeRow: { marginBottom: 10 },
  intakeLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 2 },
  intakeValue: { color: "#E2E8F0", fontSize: 14 },
  notesHelper: { color: "#64748B", fontSize: 12, marginBottom: 8 },
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateChip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  dateChipOn: { backgroundColor: BRAND_GOLD },
  dateChipText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13 },
  dateChipTextOn: { color: "#0F172A" },
});
