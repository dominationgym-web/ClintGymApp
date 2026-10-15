import React from "react";
import { View, Text, StyleSheet } from "react-native";

import {
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS as SECTIONS,
  PRIVACY_POLICY_VERSION,
} from "@/lib/privacyPolicy";

// The wording lives in src/lib/privacyPolicy.ts, shared with the web page.
export { PRIVACY_POLICY_VERSION };

// The trainer the client is joining, once they've entered a code. The policy
// then names them instead of "the trainer whose code you used to sign up".
export type PolicyTrainer = { name: string };

const GENERIC_TRAINER = "the trainer whose code you used to sign up";

export default function PrivacyPolicyContent({ trainer }: { trainer?: PolicyTrainer | null }) {
  const sections = trainer
    ? SECTIONS.map((s) => ({ ...s, body: s.body.split(GENERIC_TRAINER).join(trainer.name) }))
    : SECTIONS;
  return (
    <View>
      <Text style={styles.updated}>Last updated {PRIVACY_POLICY_LAST_UPDATED}</Text>
      {sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading}>{s.heading}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  updated: { color: "#64748B", fontSize: 12, marginBottom: 20 },
  section: { marginBottom: 20 },
  heading: { color: "#22C55E", fontWeight: "700", fontSize: 15, marginBottom: 6 },
  body: { color: "#E2E8F0", fontSize: 13.5, lineHeight: 20 },
});
