// The front page, dailyevolution.co.za (GRIZZ, 2026-11-21 design review: "looks
// very basic"). A front door for both kinds of visitor: clients get the app,
// trainers go to /trainers. Real app pictures (scripts/site-assets, copied to
// /img by build-site.mjs), the heading font the app uses, and small, quick
// movement that switches off for anyone whose device asks for less motion.

export const SITE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

// Shared look for every page on the site: colours, fonts, buttons, movement.
export const SITE_BASE_CSS = `
  :root {
    color-scheme: dark;
    --gold: #D4AF37; --gold-soft: #E9CF7A; --gold-deep: #A8871F;
    --bg: #070B14; --bg-2: #0B1220; --card: #0F172A; --card-2: #131C31;
    --line: rgba(255,255,255,.07); --line-2: rgba(255,255,255,.12);
    --text: #E7EBF3; --muted: #94A0B6; --white: #FFFFFF;
    --ease: cubic-bezier(.23, 1, .32, 1);
    --head: "Barlow Semi Condensed", "Arial Narrow", system-ui, sans-serif;
    --body: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { overflow-x: clip; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--body); -webkit-font-smoothing: antialiased; }
  a { color: var(--gold-soft); }
  h1, h2, h3 { font-family: var(--head); font-weight: 700; letter-spacing: .005em; color: var(--white); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 0 24px; border-radius: 14px;
    font: 700 17px/1 var(--body); text-decoration: none; cursor: pointer; border: 0;
    transition: transform .16s var(--ease), filter .2s var(--ease), background-color .2s var(--ease), border-color .2s var(--ease); }
  .btn:active { transform: scale(.97); }
  .btn-gold { background: linear-gradient(180deg, #E2C04F, var(--gold)); color: #15110A; box-shadow: 0 1px 0 rgba(255,255,255,.35) inset, 0 10px 30px -10px rgba(212,175,55,.6); }
  .btn-line { background: rgba(255,255,255,.03); color: var(--white); border: 1.5px solid var(--line-2); }
  @media (hover: hover) and (pointer: fine) {
    .btn-gold:hover { filter: brightness(1.07); }
    .btn-line:hover { border-color: var(--gold); background: rgba(212,175,55,.06); }
  }
  .btn:focus-visible { outline: 2px solid var(--gold-soft); outline-offset: 3px; }
  .rise { opacity: 0; transform: translateY(12px); animation: rise .6s var(--ease) forwards; }
  @keyframes rise { to { opacity: 1; transform: none; } }
  .reveal { opacity: 0; transform: translateY(16px); transition: opacity .6s var(--ease), transform .6s var(--ease); }
  .reveal.in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    .rise, .reveal { opacity: 1; transform: none; }
  }
`;

// Shows sections gently as they scroll into view (once each).
export const REVEAL_JS = `<script>
(function () {
  var els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach(function (e) { io.observe(e); });
})();
</script>`;

const phone = (src, alt, cls = "") =>
  `<div class="phone ${cls}"><img src="${src}" alt="${alt}" width="360" height="640" loading="eager" decoding="async"></div>`;

