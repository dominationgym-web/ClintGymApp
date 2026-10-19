import React from "react";
import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from "react-native";

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
  const boxed = StyleSheet.flatten(style)?.backgroundColor !== undefined;
  return (
    <RNTextInput
      ref={ref}
      selectionColor={INPUT_SELECTION}
      cursorColor={INPUT_TEXT}
      keyboardAppearance="light"
      {...props}
      placeholderTextColor={INPUT_PLACEHOLDER}
      style={[style, styles.text, boxed && styles.box]}
    />
  );
}

const styles = StyleSheet.create({
  text: { color: INPUT_TEXT },
  box: { backgroundColor: INPUT_BACKGROUND },
});

export default TextInput;
