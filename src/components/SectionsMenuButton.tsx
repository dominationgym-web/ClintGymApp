import React, { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "@/navigation/types";
import { SECTIONS } from "@/lib/sections";

// The "three lines" button in the top right of every client tab. It drops down
// a list of the extra sections (Nutrition, Supplementation, ...) that don't
// warrant their own tab at the bottom.
export default function SectionsMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <View style={styles.bar} />
        <View style={styles.bar} />
        <View style={styles.bar} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close menu">
          {/* A Pressable with no onPress, so taps on the menu itself don't close it. */}
          <Pressable style={[styles.menu, { marginTop: insets.top + 52 }]}>
            <Text style={styles.menuHeading}>More</Text>
            {SECTIONS.map((section) => (
              <Pressable
                key={section.key}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => {
                  setOpen(false);
                  navigation.navigate("Section", { sectionKey: section.key });
                }}
                accessibilityRole="button"
              >
                <Text style={styles.itemTitle}>{section.title}</Text>
                <Text style={styles.itemSummary}>{section.summary}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { marginRight: 16, paddingVertical: 4, gap: 4 },
  bar: { width: 22, height: 2.5, borderRadius: 2, backgroundColor: "#fff" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "flex-end" },
  menu: {
    marginRight: 12,
    width: 280,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 8,
  },
  menuHeading: { color: "#64748B", fontSize: 12, fontWeight: "700", paddingHorizontal: 16, paddingVertical: 8 },
  item: { paddingHorizontal: 16, paddingVertical: 12 },
  itemPressed: { backgroundColor: "#334155" },
  itemTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  itemSummary: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
});
