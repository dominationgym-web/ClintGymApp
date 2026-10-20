// Foods for the meal builder in the Nutrition section. Values are per 100 g
// (per 100 ml for milk), rounded from standard food tables, and labelled
// cooked or raw where it matters. Oats are listed as rolled or steel-cut only
// (GRIZZ, 2026-10-20), not the processed instant kind.

export type FoodGroup = "Protein" | "Carbs" | "Fibre" | "Veg" | "Fats" | "Fruit & dairy";

export type FoodUnit = { label: string; grams: number };

export type Food = {
  name: string;
  group: FoodGroup;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  // Fibre per 100 g, used by the trainer's diet planner.
  fibre?: number;
  // Handy measures besides grams, e.g. teaspoons of oil or whole eggs.
  units?: FoodUnit[];
  // Other names people search by, e.g. zucchini for baby marrow, or ugali for
  // stiff pap, so trainers and clients outside South Africa find their foods.
  aka?: string[];
  // The amount filled in when the food is added, in its first unit.
  usual: number;
};

export const FOOD_GROUPS: FoodGroup[] = ["Protein", "Carbs", "Fibre", "Veg", "Fats", "Fruit & dairy"];

const TSP_OIL = { label: "tsp", grams: 4.5 };
const TBSP_OIL = { label: "tbsp", grams: 13.5 };

