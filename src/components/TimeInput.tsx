import React from "react";
import type { TextInput as RNTextInput, TextInputProps } from "react-native";
import TextInput from "@/components/TextInput";
import { finishTypedTime, formatTypedTime } from "@/lib/typedTime";

type Props = Omit<TextInputProps, "value" | "onChangeText" | "keyboardType" | "maxLength"> & {
  value: string;
  onChangeText: (time: string) => void;
  ref?: React.Ref<RNTextInput>;
};

/**
 * Every box where a time is typed uses this. It shows the number keypad and
 * puts the colon in by itself, so "2030" becomes "20:30" and "730" becomes
 * "07:30" once the box is left (GRIZZ, 2026-11-16).
 */
export default function TimeInput({ value, onChangeText, onBlur, ...props }: Props) {
  return (
    <TextInput
      {...props}
      value={value}
      onChangeText={(text) => onChangeText(formatTypedTime(text))}
      onBlur={(e) => {
        const tidy = finishTypedTime(value);
        if (tidy !== value) onChangeText(tidy);
        onBlur?.(e);
      }}
      keyboardType="number-pad"
      maxLength={5}
    />
  );
}
