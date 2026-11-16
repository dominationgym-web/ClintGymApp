import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { loadAvailablePrograms, loadProgramExercises } from "@/lib/programQueries";
import ProgramWeekModal from "@/components/ProgramWeekModal";
import ResetPreviewModal from "@/components/reset/ResetPreviewModal";
import type { Program, ProgramExercise } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { ProgramGroup } from "@/lib/programs";
import { programCards } from "@/lib/programCards";
import ProgramCardView from "@/components/ProgramCardView";
import ProgramGroups from "@/components/ProgramGroups";
import GiveProgramButton from "@/components/GiveProgramButton";
import ProgramExerciseEditModal from "@/components/ProgramExerciseEditModal";
import { useAuth } from "@/context/AuthContext";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

type Props = TrainerTabScreenProps<"Programs">;

// Every program a trainer can switch on for a client, in three tap-to-open
// groups (Gym, Performance, Functional), each holding tap-to-open headings
// (Full body, Chest & Bi, ...) with just the program names; tap a name to
// see its details. Switching one on happens on the client's own screen
// (Training tab); this tab is for browsing and building.
export default function ProgramsScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  // The exercise being changed in one of the trainer's own workouts (0139).
  const [editing, setEditing] = useState<ProgramExercise | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<Record<string, ProgramExercise[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  // The opened program's whole week, on its own screen (GRIZZ, 2026-11-16).
  const [showWeek, setShowWeek] = useState(false);
  // The program whose exercises didn't load (no signal), so it shows a retry instead of spinning.
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<ProgramGroup | null>(null);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open !== null && !showWeek, () => setOpen(null));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [place, setPlace] = useState<ExercisePlace>("gym");
  // The 12-Week Health Reset, to look through before enrolling anyone (GRIZZ, 2026-11-16).
  const [showReset, setShowReset] = useState(false);

  // Exercises load one program at a time, when it's opened. Loading them all at
  // once hit the database's 1000-row limit, so most programs showed none.
  const load = useCallback(async () => {
    const list = await loadAvailablePrograms();
    setPrograms(list);
    setExercises({});
  }, []);

  useEffect(() => {
    if (!open || exercises[open]) return;
    let cancelled = false;
    loadProgramExercises(open).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setLoadFailed(open);
        return;
      }
      setExercises((prev) => ({ ...prev, [open]: data ?? [] }));
    });
    return () => {
      cancelled = true;
    };
  }, [open, exercises]);

  // Reload when coming back from the builder.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const remove = (p: Program) => {
    Alert.alert(`Delete "${p.name}"?`, "Any client on this program will be taken off it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("programs").delete().eq("id", p.id);
          if (error) Alert.alert("Couldn't delete", error.message);
          await load();
        },
      },
    ]);
  };

  const here = useMemo(() => programs.filter((p) => p.place === place), [programs, place]);
  // One version card per set (Chest & Bi 1-4 is one card with 1 2 3 4).
  const cards = useMemo(() => programCards(here), [here]);
  const hasOwn = cards.some((c) => c.family === "own");
  const opened = programs.find((p) => p.id === open) ?? null;
  const ownOpened = !!opened?.trainer_id && opened.trainer_id === trainer?.id;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={themeText("#22C55E")} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Pressable style={styles.buildButton} onPress={() => navigation.navigate("ProgramBuilder")}>
          <Text style={styles.buildButtonText}>+ Build a program</Text>
        </Pressable>
        <GiveProgramButton />
        <Pressable style={styles.shortcut} onPress={() => setShowReset(true)} accessibilityRole="button">
          <Text style={styles.shortcutText}>🌿 12-Week Health Reset (women and men) ›</Text>
          <Text style={styles.description}>Look through all 12 weeks and the training. Enroll a client from their Overview tab.</Text>
        </Pressable>
        <View style={{ marginTop: 8 }}>
          <GymHomeTabs
            current={place}
            onChange={(next) => {
              setPlace(next);
              setOpenGroup(null);
              setOpen(null);
            }}
            accent={BRAND_GOLD}
            labels={PROGRAM_PLACE_LABELS}
          />
        </View>

        <ProgramGroups
          place={place}
          families={cards}
          open={openGroup}
          onToggle={(g) => {
            setOpenGroup(g);
            setOpen(null);
          }}
          extra={{
            // "Your programs" shows even when empty, so trainers see where theirs go.
            gym: hasOwn ? undefined : (
              <Text style={styles.helper}>⭐ Your programs show here. Tap "+ Build a program" above.</Text>
            ),
            performance: (
              <Pressable
                style={styles.shortcut}
                onPress={() => navigation.navigate("TrainerGuide", { guideKey: "sportsPerformance" })}
              >
                <Text style={styles.shortcutText}>Who each Sports Performance program suits ›</Text>
              </Pressable>
            ),
            functional: (
              <Pressable style={styles.shortcut} onPress={() => navigation.navigate("Stability")}>
                <Text style={styles.shortcutText}>Stability & Rehab programming ›</Text>
                <Text style={styles.description}>
                  Ankle to neck, Rehab to Advanced. They run alongside the main program; give one from the client's
                  Training tab.
                </Text>
              </Pressable>
            ),
          }}
          renderFamily={(card) => {
            const p = card.options.find((o) => o.program.id === open)?.program;
            return (
              <ProgramCardView key={card.key} card={card} selectedId={open} onSelect={(next) => setOpen(open === next.id ? null : next.id)}>
                {p && (
                  <>
                    {p.description && <Text style={styles.description}>{p.description}</Text>}
                    {p.nutrition ? <Text style={styles.description}>Nutrition: {p.nutrition}</Text> : null}
                    <Pressable style={styles.weekButton} onPress={() => setShowWeek(true)} accessibilityRole="button">
                      <Text style={styles.weekButtonText}>See the whole week ›</Text>
                    </Pressable>
                    <Text style={styles.description}>
                      ⇄ Gym busy? Clients can change any exercise for another one of the same body part on their
                      workout screen. To change it for one client, tap it on that client's Training tab.
                    </Text>
                    {p.trainer_id && (
                      <Pressable onPress={() => remove(p)} hitSlop={8}>
                        <Text style={styles.delete}>Delete program</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </ProgramCardView>
            );
          }}
        />
      </ScrollView>
      <ProgramWeekModal
        program={showWeek ? opened : null}
        exercises={opened ? exercises[opened.id] ?? null : null}
        loadFailed={!!opened && loadFailed === opened.id}
        onRetry={() => {
          setLoadFailed(null);
          setExercises((prev) => ({ ...prev }));
        }}
        programs={programs}
        onPressExercise={ownOpened ? setEditing : undefined}
        onClose={() => setShowWeek(false)}
      >
        <ProgramExerciseEditModal
          row={editing}
          place={place}
          onClose={() => setEditing(null)}
          onSaved={() => {
            const programId = editing?.program_id;
            setEditing(null);
            // Reload the program, so the list shows the change.
            if (programId) setExercises(({ [programId]: _changed, ...rest }) => rest);
          }}
        />
      </ProgramWeekModal>
      <ResetPreviewModal visible={showReset} onClose={() => setShowReset(false)} place={place === "home" ? "home" : "gym"} />
    </>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  buildButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 8 },
  buildButtonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  description: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  shortcut: { backgroundColor: "#0B1220", borderRadius: 10, padding: 12, marginTop: 8 },
  shortcutText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  weekButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  weekButtonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  delete: { color: "#F87171", fontSize: 13, fontWeight: "600", marginTop: 10 },
});
