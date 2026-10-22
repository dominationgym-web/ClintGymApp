// Builds the small public website the App Store and Google Play ask for: the
// privacy policy, how to delete your account, a support page, and the For
// Personal Trainers page adverts link to (scripts/trainers-page.mjs). The wording
// comes from src/lib/privacyPolicy.ts, the same text the app shows at signup.
//
//   node --experimental-strip-types scripts/build-site.mjs [outDir]
//
// .github/workflows/site.yml builds it and publishes it with EAS Hosting.
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "../src/lib/privacyPolicy.ts";
import { trainersPage } from "./trainers-page.mjs";

const outDir = process.argv[2] ?? "site-dist";
mkdirSync(outDir, { recursive: true });

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paragraphs = (text) =>
  text
    .split("\n\n")
    .map((p) => `<p>${escape(p)}</p>`)
    .join("\n");

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} - Daily Evolution</title>
<link rel="icon" href="/icon.png">
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0F172A; color: #E2E8F0; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  header img { width: 48px; height: 48px; border-radius: 12px; }
  header a { color: #D4AF37; font-weight: 700; font-size: 20px; text-decoration: none; }
  h1 { color: #FFFFFF; font-size: 28px; margin: 0 0 8px; }
  h2 { color: #D4AF37; font-size: 18px; margin: 28px 0 8px; }
  a { color: #D4AF37; }
  .muted { color: #94A3B8; font-size: 14px; }
  nav { margin-top: 40px; border-top: 1px solid #1E293B; padding-top: 16px; font-size: 14px; }
  nav a { margin-right: 16px; }
  ol li { margin-bottom: 8px; }
</style>
</head>
<body>
<main>
<header><img src="/icon.png" alt=""><a href="/">Daily Evolution</a></header>
${body}
<nav><a href="/trainers">For personal trainers</a><a href="/privacy">Privacy policy</a><a href="/delete-account">Delete your account</a><a href="/support">Support</a><a href="/app/">Trainer login on a laptop</a></nav>
</main>
</body>
</html>
`;

const ANDROID_APK = "https://expo.dev/artifacts/eas/Z5EfxSaNnI3pW29JzWp92bZnSyaTKJ9AfKQ8JPjUwik.apk";

const pages = {
  "index.html": page(
    "Building a better you",
    `<h1>Daily Evolution</h1>
<p>Building a better you.</p>
<p>Daily Evolution is a coaching app for personal trainers and their clients: daily check-ins, habits with streaks, training programs and progress tracking, all in one place.</p>
<p>The app is available to clients of trainers who use Daily Evolution. Ask your trainer for their trainer code to sign up.</p>
<p><strong>Are you a personal trainer?</strong> <a href="/trainers">See what Daily Evolution does for you, and try it free for 30 days</a>.</p>`,
  ),
  "trainers.html": trainersPage(escape),
  "privacy.html": page(
    "Privacy policy",
    `<h1>Privacy policy</h1>
<p class="muted">Last updated ${escape(PRIVACY_POLICY_LAST_UPDATED)}</p>
<p>This notice is provided under Section 18 of South Africa's Protection of Personal Information Act, 4 of 2013 ("POPIA"). It covers the Daily Evolution app for iPhone and Android.</p>
${PRIVACY_POLICY_SECTIONS.map((s) => `<h2>${escape(s.heading)}</h2>\n${paragraphs(s.body)}`).join("\n")}`,
  ),
  "delete-account.html": page(
    "Delete your account",
    `<h1>Delete your Daily Evolution account</h1>
<p>You can delete your account and everything in it yourself, inside the app:</p>
<ol>
<li>Open the Daily Evolution app and log in.</li>
<li>Go to your <strong>Profile</strong>.</li>
<li>Tap <strong>Delete my account</strong>, then <strong>Delete everything</strong>.</li>
</ol>
<p>This permanently deletes your account, check-ins, habits, training logs, notes, progress photos, training videos and cycle log straight away. It can't be undone.</p>
<p>If you can't open the app, email <a href="mailto:${PRIVACY_CONTACT_EMAIL}?subject=Delete%20my%20Daily%20Evolution%20account">${PRIVACY_CONTACT_EMAIL}</a> from the email address you signed up with, and your account will be deleted within 7 days.</p>`,
  ),
  // Short address to share the Android test app (GRIZZ, 2026-10-22). Point
  // ANDROID_APK at each new preview build.
  "android.html": page(
    "Get the Android app",
    `<h1>Get Daily Evolution for Android</h1>
<p><a href="${ANDROID_APK}" style="display:inline-block;background:#D4AF37;color:#0F172A;font-weight:700;padding:14px 22px;border-radius:12px;text-decoration:none">Download the app</a></p>
<ol>
<li>If you already have Daily Evolution, uninstall it first.</li>
<li>Tap <strong>Download the app</strong> above, then open the downloaded file and tap <strong>Install</strong>. If your phone asks, allow installs from your browser.</li>
<li>Open the app and sign in, or sign up with your trainer's code.</li>
</ol>
<p class="muted">iPhone? Ask your trainer for the TestFlight link.</p>`,
  ),
  "support.html": page(
    "Support",
    `<h1>Support</h1>
<p>Questions about your coaching, program or payments: contact your trainer directly.</p>
<p>Problems with the app itself: email <a href="mailto:${PRIVACY_CONTACT_EMAIL}">${PRIVACY_CONTACT_EMAIL}</a>.</p>`,
  ),
};

for (const [name, html] of Object.entries(pages)) {
  writeFileSync(join(outDir, name), html);
  // Also serve each page without the .html ending, e.g. /privacy.
  if (name !== "index.html") {
    const dir = join(outDir, name.replace(/\.html$/, ""));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
  }
}
copyFileSync("assets/icon.png", join(outDir, "icon.png"));
console.log(`Built ${Object.keys(pages).length} pages into ${outDir}`);
