// The coach's introduction to the app. Shown once, the first time the app is
// opened (before signup), and any time after from the client menu. The words
// are the coach's own; only spelling has been tidied.

// Remembered on the phone once the welcome has been read.
export const WELCOME_SEEN_KEY = "welcomeSeen";

export const WELCOME_MENU_ITEM = {
  key: "welcome",
  title: "Welcome",
  icon: "✨",
  summary: "Why this app exists and how it will guide you.",
};

export const WELCOME_OPENING_QUESTION = "If you could be all that you could be, what would that look like?";

export const WELCOME_OPENING_FOLLOW_UP =
  "What would your habits, mindsets, mannerisms, physiques, hobbies, business & routines be?";

export const WELCOME_BECOME = "To be what you want to be, you need to act like the person you are gonna become.";

export const WELCOME_GOALS = [
  "Fat loss",
  "Bulking up",
  "General fitness & wellbeing",
  "Longevity",
  "Nutrition",
  "Optimising your life",
];

export type WelcomeCard = { kicker: string; title: string; paragraphs: string[] };

export const WELCOME_CARDS: WelcomeCard[] = [
  {
    kicker: "THE SYSTEM",
    title: "Built from years of research and life experience",
    paragraphs: [
      "It has taken me a long time and lots of research and life experience to put this app and system together to educate and guide you through this process of achieving your lifestyle goals.",
    ],
  },
  {
    kicker: "THE PATH",
    title: "Work surgically towards your goal",
    paragraphs: [
      "Whatever your goals, you need to have a path to follow, else you're just gonna be hacking away at bullshit with a machete, instead of surgically working towards your goal.",
    ],
  },
  {
    kicker: "BUILT AROUND YOU",
    title: "There's no one-shoe-fits-all approach",
    paragraphs: [
      "This information will be adjusted specifically towards your needs and goals, because there's no one-shoe-fits-all approach. Especially not if you want to maintain these changes in the long run.",
    ],
  },
  {
    kicker: "THE END GOAL",
    title: "For you not to need me anymore",
    paragraphs: [
      "I will be educating and guiding you through this process so that you can learn how to adjust things for your own body.",
      "The end goal is for you not to need me anymore. I want you to learn to understand your body and nutrition in such a way that you can still have fun and enjoy yourself.",
    ],
  },
  {
    kicker: "BALANCE",
    title: "Life is for living, and food is amazing",
    paragraphs: [
      "Restricting yourself from all the good things in life is not sustainable.",
      "BUT if you wanna live a good, healthy, fulfilled life and see your kids grow old, then there needs to be a level of discipline involved, but most importantly education.",
      "Whatever you learn here can be passed on to your kids, which currently might be some of the best education you can bestow upon them.",
    ],
  },
];

export const WELCOME_DISCIPLINE = "Discipline is the highest form of self respect that you can get!";

export const WELCOME_GROWING = [
  "This app has been put together to help each client with his or her individual needs.",
  "I have tried to cover as much as possible, but my goal is to make this the best lifestyle application there is. I will be adding new stuff as I see clients need more help, be it stress management, routines or structures.",
  "If you have any suggestions for improvement, please go to the Suggestion box in the Menu.",
];

export const WELCOME_SIGN_OFF = "Glad to have you on board. I really hope this helps you.";
