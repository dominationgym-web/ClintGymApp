// The For Personal Trainers landing page (GRIZZ, 2026-10-19): where Facebook
// and Instagram adverts send trainers. It says straight away why Daily
// Evolution is worth paying for, shows the five main features as a tap-through
// demo (one feature at a time, no long scroll), and its trial button opens the
// trainer application in the laptop version of the app (/app/?signup=trainer).
// Everything shown is something the app really does; no made-up numbers or
// reviews. Built into /trainers by scripts/build-site.mjs.

const SIGNUP = "/app/?signup=trainer";

// One tap-through slide per feature: what it does, and a mock of the screen.
const FEATURES = [
  {
    key: "injury",
    tab: "Injury-aware",
    title: "Injury-aware programming",
    lead: "Every plan you give is checked against your client's injuries and pain.",
    points: [
      "Injuries are asked on the intake form and kept with healed dates.",
      "Pain reported in check-ins (knee, lower back...) feeds the same check.",
      "Risky exercises are flagged straight away, each with 3 safer swaps.",
      "Keep one anyway and your reason is saved: a record that protects you.",
      "28 stability and rehab programs, ankle to neck, run alongside the main plan.",
    ],
    demo: `
      <div class="m-title">🩹 Injury check</div>
      <div class="m-sub">Sarah · Left knee (open) · Lower back pain reported Tue</div>
      <div class="m-card amber"><b>⚠ Barbell back squat</b><br>Loads the knee deeply.<div class="chips"><span>Box squat</span><span>Leg press, short range</span><span>Glute bridge</span></div></div>
      <div class="m-card amber"><b>⚠ Romanian deadlift</b><br>Loads the lower back.<div class="chips"><span>Hip thrust</span><span>Cable pull-through</span><span>Back extension, light</span></div></div>
      <div class="m-card green">✓ The other 4 exercises are fine for her injuries.</div>`,
  },
  {
    key: "progression",
    tab: "Progression",
    title: "Intelligent progression",
    lead: "Plan a client's training in a few taps, and let the app do the maths.",
    points: [
      "Tap a day, pick Gym, Performance, Functional or Rehab, choose the split and the weeks. The calendar fills itself.",
      "A gauge set works out each client's working weight the first time they do an exercise.",
      "Weights go up from their real reps and effort, capped at about 10% a jump.",
      "Fatigue monitoring: weeks in a row, sets to failure, tiredness, poor sleep, missed workouts and stalled progress.",
      "Automatic deload suggestions when fatigue adds up. One tap adds the easy week.",
    ],
    demo: `
      <div class="m-title">📅 Training calendar</div>
      <div class="week">
        <div class="d"><b>Mon</b><span class="g">Upper 1</span><i>Chest · Back</i></div>
        <div class="d"><b>Tue</b><span class="t">Mobility</span></div>
        <div class="d"><b>Wed</b><span class="g">Lower 1</span><i>Quads · Glutes</i></div>
        <div class="d"><b>Thu</b><span class="p">Knee rehab</span></div>
        <div class="d"><b>Fri</b><span class="g">Upper 2</span><i>Shoulders · Arms</i></div>
        <div class="d"><b>Sat</b><span class="r">Recovery</span></div>
        <div class="d"><b>Sun</b><span class="m">Rest</span></div>
      </div>
      <div class="m-card blue">🌙 <b>Time for a deload week</b><br>6 weeks in a row, sleep down, more sets to failure. Half the sets at about 70% next week?</div>
      <div class="m-card">🎯 <b>Gauge set</b>: Leg press. They pick a weight they can do well; the app sets their working weight from it.</div>`,
  },
  {
    key: "nutrition",
    tab: "Nutrition",
    title: "Nutrition that's safe",
    lead: "Meal plans built on proper calorie maths, with safety checks built in.",
    points: [
      "Calories from the Mifflin-St Jeor formula, with a sensible deficit for fat loss.",
      "Never below what the body burns at rest, and a floor for men and women.",
      "Clients with diabetes, kidney disease, pregnancy, or under 18 are kept at maintenance and pointed to a professional.",
      "A meal plan maker and a hand-portion guide clients actually follow.",
    ],
    demo: `
      <div class="m-title">🍽 Daily targets</div>
      <div class="targets">
        <div><b>1 950</b><i>kcal</i></div>
        <div><b>140 g</b><i>protein</i></div>
        <div><b>200 g</b><i>carbs</i></div>
        <div><b>65 g</b><i>fat</i></div>
      </div>
      <div class="m-sub">Fat loss · 18% below maintenance · never below resting burn</div>
      <div class="m-card">🥚 Breakfast: eggs, wholegrain toast, fruit<br>🍗 Lunch: chicken, rice, salad<br>🐟 Dinner: fish, sweet potato, veg</div>
      <div class="m-card amber">⚕ Health check: type 2 diabetes ticked on intake. Kept at maintenance until a doctor or dietitian is involved.</div>`,
  },
  {
    key: "recovery",
    tab: "Recovery",
    title: "Recovery and fatigue",
    lead: "Know how each client is really doing before you plan their next session.",
    points: [
      "A quick daily check-in: sleep, pain, tiredness and stress.",
      "Sleep and workouts come in from their watch through Apple Health or Health Connect.",
      "Tiredness, stress and pain show as alerts you mark Busy fixing or Fixed.",
      "A daily summary for each client: their energy, and what to do about it.",
      "Recovery suggestions for them (sleep, stretching, active recovery) based on their training load.",
    ],
    demo: `
      <div class="m-title">🧠 Daily summary · James</div>
      <div class="pill low">Energy: Low</div>
      <div class="m-sub">Check-ins 6/7 · Workouts 3/4 · Sleep 5.5 h ⌚</div>
      <div class="m-card">Sleep has been short for 4 nights and he reported tiredness twice. Two heavy leg days this week.</div>
      <div class="m-card green"><b>Suggestions</b><br>• Lighten Thursday's legs or swap in mobility.<br>• Sleep is short: an earlier bedtime will help more than more training.</div>`,
  },
  {
    key: "payments",
    tab: "Payments",
    title: "Payment tracking",
    lead: "Know who has paid, who owes and what you earn, under your own brand.",
    points: [
      "Your logo and your own code: clients join you, not a marketplace.",
      "See who's active, waiting for approval, owes you money or has gone quiet.",
      "Clients upload proof of payment; you tap Paid and they're in.",
      "Set your prices for online and in-person packages, and see your monthly income.",
      "Use it on your phone, or on a laptop for planning at your desk.",
    ],
    demo: `
      <div class="m-title">👥 Clients</div>
      <div class="group">Active · 18</div>
      <div class="group amber-t">Awaiting payment · 2</div>
      <div class="m-card">💳 <b>Lerato sent proof of payment</b><br>R850 · Online coaching<div class="btn-mini">Paid, activate her</div></div>
      <div class="group">Waiting approval · 1</div>
      <div class="group muted-t">Dormant · 3</div>
      <div class="m-card">📈 This month: <b>R15 300</b> from 18 clients</div>`,
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
    <p class="lead">${escape(f.lead)}</p>
    <ul>${f.points.map((p) => `<li>${escape(p)}</li>`).join("")}</ul>
  </div>
  <div><div class="phone" aria-hidden="true"><div class="screen">${f.demo}</div></div><div class="caption">Example screen</div></div>
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
<meta property="og:image" content="/icon.png">
<meta property="og:type" content="website">
<link rel="icon" href="/icon.png">
<style>
  :root { color-scheme: dark; --gold: #D4AF37; --bg: #0F172A; --card: #111C33; --line: #1E293B; --text: #E2E8F0; --muted: #94A3B8; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  a { color: var(--gold); }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 16px; }
  header.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 0; }
  .brand { display: flex; align-items: center; gap: 10px; color: var(--gold); font-weight: 800; font-size: 18px; text-decoration: none; }
  .brand img { width: 40px; height: 40px; border-radius: 10px; }
  .login { color: var(--muted); font-size: 14px; text-decoration: none; }
  .hero { padding: 28px 0 36px; text-align: center; }
  .eyebrow { color: var(--gold); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 13px; }
  h1 { color: #fff; font-size: clamp(30px, 6vw, 48px); line-height: 1.12; margin: 10px auto 14px; max-width: 760px; }
  .sub { color: var(--muted); font-size: 18px; max-width: 640px; margin: 0 auto 24px; }
  .cta { display: inline-block; background: var(--gold); color: #111; font-weight: 800; font-size: 18px; padding: 15px 28px; border-radius: 12px; text-decoration: none; }
  .cta:hover { filter: brightness(1.08); }
  .fine { color: var(--muted); font-size: 13px; margin-top: 10px; }
  .control { background: linear-gradient(180deg, #1A2338, var(--card)); border: 2px solid var(--gold); border-radius: 18px; padding: 24px; margin: 0 0 28px; }
  .control h2 { color: var(--gold); font-size: clamp(22px, 4.5vw, 30px); margin: 0 0 6px; text-transform: uppercase; letter-spacing: .02em; }
  .control ul { margin: 12px 0; padding-left: 20px; }
  .control li { margin-bottom: 8px; }
  .control .strong { color: #fff; font-weight: 800; font-size: 18px; margin: 12px 0 0; }
  .prices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .price { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
  .price .where { color: #fff; font-weight: 700; }
  .price .where em { display: inline-block; margin-left: 6px; font-style: normal; font-size: 12px; color: #F59E0B; border: 1px solid #F59E0B; border-radius: 999px; padding: 1px 8px; }
  .price .amount { color: var(--gold); font-size: 36px; font-weight: 800; margin: 6px 0; }
  .price .amount span { color: var(--muted); font-size: 16px; font-weight: 400; }
  .price ul { margin: 0; padding-left: 20px; }
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
  .slide { display: none; grid-template-columns: 1fr 320px; gap: 32px; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 24px; }
  .slide.on { display: grid; }
  .slide h2 { color: var(--gold); margin: 0 0 6px; font-size: 24px; }
  .lead { color: #fff; font-size: 17px; margin: 0 0 12px; }
  .slide ul { margin: 0; padding-left: 20px; }
  .slide li { margin-bottom: 8px; color: var(--text); }
  .nav { display: flex; justify-content: space-between; margin-top: 12px; }
  .nav button { background: none; border: 1px solid var(--line); color: var(--gold); border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
  .phone { background: #05080F; border: 2px solid #2A3550; border-radius: 30px; padding: 12px; box-shadow: 0 20px 50px rgba(0,0,0,.45); }
  .screen { background: var(--bg); border-radius: 20px; padding: 14px 12px; min-height: 420px; font-size: 13px; }
  .caption { text-align: center; color: var(--muted); font-size: 12px; margin-top: 8px; }
  .m-title { color: var(--gold); font-weight: 800; font-size: 15px; margin-bottom: 8px; }
  .m-sub { color: var(--muted); font-size: 12px; margin: 4px 0 8px; }
  .m-card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px; margin-top: 8px; }
  .m-card.amber { border-color: #B45309; }
  .m-card.green { border-color: #15803D; }
  .m-card.blue { border-color: #3B82F6; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chips span { background: #13301F; color: #86EFAC; border-radius: 999px; padding: 3px 9px; font-size: 12px; }
  .week { display: grid; gap: 5px; }
  .week .d { display: grid; grid-template-columns: 36px 1fr; align-items: center; background: var(--card); border-radius: 9px; padding: 6px 8px; }
  .week .d i { grid-column: 2; color: var(--muted); font-style: normal; font-size: 11px; }
  .week b { color: var(--muted); font-size: 12px; }
  .g { color: var(--gold); font-weight: 700; } .t { color: #2DD4BF; font-weight: 700; } .p { color: #C084FC; font-weight: 700; } .r { color: #4ADE80; font-weight: 700; } .m { color: #64748B; }
  .targets { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .targets div { background: var(--card); border-radius: 10px; padding: 10px; text-align: center; }
  .targets b { color: #fff; font-size: 18px; display: block; } .targets i { color: var(--muted); font-style: normal; font-size: 12px; }
  .pill { display: inline-block; border: 1px solid #F97316; color: #F97316; border-radius: 999px; padding: 2px 10px; font-weight: 700; font-size: 12px; }
  .group { color: #fff; font-weight: 700; margin-top: 10px; }
  .group i { color: var(--muted); font-weight: 400; font-style: normal; }
  .amber-t { color: #F59E0B; } .muted-t { color: var(--muted); }
  .btn-mini { display: inline-block; margin-top: 8px; background: #22C55E; color: #fff; border-radius: 8px; padding: 5px 10px; font-weight: 700; font-size: 12px; }
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
    .why, .modes, .steps, .prices { grid-template-columns: 1fr; }
    .control { padding: 18px; }
    .slide.on { grid-template-columns: 1fr; padding: 18px; gap: 18px; }
    .phone { max-width: 320px; width: 100%; margin: 0 auto; }
    .screen { min-height: 0; }
    .tabs { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; padding-bottom: 4px; }
    .tab { flex: none; }
    .sticky { display: block; position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgba(15,23,42,.96); border-top: 1px solid var(--line); }
    .sticky .cta { display: block; text-align: center; font-size: 17px; padding: 13px; }
  }
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="brand" href="/"><img src="/icon.png" alt="">Daily Evolution</a>
  <a class="login" href="/app/">Trainer login</a>
</header>

<section class="hero">
  <div class="eyebrow">For personal trainers</div>
  <h1>The coaching app that thinks like a coach.</h1>
  <p class="sub">Most trainer apps just hand out workouts. Daily Evolution plans, adjusts and protects your clients for you, and keeps track of who has paid, so you can coach more people, better, in less time.</p>
  <a class="cta" href="${SIGNUP}">Start your free 30-day trial</a>
  <div class="fine"><strong>No credit card required.</strong> Apply in a few minutes.</div>
  <div class="fine">Your clients remain under your coaching control. No independent client access.</div>
</section>

<section class="control">
  <h2>Your clients. Your business. Your control.</h2>
  <p class="lead">Daily Evolution is built exclusively around personal trainers and coaches.</p>
  <ul>
    <li>No client can use the coaching platform without being connected to an approved trainer.</li>
    <li>Every trainer has a unique reference code that clients must use to join.</li>
    <li>Each trainer manages their own private client network.</li>
    <li>Trainers can't access or view another trainer's clients.</li>
    <li>You control your clients' access to your coaching.</li>
    <li>When a client's subscription expires or payment is outstanding, you can suspend their access in line with the platform's payment rules.</li>
    <li>Clients can only use their programmes and coaching while you've authorised them.</li>
  </ul>
  <p class="strong">Daily Evolution doesn't replace personal trainers. It empowers them.</p>
</section>

<div class="why">
  <div><b>Safer clients</b><p>Injury checks, pain tracking and no sets to failure in a client's first 6 weeks.</p></div>
  <div><b>Smarter plans</b><p>Starting weights, progression and deload weeks worked out from each client's real logs.</p></div>
  <div><b>Less admin</b><p>Check-ins, daily summaries and payments come to you. No more chasing.</p></div>
</div>

<h2 class="section">See what it does</h2>
<p class="section">Tap through what sets it apart: injury-aware programming, intelligent progression with fatigue monitoring and deload suggestions, nutrition, recovery and payment tracking.</p>
<div class="tabs" role="tablist">${tabs}</div>
${slides}
<div class="nav"><button type="button" id="prev">‹ Back</button><button type="button" id="next">Next ›</button></div>

<div class="modes">${modes}</div>

<h2 class="section">Simple pricing</h2>
<p class="section">Free for 30 days, then pay only for what you use.</p>
<div class="prices">
  <div class="price">
    <div class="where">🇿🇦 South Africa</div>
    <div class="amount">R400<span>/month</span></div>
    <ul>
      <li>First 5 active clients included</li>
      <li>R100/month per additional active client</li>
    </ul>
  </div>
  <div class="price">
    <div class="where">🌍 International <em>Proposed USD pricing</em></div>
    <div class="amount">$50<span>/month</span></div>
    <ul>
      <li>6 months: $250 upfront</li>
      <li>12 months: $450 upfront</li>
      <li>$10/month per additional active client</li>
    </ul>
    <p class="note">Proposed until the payment provider and currency arrangements are confirmed.</p>
  </div>
</div>
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
<div class="sticky"><a class="cta" href="${SIGNUP}">Start your free 30-day trial</a></div>
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
      tabs[cur].scrollIntoView({ block: "nearest", inline: "center" });
    }
    for (var k = 0; k < tabs.length; k++) tabs[k].addEventListener("click", function () { show(Number(this.dataset.i)); });
    document.getElementById("prev").addEventListener("click", function () { show(cur - 1); });
    document.getElementById("next").addEventListener("click", function () { show(cur + 1); });
  })();
</script>
</body>
</html>
`;
}
