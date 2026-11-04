import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";
import EvolutionUpgradeNotice, { useMyPriceSide } from "@/components/EvolutionUpgradeNotice";

// The trainer app's two sides (GRIZZ, 2026-11-01): "1 on 1" for in-person
// session tracking, "Evolution" for online clients. The app remembers the
// side the trainer was on last.
export type TrainerSide = "one" | "evolution";

const SideContext = createContext<{
  side: TrainerSide;
  setSide: (s: TrainerSide) => void;
  // The side the trainer switched from, so the phone's Back button can go back to it.
  cameFrom: TrainerSide | null;
  backToCameFrom: () => void;
  // Before anything that puts a client on the Evolution side (0179 pricing):
  // a trainer on the 1 on 1 only price sees what moving up costs first.
  // `go` runs straight away for everyone else.
  guardEvolution: (go: () => void, continueLabel: string) => void;
  // After a client's type changes, so the price side is worked out again.
  reloadPriceSide: () => void;
}>({
  side: "evolution",
  setSide: () => {},
  cameFrom: null,
  backToCameFrom: () => {},
  guardEvolution: (go) => go(),
  reloadPriceSide: () => {},
});

const key = (trainerId: string) => `trainer-side:${trainerId}`;
// The Evolution side was opened after the price notice (shown once for the side switch).
const noticeKey = (trainerId: string) => `evolution-price-notice:${trainerId}`;

export function TrainerSideProvider({ children }: { children: React.ReactNode }) {
  const { trainer } = useAuth();
  const [side, setSideState] = useState<TrainerSide>("evolution");
  const [cameFrom, setCameFrom] = useState<TrainerSide | null>(null);
  useEffect(() => {
    if (!trainer) return;
    AsyncStorage.getItem(key(trainer.id))
      .then((v) => {
        if (v === "one" || v === "evolution") setSideState(v);
      })
      .catch(() => {});
  }, [trainer]);
  const save = useCallback(
    (s: TrainerSide) => {
      setSideState(s);
      if (trainer) AsyncStorage.setItem(key(trainer.id), s).catch(() => {});
    },
    [trainer]
  );
  const setSide = useCallback(
    (s: TrainerSide) => {
      if (s !== side) setCameFrom(side);
      save(s);
    },
    [save, side]
  );
  const backToCameFrom = useCallback(() => {
    if (!cameFrom) return;
    setCameFrom(null);
    save(cameFrom);
  }, [cameFrom, save]);
  const pricing = useMyPriceSide();
  const [notice, setNotice] = useState<{ go: () => void; label: string } | null>(null);
  const { reload } = pricing;
  const reloadPriceSide = useCallback(() => {
    // After the client's change has saved.
    setTimeout(() => reload().catch(() => {}), 2500);
  }, [reload]);
  const guardEvolution = useCallback(
    (go: () => void, continueLabel: string) => {
      const run = () => {
        go();
        reloadPriceSide();
      };
      // Wait for a closing picker first: iPhone can't open a Modal while another is closing.
      if (pricing.side === "one_on_one") setTimeout(() => setNotice({ go: run, label: continueLabel }), 400);
      else run();
    },
    [pricing.side, reloadPriceSide]
  );
  // Going to the Evolution side: the notice once, while on the 1 on 1 only price.
  const setSideChecked = useCallback(
    (s: TrainerSide) => {
      if (s !== "evolution" || pricing.side !== "one_on_one" || !trainer) return setSide(s);
      AsyncStorage.getItem(noticeKey(trainer.id))
        .catch(() => null)
        .then((seen) => {
          if (seen) return setSide(s);
          setNotice({
            label: "Open the Evolution side",
            go: () => {
              AsyncStorage.setItem(noticeKey(trainer.id), "1").catch(() => {});
              setSide(s);
            },
          });
        });
    },
    [pricing.side, setSide, trainer]
  );
  return (
    <SideContext.Provider value={{ side, setSide: setSideChecked, cameFrom, backToCameFrom, guardEvolution, reloadPriceSide }}>
      {children}
      <EvolutionUpgradeNotice
        visible={!!notice}
        settings={pricing.settings}
        continueLabel={notice?.label ?? "Continue"}
        onContinue={() => {
          const go = notice?.go;
          setNotice(null);
          go?.();
        }}
        onCancel={() => setNotice(null)}
      />
    </SideContext.Provider>
  );
}

export const useTrainerSide = () => useContext(SideContext);

export const SIDE_LABEL: Record<TrainerSide, string> = { one: "1 on 1", evolution: "Evolution" };

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
