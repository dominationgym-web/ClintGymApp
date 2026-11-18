import React from "react";
import { Text, View } from "react-native";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/privacyPolicy";
import { themedStyles } from "@/lib/theme";

// Who runs the app and is the other party to this agreement.
const APP_OPERATOR = { name: "Clint Walters, trading as Daily Evolution", email: PRIVACY_CONTACT_EMAIL };

// Every trainer reads and signs this before using the app (0031). Bump the
// version whenever the wording changes: trainers on an older version are asked
// to sign again before they can carry on. Keep in sync with
// docs/trainer-agreement.md.
export const TRAINER_AGREEMENT_VERSION = "2026-11-18";
export const TRAINER_AGREEMENT_LAST_UPDATED = "18 November 2026";

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Who this agreement is between",
    body: `You (the trainer signing below) and ${APP_OPERATOR.name} ("we"), who runs the Daily Evolution app. It covers your use of the app to coach your own clients.`,
  },
  {
    heading: "2. Fees and payment",
    body:
      "You start with a free trial, shown on your Profile. After that you pay for the plan you choose (monthly, 6 months or 1 year upfront) plus the per-client fees shown in the app, in rand if you're in South Africa or US dollars elsewhere, by card or EFT. Credit from trainers you refer comes off what you owe. If we've given you free use, you only pay the per-client fees shown on your Profile.\n\nIf a payment is overdue, your account and your clients' access can be paused until it's paid; nothing is deleted. We'll tell you in the app at least 30 days before any price change.",
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
      "We approve every trainer before clients can join them, and we may block an account that breaks this agreement or puts clients at risk. You can cancel your subscription at any time (section 9). To delete your trainer account, your clients' accounts first need to be closed or moved to another trainer - contact us to arrange it.",
  },
  {
    heading: "9. Cancelling your subscription",
    body:
      "You can cancel any time, with no cancellation fee, under Profile › Plan & refer › Cancel subscription, or by emailing us. If you cancel during your free trial, you pay nothing.\n\n" +
      "No refunds: your free trial lets you try everything first, so payments aren't refunded once made, whether you cancel early or not.\n" +
      "• Monthly plan: you keep full use until the end of the month you've paid for, and nothing more is charged after that.\n" +
      "• 6-month or 1-year plan: these are commitment plans, which is why they're discounted. You keep full use until the end of the plan and it isn't renewed. The plan isn't refunded, except where South African law requires it.\n" +
      "• Client fees for months that have already passed are still payable.\n" +
      "• Unused referral credit is never paid out in cash. It's added as free time (half a month per credit), so your access runs longer before it ends.\n" +
      "• Your saved card is removed the moment you cancel.\n" +
      "• You can undo your cancellation any time before it takes effect.\n\n" +
      "What happens to your clients: we remind you a week before your end date to tell them. On the end date your account and your clients' access are paused; nothing is deleted. For 90 days after that you can come back and find everything as it was, and a client can ask us to move them to another Daily Evolution trainer or for a copy of their information. After 90 days we delete your trainer account and your clients' information, unless a client has moved to another trainer, and you can ask us to delete it sooner. We keep payment records only as long as tax law requires.\n\n" +
      "If we end your subscription: we may do so straight away if you break this agreement or put clients at risk. Otherwise we give you at least 30 days' notice and refund any full months you've paid for and not used.",
  },
  {
    heading: "10. Changes to this agreement",
    body: "If we change this agreement, the app will ask you to read and sign the new version before you carry on.",
  },
  {
    heading: "11. The legal bits",
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

const styles = themedStyles({
  updated: { color: "#64748B", fontSize: 12, marginBottom: 20 },
  section: { marginBottom: 20 },
  heading: { color: "#22C55E", fontWeight: "700", fontSize: 15, marginBottom: 6 },
  body: { color: "#E2E8F0", fontSize: 13.5, lineHeight: 20 },
});
