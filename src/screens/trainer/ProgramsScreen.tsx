import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { loadAvailablePrograms } from "@/lib/programQueries";
import ProgramSummary from "@/components/ProgramSummary";
import type { Program, ProgramExercise } from "@/types/database";
import type { TrainerTabScreenProps } from "@/navigation/types";

type Props = TrainerTabScreenProps<"Programs">;

const GROUPS: { title: string; hint: string; match: (p: Program) => boolean }[] = [
  { title: "Quick programs", hint: "30-40 minutes, for clients short on time.", match: (p) => !p.trainer_id && p.kind === "quick" },
  { title: "Weekly programs", hint: "A different session each day, repeating every week.", match: (p) => !p.trainer_id && p.kind === "weekly" },
  { title: "Your programs", hint: "Programs you built. Only you and your clients see these.", match: (p) => !!p.trainer_id },
];

// Every program a trainer can switch on for a client. Switching one on happens
// on the client's own screen (Training tab); this tab is for browsing and
// building.
export default function ProgramsScreen({ navigation }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      {GROUPS.map((g) => {
        const list = programs.filter(g.match);
        return (
          <View key={g.title}>
            <Text style={styles.sectionHeading}>{g.title}</Text>
            <Text style={styles.helper}>{g.hint}</Text>
            {list.length === 0 && <Text style={styles.helper}>None yet.</Text>}
            {list.map((p) => (
              <Pressable key={p.id} style={styles.card} onPress={() => setOpen(open === p.id ? null : p.id)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.link}>{open === p.id ? "Hide" : "Show"}</Text>
                </View>
                {p.description && <Text style={styles.description}>{p.description}</Text>}
                {open === p.id && (
                  <>
                    <ProgramSummary program={p} exercises={exercises.filter((e) => e.program_id === p.id)} />
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
  sectionHeading: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 16, marginBottom: 2 },
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  link: { color: BRAND_GOLD, fontSize: 13, fontWeight: "600" },
  description: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  delete: { color: "#F87171", fontSize: 13, fontWeight: "600", marginTop: 10 },
});
