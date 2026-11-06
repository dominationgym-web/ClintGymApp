import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";
import EvolutionSwitchNotice from "@/components/EvolutionSwitchNotice";

// The trainer app's two sides (GRIZZ, 2026-11-01): "1 on 1" for in-person
// session tracking, "Evolution" for online clients. The app remembers the
// side the trainer was on last.
//
// GRIZZ, 2026-11-06: every new trainer starts on 1 on 1 with the Evolution
// side switched off (trainers.evolution_on, 0192). Going to Evolution, or
// putting a client on it, first shows what switching it on means (30 days
// free, first 5 clients free, switch off to stop).
export type TrainerSide = "one" | "evolution";

const SideContext = createContext<{
  side: TrainerSide;
  setSide: (s: TrainerSide) => void;
  // The side the trainer switched from, so the phone's Back button can go back to it.
  cameFrom: TrainerSide | null;
  backToCameFrom: () => void;
  // Before anything that puts a client on the Evolution side: with Evolution
  // off, the trainer is asked to switch it on first. `go` runs straight away
  // when it's already on.
  guardEvolution: (go: () => void) => void;
  // Whether the Evolution side is switched on (always for the owner).
  evolutionOn: boolean;
  // ☰ Menu › Evolution side: asks to switch it on, or to switch it off.
  toggleEvolution: () => void;
}>({
  side: "one",
  setSide: () => {},
  cameFrom: null,
  backToCameFrom: () => {},
  guardEvolution: (go) => go(),
  evolutionOn: false,
  toggleEvolution: () => {},
});

const key = (trainerId: string) => `trainer-side:${trainerId}`;

export function TrainerSideProvider({ children }: { children: React.ReactNode }) {
  const { trainer, refreshProfile } = useAuth();
  const evolutionOn = !!trainer && (trainer.is_owner || !!trainer.evolution_on);
  const [side, setSideState] = useState<TrainerSide>("one");
  const [cameFrom, setCameFrom] = useState<TrainerSide | null>(null);
  useEffect(() => {
    if (!trainer) return;
    if (!evolutionOn) {
      setSideState("one");
      return;
    }
    AsyncStorage.getItem(key(trainer.id))
      .then((v) => {
        // Nothing saved yet: trainers who already had Evolution before the
        // switch (0192) carry on there; everyone else starts on 1 on 1.
        if (v === "one" || v === "evolution") setSideState(v);
        else setSideState(trainer.is_owner || trainer.evolution_started_on ? "evolution" : "one");
      })
      .catch(() => {});
  }, [trainer, evolutionOn]);
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

  // What runs once Evolution is switched on from the notice.
  const [pending, setPending] = useState<{ then: () => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const askToSwitchOn = useCallback((then: () => void) => {
    // Wait for a closing picker or menu first: iPhone can't open a Modal while another is closing.
    setTimeout(() => setPending({ then }), 400);
  }, []);
  const switchOn = async () => {
    if (!trainer || !pending) return;
    setSaving(true);
    const { error } = await supabase.from("trainers").update({ evolution_on: true }).eq("id", trainer.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't switch Evolution on", error.message);
      return;
    }
    const then = pending.then;
    setPending(null);
    await refreshProfile();
    then();
  };
  const switchOff = useCallback(() => {
    if (!trainer) return;
    Alert.alert(
      "Switch Evolution off?",
      "The Evolution side closes and its subscription stops. Your 1 on 1 side stays as it is. You can switch it back on any time, but the 30 free days only happen once.",
      [
        { text: "Keep it on", style: "cancel" },
        {
          text: "Switch off",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("trainers").update({ evolution_on: false }).eq("id", trainer.id);
            if (error) {
              Alert.alert(
                "Couldn't switch Evolution off",
                /Evolution clients/.test(error.message)
                  ? "Some of your clients are still on Evolution. Move them to 1 on 1 first (open the client › How you train them), or archive them."
                  : error.message
              );
              return;
            }
            save("one");
            setCameFrom(null);
            await refreshProfile();
          },
        },
      ]
    );
  }, [trainer, save, refreshProfile]);

  const guardEvolution = useCallback(
    (go: () => void) => {
      if (evolutionOn) go();
      else askToSwitchOn(go);
    },
    [evolutionOn, askToSwitchOn]
  );
  // Going to the Evolution side while it's off: ask to switch it on first.
  const setSideChecked = useCallback(
    (s: TrainerSide) => {
      if (s === "evolution" && !evolutionOn) setPending({ then: () => setSide("evolution") });
      else setSide(s);
    },
    [evolutionOn, setSide]
  );
  const toggleEvolution = useCallback(() => {
    if (trainer?.is_owner) return;
    if (evolutionOn) switchOff();
    else askToSwitchOn(() => setSide("evolution"));
  }, [trainer?.is_owner, evolutionOn, switchOff, askToSwitchOn, setSide]);

  return (
    <SideContext.Provider value={{ side, setSide: setSideChecked, cameFrom, backToCameFrom, guardEvolution, evolutionOn, toggleEvolution }}>
      {children}
      <EvolutionSwitchNotice visible={!!pending} saving={saving} onSwitchOn={switchOn} onCancel={() => setPending(null)} />
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
