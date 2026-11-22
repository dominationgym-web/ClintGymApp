// Builds the small public website the App Store and Google Play ask for: the
// privacy policy, how to delete your account, a support page, and the For
// Personal Trainers page adverts link to (scripts/trainers-page.mjs). The wording
// comes from src/lib/privacyPolicy.ts, the same text the app shows at signup.
//
//   node --experimental-strip-types scripts/build-site.mjs [outDir]
//
// .github/workflows/site.yml builds it and publishes it with EAS Hosting.
import { mkdirSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "../src/lib/privacyPolicy.ts";
import { trainersPage } from "./trainers-page.mjs";
import { homePage, SITE_FONTS, SITE_BASE_CSS } from "./home-page.mjs";

const outDir = process.argv[2] ?? "site-dist";
mkdirSync(outDir, { recursive: true });

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paragraphs = (text) =>
  text
    .split("\n\n")
    .map((p) => `<p>${escape(p)}</p>`)
    .join("\n");

// The address Google should list (www and the old expo.app address point here).
export const SITE = "https://dailyevolution.co.za";

const DEFAULT_DESCRIPTION =
  "Daily Evolution: the coaching app for personal trainers and their clients in South Africa. Check-ins, training programs, nutrition and progress in one place.";

const page = (title, body, path, description = DEFAULT_DESCRIPTION) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} - Daily Evolution</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${escape(title)} - Daily Evolution">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${SITE}/icon.png">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:type" content="website">
<link rel="icon" href="/icon.png">
${SITE_FONTS}
<style>
${SITE_BASE_CSS}
  main { max-width: 720px; margin: 0 auto; padding: 24px 20px 64px; }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  header img { width: 38px; height: 38px; border-radius: 10px; }
  header a { color: var(--white); font: 700 20px/1 var(--head); letter-spacing: .02em; text-decoration: none; }
  header a span { color: var(--gold); }
  h1 { font-size: clamp(32px, 6vw, 44px); line-height: 1.05; margin: 0 0 12px; text-transform: uppercase; }
  h2 { color: var(--gold); font-size: 24px; margin: 32px 0 8px; }
  .muted { color: var(--muted); font-size: 14px; }
  nav { margin-top: 48px; border-top: 1px solid var(--line); padding-top: 18px; font-size: 14px; display: flex; flex-wrap: wrap; gap: 8px 18px; }
  nav a { color: var(--muted); text-decoration: none; }
  nav a:hover { color: var(--white); }
  ol li { margin-bottom: 8px; }
</style>
</head>
<body>
<main>
<header><img src="/icon.png" alt=""><a href="/">DAILY <span>EVOLUTION</span></a></header>
${body}
<nav><a href="/trainers">For personal trainers</a><a href="/privacy">Privacy policy</a><a href="/delete-account">Delete your account</a><a href="/support">Support</a><a href="/app/">Trainer login on a laptop</a></nav>
</main>
</body>
</html>
`;

const ANDROID_APK = "https://expo.dev/artifacts/eas/klVUi9P5Ds0iVgbOiEUDK6xM1qq_R5huhfI49yiVS3c.apk";

const pages = {
  "index.html": homePage(escape, SITE),
  "trainers.html": trainersPage(escape),
  "privacy.html": page(
    "Privacy policy",
    `<h1>Privacy policy</h1>
<p class="muted">Last updated ${escape(PRIVACY_POLICY_LAST_UPDATED)}</p>
<p>This notice is provided under Section 18 of South Africa's Protection of Personal Information Act, 4 of 2013 ("POPIA"). It covers the Daily Evolution app for iPhone and Android.</p>
${PRIVACY_POLICY_SECTIONS.map((s) => `<h2>${escape(s.heading)}</h2>\n${paragraphs(s.body)}`).join("\n")}`,
    "/privacy",
    "How Daily Evolution collects, uses and protects your personal information under POPIA.",
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
    "/delete-account",
    "How to delete your Daily Evolution account and all your data.",
  ),
  // Short address to share the Android test app (GRIZZ, 2026-10-22). Point
  // ANDROID_APK at each new preview build.
  "android.html": page(
    "Get the Android app",
    `<h1>Get Daily Evolution for Android</h1>
<p><a class="btn btn-gold" href="${ANDROID_APK}">Download the app</a></p>
<ol>
<li>If you already have Daily Evolution, uninstall it first.</li>
<li>Tap <strong>Download the app</strong> above, then open the downloaded file and tap <strong>Install</strong>. If your phone asks, allow installs from your browser.</li>
<li>Open the app and sign in, or sign up with your trainer's code.</li>
</ol>
<p class="muted">iPhone? Ask your trainer for the TestFlight link.</p>`,
    "/android",
    "Download the Daily Evolution coaching app for Android.",
  ),
  "support.html": page(
    "Support",
    `<h1>Support</h1>
<h2>Quickest way: report it in the app</h2>
<p><strong>Trainers:</strong> open the app, tap the menu <strong>☰</strong>, then <strong>Report a problem</strong>. Pick what it's about, say what happened and tap Send. It goes straight to the app owner with your name on it, and the answer comes back on the same page with a notification.</p>
<p><strong>Clients:</strong> questions about your coaching, program or payments go to your trainer directly. If something in the app isn't working, tell your trainer: they can report it in the app and it comes straight to us.</p>
<h2>Can't open the app?</h2>
<p>Email <a href="mailto:${PRIVACY_CONTACT_EMAIL}">${PRIVACY_CONTACT_EMAIL}</a>. Email replies can take longer than a problem reported in the app.</p>`,
    "/support",
    "Get help with the Daily Evolution app: report a problem inside the app for the quickest answer.",
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
// Real app pictures for the front page and the trainers page (scripts/site-assets).
mkdirSync(join(outDir, "img"), { recursive: true });
for (const f of readdirSync("scripts/site-assets")) copyFileSync(join("scripts/site-assets", f), join(outDir, "img", f));

// Lets Google find and list the pages. The laptop app at /app is a log-in
// screen, so it stays out of search results.
const listed = ["/", "/trainers", "/android", "/privacy", "/delete-account", "/support"];
writeFileSync(
  join(outDir, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /app/\n\nSitemap: ${SITE}/sitemap.xml\n`,
);
writeFileSync(
  join(outDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listed.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join("\n")}
</urlset>
`,
);
console.log(`Built ${Object.keys(pages).length} pages into ${outDir}`);
