import React from "react";
import { View, Text, StyleSheet } from "react-native";

type DailySix = {
  icon: string;
  title: string;
  body: string;
  bullets?: string[];
  subsections?: { label: string; items: string }[];
  note?: string;
};

const DAILY_SIX: DailySix[] = [
  {
    icon: "☀️",
    title: "1. Morning Light",
    body: "Within 30-60 minutes of waking:",
    bullets: ["Get outside", "10-20+ minutes of natural daylight", "Ideally combine this with a short walk"],
    note: "Why? Morning light helps anchor your circadian rhythm, which influences sleep, alertness, hormones and metabolism.",
  },
  {
    icon: "🫁",
    title: "2. Calm Your Nervous System",
    body: "5 minutes every day. Sit comfortably. Breathe gently through your nose: inhale ~4 seconds, exhale ~6 seconds. Don't force deep breaths.\n\nThink: slow → quiet → relaxed.\n\nRepeat once or twice during the day when stress is high.",
  },
  {
    icon: "🚶",
    title: "3. Move Your Body",
    body: "Your target is daily movement, not punishment.",
    bullets: [
      "Regular walking",
      "Break up long periods of sitting",
      "Walk for 5-15 minutes after meals when possible",
    ],
    note: "Build towards approximately 7,000-10,000 steps/day, but start wherever you currently are. Your starting point matters more than somebody else's number.",
  },
  {
    icon: "🥗",
    title: "4. Nourish Your Body",
    body: "Build most meals around: PROTEIN + PLANTS + CARBOHYDRATES + HEALTHY FAT",
    subsections: [
      { label: "Protein", items: "Eggs · fish · chicken · lean meat · Greek yoghurt · cottage cheese · legumes" },
      { label: "Plants", items: "Vegetables · salads · berries · fruit · herbs" },
      { label: "Carbohydrates", items: "Potatoes · oats · rice · fruit · beans · whole grains" },
      { label: "Healthy fats", items: "Olive oil · avocado · nuts · seeds · oily fish" },
    ],
    note: "Simple meal rule: start with protein, add vegetables or fruit, add the carbohydrate your body needs, add some healthy fat. Don't obsess over perfection - aim for 80-90% good choices, not 100%.",
  },
  {
    icon: "😴",
    title: "5. Protect Your Sleep",
    body: "Aim for approximately 7-9 hours. Try to keep your wake time reasonably consistent.\n\n60-90 minutes before bed:",
    bullets: [
      "Reduce bright lights",
      "Reduce stimulating content",
      "Finish eating if possible",
      "Put the phone away",
      "Take a warm shower/bath",
      "Read, stretch or breathe",
      "Keep the bedroom dark and comfortable",
    ],
    note: "Your evening routine starts before you get into bed.",
  },
  {
    icon: "🏋️",
    title: "6. Build a Strong Body",
    body: "Strength training: 2-3 sessions/week. Focus on: squat, hinge, push, pull, carry, core. Start with manageable weights - the goal is to progressively become stronger, not exhausted.\n\nCardio: 2-4 sessions/week. Mostly comfortable aerobic exercise: walking, cycling, swimming, jogging, hiking. You should be able to speak in sentences during most easy sessions.",
  },
];

const PHASES: { range: string; name: string; bullets: string[] }[] = [
  {
    range: "Weeks 1-2",
    name: "CALM",
    bullets: ["Morning light", "5 minutes breathing", "Daily walking", "Consistent wake time"],
  },
  {
    range: "Weeks 3-4",
    name: "RHYTHM",
    bullets: ["Consistent meals", "Protein at each meal", "Evening wind-down", "Reduce late-night stimulation"],
  },
  {
    range: "Weeks 5-8",
    name: "BUILD",
    bullets: ["Progressive strength training", "Structured cardio", "Increased daily movement", "Better food quality"],
  },
  {
    range: "Weeks 9-12",
    name: "OPTIMISE",
    bullets: [
      "Body composition",
      "Strength",
      "Cardiovascular fitness",
      "Energy",
      "Sleep quality",
      "Menstrual symptoms/cycle patterns",
      "Stress resilience",
      "Nutrition requirements",
    ],
  },
];

type TrainingSession = { label: string; exercises: string[] };
type TrainingPhase = {
  range: string;
  name: string;
  sessionsPerWeek: string;
  effort: string;
  cardio: string;
  sessions: TrainingSession[];
  energyNote: string;
};

