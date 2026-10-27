// Simple cooking ideas for the protein foods in the food list, plus a few
// low-calorie sauces (GRIZZ, 2026-10-27): five ideas per protein, each with
// short steps, so clients can cook their food simply but with flavour. Shown in
// Nutrition (ProteinCookingIdeas) and from the 🍳 next to a protein food in a
// meal plan. Foods that cook the same way share one set (hake, kingklip, cod
// and tilapia are all "White fish"). Ingredients are things any South African
// supermarket has. Like the rest of the advice, never oats.
import { FOODS } from "@/lib/foods";

export type CookingIdea = {
  name: string;
  // One line on what it tastes like or why it works.
  why: string;
  steps: string[];
};

export type ProteinCooking = {
  key: string;
  icon: string;
  title: string;
  // Names exactly as in FOODS, so a meal plan food finds its ideas.
  foods: string[];
  // A short tip that applies to every idea, e.g. how not to dry it out.
  tip: string;
  ideas: CookingIdea[];
};

export type LightSauce = {
  name: string;
  icon: string;
  // Rough calories for one serving, and how many servings it makes.
  kcal: number;
  serves: number;
  goesWith: string;
  ingredients: string[];
  steps: string[];
};

export const PROTEIN_COOKING: ProteinCooking[] = [
  {
    key: "chickenBreast",
    icon: "🐔",
    title: "Chicken breast",
    foods: ["Chicken breast (cooked)", "Chicken breast (raw)"],
    tip: "Chicken breast dries out fast. Flatten thick ends, cook it until the juices run clear (no pink inside), then let it rest 5 minutes before cutting.",
    ideas: [
      {
        name: "Lemon, garlic and herb pan chicken",
        why: "Fresh and zesty, ready in 15 minutes.",
        steps: [
          "Rub the chicken with 1 tsp oil, salt, pepper, 1 crushed garlic clove and dried mixed herbs.",
          "Fry in a hot pan for 5 to 6 minutes a side.",
          "Squeeze half a lemon over in the last minute and let it bubble.",
        ],
      },
      {
        name: "Peri-peri grilled chicken",
        why: "Proper South African flavour with almost no extra calories.",
        steps: [
          "Mix 1 tbsp peri-peri sauce (or 1 tsp chilli flakes), half a lemon's juice, 1 garlic clove and paprika.",
          "Coat the chicken and leave it 15 minutes (or overnight in the fridge).",
          "Grill, air fry or braai for 12 to 15 minutes, turning once.",
        ],
      },
      {
        name: "Yoghurt and curry spiced chicken",
        why: "The yoghurt keeps it soft and juicy.",
        steps: [
          "Mix 3 tbsp plain yoghurt with 1 tsp curry powder, a pinch of turmeric, garlic and salt.",
          "Coat the chicken and leave it at least 30 minutes in the fridge.",
          "Bake at 200°C for 20 to 25 minutes.",
        ],
      },
      {
        name: "Chicken stir-fry",
        why: "Protein and veg in one pan.",
        steps: [
          "Slice the chicken into strips and fry in 1 tsp oil for 5 minutes.",
          "Add sliced peppers, onion and baby marrow and fry 3 minutes more.",
          "Add 1 tbsp low-sodium soy sauce, grated ginger and garlic, and toss for 1 minute.",
        ],
      },
      {
        name: "Smoky air fryer chicken",
        why: "Crispy outside, no oil needed.",
        steps: [
          "Sprinkle with smoked paprika, garlic powder, salt and pepper.",
          "Air fry at 190°C for 15 to 18 minutes, turning halfway.",
          "Slice and serve with salsa or tzatziki.",
        ],
      },
    ],
  },
  {
    key: "chickenThigh",
    icon: "🍗",
    title: "Chicken thighs and drumsticks",
    foods: ["Chicken thigh, no skin (cooked)", "Chicken drumstick, with skin (cooked)"],
    tip: "Thighs and drumsticks stay juicy, so they suit the oven, the braai and slow cooking. Take the skin off to save calories.",
    ideas: [
      {
        name: "Sticky lemon and garlic tray bake",
        why: "One tray, very little washing up.",
        steps: [
          "Put the chicken on a tray with chunks of onion, butternut and peppers.",
          "Add juice of 1 lemon, 2 crushed garlic cloves, salt, pepper and 1 tsp oil.",
          "Bake at 200°C for 35 to 40 minutes.",
        ],
      },
      {
        name: "Braai spice drumsticks",
        why: "A braai favourite that works in the oven too.",
        steps: [
          "Rub with braai spice and a squeeze of lemon.",
          "Braai over medium coals or bake at 200°C for 35 minutes, turning once.",
          "Check the meat at the bone is no longer pink.",
        ],
      },
      {
        name: "Slow cooker chicken curry",
        why: "Comfort food that is light on fat.",
        steps: [
          "Fry 1 onion with 1 tbsp curry powder, garlic and ginger in 1 tsp oil.",
          "Add the chicken and a tin of chopped tomatoes.",
          "Cook on low for 6 hours (or simmer 40 minutes in a pot).",
        ],
      },
      {
        name: "Honey mustard thighs",
        why: "Sweet and tangy with just a little honey.",
        steps: [
          "Mix 1 tbsp mustard, 1 tsp honey, garlic and a squeeze of lemon.",
          "Brush over the thighs.",
          "Bake at 200°C for 25 to 30 minutes.",
        ],
      },
      {
        name: "Chicken and veg one-pot stew",
        why: "Cook once, eat for days.",
        steps: [
          "Brown the chicken in a pot with 1 tsp oil, then add onion, carrots and celery.",
          "Add 2 cups of chicken stock, thyme and a bay leaf.",
          "Simmer covered for 40 minutes.",
        ],
      },
    ],
  },
  {
    key: "chickenLivers",
    icon: "🫕",
    title: "Chicken livers",
    foods: ["Chicken livers (cooked)"],
    tip: "Livers cook in minutes. Take them off when they're just pink inside or they go grainy.",
    ideas: [
      {
        name: "Peri-peri chicken livers",
        why: "The classic SA starter, made lighter.",
        steps: [
          "Fry 1 chopped onion and 2 garlic cloves in 1 tsp oil.",
          "Add the livers and fry 3 to 4 minutes.",
          "Stir in 1 tbsp peri-peri sauce and half a tin of chopped tomatoes and simmer 5 minutes.",
        ],
      },
      {
        name: "Livers with onions and mushrooms",
        why: "Rich and filling.",
        steps: [
          "Fry sliced onion and mushrooms in 1 tsp oil until soft.",
          "Add the livers and fry 3 to 4 minutes.",
          "Season with salt, pepper and a splash of Worcestershire sauce.",
        ],
      },
      {
        name: "Creamy yoghurt livers",
        why: "Creamy without the cream.",
        steps: [
          "Fry the livers with onion and garlic for 4 minutes.",
          "Take the pan off the heat and stir in 3 tbsp plain yoghurt with paprika.",
          "Serve straight away (don't boil the yoghurt or it splits).",
        ],
      },
      {
        name: "Livers on a big salad",
        why: "A quick warm lunch.",
        steps: [
          "Fry the livers with garlic and a pinch of chilli for 3 to 4 minutes.",
          "Pile onto spinach, tomato and cucumber.",
          "Squeeze lemon over the top.",
        ],
      },
      {
        name: "Curried livers",
        why: "Big flavour for very little effort.",
        steps: [
          "Fry onion with 1 tsp curry powder and garlic.",
          "Add the livers and a chopped tomato and cook 5 minutes.",
          "Finish with fresh coriander.",
        ],
      },
    ],
  },
  {
    key: "turkey",
    icon: "🦃",
    title: "Turkey breast",
    foods: ["Turkey breast (cooked)"],
    tip: "Turkey is very lean, so cook it gently and don't overcook it.",
    ideas: [
      {
        name: "Herb roasted turkey breast",
        why: "Roast once, slice for the week.",
        steps: [
          "Rub with garlic, rosemary, thyme, salt, pepper and 1 tsp oil.",
          "Roast at 180°C for about 25 minutes per 500 g.",
          "Rest 10 minutes before slicing.",
        ],
      },
      {
        name: "Turkey lettuce wraps",
        why: "Light and crunchy.",
        steps: [
          "Slice cooked turkey into strips.",
          "Fill big lettuce leaves with turkey, grated carrot and cucumber.",
          "Add a spoon of tzatziki or salsa and roll up.",
        ],
      },
      {
        name: "Turkey and veg skewers",
        why: "Great on the braai.",
        steps: [
          "Cube the turkey and toss with lemon, garlic and paprika.",
          "Thread onto skewers with peppers, onion and baby tomatoes.",
          "Grill or braai for 10 to 12 minutes, turning often.",
        ],
      },
      {
        name: "Turkey stir-fry",
        why: "Ready in 10 minutes.",
        steps: [
          "Fry thin turkey strips in 1 tsp oil for 4 minutes.",
          "Add broccoli, peppers and green beans with a splash of water.",
          "Season with low-sodium soy sauce, ginger and chilli.",
        ],
      },
      {
        name: "Lemon pepper turkey steaks",
        why: "Simple and zesty.",
        steps: [
          "Season with lemon pepper and garlic.",
          "Pan fry 4 to 5 minutes a side.",
          "Squeeze fresh lemon over to serve.",
        ],
      },
    ],
  },
  {
    key: "mince",
    icon: "🍝",
    title: "Lean mince (beef or turkey)",
    foods: ["Lean beef mince (cooked)", "Lean turkey mince (cooked)"],
    tip: "Brown mince in a hot pan without crowding it, and pour off any fat before you add the sauce.",
    ideas: [
      {
        name: "Lean bolognaise",
        why: "Freezes well for busy weeks.",
        steps: [
          "Brown the mince with chopped onion, carrot and garlic.",
          "Add a tin of chopped tomatoes, 1 tbsp tomato paste and dried mixed herbs.",
          "Simmer 20 minutes. Serve on baby marrow noodles or your carb portion.",
        ],
      },
      {
        name: "Chilli con carne",
        why: "Extra protein and fibre from the beans.",
        steps: [
          "Brown the mince with onion, garlic and 1 tsp each chilli powder, cumin and paprika.",
          "Add a tin of tomatoes and a drained tin of kidney beans.",
          "Simmer 25 minutes.",
        ],
      },
      {
        name: "Homemade burger patties",
        why: "Way leaner than shop-bought.",
        steps: [
          "Mix the mince with grated onion, garlic, salt, pepper and 1 egg.",
          "Shape into patties.",
          "Grill, braai or pan fry 4 to 5 minutes a side. Serve in a lettuce wrap or a wholewheat roll.",
        ],
      },
      {
        name: "Mince lettuce cups",
        why: "Fresh and quick.",
        steps: [
          "Fry the mince with garlic, ginger and chilli.",
          "Add 1 tbsp low-sodium soy sauce and spring onions.",
          "Spoon into lettuce leaves.",
        ],
      },
      {
        name: "Stuffed peppers",
        why: "Looks fancy, very easy.",
        steps: [
          "Cook the mince with onion, tomato and herbs.",
          "Halve peppers, take out the seeds and fill them.",
          "Bake at 190°C for 20 to 25 minutes.",
        ],
      },
    ],
  },
  {
    key: "steak",
    icon: "🥩",
    title: "Steak (beef, ostrich or game)",
    foods: ["Beef steak (cooked)", "Ostrich steak (cooked)", "Venison / game steak (cooked)"],
    tip: "Take steak out of the fridge 20 minutes before cooking and let it rest 5 minutes after. Ostrich and game are very lean: cook them rare to medium or they go tough.",
    ideas: [
      {
        name: "Classic pan-seared steak",
        why: "Nothing beats a good steak done simply.",
        steps: [
          "Pat dry and season with salt and pepper.",
          "Sear in a very hot pan with 1 tsp oil, 2 to 4 minutes a side.",
          "Rest 5 minutes, then slice across the grain.",
        ],
      },
      {
        name: "Steak with garlic and rosemary",
        why: "Restaurant flavour at home.",
        steps: [
          "Sear the steak in a hot pan.",
          "In the last minute add 2 crushed garlic cloves and a sprig of rosemary.",
          "Spoon the pan juices over the steak.",
        ],
      },
      {
        name: "Braai steak with chimichurri",
        why: "Fresh herbs lift a braai.",
        steps: [
          "Season with braai spice and braai over hot coals.",
          "Make the light green herb sauce (see the sauces).",
          "Spoon over the sliced steak.",
        ],
      },
      {
        name: "Steak salad",
        why: "A light way to eat red meat.",
        steps: [
          "Cook and thinly slice the steak.",
          "Serve over rocket, tomato, cucumber and red onion.",
          "Dress with balsamic vinegar and lemon.",
        ],
      },
      {
        name: "Steak stir-fry",
        why: "Stretches one steak into a full meal.",
        steps: [
          "Slice the steak thinly and fry in a very hot pan for 1 to 2 minutes.",
          "Take it out, then fry broccoli, peppers and onion.",
          "Put the steak back with soy sauce, ginger and garlic and toss.",
        ],
      },
    ],
  },
  {
    key: "pork",
    icon: "🐖",
    title: "Pork chops and fillet",
    foods: ["Pork chop, lean (cooked)", "Pork fillet (cooked)"],
    tip: "Cut the fat off chops. Pork is done when the juices run clear and it's only just white in the middle.",
    ideas: [
      {
        name: "Apple and mustard pork",
        why: "Sweet and savoury, a classic pair.",
        steps: [
          "Brush the pork with mustard and season.",
          "Pan fry 4 to 5 minutes a side (fillet: roast 20 minutes at 200°C).",
          "Fry apple slices in the same pan for 2 minutes and serve on top.",
        ],
      },
      {
        name: "Garlic and herb roasted fillet",
        why: "Lean and tender.",
        steps: [
          "Rub with garlic, rosemary, salt, pepper and 1 tsp oil.",
          "Roast at 200°C for 20 to 25 minutes.",
          "Rest 5 minutes and slice.",
        ],
      },
      {
        name: "Pork with pineapple salsa",
        why: "Bright and fresh.",
        steps: [
          "Season and grill the pork.",
          "Mix chopped pineapple, red onion, chilli, coriander and lime.",
          "Spoon the salsa over the pork.",
        ],
      },
      {
        name: "Smoky braai chops",
        why: "Quick on the braai.",
        steps: [
          "Rub with smoked paprika, garlic powder and pepper.",
          "Braai or grill 4 to 5 minutes a side.",
          "Squeeze lemon over to serve.",
        ],
      },
      {
        name: "Ginger pork stir-fry",
        why: "Light and full of flavour.",
        steps: [
          "Slice fillet thinly and fry in 1 tsp oil for 3 minutes.",
          "Add cabbage, carrot and spring onion.",
          "Season with ginger, garlic and low-sodium soy sauce.",
        ],
      },
    ],
  },
  {
    key: "lamb",
    icon: "🐑",
    title: "Lamb",
    foods: ["Lamb chop (cooked)", "Lamb leg, lean (roasted)"],
    tip: "Lamb chops are fatty, so trim the fat and grill them so it drips away. Leg is the leaner cut.",
    ideas: [
      {
        name: "Rosemary and garlic lamb chops",
        why: "A Sunday favourite.",
        steps: [
          "Rub with garlic, chopped rosemary, salt and pepper.",
          "Grill or braai 3 to 4 minutes a side.",
          "Rest 3 minutes.",
        ],
      },
      {
        name: "Slow roast leg of lamb",
        why: "Feeds the family with leftovers.",
        steps: [
          "Make small cuts in the meat and push in garlic slivers and rosemary.",
          "Roast at 160°C for about 3 hours with a cup of water in the pan, covered.",
          "Trim visible fat before serving.",
        ],
      },
      {
        name: "Lamb kebabs with tzatziki",
        why: "Greek style and fresh.",
        steps: [
          "Cube lean leg and mix with lemon, oregano and garlic.",
          "Thread on skewers with onion and peppers and grill 8 to 10 minutes.",
          "Serve with tzatziki (see the sauces).",
        ],
      },
      {
        name: "Lamb curry",
        why: "Slow, rich and warming.",
        steps: [
          "Brown cubed lean lamb with onion, garlic, ginger and 1 tbsp curry powder.",
          "Add a tin of tomatoes and 1 cup of water.",
          "Simmer covered for 1.5 hours until soft.",
        ],
      },
      {
        name: "Mint and lemon lamb",
        why: "Fresh and light.",
        steps: [
          "Mix chopped mint, lemon zest, garlic and 1 tsp oil.",
          "Rub on the lamb and leave 30 minutes.",
          "Grill until done to your liking.",
        ],
      },
    ],
  },
  {
    key: "boerewors",
    icon: "🌭",
    title: "Boerewors",
    foods: ["Boerewors (cooked)"],
    tip: "Boerewors is high in fat, so keep the portion small and fill the plate with veg. Grill it so the fat drips away, and don't prick it.",
    ideas: [
      {
        name: "Braai wors with chakalaka",
        why: "A proper South African plate.",
        steps: [
          "Braai over medium coals, about 15 minutes, turning often.",
          "Serve with the light chakalaka (see the sauces).",
          "Add a side salad.",
        ],
      },
      {
        name: "Oven wors with roast veg",
        why: "No braai needed.",
        steps: [
          "Lay the wors coil on a tray with chopped peppers, onion and butternut.",
          "Bake at 200°C for 25 to 30 minutes.",
          "Pour off the fat before serving.",
        ],
      },
      {
        name: "Wors and tomato relish",
        why: "Quick weeknight meal.",
        steps: [
          "Grill the wors and slice it.",
          "Fry onion and tomato with a little chilli until soft.",
          "Stir in the wors and heat through.",
        ],
      },
      {
        name: "Wors on a big salad",
        why: "Keeps the portion small, the plate big.",
        steps: [
          "Grill and slice a small piece of wors.",
          "Serve over lettuce, tomato, cucumber and peppers.",
          "Dress with lemon juice or balsamic vinegar.",
        ],
      },
      {
        name: "Wors and veg skewers",
        why: "Fun on the braai.",
        steps: [
          "Cut cooked wors into chunks.",
          "Thread with peppers, onion and mushrooms.",
          "Braai or grill for 5 to 8 minutes.",
        ],
      },
    ],
  },
  {
    key: "baconHam",
    icon: "🥓",
    title: "Bacon and ham",
    foods: ["Bacon, back (grilled)", "Ham, lean"],
    tip: "Both are salty, so keep portions small. Grill back bacon instead of frying it, and cut off the white fat.",
    ideas: [
      {
        name: "Bacon and egg breakfast",
        why: "A weekend classic, done lighter.",
        steps: [
          "Grill 2 rashers of back bacon until crisp.",
          "Poach or scramble 2 eggs.",
          "Add grilled tomato and mushrooms.",
        ],
      },
      {
        name: "Ham and veg omelette",
        why: "High protein, 10 minutes.",
        steps: [
          "Whisk 2 to 3 eggs with salt and pepper.",
          "Pour into a hot pan, add chopped ham, spinach and tomato.",
          "Fold over when set.",
        ],
      },
      {
        name: "Ham and cottage cheese wraps",
        why: "A no-cook lunch.",
        steps: [
          "Spread cottage cheese on a slice of ham.",
          "Add cucumber sticks and a little mustard.",
          "Roll up.",
        ],
      },
      {
        name: "Bacon and broccoli stir-fry",
        why: "Bacon adds flavour, broccoli adds bulk.",
        steps: [
          "Grill bacon and chop it.",
          "Stir-fry broccoli and garlic in a splash of water.",
          "Toss the bacon through.",
        ],
      },
      {
        name: "Ham and salad lunch box",
        why: "Grab and go.",
        steps: [
          "Fill a box with lettuce, tomato, cucumber and peppers.",
          "Add sliced ham.",
          "Pack a little mustard-yoghurt dressing (see the sauces).",
        ],
      },
    ],
  },
  {
    key: "biltong",
    icon: "🥩",
    title: "Biltong and droëwors",
    foods: ["Biltong", "Biltong, lean, wet", "Biltong, lean, medium", "Biltong, lean, dry", "Droëwors"],
    tip: "Biltong is already cooked and is a great protein snack. It's high in salt, so go easy if you have high blood pressure, and pick lean biltong over droëwors (much more fat).",
    ideas: [
      {
        name: "Biltong salad",
        why: "Turns a snack into a meal.",
        steps: [
          "Slice lean biltong thinly.",
          "Toss with rocket, tomato, cucumber and a little feta.",
          "Dress with lemon juice and black pepper.",
        ],
      },
      {
        name: "Biltong scrambled eggs",
        why: "Savoury and high protein.",
        steps: [
          "Scramble 2 eggs in a non-stick pan.",
          "Stir in a handful of chopped biltong at the end.",
          "Top with chives or spring onion.",
        ],
      },
      {
        name: "Biltong and cottage cheese snack",
        why: "Protein on protein, no cooking.",
        steps: [
          "Spoon cottage cheese into a bowl.",
          "Top with chopped biltong and black pepper.",
          "Eat with cucumber or celery sticks.",
        ],
      },
      {
        name: "Biltong and veg snack box",
        why: "A handy work snack.",
        steps: [
          "Pack a handful of biltong.",
          "Add baby tomatoes, carrot sticks and cucumber.",
          "Add a small piece of fruit.",
        ],
      },
      {
        name: "Biltong stuffed mushrooms",
        why: "A braai side that's mostly veg.",
        steps: [
          "Mix chopped biltong with cottage cheese and garlic.",
          "Fill big brown mushrooms.",
          "Bake at 190°C or braai for 12 to 15 minutes.",
        ],
      },
    ],
  },
  {
    key: "salmonTrout",
    icon: "🐟",
    title: "Salmon and trout",
    foods: ["Salmon (cooked)", "Trout (cooked)"],
    tip: "These are oily fish, full of omega-3. They need no added oil: cook skin side down first until it lifts easily.",
    ideas: [
      {
        name: "Lemon and dill baked fish",
        why: "Ready in 15 minutes.",
        steps: [
          "Lay on foil, top with lemon slices, dill, salt and pepper.",
          "Fold the foil closed.",
          "Bake at 200°C for 12 to 15 minutes.",
        ],
      },
      {
        name: "Honey soy glazed fish",
        why: "Sticky and sweet with very little honey.",
        steps: [
          "Mix 1 tbsp low-sodium soy, 1 tsp honey, garlic and ginger.",
          "Brush over the fish.",
          "Bake at 200°C or air fry for 10 to 12 minutes.",
        ],
      },
      {
        name: "Crispy skin pan-fried fish",
        why: "Crunchy skin, juicy inside.",
        steps: [
          "Pat the skin dry and salt it.",
          "Cook skin down in a hot non-stick pan for 4 to 5 minutes.",
          "Flip for 1 to 2 minutes more.",
        ],
      },
      {
        name: "Fish and greens tray bake",
        why: "One tray, done.",
        steps: [
          "Put the fish on a tray with green beans, broccoli and baby tomatoes.",
          "Add lemon, garlic, salt and pepper.",
          "Bake at 200°C for 15 minutes.",
        ],
      },
      {
        name: "Flaked fish salad",
        why: "Great with leftovers.",
        steps: [
          "Flake cooked fish.",
          "Toss with lettuce, cucumber, avocado and red onion.",
          "Dress with lemon and a spoon of yoghurt.",
        ],
      },
    ],
  },
  {
    key: "whiteFish",
    icon: "🐠",
    title: "White fish (hake, kingklip, cod, tilapia)",
    foods: ["Hake / white fish (cooked)", "Kingklip (cooked)", "Cod (cooked)", "Tilapia (cooked)"],
    tip: "White fish is very lean and delicate. It's done when it turns white and flakes with a fork. Frozen hake works fine: cook from frozen and add a few minutes.",
    ideas: [
      {
        name: "Lemon butter hake (made light)",
        why: "Tastes like a treat.",
        steps: [
          "Season with salt, pepper and paprika.",
          "Pan fry in 1 tsp butter for 3 to 4 minutes a side.",
          "Squeeze lemon over and add chopped parsley.",
        ],
      },
      {
        name: "Cape Malay fish curry",
        why: "Warming and fragrant.",
        steps: [
          "Fry onion with garlic, ginger and 1 tbsp curry powder.",
          "Add a tin of tomatoes and simmer 10 minutes.",
          "Add chunks of fish and simmer 6 to 8 minutes. Top with coriander.",
        ],
      },
      {
        name: "Crumbed oven fish",
        why: "Fish and chips feeling, much lighter.",
        steps: [
          "Dip the fish in beaten egg, then a thin coat of wholewheat breadcrumbs with paprika.",
          "Spray lightly with oil.",
          "Bake at 200°C or air fry for 12 to 15 minutes.",
        ],
      },
      {
        name: "Fish parcels with veg",
        why: "Steams in its own juices.",
        steps: [
          "Put the fish on foil with sliced baby marrow, peppers and tomato.",
          "Add lemon, garlic and herbs, then close the foil.",
          "Bake at 200°C or braai for 15 minutes.",
        ],
      },
      {
        name: "Fish tacos",
        why: "Fun Friday night meal.",
        steps: [
          "Grill the fish with chilli and lime.",
          "Flake into small wraps or lettuce cups.",
          "Top with shredded cabbage, tomato salsa and a spoon of yoghurt.",
        ],
      },
    ],
  },
  {
    key: "snoek",
    icon: "🔥",
    title: "Snoek",
    foods: ["Snoek (cooked)"],
    tip: "Snoek has fine bones, so flake it carefully. It braais best skin side down so it doesn't fall apart.",
    ideas: [
      {
        name: "Braaied snoek with apricot glaze (light)",
        why: "The Cape classic, with less sugar.",
        steps: [
          "Mix 1 tbsp apricot jam with lemon juice and garlic.",
          "Braai the snoek skin side down for 10 minutes.",
          "Brush with the glaze and braai 5 minutes more.",
        ],
      },
      {
        name: "Lemon and garlic grilled snoek",
        why: "No sugar at all.",
        steps: [
          "Brush with lemon, crushed garlic and black pepper.",
          "Grill in the oven skin down for 12 to 15 minutes.",
          "Add fresh parsley.",
        ],
      },
      {
        name: "Snoek salad",
        why: "Uses up leftover snoek.",
        steps: [
          "Flake cooked snoek and take out the bones.",
          "Toss with lettuce, tomato, cucumber and red onion.",
          "Dress with lemon juice.",
        ],
      },
      {
        name: "Snoek and tomato bredie style",
        why: "A comforting pot meal.",
        steps: [
          "Fry onion and garlic, then add a tin of tomatoes and chilli.",
          "Simmer 10 minutes.",
          "Add flaked snoek and heat through.",
        ],
      },
      {
        name: "Snoek fish cakes",
        why: "A good way to stretch it.",
        steps: [
          "Mix flaked snoek with 1 egg, spring onion and a little mashed sweet potato.",
          "Shape into small cakes.",
          "Bake at 200°C or air fry for 12 minutes, turning once.",
        ],
      },
    ],
  },
  {
    key: "tuna",
    icon: "🥫",
    title: "Tuna",
    foods: ["Tuna in water (drained)"],
    tip: "Buy tuna in water, not oil, and drain it well. A squeeze of lemon takes away the tinny taste.",
    ideas: [
      {
        name: "Light tuna mayo",
        why: "Creamy with yoghurt instead of mayo.",
        steps: [
          "Mix the tuna with 2 tbsp fat-free Greek yoghurt and 1 tsp mustard.",
          "Add chopped celery, spring onion and black pepper.",
          "Eat in lettuce cups or on wholewheat toast.",
        ],
      },
      {
        name: "Tuna stuffed tomatoes or peppers",
        why: "No cooking needed.",
        steps: [
          "Scoop out tomatoes or halve peppers.",
          "Fill with tuna, sweetcorn and a little yoghurt.",
          "Top with black pepper and herbs.",
        ],
      },
      {
        name: "Tuna fish cakes",
        why: "Kids like these too.",
        steps: [
          "Mix tuna, 1 egg, spring onion and a little mashed potato or sweet potato.",
          "Shape into patties.",
          "Pan fry in 1 tsp oil or air fry for 10 minutes.",
        ],
      },
      {
        name: "Tuna and bean salad",
        why: "Extra fibre and very filling.",
        steps: [
          "Mix tuna with a drained tin of butter beans.",
          "Add red onion, tomato, cucumber and parsley.",
          "Dress with lemon and a little olive oil.",
        ],
      },
      {
        name: "Tuna and tomato pasta sauce",
        why: "Pantry meal in 10 minutes.",
        steps: [
          "Fry garlic and chilli, add a tin of tomatoes and simmer 5 minutes.",
          "Stir in the tuna and some capers or olives.",
          "Serve on your carb portion or on baby marrow noodles.",
        ],
      },
    ],
  },
  {
    key: "tinnedFish",
    icon: "🐡",
    title: "Pilchards, sardines and mackerel",
    foods: ["Pilchards in tomato sauce", "Sardines in tomato sauce", "Mackerel, tinned (drained)"],
    tip: "Cheap, full of omega-3 and calcium (eat the soft bones). They're already cooked, so they only need heating.",
    ideas: [
      {
        name: "Pilchard and onion stew",
        why: "The SA budget favourite.",
        steps: [
          "Fry 1 sliced onion and a chopped green pepper in 1 tsp oil.",
          "Add the pilchards with their sauce and a little chilli.",
          "Heat through for 5 minutes.",
        ],
      },
      {
        name: "Sardines on toast",
        why: "A 5-minute meal.",
        steps: [
          "Toast a slice of wholewheat bread.",
          "Mash sardines with lemon and black pepper.",
          "Spread on the toast and add sliced tomato.",
        ],
      },
      {
        name: "Mackerel salad",
        why: "Fresh and filling.",
        steps: [
          "Flake mackerel over lettuce, cucumber and tomato.",
          "Add red onion and a few olives.",
          "Squeeze lemon over.",
        ],
      },
      {
        name: "Pilchard fish cakes",
        why: "Stretches one tin into two meals.",
        steps: [
          "Mash pilchards with 1 egg, onion and a little mashed sweet potato.",
          "Shape into cakes.",
          "Bake at 200°C or air fry for 12 minutes.",
        ],
      },
      {
        name: "Curried pilchards",
        why: "Spicy and warming.",
        steps: [
          "Fry onion with 1 tsp curry powder.",
          "Add the pilchards and a chopped tomato.",
          "Simmer 5 minutes and top with coriander.",
        ],
      },
    ],
  },
  {
    key: "prawns",
    icon: "🦐",
    title: "Prawns",
    foods: ["Prawns (cooked)"],
    tip: "Prawns cook in 2 to 3 minutes: they're done when they turn pink and curl. Frozen prawns are fine, thaw them first.",
    ideas: [
      {
        name: "Garlic and chilli prawns",
        why: "Restaurant flavour in 5 minutes.",
        steps: [
          "Fry 2 garlic cloves and a pinch of chilli in 1 tsp butter.",
          "Add the prawns and cook 2 to 3 minutes.",
          "Squeeze lemon over and add parsley.",
        ],
      },
      {
        name: "Peri-peri prawns",
        why: "Mozambican style.",
        steps: [
          "Toss the prawns with peri-peri sauce, lemon and garlic.",
          "Grill or braai 2 minutes a side.",
          "Serve with a big salad.",
        ],
      },
      {
        name: "Prawn stir-fry",
        why: "Light and colourful.",
        steps: [
          "Stir-fry peppers, snap peas and onion for 3 minutes.",
          "Add the prawns, ginger and garlic.",
          "Cook 2 to 3 minutes and add low-sodium soy sauce.",
        ],
      },
      {
        name: "Prawn and tomato curry",
        why: "Quick weeknight curry.",
        steps: [
          "Fry onion with curry powder, garlic and ginger.",
          "Add a tin of tomatoes and simmer 10 minutes.",
          "Add the prawns and cook 3 minutes.",
        ],
      },
      {
        name: "Prawn salad",
        why: "A summer lunch.",
        steps: [
          "Mix cooked prawns with lettuce, avocado and cucumber.",
          "Make a dressing of yoghurt, lemon and a pinch of paprika.",
          "Spoon it over.",
        ],
      },
    ],
  },
  {
    key: "mussels",
    icon: "🦪",
    title: "Mussels",
    foods: ["Mussels (cooked)"],
    tip: "Throw away any mussels that stay closed after cooking. Frozen half-shell mussels are the easiest to use.",
    ideas: [
      {
        name: "Garlic and white wine mussels (light)",
        why: "A classic, no cream needed.",
        steps: [
          "Fry garlic and onion in 1 tsp butter.",
          "Add the mussels and half a cup of stock (or a splash of white wine).",
          "Cover and steam 5 minutes. Top with parsley.",
        ],
      },
      {
        name: "Tomato and chilli mussels",
        why: "Rich and spicy.",
        steps: [
          "Simmer a tin of tomatoes with garlic and chilli for 10 minutes.",
          "Add the mussels.",
          "Cover and cook 5 minutes.",
        ],
      },
      {
        name: "Grilled half-shell mussels",
        why: "Great for the braai.",
        steps: [
          "Top each mussel with a little garlic, lemon and parsley.",
          "Sprinkle a tiny bit of parmesan.",
          "Grill or braai 5 minutes.",
        ],
      },
      {
        name: "Curry coconut mussels (light)",
        why: "Creamy with light coconut milk.",
        steps: [
          "Fry onion with curry paste.",
          "Add half a tin of light coconut milk.",
          "Add the mussels, cover and cook 5 minutes.",
        ],
      },
      {
        name: "Mussel stir-fry",
        why: "Uses frozen mussel meat.",
        steps: [
          "Stir-fry broccoli and peppers.",
          "Add the mussel meat with ginger and garlic.",
          "Cook 3 minutes with low-sodium soy sauce.",
        ],
      },
    ],
  },
  {
    key: "eggs",
    icon: "🥚",
    title: "Eggs and egg whites",
    foods: ["Eggs", "Egg whites"],
    tip: "Eggs are the cheapest, quickest protein there is. Mixing whole eggs with egg whites gives more protein for fewer calories.",
    ideas: [
      {
        name: "Veggie omelette",
        why: "Breakfast in 10 minutes.",
        steps: [
          "Whisk 2 eggs plus some egg whites with salt and pepper.",
          "Pour into a hot non-stick pan with spinach, tomato and mushrooms.",
          "Fold when set.",
        ],
      },
      {
        name: "Shakshuka",
        why: "Eggs baked in a spicy tomato sauce.",
        steps: [
          "Fry onion and peppers, add a tin of tomatoes, paprika and cumin.",
          "Simmer 10 minutes, make small wells and crack in 2 to 3 eggs.",
          "Cover and cook 5 to 7 minutes until the whites set.",
        ],
      },
      {
        name: "Egg muffins",
        why: "Make a batch for the week.",
        steps: [
          "Whisk 6 eggs with chopped peppers, spinach, onion and a little ham.",
          "Pour into a greased muffin tray.",
          "Bake at 180°C for 18 to 20 minutes. Keeps 4 days in the fridge.",
        ],
      },
      {
        name: "Boiled egg snack",
        why: "The easiest protein snack.",
        steps: [
          "Boil eggs for 9 to 10 minutes, then put them in cold water.",
          "Peel and keep in the fridge.",
          "Eat with salt, pepper or a pinch of chilli.",
        ],
      },
      {
        name: "Egg white scramble",
        why: "Very high protein, very low fat.",
        steps: [
          "Fry onion, tomato and spinach in a non-stick pan.",
          "Add egg whites (and 1 whole egg for flavour).",
          "Stir gently until just set. Top with chives.",
        ],
      },
    ],
  },
  {
    key: "dairy",
    icon: "🥛",
    title: "Yoghurt, cottage cheese and quark",
    foods: [
      "Greek yoghurt, plain",
      "Greek yoghurt, fat free",
      "Plain yoghurt, low fat",
      "Skyr",
      "Quark, low fat",
      "Cottage cheese, low fat",
    ],
    tip: "Pick plain, unsweetened tubs and add your own flavour. Flavoured ones are full of sugar.",
    ideas: [
      {
        name: "Berry yoghurt bowl",
        why: "Sweet, but not sugary.",
        steps: [
          "Spoon yoghurt or skyr into a bowl.",
          "Top with berries and a sprinkle of cinnamon.",
          "Add a few nuts or seeds for crunch.",
        ],
      },
      {
        name: "Savoury cottage cheese bowl",
        why: "A high protein lunch.",
        steps: [
          "Spoon cottage cheese into a bowl.",
          "Add cucumber, tomato, spring onion and black pepper.",
          "Eat with crackers or veg sticks.",
        ],
      },
      {
        name: "Frozen yoghurt bark",
        why: "A healthy sweet treat.",
        steps: [
          "Spread yoghurt thinly on a lined tray.",
          "Press in berries and a little dark chocolate.",
          "Freeze 2 hours, then break into pieces.",
        ],
      },
      {
        name: "Quark or yoghurt dip",
        why: "Swap for creamy dips.",
        steps: [
          "Mix quark or yoghurt with garlic, lemon and herbs.",
          "Season with salt and pepper.",
          "Serve with carrot, cucumber and pepper sticks.",
        ],
      },
      {
        name: "Protein smoothie",
        why: "Breakfast in a glass.",
        steps: [
          "Blend yoghurt, a banana or berries and a little milk.",
          "Add a scoop of protein powder if you like.",
          "Add ice and blend again.",
        ],
      },
    ],
  },
  {
    key: "proteinPowder",
    icon: "🥤",
    title: "Protein powder (whey or plant)",
    foods: ["Whey protein powder", "Plant protein powder"],
    tip: "Protein powder is a handy top-up, not a meal. Use it when you're short of protein for the day.",
    ideas: [
      {
        name: "Classic shake",
        why: "Quick after training.",
        steps: [
          "Add 1 scoop to 250 ml water or milk.",
          "Shake or blend with ice.",
          "Drink straight away.",
        ],
      },
      {
        name: "Protein yoghurt",
        why: "Thick like mousse.",
        steps: [
          "Stir half a scoop into a bowl of plain yoghurt.",
          "Mix until smooth.",
          "Top with berries.",
        ],
      },
      {
        name: "Banana protein pancakes",
        why: "Just 3 ingredients.",
        steps: [
          "Mash 1 banana with 2 eggs and 1 scoop of protein powder.",
          "Fry small pancakes in a non-stick pan, 1 to 2 minutes a side.",
          "Top with berries and yoghurt.",
        ],
      },
      {
        name: "Iced protein coffee",
        why: "Coffee and protein together.",
        steps: [
          "Make a strong coffee and let it cool.",
          "Shake with 1 scoop of protein, milk and ice.",
          "Pour into a glass.",
        ],
      },
      {
        name: "Protein ice cream",
        why: "A dessert that helps your protein.",
        steps: [
          "Blend 1 frozen banana or frozen berries with 1 scoop of protein.",
          "Add a splash of milk to get it smooth.",
          "Eat straight away or freeze 30 minutes.",
        ],
      },
    ],
  },
  {
    key: "tofuTempeh",
    icon: "🌱",
    title: "Tofu and tempeh",
    foods: ["Tofu, firm", "Tempeh"],
    tip: "Press tofu between paper towels with something heavy on top for 15 minutes so it soaks up flavour and goes crispy.",
    ideas: [
      {
        name: "Crispy air fryer tofu",
        why: "Crunchy outside, soft inside.",
        steps: [
          "Press and cube the tofu.",
          "Toss with 1 tsp cornflour, garlic powder, paprika and a splash of soy sauce.",
          "Air fry at 200°C for 15 minutes, shaking halfway.",
        ],
      },
      {
        name: "Tofu stir-fry",
        why: "Quick and filling.",
        steps: [
          "Fry tofu cubes until golden, take out.",
          "Stir-fry broccoli, peppers and carrots.",
          "Add tofu back with soy sauce, ginger and chilli.",
        ],
      },
      {
        name: "Tofu scramble",
        why: "A plant-based breakfast.",
        steps: [
          "Crumble tofu into a pan with onion and peppers.",
          "Add turmeric, salt, pepper and spinach.",
          "Cook 5 minutes.",
        ],
      },
      {
        name: "Tempeh curry",
        why: "Nutty and rich.",
        steps: [
          "Fry onion with curry powder and garlic.",
          "Add cubed tempeh and a tin of tomatoes.",
          "Simmer 15 minutes.",
        ],
      },
      {
        name: "Smoky tempeh strips",
        why: "Great in wraps or salads.",
        steps: [
          "Slice tempeh thinly.",
          "Toss with soy sauce, smoked paprika and a little honey.",
          "Pan fry 3 minutes a side until crispy.",
        ],
      },
    ],
  },
  {
    key: "edamame",
    icon: "🫛",
    title: "Edamame beans",
    foods: ["Edamame beans"],
    tip: "Buy them frozen. Boil or microwave for 3 to 5 minutes and they're ready.",
    ideas: [
      {
        name: "Salt and chilli edamame",
        why: "The perfect snack.",
        steps: [
          "Boil edamame in the pod for 4 minutes and drain.",
          "Toss with a pinch of salt and chilli flakes.",
          "Pop the beans out of the pods to eat.",
        ],
      },
      {
        name: "Garlic edamame",
        why: "Big flavour.",
        steps: [
          "Fry 2 garlic cloves in 1 tsp oil.",
          "Add cooked edamame and a splash of soy sauce.",
          "Toss for 1 minute.",
        ],
      },
      {
        name: "Edamame salad",
        why: "Adds protein to any salad.",
        steps: [
          "Mix shelled edamame with cucumber, carrot and red cabbage.",
          "Add a dressing of soy sauce, lemon and ginger.",
          "Sprinkle sesame seeds.",
        ],
      },
      {
        name: "Edamame stir-fry",
        why: "Plant protein dinner.",
        steps: [
          "Stir-fry onion, peppers and broccoli.",
          "Add shelled edamame.",
          "Season with soy sauce and ginger.",
        ],
      },
      {
        name: "Edamame dip",
        why: "A green hummus swap.",
        steps: [
          "Blend shelled edamame with lemon, garlic and a splash of water.",
          "Season with salt and cumin.",
          "Serve with veg sticks.",
        ],
      },
    ],
  },
];

