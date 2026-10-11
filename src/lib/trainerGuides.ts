// Coaching guides for trainers, reached from the trainer menu. Each guide is a
// list of topics the trainer taps to open (one at a time, no long scroll).
// Written from current sports-science research and kept to plain facts; the
// numbers are the ranges most studies agree on, not hard rules.
import type { GuidelineGroup } from "@/lib/sleep";

export type GuideTopic = {
  title: string;
  icon: string;
  // One or two sentences shown at the top of the open topic.
  intro?: string;
  groups: GuidelineGroup[];
};

export type TrainerGuideKey = "retention" | "nutrition" | "training" | "recovery";

export type TrainerGuide = {
  key: TrainerGuideKey;
  title: string;
  icon: string;
  accent: string;
  summary: string;
  topics: GuideTopic[];
};

const RETENTION: TrainerGuide = {
  key: "retention",
  title: "Client retention",
  icon: "🤝",
  accent: "#F59E0B",
  summary: "How to keep clients motivated, getting results and renewing.",
  topics: [
    {
      title: "The first 90 days",
      icon: "🚀",
      intro: "Most clients who quit do it in the first three months. A strong start is the biggest thing you can do for retention.",
      groups: [
        {
          heading: "Week one",
          points: [
            "Read the intake form before the first session and mention something from it. Clients stay when they feel known.",
            "Agree one clear goal and one small habit for the first two weeks. Too many changes at once is the most common reason people give up.",
            "Make the first workouts achievable. A client who leaves feeling capable comes back; one who can't walk for four days often doesn't.",
          ],
        },
        {
          heading: "Quick wins",
          points: [
            "Point out early wins that aren't on the scale: more reps, better sleep, more energy, a habit streak.",
            "Take progress photos on day one, even if the client doesn't want to look at them yet. They are the best proof of change at week 6 and 12.",
            "Scale weight swings with water and food. Explain this up front so a bad weigh-in doesn't feel like failure.",
          ],
        },
      ],
    },
    {
      title: "Check-ins and accountability",
      icon: "📋",
      groups: [
        {
          heading: "Respond quickly",
          points: [
            "Answer red flags and pain, fatigue or mental exhaustion reports within a day. Fast replies are one of the strongest signs to a client that you care.",
            "Keep replies personal: use their name and refer to what they wrote. A copied message feels like an app, not a coach.",
            "When a client goes quiet for 3 or more days, reach out first. A short \"How are you doing?\" catches most drop-offs early.",
          ],
        },
        {
          heading: "Build their independence",
          points: [
            "Research on motivation (self-determination theory) shows people stick with things when they feel competent, in control and connected.",
            "Give choices where you can, like two meal options or which day to train. People follow plans they helped make.",
            "Teach the why, not only the what. Clients who understand their plan keep going when life gets busy.",
          ],
        },
      ],
    },
    {
      title: "Plateaus and setbacks",
      icon: "📉",
      groups: [
        {
          heading: "When progress stalls",
          points: [
            "Look at the check-in data first: sleep, stress, habit ticks and how often they really trained. Most plateaus are adherence or recovery, not the program.",
            "Change one thing at a time so you know what worked.",
            "Remind them how far they've come with photos and numbers from week one.",
          ],
        },
        {
          heading: "Life gets in the way",
          points: [
            "Have a short \"minimum plan\" ready for busy or hard weeks, like two 30 minute sessions and the basic habits. Something beats nothing.",
            "Never shame a missed week. Guilt makes people avoid their coach; a fresh start keeps them.",
          ],
        },
      ],
    },
    {
      title: "Renewals and referrals",
      icon: "🔁",
      groups: [
        {
          heading: "Before the plan ends",
          points: [
            "Have the renewal conversation in the last two weeks, before the app's \"expiring soon\" alert. Show their progress and set the next goal.",
            "Frame the next block around a new target, not \"more of the same\".",
          ],
        },
        {
          heading: "Referrals",
          points: [
            "Ask for a referral when a client is happiest, right after a milestone.",
            "Happy clients bring friends who already trust you, and referred clients tend to stay longer.",
          ],
        },
      ],
    },
  ],
};

