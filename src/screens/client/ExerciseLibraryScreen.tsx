import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Linking, Pressable } from "react-native";
import { supabase } from "@/lib/supabase";
import type { Exercise } from "@/types/database";

export default function ExerciseLibraryScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("exercises").select("*").order("sort_order");
      if (!error && data) setExercises(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Exercise reference</Text>
      <FlatList
        data={exercises}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            disabled={!item.external_url}
            onPress={() => item.external_url && Linking.openURL(item.external_url)}
          >
            <View>
              <Text style={styles.name}>{item.name}</Text>
              {item.category && <Text style={styles.category}>{item.category}</Text>}
            </View>
            <Text style={styles.link}>{item.external_url ? "View >" : "Ask your trainer"}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  name: { color: "#fff", fontWeight: "600" },
  category: { color: "#64748B", fontSize: 12, marginTop: 2 },
  link: { color: "#22C55E", fontSize: 13 },
});
