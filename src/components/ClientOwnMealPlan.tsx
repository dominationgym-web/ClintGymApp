import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import MealPlanMaker from "@/components/MealPlanMaker";
import type { Client } from "@/types/database";
import { themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// On the trainer's Diet tab (GRIZZ, 2026-11-02: "the trainer has control of
// the meal planning"): the trainer works out the client's meal plan with the
// meal plan maker (0077, 0182), under a tap-to-open heading. The client sees
// it under Nutrition and can swap foods, leave foods out and put in their own
// meals; those changes show here too.
export default function ClientOwnMealPlan({
  client,
  trainerId,
  onDetailsSaved,
}: {
  client: Client;
  trainerId: string;
  onDetailsSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open, () => setOpen(false));
  const first = client.name.trim().split(/\s+/)[0] || client.name;

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.title}>🤖 Work out {first}'s meal plan</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 10 }}>
          <MealPlanMaker forTrainer={{ client, trainerId, onDetailsSaved }} />
        </View>
      )}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },
  chevron: { color: BRAND_GOLD, fontSize: 14 },
});
