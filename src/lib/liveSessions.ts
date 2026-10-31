import type {
  BillingCurrency,
  InvoiceLine,
  LiveSession,
  RegularTime,
  SessionBilling,
  SessionInvoice,
  SessionPolicy,
  SessionKind,
} from "@/types/database";
import { money } from "@/lib/billing";

// In-person session booking (0168, GRIZZ 2026-10-31). A client buys N
// sessions a week at a fee; the sessions sit in a month calendar; a
// cancellation is credited when the client gave enough notice under their
// agreement and charged when it was late; after each session the trainer
// marks it done and the client confirms with one tap; on the 1st every
// client's invoice is made with a diary of every session (late in red, in
// time in green). Kept free of Supabase and React Native so it can be tested.
// sessionKind() and autoCharge() mirror the database's live_session_kind()
// and session_auto_charge().

export const TRAINER_LIVE_SESSIONS_MENU_ITEM = {
  key: "liveSessions",
  title: "Live sessions",
  icon: "🤝",
  summary: "Book in-person sessions, track cancellations and send each client's month-end invoice.",
};

export const CLIENT_SESSIONS_MENU_ITEM = {
  key: "mySessions",
  title: "My sessions",
  icon: "🤝",
  summary: "Your in-person sessions with your coach: times, cancelling, and your invoices.",
};

export const POLICIES: { key: SessionPolicy; label: string; short: string }[] = [
  { key: "24h", label: "24 hours' notice", short: "24 hours" },
  { key: "12h", label: "12 hours' notice", short: "12 hours" },
  { key: "trainer", label: "I decide each time", short: "Coach decides" },
];

export const BILLINGS: { key: SessionBilling; label: string; detail: string }[] = [
  { key: "advance", label: "In advance", detail: "Invoice on the 1st for the month's booked sessions. Cancellations in time come off the next one." },
  { key: "arrears", label: "In arrears", detail: "Invoice on the 1st for last month: sessions done plus late cancellations and no-shows." },
];

export const SESSION_LENGTHS = [30, 40, 45, 50, 60, 75, 90];

const pad = (n: number) => String(n).padStart(2, "0");

