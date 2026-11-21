import { SITE_FONTS, SITE_BASE_CSS } from "./home-page.mjs";
// The For Personal Trainers landing page (GRIZZ, 2026-10-19): where Facebook
// and Instagram adverts send trainers. It says straight away why Daily
// Evolution is worth paying for, shows the five main features as a tap-through
// demo (one feature at a time, no long scroll), and its trial button opens the
// trainer application in the laptop version of the app (/app/?signup=trainer).
// Everything shown is something the app really does; no made-up numbers or
// reviews. Built into /trainers by scripts/build-site.mjs.

const SIGNUP = "/app/?signup=trainer";

// One tap-through slide per feature: what it does, and a real picture of that
// screen from the app (made-up client names, never real ones).
const FEATURES = [
  {
    key: "progression",
    shot: "/img/trainers-progression.webp",
    alt: "A client's training calendar in the app, with today's workout and the week planned",
    tab: "Programming",
    title: "Intelligent Programming",
    tagline: "Smarter training. Less planning.",
    lead: "Build complete training programmes in minutes.",
    points: [
      "Automatically calculate suggested starting weights from a gauge set.",
      "Adjust training loads using actual performance.",
      "Monitor fatigue and suggest deload weeks.",
      "Plan workouts directly onto your client's calendar.",
    ],
    closer: "Spend less time programming. More time coaching.",
  },
  {
    key: "injury",
    shot: "/img/trainers-injury.webp",
    alt: "The injury check finding five exercises that may aggravate a client's knee",
    tab: "Injury-aware",
    title: "Injury-Aware Training",
    tagline: "Your client's safety matters.",
    lead: "Daily Evolution helps you identify potential training risks before they become problems.",
    points: [
      "Flags exercises that conflict with reported injuries or pain.",
      "Suggests three alternative exercises.",
      "Tracks injuries, pain and recovery progress.",
      "Records your decisions and programme adjustments.",
    ],
    closer: "Better information. More confident coaching decisions.",
  },
  {
    key: "nutrition",
    shot: "/img/trainers-nutrition.webp",
    alt: "The client Nutrition page: meal plan, BMR and macros, protein cooking ideas, sauces and the meal builder",
    tab: "Nutrition",
    title: "Intelligent Nutrition",
    tagline: "Nutrition planning without the admin.",
    lead: "Give your clients structured nutrition guidance without building every plan from scratch.",
    points: [
      "Calculate personalised calorie and macro targets.",
      "Generate meal plans aligned with client goals.",
      "Track nutrition progress and adherence.",
      "Identify clients who may need specialist nutritional guidance.",
    ],
    closer: "Less time calculating. More time helping clients succeed.",
  },
  {
    key: "recovery",
    shot: "/img/trainers-recovery.webp",
    alt: "The Recovery page suggesting foam rolling and stretching after a hard week",
    tab: "Recovery",
    title: "Recovery & Rehabilitation",
    tagline: "Training is only half the equation.",
    lead: "Help clients recover, manage fatigue and stay consistent.",
    points: [
      "Ready-made recovery and rehabilitation programmes.",
      "Track sleep, fatigue, soreness and reported pain.",
      "Suggest recovery activities and lighter training weeks.",
      "Monitor recovery alongside training progress.",
    ],
    closer: "Smarter recovery. Better-informed training decisions.",
  },
  {
    key: "payments",
    shot: "/img/trainers-business.webp",
    alt: "Monthly invoices ready to check and send, with paid switches",
    tab: "Business",
    title: "Business & Client Management",
    tagline: "Your clients. Your business. Your control.",
    lead: "Run your coaching business from one central platform.",
    points: [
      "Your own branding and unique trainer reference code.",
      "Private client network with trainer-controlled access.",
      "Track payments, packages and monthly income.",
      "Manage online, in-person and hybrid coaching clients.",
    ],
    closer: "Less administration. More time to grow your business.",
  },
];

const ONLINE_IN_PERSON = [
  ["📱", "Online", "Clients log every set, rep and weight on their phone, wherever they train. You see it all."],
  ["🏋️", "In person", "The same log works when you're standing next to them, with every exercise's video at hand."],
  ["🔁", "Both", "Hybrid packages for clients who see you some days and train alone on the others."],
];

