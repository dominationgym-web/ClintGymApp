// The Supplementation section: what's worth taking for energy, muscle,
// performance and recovery, in plain language. Grouped by how strong the
// evidence is, so clients spend money on what works first. General
// information, not medical advice.
import type { GuidelineGroup } from "@/lib/sleep";

export const SUPPLEMENT_GUIDE: GuidelineGroup[] = [
  {
    heading: "Food first",
    points: [
      "Supplements top up a good diet. They can't replace one. Get these right first and everything below works better.",
      "Protein: about 1.6 to 2.2 g per kg of body weight a day, spread over 3 to 5 meals. For a 70 kg person that's roughly 110 to 150 g.",
      "Vegetables and fruit: at least 5 handfuls a day, in different colours. They give you vitamins, minerals and fibre for recovery and gut health.",
      "Water: 2 to 3 litres a day, more when you sweat. Even being a little dehydrated cuts strength and energy.",
      "Carbs around training (oats, rice, potatoes, fruit) fuel your sessions and refill your muscles afterwards.",
      "Sleep 7 to 9 hours. No supplement comes close to what sleep does for recovery.",
    ],
  },
  {
    heading: "The proven basics (worth taking)",
    points: [
      "Creatine monohydrate: 3 to 5 g every day, any time, every day including rest days. It builds strength and muscle and helps you recover between sets. It's the most researched supplement there is, and it's safe for healthy adults. No need to load or cycle it.",
      "Protein powder (whey, or plant protein if you avoid dairy): a quick way to hit your protein. One scoop (about 25 g of protein) after training or as a snack. It's food, not magic. Only use it if you're short of protein from meals.",
      "Vitamin D3: 1,000 to 2,000 IU a day with a meal, especially in winter or if you're indoors a lot. It supports muscles, bones, mood and your immune system.",
      "Omega-3 fish oil: about 1 to 2 g of EPA and DHA combined a day, with food. It eases joint stiffness and inflammation and supports heart and brain.",
      "Magnesium (glycinate or citrate): 200 to 400 mg in the evening. It helps with sleep, muscle cramps and recovery. Lots of people who train hard run low on it.",
    ],
  },
  {
    heading: "Performance boosters (for training days)",
    points: [
      "Caffeine: 1 to 3 mg per kg of body weight (a strong coffee is about 100 to 150 mg), 30 to 60 minutes before training. It gives more energy, focus and power. Avoid it after about 2pm so it doesn't wreck your sleep.",
      "Electrolytes (sodium, potassium, magnesium): add them to your water on long or sweaty sessions or in hot weather. They help stop cramps, headaches and the post-training slump.",
      "Beta-alanine: 3 to 5 g a day helps with hard efforts of 1 to 4 minutes (high-rep sets, circuits). The tingling it can cause is harmless.",
      "Carbs during training: for sessions over 75 minutes, a sports drink or banana keeps energy up.",
    ],
  },
  {
    heading: "Might help (try once the basics are in place)",
    points: [
      "Glutamine: 5 g a day. It doesn't build muscle in people who eat enough protein, but it may help your gut and immune system when training is very hard or you're run down. Optional.",
      "CoQ10: 100 to 200 mg a day with a meal that has some fat in it. It helps your cells make energy. Most useful if you're over 40 or on cholesterol medication (statins). Younger people often notice little.",
      "Zinc: 10 to 15 mg a day if you sweat a lot or don't eat much red meat or seafood. It supports immunity, hormones and recovery. Don't take more for long periods.",
      "A daily multivitamin: a cheap safety net if your diet isn't perfect every day.",
      "Ashwagandha: 300 to 600 mg a day may lower stress and improve sleep and recovery. Skip it if you're pregnant or have thyroid problems.",
      "Tart cherry juice: may cut muscle soreness and help sleep during hard training blocks.",
      "Collagen (10 to 15 g) with vitamin C, about an hour before training: may help tendons and joints.",
      "Probiotics or fermented food (yoghurt, kefir): good for gut health, digestion and immunity.",
    ],
  },
  {
    heading: "Save your money",
    points: [
      "BCAAs: not needed if you eat enough protein. Your protein already contains them.",
      "Testosterone boosters: no good evidence they work for healthy people.",
      "Fat burners: mostly caffeine at a high price, and some are unsafe.",
      "Anything promising fast, dramatic results. If it sounds too good to be true, it is.",
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
      "This is general information, not medical advice.",
    ],
  },
];
