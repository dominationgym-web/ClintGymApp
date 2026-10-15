import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";

// A tap-to-open heading for a long page, so the client sees a short list of
// headings instead of scrolling (GRIZZ dislikes scrolling). `hint` is a short
// line under the title, e.g. the current status.
export default function FoldSection({
  icon,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  hint?: string | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.fold, open && styles.foldOpen]}>
      <Pressable style={styles.header} onPress={onToggle}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  fold: { backgroundColor: "#111C33", borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: "#1E293B" },
  foldOpen: { borderColor: BRAND_GOLD },
  header: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  icon: { fontSize: 22 },
  title: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chevron: { color: "#94A3B8", fontSize: 18 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
});