export function trainersPage(escape) {
  const tabs = FEATURES.map(
    (f, i) => `<button class="tab${i === 0 ? " on" : ""}" data-i="${i}" role="tab" aria-selected="${i === 0}">${escape(f.tab)}</button>`,
  ).join("");
  const slides = FEATURES.map(
    (f, i) => `<section class="slide${i === 0 ? " on" : ""}" data-i="${i}" role="tabpanel" aria-label="${escape(f.title)}">
  <div class="copy">
    <h2>${escape(f.title)}</h2>
    <p class="tagline">${escape(f.tagline)}</p>
    <p class="lead">${escape(f.lead)}</p>
    <ul>${f.points.map((p) => `<li>${escape(p)}</li>`).join("")}</ul>
    <p class="closer">${escape(f.closer)}</p>
  </div>
  <div><div class="phone"><img src="${f.shot}" alt="${escape(f.alt)}" width="540" height="960" loading="lazy" decoding="async"></div><div class="caption">In the app</div></div>
</section>`,
  ).join("\n");
  const modes = ONLINE_IN_PERSON.map(
    ([icon, title, text]) => `<div class="mode"><div class="icon">${icon}</div><b>${escape(title)}</b><p>${escape(text)}</p></div>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily Evolution for Personal Trainers</title>
<meta name="description" content="The coaching app that thinks like a coach: smart programming, injury checks, safe nutrition, recovery tracking and your business in one place. Try it free for 30 days.">
<meta property="og:title" content="Daily Evolution for Personal Trainers">
<meta property="og:description" content="Smart programming, injury checks, safe nutrition, recovery tracking and your business in one app. Try it free for 30 days.">
<meta property="og:image" content="https://dailyevolution.co.za/icon.png">
<meta property="og:url" content="https://dailyevolution.co.za/trainers">
<meta property="og:type" content="website">
<link rel="canonical" href="https://dailyevolution.co.za/trainers">
<link rel="icon" href="/icon.png">
${SITE_FONTS}
<style>
${SITE_BASE_CSS}
  :root { color-scheme: dark; --gold: #D4AF37; --bg: #0F172A; --card: #111C33; --line: #1E293B; --text: #E2E8F0; --muted: #94A3B8; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 var(--body); }
  a { color: var(--gold); }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 16px; }
  header.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 0; }
  .brand { display: flex; align-items: center; gap: 10px; color: #fff; font: 700 20px/1 var(--head); letter-spacing: .02em; text-decoration: none; }
  .brand span { color: var(--gold); }
  .brand img { width: 40px; height: 40px; border-radius: 10px; }
  .login { color: var(--muted); font-size: 14px; text-decoration: none; }
  .hero { padding: 28px 0 36px; text-align: center; }
  .eyebrow { color: var(--gold); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 13px; }
  h1 { color: #fff; font-size: clamp(40px, 7vw, 68px); line-height: 1; text-transform: uppercase; margin: 10px auto 14px; max-width: 760px; }
  .sub { color: var(--muted); font-size: 18px; max-width: 640px; margin: 0 auto 24px; }
  .cta { display: inline-block; background: var(--gold); color: #111; font-weight: 800; font-size: 18px; padding: 15px 28px; border-radius: 12px; text-decoration: none; }
  .cta { transition: transform .16s var(--ease), filter .2s var(--ease); box-shadow: 0 10px 30px -10px rgba(212,175,55,.6); }
  .cta:active { transform: scale(.97); }
  @media (hover: hover) and (pointer: fine) { .cta:hover { filter: brightness(1.08); } }
  .tab, .nav button, .get-btn, dialog.get .close { transition: transform .16s var(--ease), background-color .2s var(--ease), color .2s var(--ease), border-color .2s var(--ease); }
  .tab:active, .nav button:active, .get-btn:active, dialog.get .close:active { transform: scale(.96); }
  .fine { color: var(--muted); font-size: 13px; margin-top: 10px; }
  .hero { position: relative; isolation: isolate; }
  .hero::before { content: ""; position: absolute; left: 50%; top: 45%; width: 760px; max-width: 100vw; height: 760px; transform: translateX(-50%); pointer-events: none; z-index: -1;
    background: radial-gradient(closest-side, rgba(212,175,55,.16), rgba(212,175,55,0)); }
  .hero-phone { width: 270px; margin: 36px auto 0; border-radius: 40px; padding: 9px; background: linear-gradient(160deg, #2A3550, #0B1120 60%);
    box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset, 0 40px 80px -20px rgba(0,0,0,.7), 0 20px 40px -20px rgba(212,175,55,.25); animation-delay: .2s; }
  .hero-phone img { display: block; width: 100%; height: auto; border-radius: 32px; }
  .control { background: linear-gradient(180deg, #1A2338, var(--card)); border: 2px solid var(--gold); border-radius: 18px; padding: 24px; margin: 0 0 28px; }
  .control h2 { color: var(--gold); font-size: clamp(22px, 4.5vw, 30px); margin: 0 0 6px; text-transform: uppercase; letter-spacing: .02em; }
  .pts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .pts div { background: rgba(15,23,42,.6); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
  .pts b { display: block; color: #fff; margin-bottom: 2px; }
  .pts span { color: var(--muted); font-size: 14px; }
  .award { background: linear-gradient(180deg, #1A2338, var(--card)); border: 2px solid var(--gold); border-radius: 18px; padding: 24px; margin: 28px 0; }
  .award h2 { color: var(--gold); font-size: clamp(22px, 4.5vw, 30px); margin: 0 0 10px; }
  .award p { margin: 0 0 10px; }
  .award .strong { color: #fff; font-weight: 800; margin: 12px 0 0; }
  .control .strong { color: #fff; font-weight: 800; font-size: 18px; margin: 12px 0 0; }
  .prices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .price { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
  .price .where { color: #fff; font-weight: 700; }
  .price .where em { display: inline-block; margin-left: 6px; font-style: normal; font-size: 12px; color: #F59E0B; border: 1px solid #F59E0B; border-radius: 999px; padding: 1px 8px; }
  .price .amount { color: var(--gold); font-size: 36px; font-weight: 800; margin: 6px 0; }
  .price .amount span { color: var(--muted); font-size: 16px; font-weight: 400; }
  .price ul { margin: 0; padding-left: 20px; }
  .save { display: inline-block; margin-left: 6px; background: #13301F; color: #86EFAC; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 700; }
  .price li { margin-bottom: 4px; }
  h3.region { color: #fff; font-size: 20px; margin: 28px 0 12px; text-align: center; }
  .get-btn { display: block; width: 100%; margin-top: 14px; padding: 12px; border-radius: 12px; border: 1.5px solid var(--gold); background: transparent; color: var(--gold); font-weight: 700; font-size: 16px; cursor: pointer; }
  dialog.get { max-width: 560px; width: calc(100% - 32px); max-height: 85vh; background: var(--card); color: #E2E8F0; border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; }
  dialog.get::backdrop { background: rgba(0,0,0,0.65); }
  dialog.get[open] { animation: dlgIn .24s var(--ease); }
  dialog.get[open]::backdrop { animation: fadeIn .24s var(--ease); }
  @keyframes dlgIn { from { opacity: 0; transform: translateY(10px) scale(.97); } }
  @keyframes fadeIn { from { opacity: 0; } }
  dialog.get h3 { color: #fff; margin: 0 0 8px; font-size: 20px; }
  dialog.get h4 { color: var(--gold); margin: 16px 0 6px; font-size: 15px; }
  dialog.get h4 em { font-style: normal; font-size: 12px; color: #F59E0B; border: 1px solid #F59E0B; border-radius: 999px; padding: 1px 8px; margin-left: 6px; }
  dialog.get ul { margin: 0; padding-left: 20px; }
  dialog.get li { margin-bottom: 5px; }
  dialog.get .close { display: block; margin: 18px auto 0; padding: 10px 28px; border-radius: 12px; border: 0; background: var(--gold); color: #0F172A; font-weight: 700; font-size: 15px; cursor: pointer; }
  .price .note { color: var(--muted); font-size: 13px; margin: 10px 0 0; }
  .why { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 8px 0 40px; }
  .why div { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
  .why b { color: #fff; display: block; margin-bottom: 4px; }
  .why p { margin: 0; color: var(--muted); font-size: 14px; }
  h2.section { text-align: center; color: #fff; font-size: 26px; margin: 0 0 6px; }
  p.section { text-align: center; color: var(--muted); margin: 0 0 18px; }
  .tabs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 18px; }
  .tab { background: var(--card); color: var(--text); border: 1px solid var(--line); border-radius: 999px; padding: 9px 16px; font: inherit; font-weight: 700; font-size: 14px; cursor: pointer; }
  .tab.on { background: var(--gold); border-color: var(--gold); color: #111; }
  /* All slides sit in the same spot, so the box is as tall as the tallest one and
     Back / Next never move under your finger; the new one fades in (2026-11-21). */
  .slides { display: grid; }
  .slide { grid-area: 1 / 1; display: grid; opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .25s var(--ease), transform .25s var(--ease), visibility 0s linear .25s; grid-template-columns: 1fr 320px; gap: 32px; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 24px; }
  .slide.on { opacity: 1; visibility: visible; transform: none; transition: opacity .25s var(--ease), transform .25s var(--ease), visibility 0s; }
  .slide h2 { color: var(--gold); margin: 0 0 6px; font-size: 24px; }
  .tagline { color: #fff; font-size: 19px; font-weight: 800; margin: 0 0 6px; }
  .lead { color: var(--text); font-size: 16px; margin: 0 0 12px; }
  .closer { color: var(--gold); font-weight: 700; margin: 12px 0 0; }
  .slide ul { margin: 0; padding-left: 20px; }
  .slide li { margin-bottom: 8px; color: var(--text); }
  .nav { display: flex; justify-content: space-between; margin-top: 12px; }
  .nav button { background: none; border: 1px solid var(--line); color: var(--gold); border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
  .phone { background: linear-gradient(160deg, #2A3550, #0B1120 60%); border-radius: 30px; padding: 8px; box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset, 0 20px 50px rgba(0,0,0,.45); }
  .phone img { display: block; width: 100%; height: auto; border-radius: 22px; }
  .caption { text-align: center; color: var(--muted); font-size: 12px; margin-top: 8px; }
  .modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 40px 0; }
  .mode { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
  .mode .icon { font-size: 26px; } .mode b { color: #fff; } .mode p { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; counter-reset: s; margin-bottom: 28px; }
  .steps div { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; counter-increment: s; }
  .steps div::before { content: counter(s); display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--gold); color: #111; font-weight: 800; margin-bottom: 8px; }
  .steps b { display: block; color: #fff; } .steps p { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .final { text-align: center; padding: 20px 0 48px; }
  footer { border-top: 1px solid var(--line); padding: 16px 0 90px; font-size: 14px; color: var(--muted); }
  footer a { margin-right: 16px; }
  .sticky { display: none; }
  @media (max-width: 760px) {
    .why, .modes, .steps, .prices, .pts { grid-template-columns: 1fr; }
    body { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
    .control { padding: 18px; }
    .slide { grid-template-columns: 1fr; padding: 18px; gap: 18px; align-content: start; }
    .phone { max-width: 280px; width: 100%; margin: 0 auto; }
    .tabs { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; padding-bottom: 4px; }
    .tab { flex: none; }
    .sticky { display: block; transition: transform .2s ease; position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgba(15,23,42,.96); border-top: 1px solid var(--line); }
    .sticky.hide { transform: translateY(110%); }
    .sticky .cta { display: block; text-align: center; font-size: 17px; padding: 13px; }
  }
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="brand" href="/"><img src="/icon.png" alt="">DAILY <span>EVOLUTION</span></a>
  <a class="login" href="/app/">Trainer login</a>
</header>

<section class="hero">
  <div class="eyebrow">For personal trainers</div>
  <h1>The coaching app that thinks like a coach.</h1>
  <p class="sub">Most trainer apps just hand out workouts. Daily Evolution plans, adjusts and protects your clients for you, and keeps track of who has paid, so you can coach more people, better, in less time.</p>
  <a class="cta" href="${SIGNUP}">Start your free 30-day trial</a>
  <div class="fine"><strong>No credit card required.</strong> Apply in a few minutes.</div>
  <div class="fine">Your clients remain under your coaching control. No independent client access.</div>
  <div class="hero-phone rise" aria-hidden="true"><img src="/img/home-trainer.webp" alt="" width="360" height="640"></div>
</section>

<section class="control">
  <h2>Your clients. Your business. Your control.</h2>
  <p class="lead">Daily Evolution is built for trainers, not to replace them.</p>
  <div class="pts">
    <div><b>🔒 Exclusive access</b><span>Clients can only join through an approved trainer's unique reference code.</span></div>
    <div><b>🛡 Private client network</b><span>Your clients are managed separately from every other trainer.</span></div>
    <div><b>🎛 Complete coaching control</b><span>Manage programmes, client access and payment status.</span></div>
    <div><b>⭐ Your own branding</b><span>Build your coaching business under your own identity.</span></div>
  </div>
  <p class="strong">We don't replace personal trainers. We empower them.</p>
</section>

<div class="why">
  <div><b>Safer clients</b><p>Injury checks, pain tracking and no sets to failure in a client's first 6 weeks.</p></div>
  <div><b>Smarter plans</b><p>Starting weights, progression and deload weeks worked out from each client's real logs.</p></div>
  <div><b>Less admin</b><p>Check-ins, daily summaries and payments come to you. No more chasing.</p></div>
</div>

<div id="demo">
<h2 class="section">See what it does</h2>
<p class="section">Tap through the five things that set it apart: programming, injury-aware training, nutrition, recovery and business management.</p>
<div class="tabs" role="tablist">${tabs}</div>
<div class="slides">${slides}</div>
<div class="nav"><button type="button" id="prev">‹ Back</button><button type="button" id="next">Next ›</button></div>
</div>

<div class="modes">${modes}</div>

<h2 class="section">Simple pricing</h2>
<p class="section">Everyone starts on 1 on 1, free for 30 days. Switch on Evolution when you want to coach online: it gets its own 30 days free.</p>
${[
  { flag: "🇿🇦", title: "South Africa", c: "R", evo: 200, one: 100, t1: 10, per: 10, max: "300", evoMax: "400", six: ["1 000", 500], year: ["1 800", 900] },
  { flag: "🌍", title: "International", c: "$", evo: 20, one: 10, t1: 1, per: 1, max: "30", evoMax: "40", six: ["100", 50], year: ["180", 90] },
].map((r) => `<h3 class="region">${r.flag} ${r.title}</h3>
<div class="prices">
  <div class="price">
    <div class="where">🤝 1 on 1 <em>In-person</em></div>
    <div class="amount">${r.c}${r.one}<span>/month</span></div>
    <ul>
      <li>Plus ${r.c}${r.per} per client a month, for up to 20 clients</li>
      <li><b>Max ${r.c}${r.max} a month</b>, however many clients</li>
      <li>Clients counted from your calendar: they don't need the app</li>
      <li>6 months: ${r.c}${r.six[1]} upfront <span class="save">1 month free</span></li>
      <li>12 months: ${r.c}${r.year[1]} upfront <span class="save">3 months free</span></li>
    </ul>
    <button type="button" class="get-btn" data-open="get-one">What you get ›</button>
  </div>
  <div class="price">
    <div class="where">🌐 Evolution <em>Both sides</em></div>
    <div class="amount">${r.c}${r.evo}<span>/month</span></div>
    <ul>
      <li>Online coaching and 1 on 1 sessions in one price</li>
      <li>30 days free from the day you switch it on</li>
      <li>First 5 clients free</li>
      <li>App clients 6-15: ${r.c}${r.t1} each, 16+ free</li>
      <li>1 on 1 clients not on the app: ${r.c}${r.per} each for up to 10, then free</li>
      <li>Someone on both sides counts once</li>
      <li><b>Max ${r.c}${r.evoMax} a month</b>, however many clients</li>
      <li>6 months: ${r.c}${r.six[0]} upfront <span class="save">1 month free</span></li>
      <li>12 months: ${r.c}${r.year[0]} upfront <span class="save">3 months free</span></li>
    </ul>
    <button type="button" class="get-btn" data-open="get-evo">What you get ›</button>
    <p class="note">Switch it off any time to stop paying for it.</p>
  </div>
</div>`).join("\n")}
<p class="section" style="font-size: 13px">Clients counted each month: on Evolution, everyone in the app plus anyone only in your session diary who trained with you that month; on 1 on 1, everyone on your calendar that month. Refer another trainer and get 50% off a month for each one who stays. US dollar prices are proposed until the payment provider and currency arrangements are confirmed.</p>

<!-- Trainer of the Half-Year (GRIZZ, 2026-11-08). Same words as AWARD_PITCH in src/lib/award.ts: change both together. -->
<div class="award">
  <h2>🏆 Trainer of the Half-Year</h2>
  <p>We built Daily Evolution to help you get your clients the best results in less time. Now we're adding some friendly competition.</p>
  <p>Every six months, the trainer with the best client results wins cash. It's judged on results only: new clients who stay, the clients you keep, and the progress they make. There's no draw and no luck involved, so any trainer can win.</p>
  <p>The more trainers join, the bigger the prize. It starts at $500 (R5 000 in South Africa) and grows to five prize places at 3 000 trainers.</p>
  <p class="strong">The competition starts once 250 trainers are on the app.</p>
</div>

<dialog id="get-one" class="get" tabindex="-1" autofocus>
  <h3>🤝 What you get with 1 on 1</h3>
  <h4>📅 Your sessions and money</h4>
  <ul>
      <li>Full client session tracking</li>
      <li>Cancellation tracking, with your 24 or 12 hour rule applied for you</li>
      <li>Catch-up sessions tracked and reminded</li>
      <li>Month-end invoicing worked out for you, sent by WhatsApp or email</li>
      <li>Your earnings and predicted income for the week and month</li>
      <li>Smart calendar: weekly repeats, joint sessions, open slots and time off</li>
      <li>Bring in your existing calendar from screenshots</li>
      <li>Proof of payment straight into the app</li>
      <li>Meal planning for your clients: the app works out a plan from their calories and macros, and you adjust it</li>
      <li>All the coaching guides: nutrition, supplements, sleep and recovery</li>
    </ul>
  <h4>🥗 For clients who join the app <em>Free for them</em></h4>
  <ul>
      <li>Their meal plan from you, built around their calories and macros</li>
      <li>Swaps, leaving foods out or their own meals, with the day rebalanced</li>
      <li>Weekly shopping list they can tick off and send</li>
      <li>Nutrition guidance: BMR and macros, insulin explained, cooking ideas for each protein and low-calorie sauces</li>
      <li>Supplement guidance</li>
      <li>Sleep and recovery guidance, and the cycle tracker for women</li>
      <li>Their sessions: confirm, cancel in the app, sign your agreement</li>
      <li>Optional check-in: energy, sleep and any pain or injury</li>
      <li>Progress graphs, weigh-ins and progress photos</li>
      <li>Timers, and your workout video library if you switch it on</li>
    </ul>
  <button type="button" class="close">Close</button>
</dialog>
<dialog id="get-evo" class="get" tabindex="-1" autofocus>
  <h3>🌐 What you get with Evolution</h3>
  <h4>Everything in 1 on 1, plus online coaching</h4>
  <ul>
    <li>Programs built for each client, planned onto their calendar</li>
    <li>Ready-made programs: muscle building, fat loss, sports off-season, stability and more</li>
    <li>Injury-aware training: pain tracking, injury checks and safe starting weights</li>
    <li>Progression and deload weeks worked out from each client's real logs</li>
    <li>Daily check-ins, habits, step goals and reminders</li>
    <li>A daily summary of who needs you, and nudges to check in personally</li>
    <li>Weekly video check-in bookings (calls on WhatsApp)</li>
    <li>Monthly challenges, timers and the exercise video library</li>
    <li>Clients' payments and proof of payment in one place</li>
  </ul>
  <button type="button" class="close">Close</button>
</dialog>
<div class="final" style="padding: 0 0 36px">
  <a class="cta" href="${SIGNUP}">Start your free 30-day trial</a>
  <div class="fine"><strong>No credit card required.</strong> Nothing is charged during your trial.</div>
</div>

<h2 class="section">Up and running today</h2>
<p class="section">Three steps, then your clients can join.</p>
<div class="steps">
  <div><b>Apply</b><p>Sign up as a trainer and sign the trainer agreement.</p></div>
  <div><b>Get approved</b><p>We check your details. Your 30-day free trial starts when you're approved.</p></div>
  <div><b>Invite clients</b><p>Give them your trainer code. They download the app and join you.</p></div>
</div>

<section class="final">
  <h2 class="section">Coach better. Work less.</h2>
  <p class="section">Try every feature free for 30 days.</p>
  <a class="cta" href="${SIGNUP}">Start your free 30-day trial</a>
  <div class="fine"><strong>No credit card required.</strong></div>
  <div class="fine">Your clients remain under your coaching control. No independent client access.</div>
</section>

<footer><a href="/privacy">Privacy policy</a><a href="/support">Support</a><a href="/app/">Trainer login</a></footer>
</div>
<div class="sticky hide"><a class="cta" href="${SIGNUP}">Start your free 30-day trial</a></div>
<script>
  document.querySelectorAll("[data-open]").forEach(function (b) {
    b.addEventListener("click", function () { var d = document.getElementById(b.getAttribute("data-open")); if (d && d.showModal) { d.showModal(); d.scrollTop = 0; } });
  });
  document.querySelectorAll("dialog.get").forEach(function (d) {
    d.querySelector(".close").addEventListener("click", function () { d.close(); });
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });
</script>
<script>
  (function () {
    var tabs = document.querySelectorAll(".tab"), slides = document.querySelectorAll(".slide"), cur = 0;
    function show(i) {
      cur = (i + slides.length) % slides.length;
      for (var k = 0; k < slides.length; k++) {
        slides[k].classList.toggle("on", k === cur);
        tabs[k].classList.toggle("on", k === cur);
        tabs[k].setAttribute("aria-selected", k === cur);
      }
      var bar = tabs[cur].parentNode, t = tabs[cur];
      bar.scrollTo({ left: t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
    }
    for (var k = 0; k < tabs.length; k++) tabs[k].addEventListener("click", function () { show(Number(this.dataset.i)); });
    document.getElementById("prev").addEventListener("click", function () { show(cur - 1); });
    document.getElementById("next").addEventListener("click", function () { show(cur + 1); });

    // The pinned phone button never covers anything (GRIZZ, 2026-10-19): it
    // only shows when the strip of screen it would sit on is empty background
    // (a gap between sections or the space at the end of the page), never
    // while the demo or another trial button is on screen, and not while
    // the reader is scrolling down.
    var sticky = document.querySelector(".sticky");
    var watched = Array.prototype.slice.call(document.querySelectorAll(".wrap .cta"));
    watched.push(document.getElementById("demo"));
    var seen = new Set(), goingDown = true, lastY = window.scrollY, timer = null;
    var EMPTY = { HTML: 1, BODY: 1 };
    function stripIsEmpty() {
      var h = sticky.offsetHeight || 76, vh = window.innerHeight, w = window.innerWidth;
      var xs = [12, w / 4, w / 2, (3 * w) / 4, w - 12], ys = [vh - h, vh - h / 2, vh - 4];
      sticky.style.visibility = "hidden";
      try {
        for (var i = 0; i < xs.length; i++) for (var j = 0; j < ys.length; j++) {
          var el = document.elementFromPoint(xs[i], ys[j]);
          if (el && !EMPTY[el.tagName] && !el.classList.contains("wrap") && !el.classList.contains("hero") && !el.classList.contains("final")) return false;
        }
        return true;
      } finally {
        sticky.style.visibility = "";
      }
    }
    function update() {
      var show = seen.size === 0 && !goingDown && stripIsEmpty();
      sticky.classList.toggle("hide", !show);
    }
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (Math.abs(y - lastY) >= 8) { goingDown = y > lastY; lastY = y; }
      if (goingDown) sticky.classList.add("hide");
      clearTimeout(timer);
      timer = setTimeout(function () { goingDown = false; update(); }, 150);
    }, { passive: true });
    window.addEventListener("resize", update);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        update();
      });
      watched.forEach(function (el) { io.observe(el); });
    }
  })();
</script>
</body>
</html>
`;
}
