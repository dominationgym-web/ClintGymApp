import React from "react";
import { KeyboardAvoidingView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

// Keeps whatever is being typed above the keyboard (GRIZZ, 2026-10-12).
// Android draws the app edge to edge, so the screen no longer shrinks for
// the keyboard by itself; this pads the bottom by the keyboard's height on
// both platforms. A scroll view inside then keeps the focused box in view.
// Used once around the whole app (RootNavigator) and inside each Modal,
// which opens in its own window.
export default function KeyboardSafe({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView style={[styles.fill, style]} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