const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toClock = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/** "05:10:00" or "5:10" → "05:10"; null when it isn't a time. */
export function cleanTime(t: string | null | undefined): string | null {
  const m = /^(\d{1,2})[:.h](\d{2})/.exec((t ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${pad(Number(m[1]))}:${m[2]}`;
}

/**
 * The start times to offer on a day (GRIZZ, 2026-10-31: "if they start at
 * 5.10am sessions are staggered at 5.50, 6.30 etc. ... if they book a session
 * for 10am and they do 40 min sessions then next session is 10.40"). Steps by
 * the session length from the start of the day, and from the end of every
 * session already booked; times that would overlap a booked session or run
 * past the end of the day are left out.
 */
export function slotTimes(dayStart: string, dayEnd: string, minutes: number, booked: { time: string; minutes: number }[] = []): string[] {
  const start = toMins(cleanTime(dayStart) ?? "05:00");
  const end = toMins(cleanTime(dayEnd) ?? "20:00");
  const len = Math.max(15, minutes);
  const busy = booked.map((b) => ({ from: toMins(b.time), to: toMins(b.time) + b.minutes }));
  const anchors = [start, ...busy.map((b) => b.to)];
  const times = new Set<number>();
  for (const a of anchors) {
    for (let t = a; t + len <= end; t += len) {
      if (busy.some((b) => t < b.to && t + len > b.from)) break;
      times.add(t);
    }
  }
  return [...times].sort((a, b) => a - b).map(toClock);
}
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function policyHours(policy: SessionPolicy): number | null {
  return policy === "24h" ? 24 : policy === "12h" ? 12 : null;
}

export function policyLabel(policy: SessionPolicy): string {
  return POLICIES.find((p) => p.key === policy)?.label ?? policy;
}

export function billingLabel(billing: SessionBilling): string {
  return BILLINGS.find((b) => b.key === billing)?.label ?? billing;
}

/** Hours of notice given, to one decimal (0 or less is no notice). */
export function noticeHours(startsAt: string | Date, cancelledAt: string | Date): number {
  return Math.round((new Date(startsAt).getTime() - new Date(cancelledAt).getTime()) / 360000) / 10;
}

/** "30 hours' notice", "2 days' notice", "45 minutes' notice", "no notice". */
export function noticeText(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || hours <= 0) return "no notice";
  if (hours < 1) return `${Math.max(1, Math.floor(hours * 60))} minutes' notice`;
  if (hours < 48) return Math.floor(hours) === 1 ? "1 hour's notice" : `${Math.floor(hours)} hours' notice`;
  return `${Math.floor(hours / 24)} days' notice`;
}

/** Charge or credit a cancellation by its notice; null when the trainer decides. */
export function autoCharge(
  policy: SessionPolicy,
  by: "client" | "trainer",
  startsAt: string | Date,
  cancelledAt: string | Date
): "charge" | "credit" | null {
  if (by === "trainer") return "credit";
  const need = policyHours(policy);
  if (need === null) return null;
  return new Date(startsAt).getTime() - new Date(cancelledAt).getTime() >= need * 3600000 ? "credit" : "charge";
}

type KindFields = Pick<LiveSession, "status" | "starts_at" | "minutes" | "charge" | "cancelled_by">;

/** What a session counts as, for its colour and on an invoice. */
export function sessionKind(s: KindFields, now: Date = new Date()): SessionKind {
  if (s.status === "done") return "done";
  if (s.status === "booked") return new Date(s.starts_at).getTime() + s.minutes * 60000 < now.getTime() ? "unconfirmed" : "booked";
  if (s.status === "no_show") return s.charge === "credit" ? "excused" : s.charge === "makeup" ? "makeup" : "no_show";
  if (s.status === "removed") return "removed";
  if (s.cancelled_by === "trainer") return "trainer";
  if (s.charge === "charge") return "late";
  if (s.charge === "credit") return "notice";
  if (s.charge === "makeup") return "makeup";
  return "decide";
}

// Red for charged cancellations, green for in-time ones (GRIZZ's colours),
// blue when the coach cancelled, amber for anything still to sort out.
export const KIND_STYLE: Record<SessionKind, { label: string; colour: string; icon: string }> = {
  done: { label: "Trained", colour: "#D4AF37", icon: "✓" },
  unconfirmed: { label: "Not marked yet", colour: "#F59E0B", icon: "?" },
  booked: { label: "Booked", colour: "#94A3B8", icon: "•" },
  late: { label: "Late cancellation", colour: "#EF4444", icon: "✕" },
  no_show: { label: "No-show", colour: "#EF4444", icon: "✕" },
  notice: { label: "Cancelled in time", colour: "#22C55E", icon: "↺" },
  excused: { label: "Didn't come · credited", colour: "#22C55E", icon: "↺" },
  makeup: { label: "Cancelled in time · catch-up instead", colour: "#14B8A6", icon: "🔁" },
  trainer: { label: "Cancelled by coach", colour: "#3B82F6", icon: "↺" },
  decide: { label: "Charge or credit?", colour: "#F59E0B", icon: "!" },
  removed: { label: "Taken off", colour: "#64748B", icon: "–" },
};

/** "Late cancellation · 10 hours' notice", "Trained ✓ confirmed", for a diary line. */
export function kindDetail(
  kind: SessionKind,
  hours: number | null,
  opts: { clientOk?: boolean; disputed?: boolean; catchUp?: boolean; catchUpBooked?: boolean } = {}
): string {
  const base = kind === "done" && opts.catchUp ? "Catch-up session" : KIND_STYLE[kind].label;
  if (kind === "makeup") return `${base}${hours === null ? "" : ` · ${noticeText(hours)}`} · ${opts.catchUpBooked ? "catch-up booked" : "catch-up to book"}`;
  if (kind === "late" || kind === "notice" || kind === "decide") return hours === null ? base : `${base} · ${noticeText(hours)}`;
  if (kind === "done") return opts.disputed ? `${base} · client says it didn't happen` : opts.clientOk ? `${base} · client confirmed` : base;
  return base;
}

/** The client's side before they cancel: what it will cost under their rule. */
export function cancelPreview(policy: SessionPolicy, startsAt: string | Date, now: Date = new Date()): { charged: boolean | null; text: string } {
  const hours = noticeHours(startsAt, now);
  const need = policyHours(policy);
  if (need === null) {
    return { charged: null, text: `That's ${noticeText(hours)}. Your coach decides whether it's charged.` };
  }
  if (hours >= need) {
    return { charged: false, text: `That's ${noticeText(hours)}, so you'll get a credit or a catch-up session. Your coach will let you know which.` };
  }
  return {
    charged: true,
    text: `That's only ${noticeText(hours)}. Your agreement asks for ${need} hours, so this session will still be charged.`,
  };
}

/** "Tue 4 Nov" */
export function dayLabel(d: string | Date): string {
  const x = new Date(d);
  return `${SHORT_DAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}`;
}

/** "06:00" in the phone's time. */
export function clockLabel(d: string | Date): string {
  const x = new Date(d);
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

/** "2026-11-01": the first of the month a date is in (phone time). */
export function monthStart(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** "November 2026" from "2026-11-01". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** The month before or after "2026-11-01". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthStart(new Date(y, m - 1 + by, 1));
}

/** "2026-11-04" for a date, phone time (same as toIsoDate). */
export function dayKey(d: string | Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** The month as weeks of day keys, Monday first; null pads the edges. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The ISO time for a day key and "06:00", in the phone's time. */
export function atTime(day: string, time: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

// Monday first.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "Mon, Wed and Fri at 06:00" / "Mon 06:00, Thu 17:30". */
export function regularLabel(regular: RegularTime[], long = false): string {
  if (!regular.length) return "No regular times";
  const names = long ? LONG_DAYS : SHORT_DAYS;
  const sorted = [...regular].sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday) || a.time.localeCompare(b.time));
  const times = new Set(sorted.map((r) => r.time));
  if (times.size === 1) {
    const days = sorted.map((r) => names[r.weekday]);
    const list = days.length > 1 ? `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}` : days[0];
    return `${list} at ${sorted[0].time}`;
  }
  return sorted.map((r) => `${names[r.weekday]} ${r.time}`).join(", ");
}

/** One time per day: ticks a day on with a time, changes its time, or (null) takes it off. */
export function setDayTime(regular: RegularTime[], weekday: number, time: string | null): RegularTime[] {
  const rest = regular.filter((r) => r.weekday !== weekday);
  return time === null ? rest : [...rest, { weekday, time }];
}

/** Adds or takes off one regular time. */
export function toggleRegular(regular: RegularTime[], weekday: number, time: string): RegularTime[] {
  const on = regular.some((r) => r.weekday === weekday && r.time === time);
  return on ? regular.filter((r) => !(r.weekday === weekday && r.time === time)) : [...regular, { weekday, time }];
}

/** "R750", or "R600 (your share of R1 200 for 2 people)" for a split shared session. */
export function feeText(
  plan: { fee: number; group_size?: number | null; group_total?: number | null; solo_fee?: number | null },
  currency: BillingCurrency | null | undefined
): string {
  const own = money(Number(plan.fee), currency);
  const size = plan.group_size ?? 1;
  const solo = size > 1 && plan.solo_fee != null ? `, or ${money(Number(plan.solo_fee), currency)} when I train alone and the others are credited` : "";
  if (size > 1 && plan.group_total != null) return `${own} (my share of ${money(Number(plan.group_total), currency)} for ${size} people${solo})`;
  if (size > 1) return `${own} (a shared session with ${size} people${solo})`;
  return own;
}

/**
 * After a group session: each person's fee for it. With the special rate, one
 * person training alone (the rest credited) pays their solo fee; otherwise
 * everyone keeps their normal share.
 */
export function groupFees(
  people: { id: string; came: boolean; fee: number; soloFee: number | null }[],
  missed: "charge" | "credit"
): Record<string, number> {
  const came = people.filter((p) => p.came);
  const alone = came.length === 1 && missed === "credit" && people.length > 1;
  return Object.fromEntries(people.map((p) => [p.id, alone && p.came && p.soloFee != null ? p.soloFee : p.fee]));
}

export function sessionMoney(amount: number, currency: BillingCurrency | null | undefined): string {
  return amount < 0 ? `-${money(-amount, currency)}` : money(amount, currency);
}

const MARK: Partial<Record<SessionKind, string>> = {
  done: "✅",
  unconfirmed: "✅",
  booked: "📅",
  late: "🔴",
  no_show: "🔴",
  notice: "🟢",
  excused: "🟢",
  makeup: "🔁",
  trainer: "🔵",
  decide: "🟠",
};

export type InvoiceTextOptions = {
  /** "whatsapp" uses *bold*; "email" is plain text. */
  style: "whatsapp" | "email";
  /** The trainer's bank details, from eftRows(). */
  payTo?: { label: string; value: string }[];
};

/**
 * The invoice laid out for WhatsApp or email (GRIZZ, 2026-10-31: "a well laid
 * out invoice style ... sent via email or WhatsApp"): who it's from and to,
 * every session with its colour, a count of each kind, the total and where
 * to pay.
 */
export function invoiceText(inv: SessionInvoice, clientName: string, coachName: string, opts: InvoiceTextOptions = { style: "whatsapp" }): string {
  const b = (t: string) => (opts.style === "whatsapp" ? `*${t}*` : t.toUpperCase());
  const lines = [...inv.lines].sort((a, x) => a.at.localeCompare(x.at));
  const row = (l: InvoiceLine) => {
    const what = kindDetail(l.kind, l.notice_hours, { catchUp: l.catch_up, catchUpBooked: l.catch_up_booked });
    const amount = l.role === "diary" ? "no charge" : sessionMoney(l.amount, inv.currency);
    const credit = l.role === "credit" ? " (credit, paid last month)" : "";
    return `${MARK[l.kind] ?? "▫️"} ${dayLabel(l.at)}, ${clockLabel(l.at)} · ${what}${credit} · ${amount}`;
  };
  const count = (kinds: SessionKind[]) => lines.filter((l) => l.role !== "credit" && kinds.includes(l.kind)).length;
  const counts = [
    [count(["done", "unconfirmed"]), "trained"],
    [count(["booked"]), "booked"],
    [count(["late", "no_show"]), "late or no-show"],
    [count(["notice", "makeup"]), "cancelled in time"],
    [count(["excused"]), "missed, credited"],
    [count(["trainer"]), "cancelled by coach"],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");
  const due = inv.total < 0 ? `${b(`In credit: ${money(-inv.total, inv.currency)}`)}` : b(`Total due: ${sessionMoney(inv.total, inv.currency)}`);
  return [
    b(`INVOICE · ${monthLabel(inv.month)}`),
    `From: ${coachName}`,
    `To: ${clientName}`,
    `Billing: ${billingLabel(inv.billing).toLowerCase()}${inv.status === "paid" ? " · PAID ✅" : ""}`,
    "",
    b("Sessions"),
    ...lines.map(row),
    "",
    ...(counts ? [counts, ""] : []),
    `Sessions: ${sessionMoney(inv.charged, inv.currency)}`,
    ...(inv.credited ? [`Credits: -${money(inv.credited, inv.currency)}`] : []),
    due,
    ...(opts.payTo?.length && inv.total > 0
      ? ["", b("Pay to"), ...opts.payTo.map((r) => `${r.label}: ${r.value}`), `Reference: ${clientName} ${monthLabel(inv.month)}`]
      : []),
    "",
    "🔴 late cancellation or no-show (charged) · 🟢 cancelled in time · 🔁 catch-up instead of credit · 🔵 cancelled by coach",
  ].join("\n");
}

// The agreement the client signs: GRIZZ's text (2026-10-31). Each trainer can
// change it under Live sessions › Setup. The words in { } are filled in for
// each client from their plan; the client signs with a tick, their name and
// the date, saved with the exact text they saw.
export const AGREEMENT_TEMPLATE = `1. Please note, all sessions are paid for {paid}. This secures your time slots.
2. We have a {cancelHours} hour cancellation policy. This allows the trainer to find an alternate to fill the slot. Late cancellations will be forfeited.
3. All trainers need to be given 1 calendar month's notice before cancelling (vacating) your training slot. This is to allow them time to fill your slot on completion of training.

• Please also note that to secure your time slot when going on holiday or business for more than 2 weeks, a 50% deposit will be required. This is not compulsory but at the client's discretion if they want to keep that time slot.
• Once again, please do understand that if you go away the trainers do not earn an income and cannot keep slots indefinitely.

Please be considerate of the fact that all trainers sell time, and their time is limited.
If you have any complaints or queries feel free to contact me on {contact}.

• This is to confirm that I accept the rate of {fee} for a {length} min session.
• My confirmed slot is {slots}.

Please acknowledge that you understand all of the above and sign if you agree.`;

// What each { } word means, shown to the trainer under the agreement box.
export const AGREEMENT_WORDS: { word: string; means: string }[] = [
  { word: "{fee}", means: "the client's fee per session" },
  { word: "{length}", means: "their session length in minutes" },
  { word: "{slots}", means: "their days and times, e.g. Monday, Wednesday and Friday at 05:50" },
  { word: "{cancelHours}", means: "24 or 12, from their cancellation rule" },
  { word: "{paid}", means: "in advance or in arrears" },
  { word: "{contact}", means: "your phone number" },
  { word: "{coach}", means: "your name" },
  { word: "{client}", means: "the client's name" },
];

export type AgreementTerms = {
  coach: string;
  client: string;
  fee: string;
  policy: SessionPolicy;
  billing: SessionBilling;
  minutes: number;
  regular: RegularTime[];
  contact?: string | null;
};

export function fillAgreement(template: string | null | undefined, t: AgreementTerms): string {
  return (template?.trim() ? template : AGREEMENT_TEMPLATE)
    .replace(/\{coach\}/g, t.coach)
    .replace(/\{client\}/g, t.client)
    .replace(/\{fee\}/g, t.fee)
    .replace(/\{length\}/g, String(t.minutes))
    .replace(/\{slots\}/g, t.regular.length ? regularLabel(t.regular, true) : "to be arranged each week with my trainer")
    .replace(/\{cancelHours\}/g, String(policyHours(t.policy) ?? 24))
    .replace(/\{paid\}/g, t.billing === "advance" ? "in advance" : "in arrears (at the end of each month)")
    .replace(/\{contact\}/g, t.contact?.trim() || "WhatsApp");
}

type Terms = { fee: number; per_week: number; group_size?: number | null; billing: SessionBilling; policy: SessionPolicy; regular?: RegularTime[] | null };
const slotKey = (r: RegularTime[] | null | undefined) =>
  (r ?? [])
    .map((x) => `${x.weekday}@${x.time}`)
    .sort()
    .join(",");

/** Signed for these exact terms? A change of fee, rule, billing or slot needs a new signature. */
export function agreementCurrent(signed: Terms | null | undefined, plan: Terms | null | undefined): boolean {
  if (!signed || !plan) return false;
  return (
    Number(signed.fee) === Number(plan.fee) &&
    signed.per_week === plan.per_week &&
    (signed.group_size ?? 1) === (plan.group_size ?? 1) &&
    signed.billing === plan.billing &&
    signed.policy === plan.policy &&
    slotKey(signed.regular) === slotKey(plan.regular)
  );
}

/** Sessions the trainer still has to sort out: past and unmarked, or a cancellation to decide. */
export function needsTrainer(s: KindFields, now: Date = new Date()): boolean {
  const kind = sessionKind(s, now);
  return kind === "unconfirmed" || kind === "decide";
}

export const STORAGE_BUCKET = "session-proofs";

/** Where a cancellation screenshot goes: the client's folder. */
export function proofPath(clientId: string, sessionId: string, now: Date = new Date()): string {
  return `${clientId}/${sessionId}-${now.getTime()}.jpg`;
}
