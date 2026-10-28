import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import Confetti from "@/components/Confetti";
import { themedStyles } from "@/lib/theme";

export type CelebrationInfo = {
  emoji: string;
  title: string;
  lines?: string[];
  highlight?: string; // the big gold line, e.g. "+12% stronger"
  note?: string;
  button?: string;
};

// The gold pop-up for a big moment: the card springs in, the medal pulses and
// the confetti gun fires. Used for the 10% badge, gold stars and a won challenge.
export default function Celebration({ info, onClose }: { info: CelebrationInfo | null; onClose: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!info) return;
    pop.setValue(0);
    pulse.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [info, pop, pulse]);

  const cardScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const medalScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const medalTurn = pop.interpolate({ inputRange: [0, 1], outputRange: ["-200deg", "0deg"] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {info && (
          <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale: cardScale }] }]}>
            <View style={styles.medalWrap}>
              <Animated.View style={[styles.glow, { opacity: glow, transform: [{ scale: medalScale }] }]} />
              <Animated.View style={[styles.medal, { transform: [{ scale: medalScale }, { rotate: medalTurn }] }]}>
                <Text style={styles.medalText}>{info.emoji}</Text>
              </Animated.View>
            </View>
            <Text style={styles.title}>{info.title}</Text>
            {info.lines?.map((l, i) => (
              <Text key={i} style={i === 0 ? styles.first : styles.line}>
                {l}
              </Text>
            ))}
            {info.highlight ? <Text style={styles.highlight}>{info.highlight}</Text> : null}
            {info.note ? <Text style={styles.note}>{info.note}</Text> : null}
            <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonText}>{info.button ?? "Keep going"}</Text>
            </Pressable>
          </Animated.View>
        )}
        <Confetti fire={!!info} />
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#0F172A", borderRadius: 18, borderWidth: 2, borderColor: BRAND_GOLD, padding: 24, alignItems: "center" },
  medalWrap: { width: 130, height: 130, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  glow: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: BRAND_GOLD },
  medal: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#2A2410",
    borderWidth: 3,
    borderColor: BRAND_GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  medalText: { fontSize: 52 },
  title: { color: BRAND_GOLD, fontSize: 24, fontWeight: "800", textAlign: "center" },
  first: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 6, textAlign: "center" },
  line: { color: "#E2E8F0", fontSize: 15, marginTop: 6, textAlign: "center" },
  highlight: { color: BRAND_GOLD, fontSize: 18, fontWeight: "800", marginTop: 6, textAlign: "center" },
  note: { color: "#94A3B8", fontSize: 13, marginTop: 10, textAlign: "center" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32, marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