const NUTRITION: TrainerGuide = {
  key: "nutrition",
  title: "Nutrition for coaches",
  icon: "🥩",
  accent: "#22C55E",
  summary: "Protein, carbs and insulin, vegetables, hydration and essential fats, based on current research.",
  topics: [
    {
      title: "Protein",
      icon: "🍗",
      intro: "Protein is the building block of muscle, and the nutrient that matters most for body composition.",
      groups: [
        {
          heading: "What it does",
          points: [
            "Supplies the amino acids the body uses to repair and build muscle after training.",
            "Keeps muscle while dieting. In a calorie deficit, higher protein means more of the weight lost is fat, not muscle.",
            "Is the most filling nutrient, which helps clients eat less without feeling hungry.",
            "Costs the most energy to digest: about 20 to 30% of its calories are used just processing it, compared with about 5 to 10% for carbs and 0 to 3% for fat.",
          ],
        },
        {
          heading: "How much",
          points: [
            "For people who train: about 1.6 to 2.2 g per kg of body weight a day. Research shows most of the muscle benefit by 1.6 g/kg, with 2.2 g/kg covering almost everyone.",
            "During fat loss, aim for the top of that range to protect muscle.",
            "For very overweight clients, base it on goal weight rather than current weight.",
            "Older clients (over 50) respond less to protein, so they benefit from the higher end and bigger servings.",
          ],
        },
        {
          heading: "How to spread it",
          points: [
            "Split it over 3 to 5 meals of roughly 0.3 to 0.4 g/kg each (about 25 to 40 g for most people).",
            "A protein meal within a few hours of training is enough. The strict \"30 minute window\" is not supported by research when daily protein is met.",
            "Good sources: chicken, fish, lean beef, eggs, Greek yoghurt, cottage cheese, beans and lentils, and whey if food falls short.",
          ],
        },
      ],
    },
    {
      title: "Carbs and insulin",
      icon: "🍚",
      intro: "Carbs fuel hard training, but how much and when should depend on the client's goal and body.",
      groups: [
        {
          heading: "How carbs work",
          points: [
            "Carbs are broken down into glucose. The body uses it for energy right away or stores it as glycogen in muscle and liver.",
            "Each gram of stored glycogen holds about 3 g of water. That's why weight drops fast when carbs are cut and comes back when they return: it's water, not fat.",
            "Fibre is a carb too, but it isn't digested like sugar. It slows digestion and keeps blood sugar steadier.",
          ],
        },
        {
          heading: "What insulin does",
          points: [
            "Eating carbs raises blood sugar, and the body releases insulin to move that sugar into the muscles and liver.",
            "While insulin is high, the body breaks down and burns less stored fat. This is real, but it lasts hours, not days.",
            "Over weeks, fat loss is decided by total energy balance. Controlled studies that match calories (for example the DIETFITS trial) find similar fat loss on lower-carb and lower-fat diets.",
            "In overweight clients with insulin resistance, the body needs more insulin to clear the same sugar, so blood sugar and insulin stay up longer after a sugary meal.",
          ],
        },
        {
          heading: "Benefits for muscle gain",
          points: [
            "Carbs refill glycogen, the main fuel for hard sets in the 6 to 20 rep range. Full glycogen means more reps and more training volume.",
            "Insulin after a meal slows muscle breakdown, so carbs with protein around training support recovery.",
            "Enough carbs spare protein from being used as fuel, so more of it goes to building muscle.",
          ],
        },
        {
          heading: "Downsides for fat loss",
          points: [
            "Refined carbs and sugar are easy to overeat and not very filling, which makes a calorie deficit harder to keep.",
            "Sugar right before cardio means the body uses that sugar first and burns less fat during the session.",
            "For insulin-resistant clients, big sugary meals can bring energy crashes and cravings soon after.",
            "Practical approach: keep most carbs from whole foods (rice, potatoes, sweet potato, beans, fruit), place them around training, and cut back sweets and sugary drinks first.",
          ],
        },
      ],
    },
    {
      title: "Why vegetables matter",
      icon: "🥦",
      groups: [
        {
          heading: "What they give",
          points: [
            "Fibre: most adults get far less than the 25 to 38 g a day linked to better gut health, steadier blood sugar and lower heart disease risk.",
            "Vitamins and minerals such as vitamin C, folate, potassium and magnesium, which support energy, immunity, muscle function and recovery.",
            "Plant compounds (antioxidants and polyphenols) linked in large studies to lower risk of heart disease, stroke and some cancers.",
          ],
        },
        {
          heading: "For body composition",
          points: [
            "Lots of volume for very few calories. Half a plate of vegetables fills the stomach and makes a deficit far easier.",
            "Leafy greens and beetroot are high in nitrates, which help blood flow and can slightly improve endurance.",
            "Feed healthy gut bacteria, which is linked to better digestion and appetite control.",
          ],
        },
        {
          heading: "How much",
          points: [
            "Aim for at least 5 portions of vegetables and fruit a day, more vegetables than fruit.",
            "Eat a mix of colours. Different colours bring different nutrients.",
            "Frozen vegetables are as nutritious as fresh and make it easier for busy clients.",
          ],
        },
      ],
    },
    {
      title: "Hydration and electrolytes",
      icon: "💧",
      groups: [
        {
          heading: "Why it matters",
          points: [
            "Losing about 2% of body weight in sweat measurably lowers strength, endurance and focus.",
            "Sweat rate varies a lot: from about 0.5 to over 2 litres an hour, more in heat. South African summers push it to the top end.",
            "Thirst lags behind need, so heavy sweaters fall behind without noticing.",
          ],
        },
        {
          heading: "Electrolytes",
          points: [
            "Sweat isn't just water. It carries sodium (on average around 1 g per litre, but from under 0.5 to over 2 g), plus some potassium and magnesium.",
            "Replacing only water after heavy sweating dilutes blood sodium. In long sessions this can cause cramps, headaches and, in extreme cases, dangerous low sodium (hyponatraemia).",
            "Use an electrolyte drink or tablet for sessions over 60 to 90 minutes, hot conditions, or clients who leave white salt marks on their clothes.",
          ],
        },
        {
          heading: "Practical guide",
          points: [
            "Daily base: about 30 to 35 ml per kg of body weight, more on training days and hot days.",
            "Check urine: pale straw colour is good, dark yellow means drink more.",
            "Weigh before and after a session. For each kg lost, drink about 1.25 to 1.5 litres over the next few hours, with some salt or electrolytes.",
          ],
        },
      ],
    },
    {
      title: "Essential fats",
      icon: "🥑",
      groups: [
        {
          heading: "Why they're essential",
          points: [
            "\"Essential\" means the body can't make them, so they must come from food: omega-3 (ALA, EPA, DHA) and omega-6 fats.",
            "They build every cell membrane, support the brain, eyes and heart, and help control inflammation.",
            "Fat is needed to make hormones, including testosterone and oestrogen. Very low-fat diets (under about 20% of calories) can lower hormone levels.",
            "Vitamins A, D, E and K need fat to be absorbed.",
          ],
        },
        {
          heading: "Omega-3",
          points: [
            "Most diets are low in omega-3 and high in omega-6. Raising omega-3 is the main fix.",
            "EPA and DHA (from oily fish) are the forms the body uses best. Plant ALA converts poorly.",
            "Aim for 2 portions of oily fish a week, or a fish oil supplement if clients don't eat fish.",
          ],
        },
        {
          heading: "Where to find them",
          points: [
            "Oily fish: salmon, sardines, pilchards, mackerel, trout.",
            "Nuts and seeds: walnuts, almonds, chia, flaxseed, pumpkin seeds.",
            "Avocado, olive oil, eggs.",
            "Limit trans fats (some fried and packaged foods), which harm heart health.",
          ],
        },
      ],
    },
  ],
};

