import React from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { PROGRAM_GROUPS, programGroupHeading, type ProgramGroup } from "@/lib/programs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import { themedStyles } from "@/lib/theme";

type GroupedFamily = { key: string; group: ProgramGroup; programs: unknown[] };

// The three tap-to-open groups (Gym, Performance, Functional) every program
// list starts with. Opening one shows its family headings, which the screen
// draws itself with renderFamily. `extra` adds a row inside a group, such as
// the stability shortcut under Functional.
export default function ProgramGroups<F extends GroupedFamily>({
  place,
  families,
  open,
  onToggle,
  renderFamily,
  extra,
}: {
  place: ExercisePlace;
  families: F[];
  open: ProgramGroup | null;
  onToggle: (group: ProgramGroup | null) => void;
  renderFamily: (family: F) => React.ReactNode;
  extra?: Partial<Record<ProgramGroup, React.ReactNode>>;
}) {
  return (
    <>
      {PROGRAM_GROUPS.map((g) => {
        const inGroup = families.filter((f) => f.group === g.key);
        const count = inGroup.reduce((n, f) => n + f.programs.length, 0);
        if (inGroup.length === 0 && !extra?.[g.key]) return null;
        const isOpen = open === g.key;
        const { title, icon } = programGroupHeading(g, place);
        return (
          <View key={g.key} style={[styles.group, isOpen && styles.groupOpen]}>
            <Pressable style={styles.header} onPress={() => onToggle(isOpen ? null : g.key)}>
              <Text style={styles.icon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.summary}>{g.summary}</Text>
              </View>
              <Text style={styles.count}>{count}</Text>
              <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
            </Pressable>
            {isOpen && (
              <View style={styles.body}>
                {inGroup.map((f) => (
                  <React.Fragment key={f.key}>{renderFamily(f)}</React.Fragment>
                ))}
                {extra?.[g.key]}
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

const styles = themedStyles({
  group: { backgroundColor: "#111C33", borderRadius: 14, marginTop: 10, borderWidth: 1, borderColor: "#1E293B" },
  groupOpen: { borderColor: BRAND_GOLD },
  header: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  icon: { fontSize: 26 },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  summary: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  count: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14 },
  chevron: { color: "#94A3B8", fontSize: 18 },
  body: { paddingHorizontal: 8, paddingBottom: 8 },
});
