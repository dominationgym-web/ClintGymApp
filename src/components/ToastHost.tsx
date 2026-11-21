import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";
import { DURATION, EASE_OUT, reduceMotion } from "@/lib/motion";
import { clearToast, currentToast, registerHost, subscribeToast, topHost } from "@/lib/toast";
import { success } from "@/lib/haptics";

// Shows the newest toast() at the top of the screen: drops in, stays long
// enough to read (longer for longer text), then goes. Tap to close early.
export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [hostId, setHostId] = useState(0);
  const [, bump] = useState(0);
  const y = useRef(new Animated.Value(0)).current;
  const lastId = useRef(0);

  useEffect(() => {
    const unsub = subscribeToast(() => bump((n) => n + 1));
    const h = registerHost();
    setHostId(h.id);
    return () => {
      unsub();
      h.remove();
    };
  }, []);

  const t = currentToast();
  const mine = hostId !== 0 && topHost() === hostId && t;

  useEffect(() => {
    if (!mine || !t || lastId.current === t.id) return;
    lastId.current = t.id;
    success();
    y.setValue(reduceMotion() ? 1 : 0);
    Animated.timing(y, { toValue: 1, duration: DURATION.normal, easing: EASE_OUT, useNativeDriver: true }).start();
  });

  if (!mine || !t) return null;
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const scale = y.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity: y, transform: [{ translateY }, { scale }] }}>
        <Pressable style={styles.toast} onPress={() => clearToast(t.id)} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <View style={styles.dot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t.title}</Text>
            {t.message ? <Text style={styles.message}>{t.message}</Text> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 9999, elevation: 30, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    maxWidth: 480,
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND_GOLD, marginTop: 6 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  message: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
});
