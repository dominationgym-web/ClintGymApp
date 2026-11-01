import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";

// The trainer app's two sides (GRIZZ, 2026-11-01): "1 on 1" for in-person
// session tracking, "Evolution" for online clients. The app remembers the
// side the trainer was on last.
export type TrainerSide = "one" | "evolution";

const SideContext = createContext<{ side: TrainerSide; setSide: (s: TrainerSide) => void }>({
  side: "evolution",
  setSide: () => {},
});

const key = (trainerId: string) => `trainer-side:${trainerId}`;

export function TrainerSideProvider({ children }: { children: React.ReactNode }) {
  const { trainer } = useAuth();
  const [side, setSideState] = useState<TrainerSide>("evolution");
  useEffect(() => {
    if (!trainer) return;
    AsyncStorage.getItem(key(trainer.id))
      .then((v) => {
        if (v === "one" || v === "evolution") setSideState(v);
      })
      .catch(() => {});
  }, [trainer]);
  const setSide = useCallback(
    (s: TrainerSide) => {
      setSideState(s);
      if (trainer) AsyncStorage.setItem(key(trainer.id), s).catch(() => {});
    },
    [trainer]
  );
  return <SideContext.Provider value={{ side, setSide }}>{children}</SideContext.Provider>;
}

export const useTrainerSide = () => useContext(SideContext);

export const SIDE_LABEL: Record<TrainerSide, string> = { one: "🤝 1 on 1", evolution: "🌐 Evolution" };

// The pill at the top of every trainer tab (and the laptop sidebar).
export function TrainerSideSwitch({ compact }: { compact?: boolean }) {
  const { side, setSide } = useTrainerSide();
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="tablist">
      {(["one", "evolution"] as TrainerSide[]).map((s) => {
        const on = side === s;
        return (
          <Pressable
            key={s}
            onPress={() => setSide(s)}
            style={[styles.pill, compact && styles.pillWide, on && styles.pillOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s === "one" ? "1 on 1" : "Evolution"}
            hitSlop={4}
          >
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
              {SIDE_LABEL[s]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles({
  wrap: { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 20, padding: 3 },
  compact: { alignSelf: "stretch" },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 17, alignItems: "center" },
  pillWide: { flex: 1 },
  pillOn: { backgroundColor: BRAND_GOLD },
  text: { color: "#94A3B8", fontSize: 13, fontWeight: "700" },
  textOn: { color: "#0F172A" },
});
