import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { loadAvailablePrograms } from "@/lib/programQueries";
import ProgramSummary from "@/components/ProgramSummary";
import type { Program, ProgramExercise } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import { PROGRAM_FAMILIES, programFamily, type ProgramFamily } from "@/lib/programs";

type Props = TrainerTabScreenProps<"Programs">;

// Every program a trainer can switch on for a client, as tap-to-open headings
// (Full body, Chest & Bi, ...) holding just the program names; tap a name to
// see its details. Switching one on happens on the client's own screen
// (Training tab); this tab is for browsing and building.
export default function ProgramsScreen({ navigation }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [openFamily, setOpenFamily] = useState<ProgramFamily | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [place, setPlace] = useState<ExercisePlace>("gym");

  const load = useCallback(async () => {
    const list = await loadAvailablePrograms();
    const { data } = list.length
      ? await supabase.from("program_exercises").select("*").in("program_id", list.map((p) => p.id))
      : { data: [] as ProgramExercise[] };
    setPrograms(list);
    setExercises(data ?? []);
  }, []);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
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
        <GymHomeTabs current={place} onChange={setPlace} accent={BRAND_GOLD} labels={PROGRAM_PLACE_LABELS} />
      </View>

      {PROGRAM_FAMILIES.map((f) => {
        const list = programs.filter((p) => p.place === place && programFamily(p) === f.key);
        if (list.length === 0 && f.key !== "own") return null;
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
                      <ProgramSummary program={p} exercises={exercises.filter((e) => e.program_id === p.id)} />
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
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  delete: { color: "#F87171", fontSize: 13, fontWeight: "600", marginTop: 10 },
});
