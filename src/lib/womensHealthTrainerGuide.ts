// Women's health for coaches (nutrition review, 2026-10-18): perimenopause and
// menopause, and iron and RED-S (low energy availability). The client side is
// in the Women's Health Reset (cycle.ts). Sources: Menopause Society 2022/2023
// position statements, IMS 2024 white paper on lifestyle, LIFTMOR (Watson et
// al. 2018), ESCEO on protein, IOC REDs consensus 2023, Sims et al. 2023 on
// female athletes, Pedlar et al. 2018 on iron.
import type { TrainerGuide } from "@/lib/trainerGuides";

export const WOMENS_HEALTH_TRAINER_GUIDE: TrainerGuide = {
  key: "womensHealth",
  title: "Women's health",
  icon: "🌸",
  accent: "#F472B6",
  summary: "Coaching women through perimenopause and menopause, and spotting low iron and under-eating (RED-S).",
  topics: [
    {
      title: "Perimenopause and menopause",
      icon: "🌡️",
      intro: "Most women go through perimenopause in their 40s and reach menopause (12 months with no period) around 51. Strength training and protein matter more now. Symptoms and treatment are the doctor's call.",
      groups: [
        {
          heading: "What changes",
          points: [
            "Oestrogen swings up and down, then falls. Periods become irregular, heavier or lighter, then stop.",
            "Common symptoms: hot flushes, night sweats, poor sleep, low mood or anxiety, brain fog, joint aches and lower energy.",
            "Bone loss speeds up, about 1 to 2% a year for several years around the last period. Muscle and strength drop faster too.",
            "Fat shifts to the belly even if weight doesn't change, which raises heart and diabetes risk. Track waist (over about 80 cm is worth working on), not just weight.",
          ],
        },
        {
          heading: "How to train her",
          points: [
            "Strength train the whole body 2 to 3 times a week, with progressive loads: most sets 6 to 12 reps, finishing 1 to 3 reps short of failure. Add weight over the weeks.",
            "Heavier work (around 5 reps) built up slowly with good form is safe for most women and best for bone. In LIFTMOR, women with low bone mass did supervised heavy deadlifts, squats and presses and gained bone.",
            "Add impact for bone as tolerated: small jumps, hops, skipping or drop landings. Start with 10 to 20 low jumps a few days a week and build up.",
            "Add balance work to cut falls, and cardio for heart health.",
            "Osteoporosis or a fracture from a small fall: get the doctor's OK first, build load slowly, and avoid loaded forward bending and twisting (sit-ups, toe touches with weight).",
            "Leaking urine on jumps or heavy lifts is common, not something to push through: refer to a pelvic health physio and keep training around it.",
            "Sleep is often poor: judge the session on the day, and modify for joint aches before you swap exercises. Keep the gym cool and water handy for hot flushes.",
          ],
        },
        {
          heading: "Food and supplements",
          points: [
            "Protein about 1.2 to 1.6 g per kg a day, spread over meals with about 25 to 30 g or more at each. Older muscle needs more per meal to respond (anabolic resistance).",
            "Calcium about 1,000 to 1,200 mg a day, mostly from food: milk, maas, yoghurt, cheese, sardines or pilchards with the bones.",
            "Vitamin D: many people are low. The GP can test and advise a supplement.",
            "Creatine 3 to 5 g a day is a reasonable option for strength and muscle alongside training. Bone results are mixed so far.",
            "Avoid big deficits, which speed up muscle and bone loss. Alcohol, caffeine and spicy food trigger hot flushes for many women.",
          ],
        },
        {
          heading: "Your scope",
          points: [
            "Don't advise for or against hormone therapy (HRT or MHT) or any medication. Encourage her to talk to her doctor about her symptoms and all her options.",
            "Refer to the GP for: hot flushes, sleep or mood that affect daily life, very heavy or irregular bleeding, and any bleeding after a year with no period.",
            "In the app, she can switch the cycle tracker to \"My periods are irregular or have stopped\", which turns off the phase guide, and read Perimenopause and menopause in the Women's Health Reset.",
          ],
        },
      ],
    },
    {
      title: "Iron and RED-S",
      icon: "🩸",
      intro: "RED-S (relative energy deficiency in sport) means not eating enough to cover training and the body's normal work. With low iron, it's one of the most common and most missed problems in active women.",
      groups: [
        {
          heading: "What RED-S is",
          points: [
            "Low energy availability: too little food for the training. It can be on purpose (dieting) or not (busy, low appetite, training a lot more).",
            "It affects hormones, periods, bones, immunity, mood and performance, often while weight stays the same. Men get it too.",
            "Hormonal contraception can hide it, because she still bleeds.",
          ],
        },
        {
          heading: "Signs to watch",
          points: [
            "Missed, irregular or stopped periods (no period for 3 months is a red flag).",
            "Stress fractures, or injuries that keep coming back. Bone pain that builds with running or jumping: stop impact and refer.",
            "Constant tiredness, low mood or irritability, getting ill often, feeling cold.",
            "Performance dropping or not recovering, despite training well.",
            "Worry about food or weight, or training to make up for eating.",
          ],
        },
        {
          heading: "Iron",
          points: [
            "About 1 in 4 to 1 in 3 active women are low in iron. Higher risk: heavy periods, little or no red meat, endurance training, frequent blood donation.",
            "Signs: tired, breathless, pale, poor recovery, headaches or restless legs.",
            "Heavy periods: soaking a pad or tampon every 1 to 2 hours, big clots, or periods over 7 days. Refer to the GP.",
            "Best food sources: red meat, liver, chicken, fish and eggs. Beans, lentils and fortified bread and maize meal help, with vitamin C (citrus, peppers, tomatoes). Tea and coffee away from iron-rich meals. Spinach iron is poorly absorbed.",
            "A ferritin blood test via the GP shows iron stores. Don't suggest iron tablets without a test: too much iron is harmful.",
          ],
        },
        {
          heading: "What to do",
          points: [
            "Don't push a bigger deficit or more training. More food around training is often the first fix.",
            "Refer to the GP (blood tests, bone health, periods) and a registered dietitian (adsa.org.za). Eating disorder signs: also a psychologist.",
            "Keep coaching her, and follow what the professionals advise for load and impact.",
            "On the client side, the Women's Health Reset has an Iron and eating enough card and a When to see a doctor list.",
          ],
        },
      ],
    },
  ],
};
