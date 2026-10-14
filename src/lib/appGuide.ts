// "How to use the app" (GRIZZ, 2026-10-12): everything the app can do, so
// clients and trainers know what's at their disposal and how to get the most
// from it. Shown as tap-to-open headings (AppGuideScreen) from the menu.

export type GuideTopic = {
  key: string;
  icon: string;
  title: string;
  // Where to find it in the app.
  where: string;
  points: string[];
};

export type AppGuide = {
  intro: string;
  topics: GuideTopic[];
  // The one-line habit that ties it together.
  bottomLine: string;
};

export const APP_GUIDE_MENU_ITEM = {
  key: "appGuide",
  title: "How to use the app",
  icon: "📘",
  summary: "Everything the app can do for you, and how to get the most from it.",
};

export const CLIENT_APP_GUIDE: AppGuide = {
  intro:
    "This app is your coach in your pocket. The more honestly you use it, the better your coach can guide you. Tap a heading to see what it does and how to get the most from it.",
  topics: [
    {
      key: "daily",
      icon: "✅",
      title: "Your daily check-in",
      where: "Check-in tab",
      points: [
        "Do it every morning. It takes a minute: your sleep, water, meals, alcohol and how you feel.",
        "Be honest. A bad day logged truthfully helps your coach far more than a perfect day that didn't happen.",
        "The body and mind check asks about pain, tiredness and stress. If you report a problem, your coach is told straight away and the app checks in with you the next morning.",
        "After you check in, 📈 Your tips for this week reads your last 7 days and shows up to 3 things to work on, what to do and what it will do for you.",
        "Messages from your coach show at the top. You can reply right there.",
        "Your daily quote and the evening sleep tip also live here.",
      ],
    },
    {
      key: "habits",
      icon: "🔥",
      title: "Habits and streaks",
      where: "Habits tab",
      points: [
        "Tick off each habit as you do it. Your streak grows every day you keep it going.",
        "Your coach can set habits for you. You can also add your own from the list (nutrition, movement, sleep, mindset) or write your own, up to 15 at a time.",
        "Set a reminder time on a habit so the app nudges you.",
        "Start small. Two habits you never miss beat ten you forget.",
        "Keep a habit 5 days out of 7 and your coach is told, so expect a message from them.",
      ],
    },
    {
      key: "training",
      icon: "🏋️",
      title: "Today's workout",
      where: "Exercises tab",
      points: [
        "Your workout for today is at the top. Tap an exercise to open it and log your sets.",
        "Tap 📖 How to do it on any exercise to watch the demo video and see what it works, the steps, and tips to get the most from it. Tap the green Do set button beside the exercise, or at the bottom of the guide, to log your set.",
        "The first exercise for each body part starts with one warm-up set at half your start weight. It's logged as a warm-up and doesn't count as a working set.",
        "Log the weight, the reps and how the set felt. The rest timer starts by itself, and supersets take you straight to the next exercise.",
        "🏅 Lift 10% more on an exercise for at least the same reps and you earn a gold achievement badge. Your coach is told too.",
        "On workouts with abs between sets, the app shows an ab exercise after each set. Do the reps, then tap Complete and your rest timer starts.",
        "📈 Try this weight next tells you when you're ready to go heavier. Beat last time and you earn a gold star ⭐.",
        "Gym busy? Tap ⇄ Change exercise to swap for another exercise of the same body part, just for that day.",
        "Sprint, HIIT and conditioning workouts have a ⏱ Start interval timer button. It explains the session and how hard each effort should feel, then counts every round: red for work, green for easy, with a buzz at each switch. Save it at the end and your efforts go on your workout.",
        "Training at home? List your equipment under 🏠 My home equipment on your Profile (dumbbells, kettlebells, bench, bands, a photo of your multi station...). Your workouts then only use what you have. Add to it whenever you buy something new.",
        "When you finish, tap Complete workout. If you couldn't finish or couldn't train, say why. Your coach sees a green, orange or red dot.",
      ],
    },
    {
      key: "calendar",
      icon: "📅",
      title: "Your training calendar",
      where: "Exercises tab",
      points: [
        "When your coach plans workouts on days, open 📅 Your training calendar to see what's coming.",
        "Tap a day to see its exercises. You can change an exercise ahead of time if you know the gym will be busy.",
        "Green, orange and red dots show how each workout went, and a gold star shows where you improved.",
      ],
    },
    {
      key: "videos",
      icon: "🎥",
      title: "Video log",
      where: "Video log tab",
      points: [
        "Film a set (up to 60 seconds) so your coach can check your form. Type which exercise it is first.",
        "Your coach is told straight away. You'll see \"Coach watched ✓\" once they've seen it. Their feedback comes as a message and also shows under that video here.",
        "Videos clear themselves after 7 days, so send them while they're fresh.",
      ],
    },
    {
      key: "stability",
      icon: "🛡️",
      title: "Your stability program",
      where: "Menu ☰ → My stability program (once your coach gives you one)",
      points: [
        "Your coach can give you a 4-8 week program to strengthen and steady a joint: ankle, knee, hip, core, shoulder, wrist or neck. You'll get a message when they do.",
        "Do the short ⚡ version before a workout, or the full session on rest days or after training. It runs alongside your normal training.",
        "Log every set as seconds held or reps done before you lost control. Holds have a Start/Stop clock. One-sided exercises have a left and a right box.",
        "When you hit the target two sessions in a row, the app tells you it's time to make it harder. Your coach sees what you log.",
      ],
    },
    {
      key: "nutrition",
      icon: "🥗",
      title: "Nutrition",
      where: "Menu ☰ → Nutrition",
      points: [
        "Start with the hand portion guide: an easy way to eat well without counting.",
        "Work out your own meal plan: type your height, weight, age and activity, pick your goal, how many meals you eat, when you train and whether you eat meat, and the app builds your day around your BMR. Losing weight is low carb; otherwise the carbs sit around your training. A protein snack (biltong) is added to help you reach your protein. Don't like a food? Tap Swap and it keeps the same protein or carbs.",
        "If your coach builds you a diet, it shows here too.",
        "Read Understanding Carbs and Understanding Insulin to see why carbs are timed around training.",
        "The calorie calculator adds up any meal if you like to count.",
      ],
    },
    {
      key: "supplements",
      icon: "💊",
      title: "Supplementation",
      where: "Menu ☰ → Supplementation",
      points: [
        "What's worth taking for energy, muscle and recovery, and what to skip.",
        "Food comes first. Supplements fill the gaps.",
      ],
    },
    {
      key: "reset",
      icon: "🌸",
      title: "Health Reset and cycle tracker",
      where: "Menu ☰ → Women's Health Reset, and the Reset tab",
      points: [
        "Women: log your period and the app shows which phase you're in, with how to train, eat and supplement in each one. Your period log is private. Your coach can't see it.",
        "The Health Reset is a week-by-week plan. Tap Start, tick off each day and add a note on how you feel. Men have their own version.",
      ],
    },
    {
      key: "sleep",
      icon: "🌙",
      title: "Sleep and recovery",
      where: "Menu ☰ → Sleep & Recovery",
      points: [
        "Simple habits for deeper sleep and faster recovery.",
        "A wind-down tip shows each evening. You can switch it off on that page.",
      ],
    },
    {
      key: "profile",
      icon: "👤",
      title: "Profile and progress photos",
      where: "Profile tab",
      points: [
        "Add progress photos every 6 weeks. The app reminds you. Photos show change the scale can't.",
        "Set your flag so your coach knows how you're doing: All good, I'd like some feedback, or Urgent, I need guidance. The app also asks you this the first time you open it each day.",
        "Your coach's messages and payment details are here too.",
      ],
    },
    {
      key: "more",
      icon: "🔎",
      title: "Search and the suggestion box",
      where: "Search 🔍 and Menu ☰",
      points: [
        "Search finds any exercise, guide or tip in the app.",
        "The suggestion box sends ideas straight to the team. We read every one.",
      ],
    },
  ],
  bottomLine: "Check in every morning, tick your habits, log every workout, and be honest. That's how you get results.",
};

