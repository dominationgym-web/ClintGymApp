import React, { useState } from "react";
import { View, Pressable, Text, StyleSheet, type TextInputProps } from "react-native";
import TextInput from "@/components/TextInput";

type Props = Omit<TextInputProps, "secureTextEntry" | "style"> & {
  style?: TextInputProps["style"];
};

export default function PasswordInput({ style, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput style={[styles.input, style]} placeholderTextColor="#94A3B8" secureTextEntry={!visible} {...inputProps} />
      <Pressable style={styles.toggle} onPress={() => setVisible((v) => !v)} hitSlop={8}>
        <Text style={styles.toggleText}>{visible ? "Hide" : "Show"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", justifyContent: "center" },
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 14,
    paddingRight: 60,
    marginBottom: 12,
  },
  toggle: { position: "absolute", right: 14, top: 0, bottom: 12, justifyContent: "center" },
  toggleText: { color: "#15803D", fontWeight: "700", fontSize: 13 },
});
