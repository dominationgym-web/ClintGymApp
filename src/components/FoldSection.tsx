import React, { useEffect, useRef } from "react";
import LineIcon from "@/components/LineIcon";
import { Animated, Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import { DURATION, EASE_OUT, reduceMotion } from "@/lib/motion";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";
import { headingFont } from "@/lib/fonts";

// A tap-to-open heading for a long page, so the client sees a short list of
// headings instead of scrolling (GRIZZ dislikes scrolling). `hint` is a short
// line under the title, e.g. the current status. The one heading style for the
// whole app (GRIZZ, 2026-11-21): Profile, Nutrition, the Menu pages all use it.
export default function FoldSection({
  icon,
  title,
  hint,
  open,
  onToggle,
  children,
  tag,
  stepBack = true,
}: {
  icon?: string | null;
  title: string;
  hint?: string | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Something small on the right before the arrow, e.g. a level label. */
  tag?: React.ReactNode;
  /** false when the page already closes its open heading on Back itself. */
  stepBack?: boolean;
}) {
  // The phone's Back button closes an open fold first.
  useStepBack(stepBack && open, onToggle);
  // The arrow turns and the inside eases in (GRIZZ, 2026-11-21 design review)
  // instead of snapping open.
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  const show = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion()) {
      turn.setValue(open ? 1 : 0);
      show.setValue(open ? 1 : 0);
      return;
    }
    Animated.timing(turn, { toValue: open ? 1 : 0, duration: DURATION.normal, easing: EASE_OUT, useNativeDriver: true }).start();
    if (open) {
      show.setValue(0);
      Animated.timing(show, { toValue: 1, duration: DURATION.normal, easing: EASE_OUT, useNativeDriver: true }).start();
    }
  }, [open, turn, show]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const slide = show.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] });
  return (
    <View style={[styles.fold, open && styles.foldOpen]}>
      <Pressable style={styles.header} onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        {icon ? (
          <View style={styles.iconTile}>
            <LineIcon icon={icon} size={20} color={BRAND_GOLD} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, headingFont(16)]}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {tag}
        <Animated.Text style={[styles.chevron, { transform: [{ rotate }] }]}>▾</Animated.Text>
      </Pressable>
      {open && <Animated.View style={[styles.body, { opacity: show, transform: [{ translateY: slide }] }]}>{children}</Animated.View>}
    </View>
  );
}

const styles = themedStyles({
  fold: { backgroundColor: "#111C33", borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: "#1E293B" },
  foldOpen: { borderColor: BRAND_GOLD },
  header: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  icon: { fontSize: 22 },
  iconTile: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#D4AF371A" },
  title: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chevron: { color: "#94A3B8", fontSize: 18 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
});