const TRAINING: TrainerGuide = {
  key: "training",
  title: "Training each body part",
  icon: "🏋️",
  accent: "#60A5FA",
  summary: "Research-based technique for growing each muscle while keeping clients injury free.",
  topics: [
    {
      title: "Principles for every muscle",
      icon: "🧠",
      intro: "These apply to every body part. The body part topics build on them.",
      groups: [
        {
          heading: "Effort and volume",
          points: [
            "Muscle grows from sets taken close to failure. Aim to finish most work sets with 0 to 3 reps left in the tank.",
            "About 10 to 20 hard sets per muscle per week works for most people. Beginners grow well on less.",
            "Training each muscle twice a week tends to beat once a week for the same total sets.",
            "Any rep range from about 5 to 30 builds muscle if the set is hard enough. 6 to 15 is the most time-efficient for most clients.",
          ],
        },
        {
          heading: "Range of motion and stretch",
          points: [
            "Use a full range of motion, with extra focus on the stretched position. Studies show training a muscle at long lengths grows it more.",
            "Pausing for a moment in the stretch removes bounce and makes the muscle do the work.",
            "Only go as deep as the client can control without pain. Mobility improves over weeks.",
          ],
        },
        {
          heading: "Tempo and control",
          points: [
            "Lower the weight under control over about 2 to 3 seconds. The lowering (eccentric) part builds muscle and teaches control.",
            "Lift with intent: smooth and strong, not a slow crawl. Very slow lifting (over about 8 seconds a rep) doesn't add growth.",
            "Time under tension is less important than effort. A set usually lasts 30 to 60 seconds, but how close to failure matters more than the clock.",
            "Rest about 2 to 3 minutes between hard sets of big lifts, 1 to 2 minutes for small ones. Longer rests allow more total work.",
          ],
        },
        {
          heading: "Staying injury free",
          points: [
            "Warm up with lighter sets of the first exercise for each body part.",
            "Add weight or reps slowly (progressive overload) once technique stays the same across all sets.",
            "Pain that is sharp, in a joint, or gets worse during the set means stop and change the exercise.",
          ],
        },
      ],
    },
    {
      title: "Chest",
      icon: "💪",
      groups: [
        {
          heading: "Best exercises",
          points: [
            "Pressing: flat and incline dumbbell or barbell press, machine press, dips.",
            "Flyes: cable or dumbbell flyes, pec deck. These load the chest in the stretched position.",
            "An incline of about 30 degrees puts more work on the upper chest without turning it into a shoulder exercise.",
          ],
        },
        {
          heading: "Technique",
          points: [
            "Keep shoulder blades pulled back and down, chest up. This protects the shoulders and keeps tension on the chest.",
            "Elbows at about 45 to 60 degrees from the body, not flared out to 90.",
            "Lower to a deep, controlled stretch and pause briefly. Dumbbells allow a deeper stretch than a barbell.",
            "Avoid bouncing the bar off the chest.",
          ],
        },
        {
          heading: "Injury watch",
          points: [
            "Front-of-shoulder pain usually means elbows flaring or the shoulder rolling forward. Tuck the elbows and reset the shoulder blades.",
          ],
        },
      ],
    },
    {
      title: "Back",
      icon: "🦅",
      groups: [
        {
          heading: "Best exercises",
          points: [
            "Vertical pulls for the lats: pull-ups, lat pulldowns.",
            "Rows for the mid back: chest-supported rows, cable rows, single-arm dumbbell rows.",
            "Train both. Rows and pulldowns hit different parts of the back.",
          ],
        },
        {
          heading: "Technique",
          points: [
            "Let the arms go fully straight at the top of a pulldown or the front of a row to stretch the lats, then pull.",
            "Drive with the elbows, not the hands. Think about pulling the elbows to the hips for lats.",
            "Keep the elbows closer to the body to hit the lats, wider to hit the upper back.",
            "Control the return. Swinging the body takes the work off the back.",
          ],
        },
        {
          heading: "Injury watch",
          points: [
            "Chest-supported rows take load off the lower back, which helps clients with back pain or poor hip hinge.",
            "Keep the spine neutral on bent-over rows. If the back rounds, lower the weight.",
          ],
        },
      ],
    },
    {
      title: "Legs",
      icon: "🦵",
      groups: [
        {
          heading: "Quads",
          points: [
            "Squats, leg press, split squats, lunges and leg extensions.",
            "Go deep. Research comparing full and half squats found more glute and inner thigh growth with full depth, and quads also grow well when trained in the stretched (deep knee bend) position.",
            "Single-leg work (split squats, lunges, step-ups) fixes left-right differences and is kind to the lower back.",
          ],
        },
        {
          heading: "Hamstrings",
          points: [
            "Hamstrings both bend the knee and extend the hip, so train both: leg curls and a hip hinge (Romanian deadlift).",
            "Seated leg curls grew the hamstrings noticeably more than lying curls in research, because the hip is bent and the muscle is more stretched.",
            "On Romanian deadlifts, push the hips back with soft knees until a strong stretch, keeping the back flat.",
          ],
        },
        {
          heading: "Glutes",
          points: [
            "Deep squats, lunges, Romanian deadlifts and hip thrusts all work them well.",
            "Longer strides on lunges and split squats shift more work to the glutes.",
          ],
        },
        {
          heading: "Injury watch",
          points: [
            "Knees should track over the toes. Knees caving in under load means the weight is too heavy.",
            "Build squat depth gradually. A heel lift (small plate or squat wedge) helps clients with stiff ankles.",
          ],
        },
      ],
    },
    {
      title: "Calves",
      icon: "🦶",
      intro: "Calves are stubborn for many people and genetics play a big part, but most clients train them badly. Technique fixes a lot.",
      groups: [
        {
          heading: "Best way to grow calves",
          points: [
            "Pause for 1 to 2 seconds in the deep stretch at the bottom of every rep. The Achilles tendon acts like a spring; without the pause, the tendon does the work instead of the muscle.",
            "The stretched bottom half of the movement matters most. Research found partial reps in the stretched range grew the calves as well as or better than full reps.",
            "Go up onto the toes fully, but never bounce.",
            "Calves recover fast: train them 2 to 4 times a week, about 10 to 20 hard sets in total.",
            "They respond to a wide range of reps. Sets of 10 to 20 taken close to failure work well.",
          ],
        },
        {
          heading: "Straight knee and bent knee",
          points: [
            "Straight-knee raises (standing, leg press) work the gastrocnemius, the big visible calf muscle.",
            "Bent-knee raises (seated) work the soleus underneath, which adds width.",
            "Include both each week.",
          ],
        },
      ],
    },
    {
      title: "Biceps",
      icon: "💪",
      intro: "The biceps has a long head (outer, gives the peak) and a short head (inner, gives thickness). All curls work both, but arm position shifts the emphasis.",
      groups: [
        {
          heading: "Long head (outer)",
          points: [
            "Works hardest when the arm is behind the body, which stretches it.",
            "Best choices: incline dumbbell curls, and Bayesian cable curls (facing away from a low cable with the arm pulled back).",
            "A slightly narrower grip shifts a little more work to the long head.",
          ],
        },
        {
          heading: "Short head (inner)",
          points: [
            "Works hardest when the arm is in front of the body.",
            "Best choices: preacher curls, spider curls, concentration curls.",
            "A slightly wider grip and turning the little finger up hard at the top (full supination) shift more work to the short head.",
          ],
        },
        {
          heading: "Technique",
          points: [
            "Keep the elbows still. Swinging moves the work to the shoulders and lower back.",
            "Lower all the way to a straight arm with control. The bottom of the curl is where most of the growth stimulus is.",
            "Hammer curls train the brachialis and forearm, which push the biceps up and make the arm thicker.",
            "The grip-width effect is small. Full range and hard sets matter far more.",
          ],
        },
      ],
    },
    {
      title: "Triceps",
      icon: "🔱",
      intro: "The triceps makes up about two thirds of the upper arm. Its long head is the biggest part and crosses the shoulder.",
      groups: [
        {
          heading: "Best exercises",
          points: [
            "Overhead extensions (cable or dumbbell) stretch the long head. A 2023 study found overhead extensions grew the triceps about 40% more than pressdowns over 12 weeks.",
            "Pressdowns with a rope or bar work the lateral and medial heads well and are easy on the elbows.",
            "Close-grip press and dips add heavy pressing work.",
          ],
        },
        {
          heading: "Technique",
          points: [
            "Keep the upper arm still and let the elbow do the moving.",
            "Lock the arm out fully at the end of each rep and lower into a deep stretch.",
            "On overhead work, keep the elbows pointing forward and the ribs down, so the lower back doesn't arch.",
          ],
        },
        {
          heading: "Injury watch",
          points: [
            "Elbow pain is common with heavy skull crushers. Switch to cable work and higher reps (12 to 20) if the elbows complain.",
            "Warm up the elbows with a light set before heavy pressing.",
          ],
        },
      ],
    },
    {
      title: "Shoulders",
      icon: "🎯",
      intro: "The shoulder has three parts: front, side and rear. The front gets lots of work from chest pressing; the side and rear usually need direct work.",
      groups: [
        {
          heading: "Side delts (width)",
          points: [
            "Lateral raises with dumbbells or cables. Cables keep tension at the bottom, where dumbbells go slack.",
            "Raise slightly forward of the body (about 30 degrees, the \"scapular plane\"). This is kinder to the shoulder joint.",
            "Lead with the elbows, slight bend in the arm, and stop around shoulder height.",
            "They respond well to higher reps (12 to 25) and frequent training.",
          ],
        },
        {
          heading: "Rear delts",
          points: [
            "Reverse flyes, reverse pec deck and face pulls.",
            "Strong rear delts balance all the pressing and help posture and shoulder health.",
          ],
        },
        {
          heading: "Front delts",
          points: [
            "Chest pressing already trains the front delts heavily. Extra front raises are rarely needed.",
            "Overhead pressing is optional. Many coaches skip it to protect the shoulders, and the delts can grow fully without it.",
          ],
        },
        {
          heading: "Injury watch",
          points: [
            "Avoid narrow-grip upright rows, which can pinch the shoulder. Use a wider grip and stop at chest height, or skip them.",
            "Keep all shoulder work in a pain-free range and never swing heavy weights up.",
          ],
        },
      ],
    },
  ],
};

