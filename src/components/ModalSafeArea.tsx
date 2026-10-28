import React from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Keeps a full-screen Modal's header clear of the iPhone clock and notch
// (GRIZZ, 2026-10-28: the exercise screen's Close sat under the clock).
// A Modal opens in its own window on iPhone, and the native SafeAreaView
// inside it can measure no safe area at all, so on iPhone we pad by the
// app's own safe area instead. Android and the website keep SafeAreaView.
export default function ModalSafeArea({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "ios") return <SafeAreaView style={style}>{children}</SafeAreaView>;
  return (
    <View
      style={[
        style,
        { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      {children}
    </View>
  );
}