export const TRAINER_APP_GUIDE: AppGuide = {
  intro:
    "Everything you need to coach your clients well, in one place. Tap a heading to see what it does and how to get the most from it.",
  topics: [
    {
      key: "dashboard",
      icon: "📊",
      title: "Your dashboard",
      where: "Dashboard tab",
      points: [
        "Start every day here. It shows today's compliance: who checked in, who trained and who needs you.",
        "Problems show in red: pain, fatigue, stress or an urgent flag. Tap Busy fixing (orange) while you deal with it, then Fixed to clear it. The app checks in with the client the next morning on your behalf.",
        "🎥 New form videos and 🏆 habit wins show at the top. You get a phone notification for both.",
        "🏅 You get a phone notification when a client earns a gold achievement: 10% more weight for at least the same reps.",
        "Habit wins list each habit a client kept 5 of 7 days. Tap Write to send them a message in your own words.",
        "The recovery check warns you when a client is training the same muscles two days running, and lets you make the session lighter or move it.",
      ],
    },
    {
      key: "clients",
      icon: "👥",
      title: "Clients and payments",
      where: "Clients tab",
      points: [
        "New signups land here. Activate a client once they've paid. Only an expired plan locks the app.",
        "Dots show who needs attention. Tap a client to open everything about them.",
        "Share your trainer code (Profile tab) so new clients join you when they sign up.",
      ],
    },
    {
      key: "clientDetail",
      icon: "🗂",
      title: "Inside a client",
      where: "Clients tab → tap a client",
      points: [
        "Overview: their training level (Beginner, Intermediate or Advanced) at the top, then their problems with Reply, Busy fixing and Fixed, plus messages.",
        "Check-ins and Habits: their daily answers and streaks, plus the tips the app gave them this week. To add a habit, open a heading (Nutrition, Movement, Sleep & recovery, Mindset) and tap one, or type your own.",
        "Training: watch their 🎥 form videos (new ones are marked) and write your correction under the video while it plays; tap Watch again to replay it. Choose their program, put workouts on their calendar (if they're on the Health Reset, the app warns you and shows which week they're on), switch Gym/Home, and see their training log. For home clients, 🏠 Home equipment shows what they own, with photos; tap Edit on a multi station to load the exercises it can do. The app then picks home exercises their equipment covers, and you can still change any of them. Gold stars show where they improved.",
        "Tap any exercise in their program or calendar to swap it or change the sets and reps, for this client only.",
        "Abs between sets: switch it off on their Training tab if a client shouldn't do ab reps between sets.",
        "🌱 New clients tell you their training experience. For Never trained, Beginner and Intermediate you're asked to approve a 6-week foundation program on their Training tab; approving starts it and sends them a note explaining why.",
        "🛡️ Stability programs (Training tab): give a client a 4-8 week program for their ankle, knee, hip, core, shoulder, wrist or neck at Rehab, Beginner, Intermediate or Advanced level. They get a message and it appears in their menu. You see the week they're on, their logged holds and reps, and where they're ready to progress or struggling; move them up, repeat or stop it from there. Read every program first from your ☰ menu → Stability & injury prevention.",
        "Diet: build their week of meals against their BMR, and see the meal plan they made themselves.",
        "Photos and Notes: progress photos, and private notes only you can see.",
      ],
    },
    {
      key: "programs",
      icon: "🏋️",
      title: "Programs and workouts",
      where: "Programs tab",
      points: [
        "Use the ready-made programs (full body, upper/lower, supersets, goal blocks, HIIT, sprint and threshold intervals, 8-week fight sport conditioning, and 15 Sports Performance programs for power, speed, strength, mobility and flexibility) or tap + Build a program to make your own.",
        "🏅 Menu ☰ → Sports Performance explains each of the 15 programs and who it suits.",
        "Open any program and tap an exercise, or ▶ beside it, to watch its demo video and read how to do it.",
        "🌱 Beginner & Intermediate: 6-week foundation programs for Bodybuilding, Weight loss, Strength and Fitness, building joint stability, core strength and tendons before real training.",
        "The upper body, lower body, full body, Chest & Bi and Back & Tri workouts have 20 ab reps between sets. When you save your own program, the app asks if you want abs between sets and lets you pick the reps and the exercise.",
        "Each exercise has a video and a How to do it guide, so clients know what it works and how to do it well.",
        "Clients can change an exercise when the gym is busy, always for the same body part.",
      ],
    },
    {
      key: "results",
      icon: "⭐",
      title: "Reading their workouts",
      where: "Client → Training",
      points: [
        "Green: they finished. Orange: partly done, with their reason. Red: they couldn't train, with their reason.",
        "A gold star means they beat their last session. Tap the day to see exactly where.",
        "Warm-up sets are labelled, so you only judge the working sets.",
      ],
    },
    {
      key: "guides",
      icon: "📚",
      title: "Coaching guides",
      where: "Menu ☰",
      points: [
        "Client retention, nutrition for coaches, training each body part, and recovery, written for trainers.",
        "Clients have their own guides on nutrition, supplements, sleep and the Health Reset, so you can point them there.",
      ],
    },
    {
      key: "profile",
      icon: "👤",
      title: "Your profile, logo and billing",
      where: "Profile tab",
      points: [
        "Add your logo. Your clients see it in their app.",
        "Your trainer code for new clients, your referral code for other trainers, your EFT details and your plan all live here.",
      ],
    },
  ],
  bottomLine: "Check the dashboard daily, clear the red, reply fast, and celebrate the gold stars with your clients.",
};
