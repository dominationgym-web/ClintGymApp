import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { ScrollView } from "@/components/ScrollView";
import ModalSafeArea from "@/components/ModalSafeArea";
import SafeBottom from "@/components/SafeBottom";
import ProgramSummary from "@/components/ProgramSummary";
import PlanProgramModal from "@/components/PlanProgramModal";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { resetNotice } from "@/lib/resetProgram";
import { intakeTrainingDays } from "@/lib/intakePages";
import { slotOf } from "@/lib/programs";
import { useAuth } from "@/context/AuthContext";
import { useStepBack } from "@/hooks/useStepBack";
import { themeText, themedStyles } from "@/lib/theme";
import type { Client, Program, ProgramExercise } from "@/types/database";

// A program's whole week on one screen (GRIZZ, 2026-11-16), from the Programs
// tab. "If the trainer likes the program he should have the option to select
// the program off that screen": Give to a client picks the client, then the
// usual day planner opens with this program already picked, so it goes on
// their calendar from today.
export default function ProgramWeekModal({
  program,
  exercises,
  loadFailed,
  onRetry,
  programs,
  onPressExercise,
  onClose,
  children,
}: {
  program: Program | null;
  /** null while loading. */
  exercises: ProgramExercise[] | null;
  loadFailed: boolean;
  onRetry: () => void;
  /** Every program, for the planner's "comes off" check. */
  programs: Program[];
  /** The trainer's own program: tapping an exercise changes it. */
  onPressExercise?: (row: ProgramExercise) => void;
  onClose: () => void;
  /** Pop-ups opened from this screen (they must sit inside its Modal on iPhone). */
  children?: React.ReactNode;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const { trainer } = useAuth();
  const [picking, setPicking] = useState(false);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [planFor, setPlanFor] = useState<Client | null>(null);
  useStepBack(!!program && !picking && !planFor, onClose);
  useStepBack(picking, () => setPicking(false));

  const workouts = exercises ? new Set(exercises.filter((e) => e.kind !== "cardio").map(slotOf)).size : 0;
  const weeks = program?.weeks ?? 1;
  const perWeek = weeks > 1 ? Math.round(workouts / weeks) : workouts;
  const subtitle = program
    ? [
        program.kind === "weekly" && perWeek > 0 ? `${perWeek} workout${perWeek === 1 ? "" : "s"} a week` : null,
        weeks > 1 ? `${weeks} weeks` : null,
      ]
        .filter(Boolean)
        .concat(onPressExercise ? "tap to change, ▶ to watch" : "tap an exercise to watch it")
        .join(" · ")
    : "";

  const pickClient = async () => {
    setPicking(true);
    setClients(null);
    const { data } = await supabase.from("clients").select("*").is("archived_at", null).order("name");
    setClients(((data ?? []) as Client[]).filter((c) => !c.live_only && c.access_status !== "expired"));
  };

  const done = () => {
    const client = planFor;
    setPlanFor(null);
    if (!client || !program) return;
    const first = client.name.split(" ")[0];
    Alert.alert("Program given", `${first} is on ${program.name}. It's on their calendar from today.`, [
      { text: "OK" },
      {
        text: `Open ${first}'s calendar`,
        onPress: () => {
          onClose();
          navigation.navigate("ClientDetail", { clientId: client.id, tab: "training" });
        },
      },
    ]);
  };

  return (
    <Modal visible={!!program} animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={styles.modal}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Back">
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {program?.name}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {program && exercises ? (
            <ProgramSummary program={program} exercises={exercises} onPressExercise={onPressExercise} hideHint />
          ) : loadFailed ? (
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={styles.failed}>Couldn't load the exercises. Tap to try again.</Text>
            </Pressable>
          ) : (
            <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 20 }} />
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable style={styles.give} onPress={pickClient} accessibilityRole="button">
            <Text style={styles.giveText}>Give this program to a client</Text>
          </Pressable>
        </View>
      </ModalSafeArea>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Who gets {program?.name}?</Text>
            <Text style={styles.meta}>Next you pick the days they train, and it goes on their calendar from today.</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {clients === null ? <Text style={styles.meta}>Loading…</Text> : null}
              {clients?.length === 0 ? <Text style={styles.meta}>No clients yet.</Text> : null}
              {clients?.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.row}
                  onPress={() => {
                    setPicking(false);
                    setPlanFor(c);
                  }}
                >
                  <Text style={styles.rowText}>{c.name}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPicking(false)} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
            <SafeBottom />
          </Pressable>
        </Pressable>
      </Modal>

      {planFor && program ? (
        <PlanProgramModal
          date={todayIso()}
          clientId={planFor.id}
          clientName={planFor.name.split(" ")[0]}
          trainerId={trainer?.id}
          trainingPlace={planFor.training_place}
          trainingLevel={planFor.training_level}
          clientDays={intakeTrainingDays(planFor.intake_responses)}
          programs={programs}
          resetNotice={resetNotice(planFor, todayIso())}
          startWith={program}
          onDone={done}
          onClose={() => setPlanFor(null)}
        />
      ) : null}
      {children}
    </Modal>
  );
}

const styles = themedStyles({
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 2 },
  back: { color: BRAND_GOLD, fontSize: 28, fontWeight: "800", lineHeight: 30 },
  title: { color: "#fff", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "#94A3B8", fontSize: 12 },
  failed: { color: "#F87171", fontSize: 13, fontWeight: "600", marginTop: 12 },
  footer: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, borderTopWidth: 1, borderTopColor: "#1E293B" },
  give: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  giveText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  meta: { color: "#94A3B8", fontSize: 13, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 8 },
  rowText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  chevron: { color: BRAND_GOLD, fontWeight: "800", fontSize: 16 },
  close: { padding: 12, alignItems: "center" },
  closeText: { color: "#94A3B8", fontWeight: "700" },
});
