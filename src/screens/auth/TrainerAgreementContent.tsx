import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { APP_OPERATOR } from "@/screens/auth/PrivacyPolicyContent";

// Every trainer reads and signs this before using the app (0031). Bump the
// version whenever the wording changes: trainers on an older version are asked
// to sign again before they can carry on. Keep in sync with
// docs/trainer-agreement.md.
export const TRAINER_AGREEMENT_VERSION = "2026-10-09";
export const TRAINER_AGREEMENT_LAST_UPDATED = "9 October 2026";

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Who this agreement is between",
    body: `You (the trainer signing below) and ${APP_OPERATOR.name} ("we"), who runs the Consistent Change app. It covers your use of the app to coach your own clients.`,
  },
  {
    heading: "2. Free test period and fees",
    body:
      "Using the app is free during the current test period. Before any monthly fee starts we'll tell you the amount at least 30 days ahead, and you can choose to stop using the app instead. Fees will be paid by EFT.",
  },
  {
    heading: "3. Your clients' information is your responsibility",
    body:
      "Under POPIA you are the \"responsible party\" for the personal information of the clients who join you, including health information (sleep, alcohol, pain, distress, photos, videos). The privacy policy your clients accept names you. You agree to:\n" +
      "• use it only to coach that client;\n" +
      "• never copy, sell or share it with anyone else, or use it for marketing without the client's separate consent;\n" +
      "• keep your login private and not let anyone else use your account;\n" +
      "• help a client who asks to see, correct or delete their information;\n" +
      `• tell us straight away at ${APP_OPERATOR.email} if you think someone got into your account or a client's information was exposed.`,
  },
  {
    heading: "4. What we do as the app's operator",
    body:
      "We host and run the app on your behalf. We only process your clients' information to run, fix and secure the app; we keep it separate from other trainers' clients; we never sell it; and we'll tell you without delay if we learn of a breach affecting your clients. The app's data is stored with Supabase on servers in Ireland (EU).",
  },
  {
    heading: "5. Your coaching",
    body:
      "You're responsible for the advice and programs you give your clients. Coaching in the app is not medical advice: refer a client with a medical issue, injury or red-flag symptom to a qualified professional. You confirm you hold any qualifications and insurance your work requires.",
  },
  {
    heading: "6. Payments from your clients",
    body:
      "Clients pay you directly, outside the app, using the details on your Profile. Your prices, refunds, receipts and tax are your own responsibility. Keep your bank details correct; we're not responsible for payments sent to details you entered.",
  },
  {
    heading: "7. The app's programs and content",
    body:
      "You may use the app's programs, exercise library and guides with your clients inside the app, and add your own. You may not copy, resell or publish the app's content outside the app.",
  },
  {
    heading: "8. Approval, blocking and leaving",
    body:
      "We approve every trainer before clients can join them, and we may block an account that breaks this agreement or puts clients at risk. You can stop at any time. To delete your trainer account, your clients' accounts first need to be closed or moved to another trainer - contact us to arrange it.",
  },
  {
    heading: "9. Changes to this agreement",
    body: "If we change this agreement, the app will ask you to read and sign the new version before you carry on.",
  },
  {
    heading: "10. The legal bits",
    body:
      "The app is provided as it is, especially during the test period, and may sometimes be unavailable. As far as the law allows, we're not liable for indirect losses from using it. This agreement is governed by the law of South Africa.",
  },
];

export default function TrainerAgreementContent() {
  return (
    <View>
      <Text style={styles.updated}>Last updated {TRAINER_AGREEMENT_LAST_UPDATED}</Text>
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
