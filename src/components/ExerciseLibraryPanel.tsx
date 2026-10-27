import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import ExerciseClip from "@/components/ExerciseClip";
import GymHomeTabs from "@/components/GymHomeTabs";
import { filterExercises, forPlace, type ExercisePlace } from "@/lib/exerciseFilter";
import { BRAND_GOLD } from "@/lib/brand";
import type { Exercise } from "@/types/database";

const PER_PAGE = 12;

// The exercise library beside the program builder on a laptop (GRIZZ,
// 2026-10-27): every exercise shows its demo clip playing small, so there's no
// opening each one to check it. A page of 12 at a time, no long scrolling.
export default function ExerciseLibraryPanel({
  library,
  place,
  onPlaceChange,
  onAdd,
  target,
}: {
  library: Exercise[];
  place: ExercisePlace;
  onPlaceChange: (place: ExercisePlace) => void;
  onAdd: (exercise: Exercise) => void;
  // Where Add puts it, e.g. "Exercise 3 · Mon".
  target: string;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [big, setBig] = useState<Exercise | null>(null);

  const categories = useMemo(
    () => [...new Set(library.map((e) => e.category).filter((c): c is string => !!c))].sort(),
    [library],
  );
  // The ones with a clip first, so a page is all videos.
  const shown = filterExercises(forPlace(library, place), search, category).sort(
    (a, b) => Number(!a.external_url) - Number(!b.external_url),
  );
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  useEffect(() => setPage(0), [search, category, place]);
  const onPage = shown.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Exercise videos</Text>
        <Text style={styles.target}>
          Add puts it in <Text style={styles.targetName}>{target}</Text>
        </Text>
        <GymHomeTabs current={place} onChange={onPlaceChange} accent={BRAND_GOLD} />
        <TextInput
          style={styles.search}
          placeholder="Search, e.g. squat or Legs"
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.chips}>
          {[null, ...categories].map((c) => {
            const on = c === category;
            return (
              <Pressable key={c ?? "all"} style={[styles.chip, on && styles.chipOn]} onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c ?? "All"}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.grid}>
          {onPage.map((e) => (
            <View key={e.id} style={styles.card}>
              <Pressable onPress={() => setBig(e)} accessibilityLabel={`Watch ${e.name} bigger`}>
                <ExerciseClip url={e.external_url} height={88} />
              </Pressable>
              <Text style={styles.name} numberOfLines={2}>
                {e.name}
              </Text>
              {e.category ? <Text style={styles.category}>{e.category}</Text> : null}
              <Pressable style={styles.add} onPress={() => onAdd(e)} accessibilityRole="button" accessibilityLabel={`Add ${e.name}`}>
                <Text style={styles.addText}>+ Add</Text>
              </Pressable>
            </View>
          ))}
          {onPage.length === 0 ? <Text style={styles.none}>No exercises match that search.</Text> : null}
        </View>

        <View style={styles.pager}>
          <Pressable disabled={page === 0} onPress={() => setPage(page - 1)} style={[styles.pageButton, page === 0 && styles.off]}>
            <Text style={styles.pageText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.pageCount}>
            Page {page + 1} of {pages} · {shown.length} exercises
          </Text>
          <Pressable
            disabled={page >= pages - 1}
            onPress={() => setPage(page + 1)}
            style={[styles.pageButton, page >= pages - 1 && styles.off]}
          >
            <Text style={styles.pageText}>Next ›</Text>
          </Pressable>
        </View>
      </ScrollView>

      {big ? (
        // A bigger look at one clip, over the panel. Not a Modal, so nothing
        // can be left blocking the page.
        <Pressable style={styles.bigBackdrop} onPress={() => setBig(null)} accessibilityLabel="Close video">
          <Pressable style={styles.bigCard}>
            <Text style={styles.bigName}>{big.name}</Text>
            <ExerciseClip url={big.external_url} height={320} controls />
            <View style={styles.bigRow}>
              <Pressable
                style={styles.add}
                onPress={() => {
                  onAdd(big);
                  setBig(null);
                }}
              >
                <Text style={styles.addText}>+ Add to {target}</Text>
              </Pressable>
              <Pressable onPress={() => setBig(null)} hitSlop={8}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: "#0B1222" },
  inner: { padding: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  target: { color: "#94A3B8", fontSize: 13, marginTop: 4, marginBottom: 10 },
  targetName: { color: BRAND_GOLD, fontWeight: "700" },
  search: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#94A3B8", fontWeight: "600", fontSize: 12 },
  chipTextOn: { color: "#0F172A" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  card: { width: "23%", flexGrow: 1, maxWidth: "25%", backgroundColor: "#1E293B", borderRadius: 10, padding: 8 },
  name: { color: "#fff", fontWeight: "600", fontSize: 12, marginTop: 6 },
  category: { color: "#64748B", fontSize: 11, marginTop: 1 },
  add: { backgroundColor: BRAND_GOLD, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start", marginTop: 6 },
  addText: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
  none: { color: "#64748B", fontSize: 13 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  pageButton: { backgroundColor: "#1E293B", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  off: { opacity: 0.4 },
  pageText: { color: BRAND_GOLD, fontWeight: "700" },
  pageCount: { color: "#94A3B8", fontSize: 12 },
  bigBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  bigCard: { backgroundColor: "#0F172A", borderRadius: 14, borderWidth: 1.5, borderColor: BRAND_GOLD, padding: 16 },
  bigName: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  bigRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  close: { color: BRAND_GOLD, fontWeight: "600" },
});
