import React from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";
import { ScrollView } from "@/components/ScrollView";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

// "Forgot your password?" from the log-in page (GRIZZ, 2026-11-09). The trainer
// gives a new password from the client's page in their app (the owner does it
// for trainers), and can see or fix the email they signed up with.
export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const coach = route.params?.coach === true;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Forgot your password?</Text>
      {coach ? (
        <>
          <Text style={styles.body}>Message the Daily Evolution team on WhatsApp. We'll give you a new password straight away.</Text>
          <Text style={styles.body}>Not sure which email you signed up with? We can see it and fix a spelling mistake in it.</Text>
        </>
      ) : (
        <>
          <View style={styles.step}>
            <Text style={styles.num}>1</Text>
            <Text style={styles.stepText}>Send your trainer a WhatsApp saying you can't log in.</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.num}>2</Text>
            <Text style={styles.stepText}>They'll send you a new password and the email you log in with. They can fix the email too if it was spelt wrong.</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.num}>3</Text>
            <Text style={styles.stepText}>Log in with them. You can pick your own password afterwards under Profile › Account.</Text>
          </View>
        </>
      )}
      <Pressable style={styles.button} onPress={() => navigation.goBack()} accessibilityRole="button">
        <Text style={styles.buttonText}>Back to log in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, maxWidth: 440, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 18 },
  body: { color: "#CBD5E1", fontSize: 16, lineHeight: 23, marginBottom: 14 },
  step: { flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "flex-start" },
  num: { color: "#0F172A", backgroundColor: BRAND_GOLD, width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28, fontWeight: "800", overflow: "hidden" },
  stepText: { flex: 1, color: "#CBD5E1", fontSize: 16, lineHeight: 23 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
});