export const FOODS: Food[] = [
  // Protein
  { name: "Chicken breast (cooked)", group: "Protein", kcal: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0, usual: 150 },
  { name: "Chicken breast (raw)", group: "Protein", kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fibre: 0, usual: 150 },
  { name: "Chicken thigh, no skin (cooked)", group: "Protein", kcal: 209, protein: 26, carbs: 0, fat: 10.9, fibre: 0, usual: 150 },
  { name: "Lean beef mince (cooked)", group: "Protein", kcal: 217, protein: 26, carbs: 0, fat: 12, fibre: 0, aka: ["ground beef", "hamburger"], usual: 150 },
  { name: "Beef steak (cooked)", group: "Protein", kcal: 190, protein: 30, carbs: 0, fat: 7.5, fibre: 0, usual: 150 },
  { name: "Ostrich steak (cooked)", group: "Protein", kcal: 145, protein: 29, carbs: 0, fat: 2.5, fibre: 0, usual: 150 },
  // Lean biltong (no fat), per 100 g. The drier it is, the more water has gone
  // and the more protein each gram holds: wet about 35%, medium about 50%,
  // dry about 70% (GRIZZ, 2026-10-12). A handful is about 30 g.
  { name: "Biltong, lean, wet", group: "Protein", kcal: 175, protein: 35, carbs: 1.5, fat: 3, fibre: 0, units: [{ label: "handful", grams: 30 }], aka: ["jerky"], usual: 1 },
  { name: "Biltong, lean, medium", group: "Protein", kcal: 240, protein: 50, carbs: 2, fat: 3.5, fibre: 0, units: [{ label: "handful", grams: 30 }], aka: ["jerky"], usual: 1 },
  { name: "Biltong, lean, dry", group: "Protein", kcal: 330, protein: 70, carbs: 2.5, fat: 4, fibre: 0, units: [{ label: "handful", grams: 30 }], aka: ["jerky"], usual: 1 },
  { name: "Pork chop, lean (cooked)", group: "Protein", kcal: 196, protein: 29, carbs: 0, fat: 8, fibre: 0, usual: 150 },
  { name: "Lamb chop (cooked)", group: "Protein", kcal: 294, protein: 25, carbs: 0, fat: 21, fibre: 0, usual: 120 },
  { name: "Salmon (cooked)", group: "Protein", kcal: 206, protein: 22, carbs: 0, fat: 12, fibre: 0, usual: 150 },
  { name: "Hake / white fish (cooked)", group: "Protein", kcal: 105, protein: 23, carbs: 0, fat: 1, fibre: 0, aka: ["haddock", "pollock"], usual: 150 },
  { name: "Tuna in water (drained)", group: "Protein", kcal: 116, protein: 26, carbs: 0, fat: 0.8, fibre: 0, usual: 120 },
  {
    name: "Eggs",
    group: "Protein",
    kcal: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    fibre: 0,
    units: [{ label: "egg", grams: 50 }],
    usual: 2,
  },
  { name: "Egg whites", group: "Protein", kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fibre: 0, usual: 100 },
  { name: "Biltong", group: "Protein", kcal: 290, protein: 55, carbs: 2, fat: 6, fibre: 0, aka: ["jerky"], usual: 50 },
  {
    name: "Whey protein powder",
    group: "Protein",
    kcal: 400,
    protein: 78,
    carbs: 8,
    fat: 6,
    fibre: 0,
    units: [{ label: "scoop", grams: 30 }],
    aka: ["protein shake"],
    usual: 1,
  },
  { name: "Tofu, firm", group: "Protein", kcal: 144, protein: 16, carbs: 3, fat: 8.7, fibre: 2.3, usual: 150 },

  { name: "Turkey breast (cooked)", group: "Protein", kcal: 135, protein: 30, carbs: 0, fat: 1, fibre: 0, usual: 150 },
  { name: "Lean turkey mince (cooked)", group: "Protein", kcal: 190, protein: 27, carbs: 0, fat: 9, fibre: 0, aka: ["ground turkey"], usual: 150 },
  { name: "Prawns (cooked)", group: "Protein", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, fibre: 0, aka: ["shrimp", "seafood"], usual: 150 },
  { name: "Sardines in tomato sauce", group: "Protein", kcal: 180, protein: 18, carbs: 2, fat: 11, fibre: 0, usual: 100 },
  { name: "Pilchards in tomato sauce", group: "Protein", kcal: 135, protein: 17, carbs: 2, fat: 6.5, fibre: 0, usual: 100 },

  { name: "Boerewors (cooked)", group: "Protein", kcal: 270, protein: 16, carbs: 2, fat: 22, fibre: 0, aka: ["sausage", "wors"], usual: 100 },
  { name: "Droëwors", group: "Protein", kcal: 470, protein: 45, carbs: 2, fat: 31, fibre: 0, aka: ["droewors", "dry sausage"], usual: 30 },
  { name: "Venison / game steak (cooked)", group: "Protein", kcal: 158, protein: 30.2, carbs: 0, fat: 3.2, fibre: 0, aka: ["kudu", "springbok", "deer", "game meat"], usual: 150 },
  { name: "Lamb leg, lean (roasted)", group: "Protein", kcal: 191, protein: 28.3, carbs: 0, fat: 7.7, fibre: 0, aka: ["mutton"], usual: 120 },
  { name: "Pork fillet (cooked)", group: "Protein", kcal: 143, protein: 26.2, carbs: 0, fat: 3.5, fibre: 0, aka: ["pork tenderloin"], usual: 150 },
  { name: "Chicken drumstick, with skin (cooked)", group: "Protein", kcal: 216, protein: 27, carbs: 0, fat: 11.2, fibre: 0, aka: ["chicken leg"], usual: 150 },
  { name: "Chicken livers (cooked)", group: "Protein", kcal: 167, protein: 24.5, carbs: 0.9, fat: 6.5, fibre: 0, usual: 100 },
  { name: "Bacon, back (grilled)", group: "Protein", kcal: 287, protein: 23.3, carbs: 0, fat: 21.6, fibre: 0, units: [{ label: "rasher", grams: 25 }], aka: ["rashers"], usual: 50 },
  { name: "Ham, lean", group: "Protein", kcal: 120, protein: 19, carbs: 1.5, fat: 4.2, fibre: 0, units: [{ label: "slice", grams: 25 }], aka: ["deli ham", "cold meat"], usual: 50 },
  { name: "Snoek (cooked)", group: "Protein", kcal: 154, protein: 25, carbs: 0, fat: 6, fibre: 0, usual: 150 },
  { name: "Kingklip (cooked)", group: "Protein", kcal: 105, protein: 23, carbs: 0, fat: 1.2, fibre: 0, aka: ["white fish"], usual: 150 },
  { name: "Cod (cooked)", group: "Protein", kcal: 105, protein: 22.8, carbs: 0, fat: 0.9, fibre: 0, aka: ["white fish", "haddock"], usual: 150 },
  { name: "Tilapia (cooked)", group: "Protein", kcal: 128, protein: 26.2, carbs: 0, fat: 2.7, fibre: 0, aka: ["white fish"], usual: 150 },
  { name: "Trout (cooked)", group: "Protein", kcal: 168, protein: 23.8, carbs: 0, fat: 7.4, fibre: 0, usual: 150 },
  { name: "Mackerel, tinned (drained)", group: "Protein", kcal: 156, protein: 23.2, carbs: 0, fat: 6.3, fibre: 0, aka: ["canned fish"], usual: 100 },
  { name: "Mussels (cooked)", group: "Protein", kcal: 172, protein: 23.8, carbs: 7.4, fat: 4.5, fibre: 0, aka: ["seafood"], usual: 100 },
  { name: "Tempeh", group: "Protein", kcal: 192, protein: 20.3, carbs: 7.6, fat: 10.8, fibre: 0, aka: ["vegan", "plant protein"], usual: 100 },
  { name: "Edamame beans", group: "Protein", kcal: 121, protein: 11.9, carbs: 8.9, fat: 5.2, fibre: 5.2, aka: ["soya beans", "soybeans", "vegan"], usual: 100 },
  { name: "Plant protein powder", group: "Protein", kcal: 380, protein: 80, carbs: 3, fat: 6, fibre: 0, units: [{ label: "scoop", grams: 30 }], aka: ["pea protein", "vegan protein"], usual: 1 },

  // Carbs
  { name: "Potatoes (boiled)", group: "Carbs", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1, fibre: 1.8, usual: 200 },
  { name: "Sweet potato (cooked)", group: "Carbs", kcal: 90, protein: 2, carbs: 20.7, fat: 0.2, fibre: 3.3, aka: ["kumara"], usual: 150 },
  { name: "White rice (cooked)", group: "Carbs", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fibre: 0.4, usual: 150 },
  { name: "Brown rice (cooked)", group: "Carbs", kcal: 123, protein: 2.7, carbs: 25.6, fat: 1, fibre: 1.6, usual: 150 },
  { name: "Pasta (cooked)", group: "Carbs", kcal: 158, protein: 5.8, carbs: 31, fat: 0.9, fibre: 1.8, aka: ["spaghetti", "macaroni", "noodles"], usual: 150 },
  { name: "Lentils (cooked)", group: "Carbs", kcal: 116, protein: 9, carbs: 20, fat: 0.4, fibre: 7.9, usual: 100 },
  { name: "Lentils (dry)", group: "Carbs", kcal: 352, protein: 24.6, carbs: 63, fat: 1.1, fibre: 10.7, usual: 20 },
  { name: "Chickpeas (cooked)", group: "Carbs", kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fibre: 7.6, aka: ["garbanzo beans"], usual: 100 },
  { name: "Kidney beans (cooked)", group: "Carbs", kcal: 127, protein: 8.7, carbs: 22.8, fat: 0.5, fibre: 6.4, usual: 100 },
  { name: "Quinoa (cooked)", group: "Carbs", kcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fibre: 2.8, usual: 150 },
  { name: "Pap / maize porridge (cooked)", group: "Carbs", kcal: 72, protein: 1.7, carbs: 15.5, fat: 0.3, fibre: 1.1, aka: ["mieliepap", "maize meal", "polenta", "grits", "porridge"], usual: 200 },
  {
    name: "Brown bread",
    group: "Carbs",
    kcal: 247,
    protein: 13,
    carbs: 41,
    fat: 3.4,
    fibre: 6,
    units: [{ label: "slice", grams: 35 }],
    aka: ["wholewheat bread", "wholemeal bread", "toast"],
    usual: 2,
  },
  { name: "Basmati rice (cooked)", group: "Carbs", kcal: 121, protein: 3.5, carbs: 25.2, fat: 0.4, fibre: 0.4, usual: 150 },
  { name: "Wholewheat pasta (cooked)", group: "Carbs", kcal: 149, protein: 6, carbs: 30, fat: 1.7, fibre: 3.9, usual: 150 },
  { name: "Corn on the cob (cooked)", group: "Carbs", kcal: 96, protein: 3.4, carbs: 21, fat: 1.5, fibre: 2.4, aka: ["mielie", "sweetcorn", "maize"], usual: 150 },
  { name: "Rice cakes", group: "Carbs", kcal: 387, protein: 8, carbs: 81, fat: 2.8, fibre: 4.2, units: [{ label: "cake", grams: 9 }], usual: 2 },
  { name: "Wholewheat wrap", group: "Carbs", kcal: 290, protein: 9, carbs: 48, fat: 7, fibre: 6, units: [{ label: "wrap", grams: 60 }], aka: ["tortilla"], usual: 1 },
  { name: "Baby potatoes (boiled)", group: "Carbs", kcal: 80, protein: 1.9, carbs: 17.5, fat: 0.1, fibre: 1.6, usual: 200 },
  { name: "Oats, rolled or steel-cut (dry)", group: "Carbs", kcal: 379, protein: 13.2, carbs: 67.7, fat: 6.5, fibre: 10.1, aka: ["oatmeal", "porridge"], usual: 40 },
  { name: "Oat porridge, made with water", group: "Carbs", kcal: 71, protein: 2.5, carbs: 12, fat: 1.5, fibre: 1.7, aka: ["oatmeal", "porridge"], usual: 250 },
  { name: "Stiff pap (cooked)", group: "Carbs", kcal: 110, protein: 2.6, carbs: 23.5, fat: 0.5, fibre: 1.6, aka: ["phutu", "uphuthu", "ugali", "sadza", "nshima", "krummelpap", "mieliepap"], usual: 200 },
  { name: "Maize meal (dry)", group: "Carbs", kcal: 354, protein: 7.6, carbs: 77, fat: 1.4, fibre: 3, aka: ["mielie meal", "mealie meal", "polenta", "cornmeal"], usual: 60 },
  { name: "Samp (cooked)", group: "Carbs", kcal: 89, protein: 2, carbs: 19, fat: 0.5, fibre: 2.6, aka: ["umngqusho", "hominy"], usual: 150 },
  { name: "Samp and beans (cooked)", group: "Carbs", kcal: 105, protein: 4.5, carbs: 20, fat: 0.7, fibre: 4.5, aka: ["umngqusho"], usual: 200 },
  { name: "Mabele / sorghum porridge (cooked)", group: "Carbs", kcal: 82, protein: 2.6, carbs: 18, fat: 0.9, fibre: 1.6, aka: ["sorghum", "ting"], usual: 200 },
  { name: "Sugar beans (cooked)", group: "Carbs", kcal: 136, protein: 9.3, carbs: 24.5, fat: 0.5, fibre: 8.6, aka: ["cranberry beans", "borlotti beans"], usual: 100 },
  { name: "Baked beans in tomato sauce", group: "Carbs", kcal: 84, protein: 5, carbs: 14, fat: 0.4, fibre: 4.5, usual: 100 },
  { name: "Couscous (cooked)", group: "Carbs", kcal: 112, protein: 3.8, carbs: 23.2, fat: 0.2, fibre: 1.4, usual: 150 },
  { name: "Bulgur wheat (cooked)", group: "Carbs", kcal: 83, protein: 3.1, carbs: 18.6, fat: 0.2, fibre: 4.5, aka: ["bulgar"], usual: 150 },
  { name: "Pearl barley (cooked)", group: "Carbs", kcal: 123, protein: 2.3, carbs: 28.2, fat: 0.4, fibre: 3.8, usual: 150 },
  { name: "Rice noodles (cooked)", group: "Carbs", kcal: 108, protein: 1.8, carbs: 24, fat: 0.2, fibre: 1, usual: 150 },
  { name: "Egg noodles (cooked)", group: "Carbs", kcal: 138, protein: 4.5, carbs: 25, fat: 2.1, fibre: 1.2, usual: 150 },
  { name: "Plantain (cooked)", group: "Carbs", kcal: 116, protein: 0.8, carbs: 31.2, fat: 0.2, fibre: 2.3, usual: 150 },
  { name: "White bread", group: "Carbs", kcal: 265, protein: 9, carbs: 49, fat: 3.2, fibre: 2.7, units: [{ label: "slice", grams: 35 }], aka: ["toast"], usual: 2 },
  { name: "Rye bread", group: "Carbs", kcal: 259, protein: 8.5, carbs: 48.3, fat: 3.3, fibre: 5.8, units: [{ label: "slice", grams: 32 }], aka: ["seed loaf", "toast"], usual: 2 },
  { name: "Sourdough bread", group: "Carbs", kcal: 259, protein: 10, carbs: 51, fat: 1.7, fibre: 2.5, units: [{ label: "slice", grams: 50 }], aka: ["toast"], usual: 1 },
  { name: "Wholewheat pita", group: "Carbs", kcal: 266, protein: 9.8, carbs: 55, fat: 2.6, fibre: 7.4, units: [{ label: "pita", grams: 64 }], aka: ["pitta"], usual: 1 },
  { name: "Bagel, plain", group: "Carbs", kcal: 257, protein: 10, carbs: 50.5, fat: 1.6, fibre: 2.1, units: [{ label: "bagel", grams: 95 }], usual: 1 },
  { name: "Roti", group: "Carbs", kcal: 300, protein: 7.9, carbs: 46.4, fat: 9.2, fibre: 4.9, units: [{ label: "roti", grams: 70 }], aka: ["chapati", "flatbread"], usual: 1 },
  { name: "Corn tortilla", group: "Carbs", kcal: 218, protein: 5.7, carbs: 44.6, fat: 2.9, fibre: 6.3, units: [{ label: "tortilla", grams: 26 }], aka: ["taco"], usual: 2 },
  { name: "Bran rusk", group: "Carbs", kcal: 393, protein: 9, carbs: 60, fat: 13, fibre: 8, units: [{ label: "rusk", grams: 40 }], aka: ["beskuit"], usual: 1 },
  { name: "Popcorn, air-popped", group: "Carbs", kcal: 387, protein: 13, carbs: 78, fat: 4.5, fibre: 14.5, usual: 20 },

  // Fibre
  { name: "Chia seeds", group: "Fibre", kcal: 486, protein: 17, carbs: 42, fat: 31, fibre: 34, units: [{ label: "tbsp", grams: 12 }], usual: 1 },
  { name: "Flaxseed, ground", group: "Fibre", kcal: 534, protein: 18, carbs: 29, fat: 42, fibre: 27, units: [{ label: "tbsp", grams: 7 }], usual: 1 },
  { name: "Psyllium husk", group: "Fibre", kcal: 200, protein: 1.5, carbs: 85, fat: 0.6, fibre: 80, units: [{ label: "tsp", grams: 5 }], usual: 1 },
  { name: "Black beans (cooked)", group: "Fibre", kcal: 132, protein: 8.9, carbs: 23.7, fat: 0.5, fibre: 8.7, usual: 100 },
  { name: "Butter beans (cooked)", group: "Fibre", kcal: 115, protein: 7.8, carbs: 20.9, fat: 0.4, fibre: 7, aka: ["lima beans"], usual: 100 },
  { name: "Pear", group: "Fibre", kcal: 57, protein: 0.4, carbs: 15.2, fat: 0.1, fibre: 3.1, usual: 150 },
  { name: "Raspberries", group: "Fibre", kcal: 52, protein: 1.2, carbs: 11.9, fat: 0.7, fibre: 6.5, usual: 100 },
  { name: "Split peas (cooked)", group: "Fibre", kcal: 118, protein: 8.3, carbs: 21.1, fat: 0.4, fibre: 8.3, usual: 100 },
  { name: "Cannellini beans (cooked)", group: "Fibre", kcal: 139, protein: 9.7, carbs: 25.1, fat: 0.4, fibre: 6.3, aka: ["white beans", "haricot beans"], usual: 100 },
  { name: "Prunes", group: "Fibre", kcal: 240, protein: 2.2, carbs: 63.9, fat: 0.4, fibre: 7.1, aka: ["dried plums"], usual: 30 },

  // Veg
  { name: "Broccoli", group: "Veg", kcal: 35, protein: 2.4, carbs: 7.2, fat: 0.4, fibre: 3.3, usual: 100 },
  { name: "Spinach", group: "Veg", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fibre: 2.2, aka: ["swiss chard", "chard"], usual: 80 },
  { name: "Green beans", group: "Veg", kcal: 31, protein: 1.8, carbs: 7, fat: 0.2, fibre: 3.4, aka: ["string beans", "french beans"], usual: 100 },
  { name: "Carrots", group: "Veg", kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fibre: 2.8, usual: 80 },
  { name: "Butternut", group: "Veg", kcal: 45, protein: 1, carbs: 11.7, fat: 0.1, fibre: 2, aka: ["butternut squash"], usual: 150 },
  { name: "Tomato", group: "Veg", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fibre: 1.2, aka: ["cherry tomatoes"], usual: 100 },
  { name: "Mixed salad leaves", group: "Veg", kcal: 17, protein: 1.2, carbs: 3.3, fat: 0.2, fibre: 1.3, aka: ["lettuce", "rocket", "arugula", "salad"], usual: 80 },
  { name: "Cauliflower", group: "Veg", kcal: 25, protein: 1.9, carbs: 5, fat: 0.3, fibre: 2, usual: 100 },
  { name: "Cabbage", group: "Veg", kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fibre: 2.5, usual: 100 },
  { name: "Peppers", group: "Veg", kcal: 31, protein: 1, carbs: 6, fat: 0.3, fibre: 2.1, aka: ["capsicum", "bell pepper", "sweet pepper"], usual: 80 },
  { name: "Mushrooms", group: "Veg", kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fibre: 1, usual: 80 },
  { name: "Cucumber", group: "Veg", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fibre: 0.5, usual: 80 },
  { name: "Baby marrow", group: "Veg", kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fibre: 1, aka: ["zucchini", "courgette"], usual: 100 },
  { name: "Gem squash (cooked)", group: "Veg", kcal: 34, protein: 1, carbs: 7.5, fat: 0.1, fibre: 2, aka: ["squash"], usual: 150 },
  { name: "Pumpkin (cooked)", group: "Veg", kcal: 20, protein: 0.7, carbs: 4.9, fat: 0.1, fibre: 1.1, aka: ["squash"], usual: 150 },
  { name: "Morogo (cooked)", group: "Veg", kcal: 21, protein: 2.1, carbs: 4.1, fat: 0.2, fibre: 2, aka: ["imifino", "african spinach", "amaranth leaves", "wild spinach"], usual: 100 },
  { name: "Chakalaka", group: "Veg", kcal: 60, protein: 1.6, carbs: 9, fat: 1.8, fibre: 2.5, aka: ["relish"], usual: 100 },
  { name: "Green peas (cooked)", group: "Veg", kcal: 84, protein: 5.4, carbs: 15.6, fat: 0.2, fibre: 5.5, aka: ["petit pois", "garden peas"], usual: 80 },
  { name: "Beetroot (cooked)", group: "Veg", kcal: 44, protein: 1.7, carbs: 10, fat: 0.2, fibre: 2, aka: ["beets"], usual: 80 },
  { name: "Onion", group: "Veg", kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fibre: 1.7, usual: 50 },
  { name: "Brussels sprouts (cooked)", group: "Veg", kcal: 36, protein: 2.6, carbs: 7.1, fat: 0.5, fibre: 2.6, usual: 100 },
  { name: "Asparagus (cooked)", group: "Veg", kcal: 22, protein: 2.4, carbs: 4.1, fat: 0.2, fibre: 2, usual: 100 },
  { name: "Kale", group: "Veg", kcal: 35, protein: 2.9, carbs: 4.4, fat: 1.5, fibre: 4.1, usual: 80 },
  { name: "Brinjal / aubergine (cooked)", group: "Veg", kcal: 35, protein: 0.8, carbs: 8.7, fat: 0.2, fibre: 2.5, aka: ["eggplant"], usual: 100 },
  { name: "Celery", group: "Veg", kcal: 16, protein: 0.7, carbs: 3, fat: 0.2, fibre: 1.6, usual: 50 },
  { name: "Bok choy", group: "Veg", kcal: 13, protein: 1.5, carbs: 2.2, fat: 0.2, fibre: 1, aka: ["pak choi", "chinese cabbage"], usual: 100 },
  { name: "Sugar snap peas / mangetout", group: "Veg", kcal: 42, protein: 2.8, carbs: 7.6, fat: 0.2, fibre: 2.6, aka: ["snow peas"], usual: 80 },
  { name: "Okra (cooked)", group: "Veg", kcal: 22, protein: 1.9, carbs: 4.5, fat: 0.2, fibre: 2.5, aka: ["lady fingers", "bhindi"], usual: 100 },

  // Fats
  { name: "Olive oil", group: "Fats", kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, units: [TSP_OIL, TBSP_OIL], usual: 2 },
  { name: "Coconut oil", group: "Fats", kcal: 862, protein: 0, carbs: 0, fat: 100, fibre: 0, units: [TSP_OIL, TBSP_OIL], usual: 1 },
  {
    name: "Butter",
    group: "Fats",
    kcal: 717,
    protein: 0.9,
    carbs: 0.1,
    fat: 81,
    fibre: 0,
    units: [{ label: "tsp", grams: 5 }],
    usual: 1,
  },
  { name: "Avocado", group: "Fats", kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, fibre: 6.7, usual: 50 },
  {
    name: "Peanut butter",
    group: "Fats",
    kcal: 588,
    protein: 25,
    carbs: 20,
    fat: 50,
    fibre: 6,
    units: [{ label: "tbsp", grams: 16 }],
    usual: 1,
  },
  { name: "Almonds", group: "Fats", kcal: 579, protein: 21, carbs: 21.6, fat: 49.9, fibre: 12.5, usual: 30 },
  { name: "Cheddar cheese", group: "Fats", kcal: 403, protein: 25, carbs: 1.3, fat: 33, fibre: 0, aka: ["cheese"], usual: 30 },
  { name: "Feta", group: "Fats", kcal: 264, protein: 14, carbs: 4, fat: 21, fibre: 0, aka: ["cheese"], usual: 30 },
  { name: "Walnuts", group: "Fats", kcal: 654, protein: 15, carbs: 14, fat: 65, fibre: 6.7, usual: 20 },
  { name: "Cashews", group: "Fats", kcal: 553, protein: 18, carbs: 30, fat: 44, fibre: 3.3, usual: 25 },
  { name: "Mixed nuts, unsalted", group: "Fats", kcal: 607, protein: 20, carbs: 21, fat: 54, fibre: 7, usual: 25 },
  { name: "Olives", group: "Fats", kcal: 145, protein: 1, carbs: 3.8, fat: 15, fibre: 3.3, usual: 30 },
  { name: "Pumpkin seeds", group: "Fats", kcal: 559, protein: 30, carbs: 11, fat: 49, fibre: 6, usual: 20 },
  { name: "Sunflower oil", group: "Fats", kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, units: [TSP_OIL, TBSP_OIL], aka: ["cooking oil", "vegetable oil"], usual: 2 },
  { name: "Canola oil", group: "Fats", kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, units: [TSP_OIL, TBSP_OIL], aka: ["rapeseed oil", "cooking oil"], usual: 2 },
  { name: "Avocado oil", group: "Fats", kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, units: [TSP_OIL, TBSP_OIL], usual: 2 },
  { name: "Ghee", group: "Fats", kcal: 876, protein: 0.3, carbs: 0, fat: 99.5, fibre: 0, units: [TSP_OIL, TBSP_OIL], aka: ["clarified butter"], usual: 1 },
  { name: "Peanuts, unsalted", group: "Fats", kcal: 585, protein: 24.4, carbs: 21.3, fat: 49.7, fibre: 8.4, aka: ["groundnuts"], usual: 25 },
  { name: "Macadamia nuts", group: "Fats", kcal: 718, protein: 7.9, carbs: 13.8, fat: 75.8, fibre: 8.6, usual: 20 },
  { name: "Pecan nuts", group: "Fats", kcal: 691, protein: 9.2, carbs: 13.9, fat: 72, fibre: 9.6, usual: 20 },
  { name: "Pistachios", group: "Fats", kcal: 560, protein: 20.2, carbs: 27.2, fat: 45.3, fibre: 10.6, usual: 25 },
  { name: "Sunflower seeds", group: "Fats", kcal: 584, protein: 20.8, carbs: 20, fat: 51.5, fibre: 8.6, usual: 20 },
  { name: "Almond butter", group: "Fats", kcal: 614, protein: 21, carbs: 18.8, fat: 55.5, fibre: 10.3, units: [{ label: "tbsp", grams: 16 }], aka: ["nut butter"], usual: 1 },
  { name: "Tahini", group: "Fats", kcal: 595, protein: 17, carbs: 21.2, fat: 53.8, fibre: 9.3, units: [{ label: "tbsp", grams: 15 }], aka: ["sesame paste"], usual: 1 },
  { name: "Hummus", group: "Fats", kcal: 166, protein: 7.9, carbs: 14.3, fat: 9.6, fibre: 6, units: [{ label: "tbsp", grams: 15 }], aka: ["houmous"], usual: 2 },
  { name: "Mozzarella", group: "Fats", kcal: 281, protein: 22, carbs: 2.2, fat: 20.5, fibre: 0, aka: ["cheese"], usual: 30 },
  { name: "Parmesan", group: "Fats", kcal: 392, protein: 35.8, carbs: 3.2, fat: 25.8, fibre: 0, aka: ["cheese"], usual: 15 },
  { name: "Halloumi", group: "Fats", kcal: 316, protein: 21.3, carbs: 1.6, fat: 24.7, fibre: 0, aka: ["cheese"], usual: 50 },
  { name: "Ricotta", group: "Fats", kcal: 174, protein: 11.3, carbs: 3, fat: 13, fibre: 0, aka: ["cheese"], usual: 50 },

  // Fruit & dairy
  { name: "Banana", group: "Fruit & dairy", kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fibre: 2.6, usual: 120 },
  { name: "Apple", group: "Fruit & dairy", kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fibre: 2.4, usual: 150 },
  { name: "Berries", group: "Fruit & dairy", kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fibre: 2.4, aka: ["mixed berries"], usual: 100 },
  { name: "Greek yoghurt, plain", group: "Fruit & dairy", kcal: 97, protein: 9, carbs: 4, fat: 5, fibre: 0, aka: ["yogurt"], usual: 150 },
  { name: "Cottage cheese, low fat", group: "Fruit & dairy", kcal: 82, protein: 11, carbs: 3.4, fat: 2.3, fibre: 0, usual: 100 },
  { name: "Full cream milk (ml)", group: "Fruit & dairy", kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fibre: 0, aka: ["whole milk"], usual: 250 },
  { name: "Low fat milk (ml)", group: "Fruit & dairy", kcal: 50, protein: 3.3, carbs: 4.8, fat: 2, fibre: 0, aka: ["skim milk", "semi-skimmed milk", "2% milk"], usual: 250 },
  { name: "Greek yoghurt, fat free", group: "Fruit & dairy", kcal: 59, protein: 10.2, carbs: 3.6, fat: 0.4, fibre: 0, aka: ["yogurt", "fat-free"], usual: 150 },
  { name: "Plain yoghurt, low fat", group: "Fruit & dairy", kcal: 63, protein: 5.3, carbs: 7, fat: 1.6, fibre: 0, aka: ["yogurt"], usual: 150 },
  { name: "Skyr", group: "Fruit & dairy", kcal: 63, protein: 11, carbs: 4, fat: 0.2, fibre: 0, aka: ["yoghurt", "yogurt"], usual: 150 },
  { name: "Quark, low fat", group: "Fruit & dairy", kcal: 67, protein: 12, carbs: 4, fat: 0.2, fibre: 0, usual: 150 },
  { name: "Amasi / maas (ml)", group: "Fruit & dairy", kcal: 62, protein: 3.3, carbs: 4.4, fat: 3.4, fibre: 0, aka: ["sour milk", "fermented milk"], usual: 250 },
  { name: "Kefir (ml)", group: "Fruit & dairy", kcal: 41, protein: 3.8, carbs: 4.5, fat: 0.9, fibre: 0, aka: ["fermented milk"], usual: 200 },
  { name: "Almond milk, unsweetened (ml)", group: "Fruit & dairy", kcal: 15, protein: 0.6, carbs: 0.6, fat: 1.1, fibre: 0, aka: ["plant milk", "dairy free"], usual: 250 },
  { name: "Soy milk, unsweetened (ml)", group: "Fruit & dairy", kcal: 33, protein: 3.3, carbs: 0.3, fat: 1.8, fibre: 0.6, aka: ["soya milk", "plant milk", "dairy free"], usual: 250 },
  { name: "Orange", group: "Fruit & dairy", kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fibre: 2.4, usual: 130 },
  { name: "Naartjie / mandarin", group: "Fruit & dairy", kcal: 53, protein: 0.8, carbs: 13.3, fat: 0.3, fibre: 1.8, aka: ["tangerine", "clementine", "satsuma"], usual: 80 },
  { name: "Mango", group: "Fruit & dairy", kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, fibre: 1.6, usual: 150 },
  { name: "Pineapple", group: "Fruit & dairy", kcal: 50, protein: 0.5, carbs: 13.1, fat: 0.1, fibre: 1.4, usual: 150 },
  { name: "Pawpaw / papaya", group: "Fruit & dairy", kcal: 43, protein: 0.5, carbs: 10.8, fat: 0.3, fibre: 1.7, usual: 150 },
  { name: "Grapes", group: "Fruit & dairy", kcal: 69, protein: 0.7, carbs: 18.1, fat: 0.2, fibre: 0.9, usual: 100 },
  { name: "Watermelon", group: "Fruit & dairy", kcal: 30, protein: 0.6, carbs: 7.6, fat: 0.2, fibre: 0.4, usual: 200 },
  { name: "Spanspek / cantaloupe", group: "Fruit & dairy", kcal: 34, protein: 0.8, carbs: 8.2, fat: 0.2, fibre: 0.9, aka: ["melon", "rockmelon"], usual: 150 },
  { name: "Strawberries", group: "Fruit & dairy", kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fibre: 2, usual: 150 },
  { name: "Blueberries", group: "Fruit & dairy", kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fibre: 2.4, usual: 100 },
  { name: "Kiwi fruit", group: "Fruit & dairy", kcal: 61, protein: 1.1, carbs: 14.7, fat: 0.5, fibre: 3, usual: 75 },
  { name: "Guava", group: "Fruit & dairy", kcal: 68, protein: 2.6, carbs: 14.3, fat: 1, fibre: 5.4, aka: ["guavas"], usual: 100 },
  { name: "Litchis", group: "Fruit & dairy", kcal: 66, protein: 0.8, carbs: 16.5, fat: 0.4, fibre: 1.3, aka: ["lychees"], usual: 100 },
  { name: "Peach / nectarine", group: "Fruit & dairy", kcal: 39, protein: 0.9, carbs: 9.5, fat: 0.3, fibre: 1.5, usual: 150 },
  { name: "Plum", group: "Fruit & dairy", kcal: 46, protein: 0.7, carbs: 11.4, fat: 0.3, fibre: 1.4, usual: 100 },
  { name: "Granadilla / passion fruit", group: "Fruit & dairy", kcal: 97, protein: 2.2, carbs: 23.4, fat: 0.7, fibre: 10.4, units: [{ label: "granadilla", grams: 18 }], aka: ["passionfruit"], usual: 1 },
  { name: "Dates", group: "Fruit & dairy", kcal: 282, protein: 2.5, carbs: 75, fat: 0.4, fibre: 8, units: [{ label: "date", grams: 8 }], usual: 3 },
  { name: "Raisins", group: "Fruit & dairy", kcal: 299, protein: 3.1, carbs: 79.2, fat: 0.5, fibre: 3.7, aka: ["sultanas", "dried fruit"], usual: 30 },
];

/** Foods whose name or other names hold every word typed, e.g. "white fish". */
export function searchFoods(text: string, foods: Food[] = FOODS): Food[] {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return foods.filter((f) => {
    const names = [f.name, ...(f.aka ?? [])].join(" | ").toLowerCase();
    return words.every((w) => names.includes(w));
  });
}

/** The measures a food can be entered in: its own units first, then grams. */
export function foodUnits(food: Food): FoodUnit[] {
  return [...(food.units ?? []), { label: food.name.endsWith("(ml)") ? "ml" : "g", grams: 1 }];
}

export type MealItem = { food: Food; amount: number; unit: FoodUnit };

export type Totals = { kcal: number; protein: number; carbs: number; fat: number };

/** What one item adds to the meal, unrounded. */
export function itemTotals({ food, amount, unit }: MealItem): Totals {
  const factor = (amount * unit.grams) / 100;
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

/** The whole meal, rounded: calories to whole kcal, macros to whole grams. */
export function mealTotals(items: MealItem[]): Totals {
  const sum = items.map(itemTotals).reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    kcal: Math.round(sum.kcal),
    protein: Math.round(sum.protein),
    carbs: Math.round(sum.carbs),
    fat: Math.round(sum.fat),
  };
}