export const LIGHT_SAUCES: LightSauce[] = [
  {
    name: "Tzatziki (cucumber yoghurt)",
    icon: "🥒",
    kcal: 25,
    serves: 4,
    goesWith: "Chicken, lamb, fish, burgers and wraps.",
    ingredients: ["150 g fat-free Greek yoghurt", "Half a cucumber, grated and squeezed dry", "1 small garlic clove, crushed", "Juice of half a lemon", "Fresh mint or dill, salt and pepper"],
    steps: ["Grate the cucumber and squeeze out the water in your hands.", "Mix everything together.", "Leave 10 minutes in the fridge. Keeps 3 days."],
  },
  {
    name: "Peri-peri yoghurt sauce",
    icon: "🌶️",
    kcal: 25,
    serves: 4,
    goesWith: "Chicken, prawns, steak and wors.",
    ingredients: ["150 g fat-free Greek yoghurt", "1 to 2 tsp peri-peri sauce (or a pinch of chilli flakes)", "Half a tsp paprika", "1 small garlic clove, crushed", "A squeeze of lemon and a pinch of salt"],
    steps: ["Mix everything together.", "Taste and add more peri-peri if you like it hot.", "Keeps 3 days in the fridge."],
  },
  {
    name: "Fresh tomato salsa",
    icon: "🍅",
    kcal: 15,
    serves: 4,
    goesWith: "Fish, eggs, chicken, mince and tacos.",
    ingredients: ["2 ripe tomatoes, chopped small", "Half a red onion, chopped small", "1 green chilli (optional)", "A handful of fresh coriander", "Juice of 1 lime or half a lemon, and salt"],
    steps: ["Chop the tomatoes, onion, chilli and coriander.", "Mix with the lime juice and a pinch of salt.", "Leave 10 minutes so the flavours mix. Best eaten the same day."],
  },
  {
    name: "Light chakalaka",
    icon: "🫑",
    kcal: 45,
    serves: 6,
    goesWith: "Wors, chicken, steak and pilchards.",
    ingredients: ["1 tsp oil", "1 onion and 1 green pepper, chopped", "2 carrots, grated", "1 tbsp curry powder and 2 garlic cloves", "1 tin chopped tomatoes", "Chilli to taste"],
    steps: ["Fry the onion and pepper in the oil for 5 minutes.", "Add the garlic, curry powder and carrot and fry 2 minutes.", "Add the tomatoes and chilli and simmer 15 minutes. Keeps 4 days in the fridge."],
  },
  {
    name: "Mustard yoghurt dressing",
    icon: "🍯",
    kcal: 25,
    serves: 2,
    goesWith: "Salads, pork, chicken and ham.",
    ingredients: ["3 tbsp fat-free Greek yoghurt", "1 tsp wholegrain or Dijon mustard", "1 tsp honey", "A squeeze of lemon", "Salt and pepper"],
    steps: ["Mix everything together.", "Add a splash of water if you want it thinner.", "Keeps 3 days in the fridge."],
  },
  {
    name: "Light green herb sauce (chimichurri)",
    icon: "🌿",
    kcal: 35,
    serves: 4,
    goesWith: "Steak, lamb, chicken and fish.",
    ingredients: ["A big handful of parsley", "A small handful of coriander", "1 garlic clove", "1 tbsp olive oil", "2 tbsp red wine vinegar or lemon juice", "A pinch of chilli flakes and salt", "2 tbsp water"],
    steps: ["Chop the herbs and garlic very finely (or blend quickly).", "Mix with the oil, vinegar, water, chilli and salt.", "Leave 10 minutes. Keeps 3 days in the fridge."],
  },
  {
    name: "Ginger soy dipping sauce",
    icon: "🫚",
    kcal: 15,
    serves: 2,
    goesWith: "Stir-fries, fish, prawns, tofu and edamame.",
    ingredients: ["2 tbsp low-sodium soy sauce", "1 tbsp lemon juice or rice vinegar", "1 tsp grated ginger", "1 small garlic clove, crushed", "Half a tsp honey and a pinch of chilli"],
    steps: ["Mix everything together.", "Leave 5 minutes for the ginger to flavour it.", "Keeps a week in the fridge."],
  },
];

/** The cooking ideas for a food from the food list, if it is a protein we have ideas for. */
export function cookingIdeasFor(food: string): ProteinCooking | undefined {
  return PROTEIN_COOKING.find((p) => p.foods.includes(food));
}

/** Every protein food in the list, so a test can check none is missing ideas. */
export function proteinFoodNames(): string[] {
  return FOODS.filter((f) => f.group === "Protein").map((f) => f.name);
}
