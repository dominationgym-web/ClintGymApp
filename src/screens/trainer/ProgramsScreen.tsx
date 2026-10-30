import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { loadAvailablePrograms, loadProgramExercises } from "@/lib/programQueries";
import ProgramSummary from "@/components/ProgramSummary";
import type { Program, ProgramExercise } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import { PROGRAM_FAMILIES, programFamily, type ProgramFamily, type ProgramGroup } from "@/lib/programs";
import ProgramGroups from "@/components/ProgramGroups";
import ProgramExerciseEditModal from "@/components/ProgramExerciseEditModal";
import { useAuth } from "@/context/AuthContext";
import { themeText, themedStyles } from "@/lib/theme";

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
  // The program whose exercises didn't load (no signal), so it shows a retry instead of spinning.
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [openFamily, setOpenFamily] = useState<ProgramFamily | null>(null);
  const [openGroup, setOpenGroup] = useState<ProgramGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [place, setPlace] = useState<ExercisePlace>("gym");

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

  const here = programs.filter((p) => p.place === place);
  // "Your programs" shows even when empty, so trainers see where theirs go.
  const families = PROGRAM_FAMILIES.map((f) => ({ ...f, programs: here.filter((p) => programFamily(p) === f.key) })).filter(
    (f) => f.programs.length > 0 || f.key === "own",
  );

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
        <Text style={styles.helper}>To put a client on a program, open the client and go to their Training tab.</Text>
        <View style={{ marginTop: 8 }}>
          <GymHomeTabs
            current={place}
            onChange={(next) => {
              setPlace(next);
              setOpenGroup(null);
              setOpenFamily(null);
            }}
            accent={BRAND_GOLD}
            labels={PROGRAM_PLACE_LABELS}
          />
        </View>

        <ProgramGroups
          place={place}
          families={families}
          open={openGroup}
          onToggle={(g) => {
            setOpenGroup(g);
            setOpenFamily(null);
          }}
          extra={{
            performance: (
              <Pressable
                style={styles.shortcut}
                onPress={() => navigation.navigate("TrainerGuide", { guideKey: "sportsPerformance" })}
              >
                <Text style={styles.shortcutText}>🏅 Who each Sports Performance program suits ›</Text>
              </Pressable>
            ),
            functional: (
              <Pressable style={styles.shortcut} onPress={() => navigation.navigate("Stability")}>
                <Text style={styles.shortcutText}>🛡️ Stability & Rehab programming ›</Text>
                <Text style={styles.description}>
                  Ankle to neck, Rehab to Advanced. They run alongside the main program; give one from the client's
                  Training tab.
                </Text>
              </Pressable>
            ),
          }}
          renderFamily={(f) => {
            const list = f.programs;
            const familyOpen = openFamily === f.key;
            return (
              <View key={f.key} style={styles.family}>
                <Pressable style={styles.familyHeader} onPress={() => setOpenFamily(familyOpen ? null : f.key)}>
                  <Text style={styles.familyTitle}>
                    {f.icon} {f.title}
                  </Text>
                  <Text style={styles.count}>
                    {list.length} {familyOpen ? "▲" : "▼"}
                  </Text>
                </Pressable>
                {familyOpen && list.length === 0 && <Text style={styles.helper}>None yet. Tap "+ Build a program" above.</Text>}
                {familyOpen &&
                  list.map((p) => (
                    <Pressable key={p.id} style={styles.card} onPress={() => setOpen(open === p.id ? null : p.id)}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.name}>{p.name}</Text>
                        <Text style={styles.link}>{open === p.id ? "▲" : "▼"}</Text>
                      </View>
                      {open === p.id && (
                        <>
                          {p.description && <Text style={styles.description}>{p.description}</Text>}
                          {p.nutrition ? <Text style={styles.description}>🍽 Nutrition: {p.nutrition}</Text> : null}
                          {exercises[p.id] ? (
                            p.trainer_id && p.trainer_id === trainer?.id ? (
                              <ProgramSummary
                                program={p}
                                exercises={exercises[p.id]}
                                onPressExercise={setEditing}
                                tapHint="✎ Tap an exercise to change it for everyone on this workout, just for now or for good. Tap the green ▶ to watch it."
                              />
                            ) : (
                              <ProgramSummary program={p} exercises={exercises[p.id]} collapsible />
                            )
                          ) : loadFailed === p.id ? (
                            <Pressable
                              onPress={() => {
                                setLoadFailed(null);
                                setExercises((prev) => ({ ...prev }));
                              }}
                              hitSlop={8}
                            >
                              <Text style={styles.delete}>Couldn't load the exercises. Tap to try again.</Text>
                            </Pressable>
                          ) : (
                            <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 10 }} />
                          )}
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
                    </Pressable>
                  ))}
              </View>
            );
          }}
        />
      </ScrollView>
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
    </>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  buildButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 8 },
  buildButtonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  helper: { color: "#64748B", fontSize: 13, marginBottom: 8 },
  family: { marginTop: 10 },
  familyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
    padding: 14,
    marginBottom: 6,
  },
  familyTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  count: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700" },
  card: { backgroundColor: "#0B1220", borderRadius: 10, padding: 12, marginBottom: 6, marginLeft: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  link: { color: BRAND_GOLD, fontSize: 13, fontWeight: "600" },
  description: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  shortcut: { backgroundColor: "#0B1220", borderRadius: 10, padding: 12, marginTop: 8 },
  shortcutText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  delete: { color: "#F87171", fontSize: 13, fontWeight: "600", marginTop: 10 },
});
