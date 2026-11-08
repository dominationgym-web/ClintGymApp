import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND_GOLD } from "@/lib/brand";
import { WELCOME_CLOSING_LINE, WELCOME_OPENING_FOLLOW_UP, WELCOME_OPENING_QUESTION } from "@/lib/welcome";
import { themedStyles } from "@/lib/theme";

const NAVY = "#0F172A";
const CARD = "#1E293B";

type Props = {
  // The gold button on the last page.
  buttonLabel: string;
  onPress: () => void;
  // Shown under the closing words, e.g. a link to the suggestion box once signed in.
  onOpenSuggestionBox?: () => void;
  // The first-launch screen has no header, so it needs room for the status bar.
  padTop?: boolean;
  // Shows a Skip link under the buttons (critique, 2026-11-04: the welcome is optional).
  onSkip?: () => void;
};

// The coach's introduction, laid out as pages the reader taps through.
// The coach's welcome: one page (GRIZZ, 2026-11-04: "Just leave the 1st page"),
// the opening question with his closing line under it, and one button.
export default function WelcomeContent({ buttonLabel, onPress, padTop }: Props) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fade]);

  const rise = fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, padTop && { paddingTop: insets.top + 24 }]}>
        <Animated.View style={[styles.centred, { opacity: fade, transform: [{ translateY: rise }] }]}>
          <Image source={require("../../assets/splash-icon.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.kicker}>WELCOME</Text>
          <Text style={styles.heroQuestion}>{WELCOME_OPENING_QUESTION}</Text>
          <Text style={styles.heroFollowUp}>{WELCOME_OPENING_FOLLOW_UP}</Text>
          <Text style={styles.closing}>{WELCOME_CLOSING_LINE}</Text>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          onPress={onPress}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: NAVY },
  content: { flexGrow: 1, padding: 24, paddingBottom: 32 },
  centred: { flexGrow: 1, justifyContent: "center" },
  logo: { width: 140, height: 140, alignSelf: "center", marginBottom: 8 },
  kicker: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", letterSpacing: 4, textAlign: "center", marginBottom: 14 },
  heroQuestion: { color: "#fff", fontSize: 25, fontWeight: "800", lineHeight: 32, textAlign: "center" },
  closing: { color: BRAND_GOLD, fontSize: 20, fontWeight: "800", lineHeight: 28, textAlign: "center", marginTop: 20, fontStyle: "italic" },
  heroFollowUp: { color: "#CBD5E1", fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 16 },
  becomeBox: { flexDirection: "row", marginTop: 28, marginBottom: 32 },
  becomeBar: { width: 4, borderRadius: 2, backgroundColor: BRAND_GOLD, marginRight: 14 },
  becomeText: { flex: 1, color: BRAND_GOLD, fontSize: 20, fontWeight: "700", lineHeight: 28, fontStyle: "italic" },
  sectionLabel: { color: "#64748B", fontSize: 12, fontWeight: "700", letterSpacing: 2, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.5)",
    backgroundColor: "rgba(212,175,55,0.08)",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipText: { color: "#F1E3B0", fontSize: 14, fontWeight: "600" },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderTopWidth: 2,
    borderTopColor: BRAND_GOLD,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  cardNumber: { color: BRAND_GOLD, fontSize: 13, fontWeight: "800", marginRight: 10 },
  cardKicker: { color: "#94A3B8", fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  cardTitle: { color: "#fff", fontSize: 19, fontWeight: "700", lineHeight: 25, marginBottom: 10 },
  cardBody: { color: "#CBD5E1", fontSize: 15, lineHeight: 23, marginBottom: 8 },
  discipline: {
    marginVertical: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_GOLD,
    backgroundColor: "rgba(212,175,55,0.1)",
    alignItems: "center",
  },
  quoteMark: { color: BRAND_GOLD, fontSize: 56, lineHeight: 56, fontWeight: "800", marginBottom: -8 },
  disciplineText: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 30, textAlign: "center" },
  body: { color: "#CBD5E1", fontSize: 15, lineHeight: 23, marginBottom: 10 },
  linkButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: BRAND_GOLD,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  linkButtonText: { color: BRAND_GOLD, fontWeight: "700" },
  divider: { height: 2, width: 60, backgroundColor: BRAND_GOLD, alignSelf: "center", marginTop: 28, marginBottom: 18 },
  signOff: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 26, textAlign: "center" },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: NAVY,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#334155" },
  dotActive: { width: 20, backgroundColor: BRAND_GOLD },
  buttonRow: { flexDirection: "row", gap: 10 },
  skip: { color: "#94A3B8", textAlign: "center", marginTop: 12, fontWeight: "600" },
  backButton: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  backButtonText: { color: "#CBD5E1", fontSize: 17, fontWeight: "700" },
  button: { flex: 1, backgroundColor: BRAND_GOLD, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: NAVY, fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
});