const TRAINING_PLAN: TrainingPhase[] = [
  {
    range: "Weeks 1-2",
    name: "CALM",
    sessionsPerWeek: "2 full-body sessions/week",
    effort: "Comfortable only - nothing near failure",
    cardio: "Walking only (covered by your Daily 6 movement target)",
    sessions: [
      {
        label: "Session A (repeat twice this week)",
        exercises: ["Barbell Back Squat (light)", "Bench Press (light)", "Bent-Over Barbell Row or Lat Pulldown", "Plank"],
      },
    ],
    energyNote:
      "If energy or stress is high this week, it's completely fine to keep the weight light or skip a session. Consistency matters far more than intensity right now.",
  },
  {
    range: "Weeks 3-4",
    name: "RHYTHM",
    sessionsPerWeek: "2 full-body sessions/week",
    effort: "Still comfortable - just adding a little more volume",
    cardio: "Add 10-15 easy minutes (walk/cycle/swim), 1-2x/week",
    sessions: [
      {
        label: "Session A (repeat twice this week)",
        exercises: [
          "Barbell Back Squat or Walking Lunge",
          "Romanian Deadlift (light)",
          "Incline Dumbbell Press",
          "Lat Pulldown or Pull-Up",
          "Dumbbell Lateral Raise",
          "Plank",
        ],
      },
    ],
    energyNote: "Same rule as weeks 1-2: a heavy week at work or bad sleep means you scale back, not push through.",
  },
  {
    range: "Weeks 5-8",
    name: "BUILD",
    sessionsPerWeek: "3 sessions/week, split by movement pattern",
    effort: "Comfortable, except the last set of each exercise - close to failure",
    cardio: "20-30 structured minutes, 2-3x/week",
    sessions: [
      {
        label: "Day A - Lower body",
        exercises: ["Barbell Back Squat", "Romanian Deadlift", "Walking Lunge", "Leg Extension", "Plank"],
      },
      {
        label: "Day B - Push",
        exercises: ["Bench Press", "Incline Dumbbell Press", "Dumbbell Lateral Raise", "Cable Rope Pushdown"],
      },
      {
        label: "Day C - Pull",
        exercises: ["Bent-Over Barbell Row", "Lat Pulldown", "Seated Dumbbell Curl", "EZ-Bar Preacher Curl"],
      },
    ],
    energyNote:
      "Only push that last set close to failure if the week has actually felt good - check your own Daily 6 and sleep before deciding. Any rough week, drop back to comfortable across the board.",
  },
  {
    range: "Weeks 9-12",
    name: "OPTIMISE",
    sessionsPerWeek: "3 sessions/week, individualised with your trainer",
    effort: "Comfortable most sets - failure on your last set when genuinely recovered",
    cardio: "3-4x/week, mixing easy and slightly harder sessions",
    sessions: [
      {
        label: "Day A - Lower body",
        exercises: ["Barbell Back Squat", "Bulgarian Split Squat", "Leg Extension", "Lying Leg Curl", "Hip Abduction", "Hip Adduction", "Plank"],
      },
      {
        label: "Day B - Push",
        exercises: ["Bench Press", "Incline Dumbbell Press", "Dumbbell Lateral Raise", "Cable Rope Pushdown", "Reverse-Grip Tricep Pushdown"],
      },
      {
        label: "Day C - Pull",
        exercises: ["Romanian Deadlift", "Bent-Over Barbell Row or Lat Pulldown", "Dumbbell Row", "Seated Dumbbell Curl", "EZ-Bar Preacher Curl"],
      },
    ],
    energyNote:
      "By now you should know your own rhythm. Log the effort honestly in your Training Log every session - that's what lets your trainer fine-tune things from here.",
  },
];

const TRACK_METRICS = ["Energy", "Sleep quality", "Stress", "Mood", "Hunger", "Training performance", "Digestion"];
const TRACK_OPTIONAL = ["Waist measurement", "Body weight", "Resting heart rate", "HRV", "Strength levels"];

const MONTHLY_CHECKIN = [
  "Energy better?",
  "Sleeping better?",
  "Less stressed?",
  "Stronger?",
  "Better fitness?",
  "Better digestion?",
  "Better relationship with food?",
  "Menstrual symptoms changing?",
  "Recovery improving?",
];

const GOLDEN_RULE_QUESTIONS = [
  "Are you sleeping?",
  "Are you eating enough quality food?",
  "Are you getting morning light?",
  "Are you moving every day?",
  "Are you strength training?",
  "Are you managing stress?",
  "Are you recovering?",
];

const FIVE_THINGS: { icon: string; title: string; line: string }[] = [
  { icon: "☀️", title: "LIGHT", line: "Tell your body when the day starts." },
  { icon: "🫁", title: "BREATH", line: "Teach your nervous system how to come down." },
  { icon: "🚶", title: "MOVEMENT", line: "Move throughout the day." },
  { icon: "🥗", title: "FOOD", line: "Give your body the raw materials it needs." },
  { icon: "😴", title: "SLEEP", line: "Give your body time to repair." },
];

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ marginTop: 6 }}>
      {items.map((b) => (
        <Text key={b} style={styles.bullet}>
          {"☐  "}
          {b}
        </Text>
      ))}
    </View>
  );
}