const RECOVERY: TrainerGuide = {
  key: "recovery",
  title: "Recovery",
  icon: "🔋",
  accent: "#A78BFA",
  summary: "Why recovery time matters, how to speed it up, and how to plan programs around it.",
  topics: [
    {
      title: "Recovery time between body parts",
      icon: "⏱️",
      intro: "Muscle doesn't grow during the workout. It grows while recovering afterwards.",
      groups: [
        {
          heading: "What happens after training",
          points: [
            "Muscle protein building stays raised for about 24 to 48 hours after a hard session.",
            "Most muscles need about 48 to 72 hours before the same muscle is trained hard again. Big lower-body sessions with lots of stretch (deep squats, Romanian deadlifts) can need longer.",
            "Smaller muscles like calves, forearms and side delts recover faster and can be trained more often.",
          ],
        },
        {
          heading: "Overlap counts",
          points: [
            "Muscles work together. Chest pressing also trains the front delts and triceps; rows and pulldowns train the biceps.",
            "Arms the day after a chest or back day are not fully rested. Plan splits so that helper muscles get a break too.",
          ],
        },
        {
          heading: "Soreness isn't the measure",
          points: [
            "Soreness (DOMS) doesn't show how good a workout was or how recovered a muscle is.",
            "Better signs: strength back to normal, normal energy and sleep, and the client feeling ready.",
          ],
        },
      ],
    },
    {
      title: "How to aid recovery",
      icon: "🛌",
      groups: [
        {
          heading: "The big three",
          points: [
            "Sleep: 7 to 9 hours. Less than 6 hours lowers strength, slows muscle repair and raises injury risk.",
            "Protein: 1.6 to 2.2 g per kg a day, spread across the day.",
            "Total food: a big calorie deficit slows recovery. During fat loss, expect slightly slower recovery and plan for it.",
          ],
        },
        {
          heading: "Helpful extras",
          points: [
            "Light movement such as walking on rest days increases blood flow and eases stiffness.",
            "Hydration and electrolytes, especially after heavy sweating.",
            "Life stress counts. Work, kids and poor sleep use the same recovery capacity as training. Check the client's body and mind reports in the app.",
          ],
        },
        {
          heading: "What the research says about the rest",
          points: [
            "Massage and foam rolling can reduce soreness and feel good, but have little effect on real muscle repair.",
            "Ice baths straight after weights may blunt muscle growth over time. Save them for sport recovery, not muscle-building phases.",
          ],
        },
      ],
    },
    {
      title: "Structuring recovery into programs",
      icon: "🗓️",
      groups: [
        {
          heading: "Splits that respect recovery",
          points: [
            "Full body 3 days a week (e.g. Mon, Wed, Fri) gives each muscle about 48 hours between sessions.",
            "Upper / lower 4 days a week trains each muscle twice with good rest.",
            "Push / pull / legs spreads the load so helper muscles rest too.",
            "Avoid hard leg days back to back, and avoid arms the day after chest or back.",
          ],
        },
        {
          heading: "Plan easier weeks",
          points: [
            "Every 4 to 8 weeks, a lighter week (deload) with about half the sets lets joints and tiredness catch up.",
            "Deload early if a client shows signs of under-recovery.",
          ],
        },
        {
          heading: "Signs of under-recovery",
          points: [
            "Strength dropping for two or more sessions in a row.",
            "Poor sleep, low mood, irritability or high resting heart rate.",
            "Joint aches, constant soreness or getting sick often.",
            "Fix: cut sets by a third for a week, check sleep and food, and move hard sessions further apart.",
          ],
        },
      ],
    },
  ],
};

export const TRAINER_GUIDES: TrainerGuide[] = [RETENTION, NUTRITION, TRAINING, RECOVERY];

export function trainerGuide(key: TrainerGuideKey): TrainerGuide | undefined {
  return TRAINER_GUIDES.find((g) => g.key === key);
}
