import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, PanResponder, Pressable as RNPressable, View, useWindowDimensions } from "react-native";
import { themedStyles } from "@/lib/theme";
import { DURATION, EASE_OUT, reduceMotion } from "@/lib/motion";

// A pop-up that comes up from the bottom (GRIZZ, 2026-11-21 design review):
// the dark background fades in while the sheet slides up, and it follows your
// thumb: drag it down (or flick it) to close. Tap the dark part to close too.
export default function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const shade = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(height)).current;
  const sheetH = useRef(400);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.setValue(reduceMotion() ? 0 : sheetH.current);
      shade.setValue(reduceMotion() ? 1 : 0);
      Animated.parallel([
        Animated.timing(shade, { toValue: 1, duration: DURATION.normal, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: DURATION.slow, easing: EASE_OUT, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(shade, { toValue: 0, duration: DURATION.fast, useNativeDriver: true }),
        Animated.timing(y, { toValue: sheetH.current, duration: DURATION.normal, easing: EASE_OUT, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > sheetH.current * 0.3 || g.vy > 0.8) onCloseRef.current();
        else Animated.spring(y, { toValue: 0, friction: 9, tension: 120, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[styles.shade, { opacity: shade }]}>
          <RNPressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: y }] }]}
          onLayout={(e) => (sheetH.current = e.nativeEvent.layout.height)}
          {...pan.panHandlers}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  fill: { flex: 1, justifyContent: "flex-end" },
  shade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#475569", marginBottom: 10 },
});