export function homePage(escape, SITE) {
  const features = [
    ["/img/home-workout.webp", "Train", "Your coach's plan, set by set", "Every exercise with how to do it, your weights from last time, and a rest timer that starts by itself."],
    ["/img/home-today.webp", "Check in", "Ten seconds a day", "Tell your coach how you slept, ate and feel with a few taps. They see it, and adjust your plan."],
    ["/img/home-nutrition.webp", "Eat", "Eat for your goal", "A meal plan from your coach, cooking ideas, sauces and a shopping list in one tap."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Daily Evolution - Building a better you</title>
<meta name="description" content="Daily Evolution is the coaching app for personal trainers and their clients in South Africa: training plans, daily check-ins, meal plans and progress, all in one place.">
<link rel="canonical" href="${SITE}/">
<meta property="og:title" content="Daily Evolution - Building a better you">
<meta property="og:description" content="Your coach's plan, daily check-ins, meal plans and progress in one app.">
<meta property="og:image" content="${SITE}/img/home-og.png">
<meta property="og:url" content="${SITE}/">
<meta property="og:type" content="website">
<meta name="theme-color" content="#070B14">
<link rel="icon" href="/icon.png">
${SITE_FONTS}
<style>
${SITE_BASE_CSS}
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
  header.top { display: flex; align-items: center; justify-content: space-between; padding: 18px 0; }
  .brand { display: flex; align-items: center; gap: 10px; color: var(--white); text-decoration: none; font: 700 20px/1 var(--head); letter-spacing: .02em; }
  .brand img { width: 38px; height: 38px; border-radius: 10px; }
  .brand span { color: var(--gold); }
  .top nav { display: flex; gap: 22px; font-size: 15px; }
  .top nav a { color: var(--muted); text-decoration: none; transition: color .2s var(--ease); }
  .top nav a:hover { color: var(--white); }

  .hero { position: relative; display: grid; grid-template-columns: 1.05fr .95fr; gap: 40px; align-items: center; padding: 40px 0 80px; }
  .hero::before { content: ""; position: absolute; inset: -120px -20% auto auto; width: 720px; height: 720px; pointer-events: none;
    background: radial-gradient(closest-side, rgba(212,175,55,.18), rgba(212,175,55,0)); }
  .eyebrow { display: inline-flex; align-items: center; gap: 8px; color: var(--gold-soft); font-weight: 600; font-size: 14px; letter-spacing: .04em;
    padding: 6px 12px; border: 1px solid rgba(212,175,55,.3); border-radius: 999px; background: rgba(212,175,55,.06); }
  .hero h1 { font-size: clamp(46px, 7vw, 84px); line-height: .98; margin: 18px 0 18px; text-transform: uppercase; }
  .hero h1 em { font-style: normal; color: var(--gold); }
  .hero .sub { color: var(--muted); font-size: 19px; max-width: 520px; margin: 0 0 30px; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; }
  .fine { color: var(--muted); font-size: 13px; margin-top: 14px; }

  .phones { position: relative; height: 600px; }
  .phone { position: absolute; width: 270px; border-radius: 40px; padding: 9px; background: linear-gradient(160deg, #2A3550, #0B1120 60%);
    box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset, 0 40px 80px -20px rgba(0,0,0,.7), 0 20px 40px -20px rgba(212,175,55,.25); }
  .phone img { display: block; width: 100%; height: auto; border-radius: 32px; }
  .phones .p1 { left: 8%; top: 40px; transform: rotate(-5deg); z-index: 1; }
  .phones .p2 { right: 6%; top: 0; transform: rotate(4deg); z-index: 2; }
  .phones .rise.p1 { animation-delay: .15s; } .phones .rise.p2 { animation-delay: .28s; }
  @keyframes riseTilt1 { from { opacity: 0; transform: translateY(24px) rotate(-5deg); } to { opacity: 1; transform: rotate(-5deg); } }
  @keyframes riseTilt2 { from { opacity: 0; transform: translateY(24px) rotate(4deg); } to { opacity: 1; transform: rotate(4deg); } }
  .phones .p1.rise { opacity: 0; animation: riseTilt1 .8s var(--ease) .15s forwards; }
  .phones .p2.rise { opacity: 0; animation: riseTilt2 .8s var(--ease) .3s forwards; }

  .band { background: var(--bg-2); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .section { padding-top: 84px; padding-bottom: 84px; }
  .section h2 { font-size: clamp(34px, 4.6vw, 52px); line-height: 1.02; margin: 0 0 12px; text-transform: uppercase; }
  .section .lede { color: var(--muted); font-size: 18px; max-width: 620px; margin: 0 0 44px; }
  .center { text-align: center; } .center .lede { margin-left: auto; margin-right: auto; }

  .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .feature { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 22px; overflow: hidden;
    transition: transform .3s var(--ease), border-color .3s var(--ease); }
  @media (hover: hover) and (pointer: fine) { .feature:hover { transform: translateY(-4px); border-color: rgba(212,175,55,.35); } }
  .feature .shot { height: 300px; overflow: hidden; padding: 22px 34px 0; background: radial-gradient(120% 80% at 50% 0%, rgba(212,175,55,.14), transparent 70%); }
  .feature .shot img { width: 100%; border-radius: 22px 22px 0 0; display: block; box-shadow: 0 -1px 0 rgba(255,255,255,.08), 0 20px 40px rgba(0,0,0,.5); }
  .feature .txt { padding: 22px 24px 26px; }
  .tag { color: var(--gold); font: 700 13px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; }
  .feature h3 { font-size: 26px; margin: 8px 0 6px; line-height: 1.1; }
  .feature p { color: var(--muted); margin: 0; font-size: 15px; }

  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; counter-reset: s; }
  .step { position: relative; padding: 26px 24px; border: 1px solid var(--line); border-radius: 20px; background: rgba(255,255,255,.015); counter-increment: s; }
  .step::before { content: counter(s); display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; margin-bottom: 16px;
    background: rgba(212,175,55,.12); color: var(--gold); font: 700 22px/1 var(--head); border: 1px solid rgba(212,175,55,.3); }
  .step h3 { font-size: 22px; margin: 0 0 6px; }
  .step p { color: var(--muted); margin: 0; font-size: 15px; }

  .trainer { display: grid; grid-template-columns: 1.2fr .8fr; gap: 30px; align-items: center; padding: 44px; border-radius: 28px;
    border: 1px solid rgba(212,175,55,.35); background: radial-gradient(120% 140% at 100% 0%, rgba(212,175,55,.16), transparent 55%), var(--card); }
  .trainer h2 { margin: 6px 0 10px; }
  .trainer p { color: var(--muted); margin: 0 0 22px; font-size: 17px; }
  .trainer ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .trainer li { display: flex; gap: 12px; align-items: flex-start; color: var(--text); }
  .trainer li::before { content: ""; flex: none; width: 20px; height: 20px; margin-top: 3px; border-radius: 6px; background: var(--gold);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5 10.5l3 3 7-7' stroke='black' stroke-width='2.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5 10.5l3 3 7-7' stroke='black' stroke-width='2.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat; }

  footer { padding: 36px 0 48px; color: var(--muted); font-size: 14px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; }
  footer nav { display: flex; flex-wrap: wrap; gap: 18px; }
  footer a { color: var(--muted); text-decoration: none; } footer a:hover { color: var(--white); }

  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; padding: 16px 0 40px; text-align: center; }
    .hero .sub { margin-left: auto; margin-right: auto; }
    .ctas { justify-content: center; }
    .phones { height: 440px; max-width: 400px; width: 100%; margin: 8px auto 0; }
    .phone { width: 200px; border-radius: 32px; padding: 7px; } .phone img { border-radius: 26px; }
    .phones .p1 { left: 2%; top: 30px; } .phones .p2 { right: 2%; }
    .features, .steps { grid-template-columns: 1fr; }
    .feature .shot { height: 260px; }
    .trainer { grid-template-columns: 1fr; padding: 28px 22px; }
    .top nav .hide-sm { display: none; }
    .top nav { gap: 16px; }
    .brand { font-size: 17px; gap: 8px; } .brand img { width: 32px; height: 32px; }
    .section { padding-top: 60px; padding-bottom: 60px; }
  }
  @media (max-width: 420px) { .ctas .btn { width: 100%; } }
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="brand" href="/"><img src="/icon.png" alt="">DAILY <span>EVOLUTION</span></a>
  <nav><a href="/trainers">For trainers</a><a class="hide-sm" href="/support">Support</a><a href="/app/">Log in</a></nav>
</header>

<section class="hero">
  <div>
    <div class="eyebrow rise">Coaching app · Made in South Africa</div>
    <h1 class="rise" style="animation-delay:.06s">Building a <em>better</em> you.</h1>
    <p class="sub rise" style="animation-delay:.12s">Your coach's training plan, daily check-ins, meal plan and progress, all in one app. Every day a little stronger.</p>
    <div class="ctas rise" style="animation-delay:.18s">
      <a class="btn btn-gold" href="/android">I'm a client: get the app</a>
      <a class="btn btn-line" href="/trainers">I'm a personal trainer</a>
    </div>
    <div class="fine rise" style="animation-delay:.24s">Clients join with their trainer's code. iPhone? Ask your trainer for the link.</div>
  </div>
  <div class="phones" aria-hidden="true">
    ${phone("/img/home-today.webp", "", "p1 rise")}
    ${phone("/img/home-logset.webp", "", "p2 rise")}
  </div>
</section>
</div>

<div class="band">
<section class="section wrap center reveal">
  <h2>Everything your coach plans.<br>In your pocket.</h2>
  <p class="lede">No more screenshots, spreadsheets and lost WhatsApp messages. Open the app and you know exactly what to do today.</p>
  <div class="features">
    ${features
      .map(
        ([img, tag, title, text]) => `<article class="feature reveal">
      <div class="shot"><img src="${img}" alt="${escape(title)}" width="360" height="640" loading="lazy" decoding="async"></div>
      <div class="txt"><div class="tag">${escape(tag)}</div><h3>${escape(title)}</h3><p>${escape(text)}</p></div>
    </article>`,
      )
      .join("\n    ")}
  </div>
</section>
</div>

<section class="section wrap reveal">
  <h2>Start in three steps</h2>
  <p class="lede">Daily Evolution is for clients of trainers who use it, so your trainer is with you from day one.</p>
  <div class="steps">
    <div class="step"><h3>Get your trainer's code</h3><p>Your trainer gives you a short code. It links you to them and nobody else.</p></div>
    <div class="step"><h3>Download the app</h3><p>Install Daily Evolution and sign up with your code. It takes about two minutes.</p></div>
    <div class="step"><h3>Check in and train</h3><p>Tap through your daily check-in, open today's workout and go. Your coach sees it all.</p></div>
  </div>
</section>

<section class="section wrap reveal" style="padding-top:0">
  <div class="trainer">
    <div>
      <div class="tag">For personal trainers</div>
      <h2>Coach more people.<br>Better. In less time.</h2>
      <p>Plans that adjust themselves, injury checks, safe nutrition, your 1 on 1 calendar and who has paid, all in one place.</p>
      <a class="btn btn-gold" href="/trainers">Try it free for 30 days</a>
    </div>
    <ul>
      <li>Your clients join only through your code</li>
      <li>Your logo on your clients' app</li>
      <li>No credit card to start</li>
    </ul>
  </div>
</section>

<div class="wrap">
<footer>
  <div>© Daily Evolution · Building a better you</div>
  <nav><a href="/trainers">For trainers</a><a href="/android">Get the app</a><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/delete-account">Delete your account</a><a href="/app/">Log in on a laptop</a></nav>
</footer>
</div>
${REVEAL_JS}
</body>
</html>
`;
}