export default function LifestyleResetContent() {
  return (
    <View>
      <Text style={styles.title}>The Women's Health Reset</Text>
      <Text style={styles.subtitle}>A 12-Week Lifestyle Programme</Text>
      <Text style={styles.intro}>
        Your goal isn't to punish your body into being healthy. It's to give your body the environment it needs to
        recover, regulate and become stronger.
      </Text>
      <Text style={styles.foundations}>CALM → RHYTHM → RECOVER → NOURISH → BUILD</Text>

      <Text style={styles.sectionTitle}>Your Daily 6</Text>
      {DAILY_SIX.map((d) => (
        <View key={d.title} style={styles.card}>
          <Text style={styles.cardTitle}>
            {d.icon} {d.title}
          </Text>
          <Text style={styles.body}>{d.body}</Text>
          {d.bullets && <Bullets items={d.bullets} />}
          {d.subsections && (
            <View style={{ marginTop: 8 }}>
              {d.subsections.map((s) => (
                <View key={s.label} style={{ marginBottom: 8 }}>
                  <Text style={styles.subLabel}>{s.label}</Text>
                  <Text style={styles.subItems}>{s.items}</Text>
                </View>
              ))}
            </View>
          )}
          {d.note && <Text style={styles.note}>{d.note}</Text>}
        </View>
      ))}

      <Text style={styles.sectionTitle}>The 12-Week Journey</Text>
      {PHASES.map((p) => (
        <View key={p.name} style={styles.card}>
          <Text style={styles.cardTitle}>
            {p.range} · {p.name}
          </Text>
          <Bullets items={p.bullets} />
        </View>
      ))}

      <Text style={styles.sectionTitle}>Your 12-Week Training Plan</Text>
      <Text style={styles.body}>
        Simple and achievable - built around the same four phases, scaled to how much you actually have in the tank
        each week. Log every session in your Training Log (Exercises tab) - weight, reps, and how it felt. That's
        what lets you and your trainer see real progress, not just how any one day feels.
      </Text>
      {TRAINING_PLAN.map((p) => (
        <View key={p.name} style={[styles.card, { marginTop: 10 }]}>
          <Text style={styles.cardTitle}>
            {p.range} · {p.name}
          </Text>
          <Text style={styles.subItems}>{p.sessionsPerWeek}</Text>
          <Text style={styles.subItems}>Effort: {p.effort}</Text>
          <Text style={styles.subItems}>Cardio: {p.cardio}</Text>
          {p.sessions.map((s) => (
            <View key={s.label} style={{ marginTop: 10 }}>
              <Text style={styles.subLabel}>{s.label}</Text>
              <Bullets items={s.exercises} />
            </View>
          ))}
          <Text style={styles.note}>{p.energyNote}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Track More Than Your Weight</Text>
      <Text style={styles.body}>Every week, rate each of these 1-10:</Text>
      <Text style={styles.subItems}>{TRACK_METRICS.join(" · ")}</Text>
      <Text style={[styles.body, { marginTop: 10 }]}>Optionally also record:</Text>
      <Text style={styles.subItems}>{TRACK_OPTIONAL.join(" · ")}</Text>
      <Text style={styles.note}>
        The goal is to see whether health and function are improving, not simply whether the scale is moving.
      </Text>

      <Text style={styles.sectionTitle}>Monthly Check-in</Text>
      <Text style={styles.body}>Every month, ask how your body is responding:</Text>
      <Bullets items={MONTHLY_CHECKIN} />
      <Text style={styles.note}>
        Your programme should adapt to the person - it should not force everyone into exactly the same routine.
      </Text>

      <Text style={styles.sectionTitle}>The Golden Rule</Text>
      <Text style={styles.body}>Don't add more until the foundations are working.</Text>
      <Text style={[styles.body, { marginTop: 6 }]}>
        Before adding complicated supplements, fasting protocols, extreme diets or excessive exercise, ask:
      </Text>
      <Bullets items={GOLDEN_RULE_QUESTIONS} />
      <Text style={styles.note}>If the answer is mostly no, start there.</Text>

      <Text style={styles.sectionTitle}>5 Things to Remember</Text>
      {FIVE_THINGS.map((f) => (
        <Text key={f.title} style={styles.body}>
          {f.icon} {f.title} - {f.line}
        </Text>
      ))}
      <Text style={styles.closing}>Health is built daily.{"\n"}You don't need to be perfect. You need to be consistent enough, for long enough.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#94A3B8", fontSize: 14, marginTop: 2, marginBottom: 14 },
  intro: { color: "#E2E8F0", fontSize: 14, lineHeight: 21, marginBottom: 10 },
  foundations: { color: "#22C55E", fontWeight: "700", fontSize: 13, marginBottom: 24 },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 17, marginTop: 24, marginBottom: 12 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 6 },
  body: { color: "#E2E8F0", fontSize: 13.5, lineHeight: 20 },
  bullet: { color: "#CBD5E1", fontSize: 13.5, lineHeight: 21 },
  subLabel: { color: "#22C55E", fontWeight: "600", fontSize: 12.5, marginBottom: 2 },
  subItems: { color: "#CBD5E1", fontSize: 13, lineHeight: 19 },
  note: { color: "#94A3B8", fontSize: 12.5, lineHeight: 18, marginTop: 8, fontStyle: "italic" },
  closing: { color: "#E2E8F0", fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 24, marginBottom: 12 },
});
