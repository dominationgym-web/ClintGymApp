import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// The magnifying glass in the header that opens the app-wide search. Both the
// client and trainer stacks have a "Search" screen.
export default function SearchButton() {
  const navigation = useNavigation<NativeStackNavigationProp<{ Search: undefined }>>();
  return (
    <Pressable onPress={() => navigation.navigate("Search")} hitSlop={10} style={styles.button} accessibilityRole="button" accessibilityLabel="Search">
      <Ionicons name="search" size={22} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginRight: 16, paddingVertical: 2 },
});
