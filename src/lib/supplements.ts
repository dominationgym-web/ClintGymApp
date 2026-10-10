// The Supplementation section: what's worth taking for energy, muscle,
// performance and recovery, in plain language. Each supplement has its own
// card (what it does, who it suits, how to take it, what to watch) so clients
// can decide for themselves or ask their trainer. Labelled by how strong the
// evidence is, so they spend money on what works first. General information,
// not medical advice.
import type { GuidelineGroup } from "@/lib/sleep";

export const SUPPLEMENT_GUIDE: GuidelineGroup[] = [
  {
    heading: "Food first",
    points: [
      "Supplements top up a good diet. They can't replace one. Get these right first and everything below works better.",
      "Protein: about 1.6 to 2.2 g per kg of body weight a day, spread over 3 to 5 meals. For a 70 kg person that's roughly 110 to 150 g.",
      "Vegetables and fruit: at least 5 handfuls a day, in different colours. They give you vitamins, minerals and fibre for recovery and gut health.",
      "Water: 2 to 3 litres a day, more when you sweat. Even being a little dehydrated cuts strength and energy.",
      "Carbs around training (rice, potatoes, sweet potato, fruit) fuel your sessions and refill your muscles afterwards.",
      "Sleep 7 to 9 hours. No supplement comes close to what sleep does for recovery.",
    ],
  },
  {
    heading: "Your daily routine, simply",
    points: [
      "Morning with breakfast: vitamin D, omega-3, multivitamin (if you take one), creatine.",
      "Before training: coffee or caffeine if you want it, and water with electrolytes on sweaty days.",
      "After training: a protein shake if you're short of protein, plus a proper meal with carbs.",
      "Evening: magnesium, about an hour before bed.",
    ],
  },
  {
    heading: "Stay safe",
    points: [
      "Start one new supplement at a time, so you know what's working and what doesn't agree with you.",
      "Buy from trusted brands, ideally batch-tested (look for Informed Sport or NSF Certified for Sport).",
      "Check with your doctor first if you're pregnant, breastfeeding, have a medical condition, or take any medication.",
      "More isn't better. Stick to the amounts on the label or in this guide.",
      "Not sure if a supplement is right for you? Ask your trainer.",
      "This is general information, not medical advice.",
    ],
  },
];

export type SupplementLevel = "Proven" | "Training days" | "Might help" | "Save your money";

export type Supplement = {
  name: string;
  level: SupplementLevel;
  what: string;
  who: string;
  how: string;
  careful: string;
  // Extra research notes, shown as "For your brain" on the card.
  brain?: string;
};

export const SUPPLEMENT_LEVELS: { level: SupplementLevel; meaning: string }[] = [
  { level: "Proven", meaning: "Strong evidence. Worth taking for most people who train." },
  { level: "Training days", meaning: "Helps performance on the day you take it." },
  { level: "Might help", meaning: "Some evidence. Try once the basics are in place." },
  { level: "Save your money", meaning: "Not worth buying for most people." },
];

