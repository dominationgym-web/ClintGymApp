import React, { useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";

export type SearchItem = {
  key: string;
  title: string;
  subtitle?: string | null;
  // Opens the thing found. Exercises leave it out and play their video instead.
  onPress?: () => void;
  videoUrl?: string | null;
};

export type SearchGroup = { title: string; data: SearchItem[] };

// The search box and its results, grouped (Pages, Guides, Exercises, ...).
// Shared by the client and trainer search screens.
export default function SearchResults({
  query,
  onChangeQuery,
  groups,
  loading,
  placeholder,
  accent,
}: {
  query: string;
  onChangeQuery: (q: string) => void;
  groups: SearchGroup[];
  loading: boolean;
  placeholder: string;
  accent: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const shown = groups.filter((g) => g.data.length > 0);
  const searching = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={onChangeQuery}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        autoFocus
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 24 }} />
      ) : (
        <SectionList
          sections={shown}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderSectionHeader={({ section }) => <Text style={styles.groupTitle}>{section.title.toUpperCase()}</Text>}
          ListEmptyComponent={
            <Text style={styles.helper}>{searching ? `Nothing found for "${query.trim()}".` : "Type a word, e.g. squat, sleep or photos."}</Text>
          }
          renderItem={({ item }) => {
            const isVideo = !item.onPress;
            const open = playing === item.key;
            return (
              <Pressable
                style={styles.row}
                onPress={item.onPress ?? (() => setPlaying(open ? null : item.key))}
                accessibilityRole="button"
              >
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={styles.subtitle} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.action, { color: accent }]}>{isVideo ? (open ? "Hide" : "▶ Watch") : "Open ›"}</Text>
                </View>
                {isVideo && open && <ExerciseVideoPreview url={item.videoUrl ?? null} />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 16, paddingTop: 12 },
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  groupTitle: { color: "#64748B", fontSize: 12, fontWeight: "700", marginTop: 16, marginBottom: 6 },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  subtitle: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  action: { fontWeight: "700", fontSize: 13 },
  helper: { color: "#94A3B8", fontSize: 14, marginTop: 16, textAlign: "center" },
});
