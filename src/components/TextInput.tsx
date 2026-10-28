import React from "react";
import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from "react-native";
import { getThemeMode } from "@/lib/theme";

// Every typing box in the app uses this instead of React Native's TextInput.
// White text on dark boxes was hard to read on some phones (phone autofill
// paints a light highlight over name/email boxes, and bright sunlight), so
// boxes are light with dark navy text everywhere.
export const INPUT_BACKGROUND = "#F8FAFC";
export const INPUT_TEXT = "#0F172A";
export const INPUT_PLACEHOLDER = "#64748B";
export const INPUT_SELECTION = "#B8941F";

type TextInput = RNTextInput;

function TextInput({ style, ref, ...props }: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  // A box with its own background gets the light background; a bare input
  // sitting inside a styled row keeps the row's look and only gets the text colour.
  const flat = StyleSheet.flatten(style);
  const boxed = flat?.backgroundColor !== undefined;
  // In light mode the light box sits on a white card, so it gets an edge.
  const edged = boxed && getThemeMode() === "light" && !flat?.borderWidth;
  return (
    <RNTextInput
      ref={ref}
      selectionColor={INPUT_SELECTION}
      cursorColor={INPUT_TEXT}
      keyboardAppearance="light"
      {...props}
      placeholderTextColor={INPUT_PLACEHOLDER}
      style={[style, styles.text, boxed && styles.box, edged && styles.edge]}
    />
  );
}

const styles = StyleSheet.create({
  text: { color: INPUT_TEXT },
  box: { backgroundColor: INPUT_BACKGROUND },
  edge: { borderWidth: 1, borderColor: "#CBD5E1" },
});

export default TextInput;
