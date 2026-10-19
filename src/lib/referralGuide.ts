// "When to refer" (nutrition and rehab reviews, 2026-10-18): one place in the
// trainer menu for scope of practice, who to refer to, and the red flags. The
// detailed red flags stay in their own topics (Recovery → Working with injured
// clients, Nutrition → Nutrition: when to refer, Women's health), and this
// points to them rather than repeating them. Based on the REPSSA scope for
// exercise professionals, HPCSA scopes, and ACSM pre-exercise screening.
import type { TrainerGuide } from "@/lib/trainerGuides";

export const REFERRAL_GUIDE: TrainerGuide = {
  key: "referral",
  title: "When to refer",
  icon: "🩺",
  accent: "#F87171",
  summary: "Your scope as a trainer, who to send clients to, and the red flags that mean refer first.",
  topics: [
    {
      title: "Your scope as a trainer",
      icon: "🧭",
      intro: "You coach training and habits. You don't diagnose, treat or prescribe. Knowing when to refer protects your client and you.",
      groups: [
        {
          heading: "In your scope",
          points: [
            "Planning and coaching exercise for healthy adults, and adapting it around niggles, fitness and goals.",
            "General healthy-eating advice and calorie and macro estimates for healthy adults (see Nutrition for coaches → Nutrition: when to refer).",
            "Habits: sleep, steps, water, stress and routine. Listening, encouraging and keeping clients accountable.",
          ],
        },
        {
          heading: "Out of your scope",
          points: [
            "Saying what an injury, symptom or condition is, or that something is \"nothing to worry about\".",
            "Prescribing diets for medical conditions, medication, or supplements to treat a problem (iron, hormones and the like).",
            "Counselling for mental health problems, eating disorders or trauma.",
            "Advising for or against medical treatment, such as hormone therapy, medication or surgery.",
          ],
        },
        {
          heading: "When in doubt",
          points: [
            "Refer, and keep training what's safe. Referring isn't losing the client: most stay when they see you care.",
            "Read the intake form's health answers before the first session, and ask again when something changes.",
            "Write down what you saw, what you suggested and when, on the client's Notes tab.",
          ],
        },
      ],
    },
    {
      title: "Who to refer to",
      icon: "📇",
      intro: "Send the client to the right person for the problem. A GP is always a safe first stop.",
      groups: [
        {
          heading: "Health professionals",
          points: [
            "GP or doctor: anything medical, red flags, new or unexplained symptoms, blood tests (iron, thyroid), medication, periods, menopause and hormone therapy. Clearance before hard training for heart disease, uncontrolled blood pressure or diabetes on insulin.",
            "Physiotherapist: assessing and treating new or unclear injuries and pain. A pelvic health physio for leaking, prolapse or pelvic pain, including after a baby.",
            "Biokineticist: exercise-based rehab, especially the later stages of getting back to full training, and exercise for chronic conditions. HPCSA registered.",
            "Registered dietitian: diets for medical conditions, eating disorders, pregnancy, under-18s, low energy and iron problems. Find one at adsa.org.za (HPCSA registered).",
            "Psychologist or counsellor: low mood, anxiety, stress they can't manage, eating disorders, or anything they need to talk through that's beyond a coach.",
          ],
        },
        {
          heading: "Helplines and emergencies",
          points: [
            "SADAG (South African Depression and Anxiety Group): 0800 567 567, free, 24 hours. For low mood, anxiety or thoughts of suicide.",
            "Emergency: call 10177 for an ambulance, or 112 from a cell phone.",
          ],
        },
      ],
    },
    {
      title: "Red flags: stop and refer",
      icon: "🚩",
      intro: "These mean stop, or don't start, and send the client to a professional first. Each area's full list is in its own topic.",
      groups: [
        {
          heading: "Stop now and get help",
          points: [
            "Chest pain or pressure, fainting or nearly fainting, a racing or irregular heartbeat, or breathlessness far beyond the effort. Stop the session and call for help if it doesn't settle quickly.",
            "Sudden severe headache, new weakness or numbness on one side, slurred speech, or confusion: call 10177 or 112.",
            "Numbness around the groin or bottom, or new trouble with the bladder or bowel: same day emergency.",
          ],
        },
        {
          heading: "Refer before you train it",
          points: [
            "Injury and pain: night or rest pain, numbness or tingling, swelling, pain after a fall, or not improving after 2 weeks. Full list: Recovery → Working with injured clients, and each area in Stability & Rehab programming.",
            "Nutrition: diabetes on medication, kidney or liver disease, pregnancy or breastfeeding, eating disorder signs, under 18. Full list: Nutrition for coaches → Nutrition: when to refer.",
            "Women's health: no period for 3 months, a stress fracture, very heavy periods, constant tiredness, or symptoms of perimenopause. See Women's health → Iron and RED-S, and Perimenopause and menopause.",
            "Pregnant or just had a baby: training is usually good for them, but they need their doctor's or midwife's OK first.",
            "Tired most days for 2 to 3 weeks despite sleeping well, or weight loss nobody can explain: GP.",
          ],
        },
      ],
    },
    {
      title: "Mental health",
      icon: "🧠",
      intro: "Training helps mood, but you're not a counsellor. Notice, listen and point them to help.",
      groups: [
        {
          heading: "What to notice",
          points: [
            "Low mood, losing interest, or feeling hopeless for more than two weeks.",
            "Big changes in sleep, appetite or weight, pulling away from people, or missing sessions they used to love.",
            "Anxiety or stress that stops them getting through the day.",
            "Signs of an eating disorder: fear of foods, skipping meals, purging, training to \"burn off\" food, or panic about missed sessions.",
          ],
        },
        {
          heading: "What to do",
          points: [
            "Talk in private, listen without judging, and don't try to fix it or diagnose it.",
            "Encourage them to see their GP, a psychologist or a counsellor, or to call SADAG on 0800 567 567.",
            "If they talk about ending their life or you think they're in danger: don't leave them alone, call SADAG or 10177 / 112, and contact someone close to them.",
            "Keep training them if they want to. Steady routine and contact help.",
          ],
        },
      ],
    },
    {
      title: "How to refer well",
      icon: "🤝",
      groups: [
        {
          heading: "Do it like this",
          points: [
            "Say what you noticed and why it matters in plain words, without guessing what it is.",
            "Name the kind of professional to see, and how soon (today, this week, at their next check-up).",
            "Keep training what's safe while they wait, and change the plan once you hear back.",
            "Ask them to share what the professional said, and follow it. Their advice comes before the program.",
          ],
        },
      ],
    },
  ],
};
