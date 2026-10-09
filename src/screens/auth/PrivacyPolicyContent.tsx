import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Keep this in sync with docs/privacy-policy.md if either changes.
// 2026-10-09: rewritten for more than one trainer. Each client's own trainer
// is the responsible party; the app's operator runs the app for them.
export const PRIVACY_POLICY_VERSION = "2026-10-09";
export const PRIVACY_POLICY_LAST_UPDATED = "9 October 2026";

// Who runs the app on every trainer's behalf (the POPIA "operator").
export const APP_OPERATOR = {
  name: "Clint Walters, trading as Domination Gym",
  email: "dominationgym@gmail.com",
};

// The trainer the client is joining, when known. Before a client has entered
// a trainer code the policy speaks of "your trainer" generically.
export type PolicyTrainer = { name: string; contact?: string | null };

function sections(trainer: PolicyTrainer | null | undefined): { heading: string; body: string }[] {
  const who = trainer ? trainer.name : "the trainer whose code you used to sign up";
  const contact = trainer?.contact ? ` You can reach them on ${trainer.contact}.` : "";
  return [
    {
      heading: "1. Who is responsible for your information",
      body:
        `Your trainer, ${who}, is the "responsible party" for your personal information under POPIA. They decide what is collected and use it to coach you.${contact}\n\n` +
        `The Consistent Change app is run by ${APP_OPERATOR.name}, based in South Africa, as your trainer's "operator". That means we host and run the app on your trainer's behalf and only process your information to do that. App contact: ${APP_OPERATOR.email}.`,
    },
    {
      heading: "2. What is collected",
      body:
        "Account details (name, email, phone), coaching information (goals, injuries, intake-form answers), daily check-in data (alcohol, sleep, water, meals, screen time, reading/breathing habits, distress or pain you choose to flag), status updates you set yourself, habits and training logs, progress photos and training videos you upload, your plan and payment status, and private notes your trainer makes about you.\n\nCard or bank login details are never collected - EFT/PayPal payment happens outside the app. Your password is never visible to your trainer.",
    },
    {
      heading: "3. Why it is collected",
      body:
        "Solely to provide the coaching service you signed up for: tracking daily accountability, building your program around your routine, reviewing check-ins and flags so your trainer can respond, and confirming your payment and access status.",
    },
    {
      heading: "4. Is this voluntary?",
      body:
        "Name, email, and consent are required to create an account. Everything else you provide as part of using the service - you can decline to answer any specific question without losing access.",
    },
    {
      heading: "5. Health-related information",
      body:
        "Sleep, alcohol use, and any distress, pain, or health notes are \"special personal information\" under POPIA, which is only processed because you give explicit, informed consent at signup. You can withdraw consent any time by telling your trainer, though they may no longer be able to coach you effectively without it.",
    },
    {
      heading: "6. Where it's stored",
      body:
        "With the app's hosting provider, Supabase, on servers in Ireland (EU) - meaning your information leaves South Africa to a jurisdiction with its own data protection framework (GDPR). Supabase only stores it for the app and doesn't use it for its own purposes.",
    },
    {
      heading: "7. How long it's kept",
      body:
        "Training videos are automatically deleted 30 days after upload. Everything else is kept while you're an active client, and deleted within a reasonable time if you delete your account (Profile > Delete my account) or ask your trainer to, except limited records the law requires to be kept.",
    },
    {
      heading: "8. Who else sees it",
      body:
        "Your trainer. Progress photos only if you switch on sharing. Other trainers on the app never see your information. The app operator only accesses it when needed to run, fix or secure the app, and Supabase stores it. Your information is never sold or shared for marketing.",
    },
    {
      heading: "9. No automated decisions",
      body: "Nothing in this app makes automated decisions about you - your trainer reviews everything personally.",
    },
    {
      heading: "10. Your rights",
      body:
        `You can ask what is held about you, ask for it to be corrected or deleted, object to how it's processed, and withdraw consent at any time. Ask your trainer first; if they don't help, contact ${APP_OPERATOR.email}. You can also complain to the Information Regulator: POPIAComplaints@inforegulator.org.za, inforegulator.org.za.`,
    },
  ];
}

export default function PrivacyPolicyContent({ trainer }: { trainer?: PolicyTrainer | null }) {
  return (
    <View>
      <Text style={styles.updated}>Last updated {PRIVACY_POLICY_LAST_UPDATED}</Text>
      {sections(trainer).map((s) => (
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