export const SUPPLEMENTS: Supplement[] = [
  {
    name: "Creatine monohydrate",
    level: "Proven",
    what: "Tops up the quick energy your muscles use for short, hard efforts. You get a rep or two more per set, which builds more strength and muscle over time, and you recover faster between sets.",
    who: "Anyone who lifts weights or does sprint-type training, men and women, young and older. Vegetarians often notice the biggest difference because they eat little creatine in food.",
    how: "3 to 5 g every day, any time of day, including rest days. No need to load or cycle it. Mix it into water, a shake or yoghurt.",
    careful: "You may gain 1 to 2 kg in the first weeks. That's water stored in the muscle, not fat. Drink enough water. It's the most researched supplement there is and safe for healthy adults; check with your doctor first if you have kidney problems.",
    brain:
      "Your brain uses creatine for energy too. When you're sleep-deprived or exhausted, its creatine runs low. In a 2024 study (Gordji-Nejad and colleagues, Scientific Reports), people kept awake through the night took one large dose of about 0.35 g per kg of body weight (roughly 25 g for a 70 kg person). Their reaction speed, short-term memory and mood held up better than on placebo, starting about 3 hours later and lasting up to about 9 hours. Older studies using about 20 g a day for a week found similar benefits during sleep loss, and reviews suggest the normal daily dose helps memory most in people who are stressed, older or vegetarian. The catch: these were small studies, high doses can upset your stomach, and they haven't been tested for regular use. Treat it as an occasional option on a really exhausted day, not a daily habit, and it never replaces sleep.",
  },
  {
    name: "Protein powder",
    level: "Proven",
    what: "Simply protein in an easy form. Protein repairs and builds muscle and keeps you full. Whey comes from milk; plant blends (pea, rice, soy) suit people who avoid dairy.",
    who: "People who struggle to reach their daily protein (about 1.6 to 2.2 g per kg of body weight) from meals, or who need a quick option after training or on the go.",
    how: "One scoop (about 25 g protein) after training or as a snack, in water or milk. Count it as part of your daily protein, not on top of it.",
    careful: "It's food, not magic. If you already eat enough protein, you don't need it. If whey bloats you, try a whey isolate or a plant protein.",
  },
  {
    name: "Vitamin D3",
    level: "Proven",
    what: "Your body makes vitamin D from sunlight. It keeps bones and muscles strong and supports your mood and immune system.",
    who: "Anyone who works indoors, covers up in the sun, has darker skin, or trains through winter. Many people are low without knowing it.",
    how: "1,000 to 2,000 IU a day with a meal that has some fat in it, because it absorbs better with fat.",
    careful: "More is not better: it builds up in the body, so don't take high doses for long unless a blood test shows you're low. Your doctor can test your levels.",
  },
  {
    name: "Omega-3 fish oil",
    level: "Proven",
    what: "Healthy fats (EPA and DHA) that calm inflammation, ease stiff joints, and support your heart and brain.",
    who: "Anyone who eats oily fish (salmon, sardines, mackerel) less than twice a week.",
    how: "About 1 to 2 g of EPA and DHA combined a day, with food. Check the label: a 1 g capsule often holds only 300 mg of EPA and DHA. Algae oil is the option for vegetarians.",
    careful: "Can cause fishy burps; taking it with meals or keeping it in the fridge helps. Check with your doctor if you take blood thinners.",
  },
  {
    name: "Magnesium",
    level: "Proven",
    what: "A mineral your muscles and nerves need to relax. It helps with sleep, cramps and recovery, and hard training uses more of it because you lose some in sweat.",
    who: "People who train hard, sweat a lot, sleep badly or get muscle cramps.",
    how: "200 to 400 mg of magnesium glycinate or citrate in the evening, about an hour before bed.",
    careful: "Too much, especially magnesium oxide or citrate, can loosen your stomach. Start low. Check with your doctor if you have kidney problems.",
  },
  {
    name: "Caffeine",
    level: "Training days",
    what: "Wakes up your brain and nervous system so training feels easier. You get more energy, focus and power, and you can push a little harder.",
    who: "Anyone who wants a boost before training, as long as it doesn't make them jittery.",
    how: "1 to 3 mg per kg of body weight, 30 to 60 minutes before training. A strong coffee is about 100 to 150 mg.",
    careful: "Avoid it after about 2pm so it doesn't ruin your sleep. Pre-workout powders can hold 300 mg or more per scoop, so read the label. Skip it if you have heart problems, high blood pressure or anxiety, or if you're pregnant.",
  },
  {
    name: "Electrolytes",
    level: "Training days",
    what: "Salts (sodium, potassium, magnesium) you lose in sweat. Replacing them helps stop cramps, headaches and the tired, flat feeling after a sweaty session.",
    who: "Anyone training for a long time, sweating heavily, or training in hot weather.",
    how: "A sachet or tablet in your water during or after long or sweaty sessions. A pinch of salt in water with some fruit also works.",
    careful: "Not needed for a normal session if you eat well. Some drinks are full of sugar; pick low-sugar ones. Check with your doctor if you have high blood pressure.",
  },
  {
    name: "Beta-alanine",
    level: "Training days",
    what: "Helps your muscles cope with the burning feeling in hard efforts of 1 to 4 minutes, so you can keep going a little longer.",
    who: "People doing high-rep sets, circuits, CrossFit-style or interval training. Little benefit for heavy, low-rep lifting.",
    how: "3 to 5 g a day, every day. It builds up over a few weeks, so the timing on the day doesn't matter.",
    careful: "It can cause a harmless tingling in the face and hands. Splitting the dose over the day reduces it.",
  },
  {
    name: "Carbs during training",
    level: "Training days",
    what: "A sports drink or a banana during long sessions keeps your energy up when your muscles' fuel starts running low.",
    who: "Sessions longer than about 75 minutes, or two sessions in one day.",
    how: "About 30 to 60 g of carbs per hour of training, from a sports drink, banana or similar.",
    careful: "Not needed for normal sessions under an hour. If fat loss is your goal, skip it, especially before cardio.",
  },
  {
    name: "Glutamine",
    level: "Might help",
    what: "An amino acid that fuels your gut and immune cells. It doesn't build muscle in people who already eat enough protein.",
    who: "People in very hard training blocks who keep getting sick or have a sensitive gut.",
    how: "5 g a day in water.",
    careful: "Optional. Most people get enough from protein in food.",
  },
  {
    name: "CoQ10",
    level: "Might help",
    what: "Helps your cells turn food into energy. Your body makes less of it as you age.",
    who: "Most useful if you're over 40 or take cholesterol medication (statins), which lowers CoQ10. Younger people often notice little.",
    how: "100 to 200 mg a day with a meal that has some fat in it.",
    careful: "Check with your doctor if you take blood thinners or blood pressure medication.",
  },
  {
    name: "Zinc",
    level: "Might help",
    what: "A mineral for your immune system, hormones and recovery. You lose some in sweat.",
    who: "People who sweat a lot, or eat little red meat or seafood.",
    how: "10 to 15 mg a day with food.",
    careful: "Don't take more for long periods: too much zinc blocks copper absorption and can upset your stomach.",
  },
  {
    name: "Multivitamin",
    level: "Might help",
    what: "A cheap safety net that fills small gaps in vitamins and minerals.",
    who: "Anyone whose diet isn't varied every day, or who eats few vegetables and fruit.",
    how: "One a day with breakfast.",
    careful: "It doesn't replace real food. If you also take vitamin D or zinc separately, add up the amounts so you don't double up.",
  },
  {
    name: "Ashwagandha",
    level: "Might help",
    what: "A herb that may lower stress hormones and help you sleep and recover better.",
    who: "People who feel stressed, wired or run down, or who sleep badly.",
    how: "300 to 600 mg a day, often in the evening.",
    careful: "Skip it if you're pregnant or breastfeeding, or have thyroid or autoimmune problems. Check with your doctor if you take any medication.",
  },
  {
    name: "Tart cherry juice",
    level: "Might help",
    what: "Rich in plant compounds that may reduce muscle soreness. It holds a little natural melatonin, which may help sleep.",
    who: "People in hard training blocks with a lot of soreness, or who sleep badly.",
    how: "About 30 ml of concentrate (or 250 ml of juice) once or twice a day.",
    careful: "It has natural sugar, so count it if fat loss is the goal.",
  },
  {
    name: "Collagen",
    level: "Might help",
    what: "Building blocks for tendons, ligaments, joints and skin.",
    who: "People with sore tendons or joints, or coming back from a niggle.",
    how: "10 to 15 g with some vitamin C (like an orange) about an hour before training.",
    careful: "It doesn't count well towards your muscle-building protein, so keep eating proper protein.",
  },
  {
    name: "Probiotics",
    level: "Might help",
    what: "Friendly gut bacteria that support digestion and your immune system.",
    who: "People with tummy trouble, or after a course of antibiotics.",
    how: "Fermented foods every day (plain yoghurt, kefir, sauerkraut), or a probiotic capsule.",
    careful: "Effects differ a lot between products and people. Food sources are a good, cheap place to start.",
  },
  {
    name: "BCAAs",
    level: "Save your money",
    what: "Three amino acids sold for muscle building and recovery.",
    who: "Hardly anyone. Your protein from food and shakes already contains them.",
    how: "Not needed if you eat enough protein. Spend the money on good food or creatine instead.",
    careful: "They're often sweet drinks that add little.",
  },
  {
    name: "Testosterone boosters",
    level: "Save your money",
    what: "Herbal blends that claim to raise testosterone.",
    who: "No one: there's no good evidence they work in healthy people.",
    how: "Sleep, strength training, enough healthy fats and zinc, and a healthy body weight do far more.",
    careful: "Some products have been found to hold hidden banned substances.",
  },
  {
    name: "Fat burners",
    level: "Save your money",
    what: "Pills that claim to melt fat. Most are mainly high-dose caffeine at a high price.",
    who: "No one. Fat loss comes from your eating, training, sleep and daily steps.",
    how: "If you want the energy, a coffee does the same job for a fraction of the cost.",
    careful: "Some are unsafe and can cause a racing heart, anxiety and poor sleep.",
  },
];
