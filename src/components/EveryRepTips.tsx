import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { EVERY_REP_TIPS } from "@/lib/exerciseTechnique";
import { themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// "Get the most from every rep": range of motion and muscle tension, tap to open.
export default function EveryRepTips() {
  const [open, setOpen] = useState(false);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open, () => setOpen(false));
  return (
    <View style={styles.box}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6}>
        <Text style={styles.title}>💪 Get the most from every rep {open ? "▲" : "▼"}</Text>
      </Pressable>
      {open &&
        EVERY_REP_TIPS.map((tip, i) => (
          <Text key={i} style={styles.tip}>
            • {tip}
          </Text>
        ))}
    </View>
  );
}

const styles = themedStyles({
  box: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 12 },
  title: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  tip: { color: "#CBD5E1", fontSize: 13, lineHeight: 19, marginTop: 6 },
});
