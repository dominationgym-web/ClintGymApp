// The privacy policy, shown at signup (PrivacyPolicyContent) and published as
// a web page for the App Store and Google Play (scripts/build-site.mjs). Plain
// data with no imports, so the site script can load it straight from Node.
// Bump the version when the wording changes: signups record which one they
// agreed to.
export const PRIVACY_POLICY_VERSION = "2026-10-11";
export const PRIVACY_POLICY_LAST_UPDATED = "11 October 2026";

export const PRIVACY_CONTACT_EMAIL = "dominationgym@gmail.com";

export const PRIVACY_POLICY_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Who is responsible for your information",
    body:
      "Your trainer, the trainer whose code you used to sign up, coaches you and is the \"responsible party\" for your personal information under South Africa's Protection of Personal Information Act (POPIA).\n\nThe Daily Evolution app is run for trainers by Clint Walters, trading as Daily Evolution, based in South Africa, as their \"operator\". Contact / Information Officer: Clint Walters, WhatsApp 076 423 2075, email dominationgym@gmail.com.",
  },
  {
    heading: "2. What is collected",
    body:
      "Account details (name, email, phone), coaching information (goals, injuries, intake-form answers), daily check-in data (alcohol, sleep, water, meals, screen time, reading/breathing habits, pain, fatigue or distress you choose to report), status updates you set yourself, habits, training and workout logs, training videos and progress photos you upload, a cycle log if you choose to keep one, your plan and payment status, private notes your trainer makes about you, and a device token so the app can send you notifications.\n\nCard or bank login details are never collected - EFT/PayPal payment happens outside the app. Your password is never visible to your trainer.",
  },
  {
    heading: "3. Why it is collected",
    body:
      "Solely to provide the coaching service you signed up for: tracking daily accountability, building your program around your routine, reviewing check-ins and flags so your trainer can respond, sending you reminders, and confirming your payment and access status.",
  },
  {
    heading: "4. Is this voluntary?",
    body:
      "Name, email, and consent are required to create an account. Everything else you provide as part of using the service - you can decline to answer any specific question without losing access.",
  },
  {
    heading: "5. Health-related information",
    body:
      "Sleep, alcohol use, your cycle log, and any distress, pain, or health notes are \"special personal information\" under POPIA, which is only processed because you give explicit, informed consent at signup. You can withdraw consent any time by telling your trainer, though they may no longer be able to coach you effectively without it.",
  },
  {
    heading: "6. Where it's stored",
    body:
      "With the app's hosting provider, Supabase, on servers in Ireland (EU) - meaning your information leaves South Africa to a jurisdiction with its own data protection framework (GDPR). Supabase only stores it for the app and doesn't use it for its own purposes. Notifications are delivered through Expo, Google and Apple's notification services.",
  },
  {
    heading: "7. How long it's kept",
    body:
      "Training videos are automatically deleted 7 days after upload, or sooner if your plan ends. Everything else, including progress photos, is kept while you have an account, and deleted when you delete your account (Profile > Delete my account) or ask your trainer to, except limited records the law requires to be kept.",
  },
  {
    heading: "8. Who else sees it",
    body:
      "Your trainer. Progress photos only while you have photo sharing switched on, and your cycle log is never shown to your trainer. Other trainers on the app never see your information. The app operator only accesses it when needed to run, fix or secure the app, and Supabase stores it. Your information is never sold or shared for marketing.",
  },
  {
    heading: "9. No automated decisions",
    body: "Nothing in this app makes automated decisions about you - your trainer reviews everything personally.",
  },
  {
    heading: "10. Your rights",
    body:
      "You can ask what is held about you, ask for it to be corrected or deleted, object to how it's processed, and withdraw consent at any time. You can delete your account and everything in it yourself in the app (Profile > Delete my account). Ask your trainer first for anything else; if they don't help, contact dominationgym@gmail.com. You can also complain to the Information Regulator: POPIAComplaints@inforegulator.org.za, inforegulator.org.za.",
  },
];
