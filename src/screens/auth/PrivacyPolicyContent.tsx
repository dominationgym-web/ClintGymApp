import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Keep this in sync with docs/privacy-policy.md if either changes.
export const PRIVACY_POLICY_VERSION = "2026-09-18";
export const PRIVACY_POLICY_LAST_UPDATED = "18 September 2026";

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Who we are",
    body:
      "Viveshan Naidoo, trading as Domination Gym, based in South Africa, operates the Daily Grizz app and is the \"responsible party\" for your personal information under POPIA.\n\nContact / Information Officer: Viveshan Naidoo — WhatsApp 076 423 2075, email dominationgym@gmail.com.",
  },
  {
    heading: "2. What we collect",
    body:
      "Account details (name, email, phone), coaching information (goals, injuries, intake-form answers), daily check-in data (alcohol, sleep, water, meals, screen time, reading/breathing habits, distress or pain you choose to flag), status updates you set yourself, training videos you upload, your plan and payment status, and private notes your trainer makes about you.\n\nWe never collect card or bank login details - EFT/PayPal payment happens outside the app. Your password is never visible to your trainer.",
  },
  {
    heading: "3. Why we collect it",
    body:
      "Solely to provide the coaching service you signed up for: tracking daily accountability, building your program around your routine, reviewing check-ins and flags so your trainer can respond, and confirming your payment/access status.",
  },
  {
    heading: "4. Is this voluntary?",
    body:
      "Name, email, and consent are required to create an account. Everything else you provide as part of using the service - you can decline to answer any specific question without losing access.",
  },
  {
    heading: "5. Health-related information",
    body:
      "Sleep, alcohol use, and any distress, pain, or health notes are \"special personal information\" under POPIA, which we only process because you give explicit, informed consent at signup. You can withdraw consent any time by contacting us, though we may no longer be able to coach you effectively without it.",
  },
  {
    heading: "6. Where it's stored",
    body:
      "With our hosting provider, Supabase, on servers in Ireland (EU) - meaning your information leaves South Africa to a jurisdiction with its own data protection framework (GDPR). Supabase is our data processor only, and doesn't use your information for its own purposes.",
  },
  {
    heading: "7. How long we keep it",
    body:
      "Training videos are automatically deleted 30 days after upload. Everything else is kept while you're an active client, and deleted within a reasonable time if you close your account or ask us to, except limited records we're legally required to keep.",
  },
  {
    heading: "8. Who else sees it",
    body:
      "Your trainer, and Supabase as our data processor. Nobody else. We never sell your information or share it for marketing.",
  },
  {
    heading: "9. No automated decisions",
    body: "Nothing in this app makes automated decisions about you - your trainer reviews everything personally.",
  },
  {
    heading: "10. Your rights",
    body:
      "You can ask what we hold about you, ask us to correct or delete it, object to how it's processed, and withdraw consent at any time. You can also complain to the Information Regulator: POPIAComplaints@inforegulator.org.za, inforegulator.org.za.",
  },
];

export default function PrivacyPolicyContent() {
  return (
    <View>
      <Text style={styles.updated}>Last updated {PRIVACY_POLICY_LAST_UPDATED}</Text>
      {SECTIONS.map((s) => (
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
