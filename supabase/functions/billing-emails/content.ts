// The words of each trainer payment email (0219). Kept apart from the sender
// so it can be checked by the app's tests (src/lib/billingEmails.test.ts).
// Plain words, one gold "Pay now" button to the website, and three steps.

export type BillingEmailKind = "welcome" | "plan_due" | "plan_due_today" | "plan_overdue" | "client_fees" | "client_fees_overdue";

type Details = {
  due_on?: string | null;
  autopay?: boolean;
  paused?: boolean;
  amount?: string;
  month?: string;
  clients?: number;
  trial_ends_at?: string | null;
  free_use_from?: string | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 2026-12-01 -> "1 December". */
export function niceDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STEPS = (link: string) => [
  `Go to ${link} (on your phone or laptop).`,
  "Log in with the same email and password you use in the app.",
  "Tap Pay by card, and tick \"Save my card\" so it pays itself every month. Your EFT details are there too.",
];

export function billingEmail(
  kind: BillingEmailKind,
  raw: Record<string, unknown>,
  who: { name: string; site: string },
): { subject: string; html: string; text: string } {
  const d = raw as Details;
  const link = `${who.site.replace(/\/$/, "")}/app/`;
  const linkText = link.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const first = (who.name || "").trim().split(/\s+/)[0] || "there";
  const due = niceDate(d.due_on);
  // With a saved card nothing needs doing, so no button.
  let subject: string;
  let lines: string[];
  let button: string | null = "Pay now";
  let steps = true;

  switch (kind) {
    case "welcome":
      subject = "How paying for Daily Evolution works";
      lines = [
        "Welcome to Daily Evolution. Your trainer account is approved.",
        d.free_use_from
          ? "You're on free use, so there's no monthly subscription. We'll email you before any client fees start."
          : d.trial_ends_at
            ? `Your free period runs until ${niceDate(d.trial_ends_at)}. You don't need to do anything until then.`
            : "There's nothing to pay right now.",
        "When it's time to pay, you pay on our website, not in the app. Here's how, so you have it ready:",
      ];
      button = "Open the website";
      break;
    case "plan_due":
    case "plan_due_today":
      subject = kind === "plan_due_today" ? "Your Daily Evolution plan is due today" : `Your Daily Evolution plan is due on ${due}`;
      if (d.autopay) {
        lines = [`Your plan is due on ${due}. Your saved card pays it automatically that morning, so there's nothing to do.`];
        button = null;
        steps = false;
      } else {
        lines = [
          kind === "plan_due_today" ? "Your Daily Evolution plan is due today." : `Your Daily Evolution plan is due on ${due}.`,
          "It takes a minute to pay on our website:",
        ];
      }
      break;
    case "plan_overdue":
      subject = "Your Daily Evolution plan is overdue";
      lines = [
        d.autopay
          ? "We couldn't take your plan payment from your saved card. Please pay on our website, or save a different card there."
          : "Your Daily Evolution plan payment hasn't come through yet.",
        d.paused
          ? "Your coach access is paused until it's paid. Your clients and their data are safe, and everything comes back as soon as you pay."
          : "Please pay soon to keep your coach access.",
      ];
      break;
    case "client_fees":
      subject = `Your client fees for ${d.month ?? "last month"}`;
      lines = [
        `Last month you had ${d.clients ?? "your"} active client${d.clients === 1 ? "" : "s"}. Your client fees are ${d.amount ?? "ready to see on the website"}${due ? `, due by ${due}` : ""}.`,
      ];
      if (d.autopay) {
        lines.push("Your saved card pays this automatically, so there's nothing to do.");
        button = null;
        steps = false;
      }
      break;
    case "client_fees_overdue":
      subject = "Your Daily Evolution client fees are overdue";
      lines = [
        `${d.amount ?? "Your client fees"} in client fees hasn't come through yet.`,
        d.autopay ? "We couldn't take it from your saved card. Please pay on our website, or save a different card there." : "Please pay soon to keep your coach access.",
      ];
      break;
  }

  const stepList = steps ? STEPS(linkText) : [];
  const sign = "Thanks,\nDaily Evolution";
  const help = "Questions? In the app, tap ☰ Menu › Report a problem.";

  const text = [
    `Hi ${first},`,
    "",
    ...lines,
    ...(stepList.length ? ["", ...stepList.map((s, i) => `${i + 1}. ${s}`)] : []),
    ...(button ? ["", `${button}: ${link}`] : []),
    "",
    help,
    "",
    sign,
  ].join("\n");

  const p = (s: string) => `<p style="margin:0 0 14px;color:#E2E8F0;font-size:15px;line-height:22px">${escapeHtml(s)}</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0F172A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1E293B;border:1px solid #334155;border-radius:12px">
<tr><td style="padding:24px 24px 8px;font-family:Arial,Helvetica,sans-serif">
<div style="color:#D4AF37;font-size:20px;font-weight:800;margin-bottom:4px">Daily Evolution</div>
<div style="color:#94A3B8;font-size:13px;margin-bottom:20px">Building a better you</div>
${p(`Hi ${first},`)}
${lines.map(p).join("\n")}
${
  stepList.length
    ? `<ol style="margin:0 0 18px;padding-left:20px;color:#E2E8F0;font-size:15px;line-height:22px">${stepList
        .map((s) => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`)
        .join("")}</ol>`
    : ""
}
${
  button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td style="background:#D4AF37;border-radius:10px"><a href="${link}" style="display:inline-block;padding:14px 26px;color:#0F172A;font-weight:800;font-size:16px;text-decoration:none">${escapeHtml(button)}</a></td></tr></table>`
    : ""
}
<p style="margin:0 0 14px;color:#94A3B8;font-size:13px;line-height:20px">${escapeHtml(help)}</p>
<p style="margin:0 0 20px;color:#E2E8F0;font-size:15px;line-height:22px">Thanks,<br>Daily Evolution</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, html, text };
}
