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
        "Do it every morning. It takes a minute over three short pages: How you feel, Sleep, then Food & drink. Tap Next to move on, or tap a page name at the top to jump to it.",
        "Be honest. A bad day logged truthfully helps your coach far more than a perfect day that didn't happen.",
        "The body and mind check asks about pain, tiredness and stress. If you report a problem, your coach is told straight away and the app checks in with you the next morning.",
        "After you check in, 📈 Your tips for this week reads your last 7 days and shows up to 3 things to work on, what to do and what it will do for you. It also gives you a message on alcohol: encouragement for every alcohol-free day, and water and electrolyte advice after a drinking session.",
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
        "Tap ⚙ Days and reminder on a habit to pick its days, set a reminder time or stop it.",
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
        "🎯 Gauge set: the first time you do an exercise, pick a weight you think you can lift for the reps shown and do as many good reps as you can, until you can't do one more. The app then works out the right weight for your other sets, and keeps suggesting weights as it learns your strength.",
        "In your first 6 weeks (your intro program), don't go to failure. Stop each set when you could still do 1 or 2 more good reps. The gauge set is the only exception.",
        "🏅 Lift 10% more on an exercise for at least the same reps and you earn a gold achievement badge. Your coach is told too.",
        "On workouts with abs between sets, the app shows an ab exercise after each set. Do the reps, then tap Complete and your rest timer starts.",
        "📈 Try this weight next tells you when you're ready to go heavier. Beat last time and you earn a gold star ⭐.",
        "Gym busy? Tap ⇄ Change exercise to swap for another exercise of the same body part, just for that day.",
        "Sprint, HIIT and conditioning workouts have a ⏱ Start interval timer button. It explains the session and how hard each effort should feel, then counts every round: red for work, green for easy, with a buzz at each switch. Save it at the end and your efforts go on your workout.",
        "Drop set programs (intermediate and advanced): put in your start weight and reps, and the round clock starts. It pauses while you type the next weight and runs again when you tap Log. Tap Finish round to save your time and start the 6-minute recovery. Next time, try to beat it.",
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
        "🔁 Missed a workout in the week? On Saturday or Sunday the app opens on it so you can catch it up, and you get a reminder at 6am. If you missed more than one, it starts with the one that works different muscles from yesterday. Tapping an empty day on your calendar also takes you to it, or tap the missed day and choose Do it today.",
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
        "🛒 A week before your period is due, the app reminds you to check you have your supplements ready (magnesium, omega-3, vitamin B6 and calcium), on your phone and on your Check-in.",
        "Until you log your first period, a Saturday reminder points you to the cycle tracker. It stops once you've logged one.",
        "The Health Reset is a week-by-week plan. Tap Start, tick off each day and add a note on how you feel. Men have their own version.",
      ],
    },
    {
      key: "recovery",
      icon: "🌿",
      title: "Recovery",
      where: "Menu ☰ → Recovery",
      points: [
        "Pick a ready-made program: Training Recovery (gym and muscle), Sports Recovery (runners, cyclists, team sports) or Lifestyle Recovery (health and consistency). Your coach can pick it for you.",
        "Eight activities: Sleep, Hydration & nutrition, Active recovery, Breathing & relaxation, Mobility & stretching, Massage & foam rolling, Cold shower / ice bath and Sauna / heat. Tap one for what it does, how long, the benefits and safety.",
        "Log it for today (how long, and a note on soreness, energy or how you feel) or plan it for a day. Planned ones show on your calendar in bright green; tap ✓ Done or Skip in your Daily Log.",
        "🌿 Recovery suggested for you: the app looks at your training (days in a row, how hard you pushed, big leg days) and check-ins (pain, tiredness, poor sleep, stress) and suggests what would help most, on Recovery and your Check-in. Your coach sees what you plan, do and skip.",
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
        "Each part of your Profile is a heading you tap to open: How are you doing?, Messages from your coach, Progress photos, Goals and injuries, Paying your trainer and Account (log out).",
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
        "Needs you, at the top, lists everything waiting on you in one card: new clients to activate, new form videos, foundation programs to approve, the recovery check and new suggestions. Tap a line to open it.",
        "🏆 Habit wins show under it. You get a phone notification for new form videos and habit wins.",
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
        "Four tabs sort your clients: Active (training now), Waiting approval (new signups and returning clients), Awaiting payment (plan ended in the last 30 days) and Dormant (archived, or plan ended over 30 days ago).",
        "Activate a client once they've paid. Only an expired plan locks the app.",
        "Dots show who needs attention. Tap a client to open everything about them.",
        "Share your trainer code (Profile tab) so new clients join you when they sign up.",
        "🗄 Old clients: open a client and tap Archive this client at the bottom of their Overview. They leave your lists and their access closes, but nothing is deleted. If they start again, open the Dormant tab on the Clients tab and tap Bring back. They fill in the intake form again, and a Then vs now card on their Overview compares their first time with you against now.",
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
        "📅 Setting up a program (top of the Training tab): tap the day the client starts, pick Gym, Performance, Functional or Rehab, pick the program, then the days they train (Tue · Thu, Mon · Wed · Fri, Mon · Tue · Thu · Fri, Mon to Fri or Mon to Sat; Sunday is always rest) and how many weeks, and tap Activate program. The calendar fills itself in order. Tap any day after to change that one workout. Recovery, where they train, the training log and more options are under the tap-to-open headings below the calendar.",
        "📅 Training calendar: you don't have to give a whole program either. Tap a day and pick any workout, or open a weekly program and pick one of its days, so you can mix and match, like a gym day on Monday, mobility on Tuesday, gym again on Wednesday and flexibility on Thursday. Tap ＋ Add a block to put an extra block (mobility, flexibility or a fight session) on the same day, to suit the client and their energy. Take it off removes a block.",
        "Tap any exercise in their program or calendar to swap it or change the sets and reps, for this client only.",
        "🎯 Gauge test: the first time a client does an exercise, their first set is a gauge set to failure at a weight they pick. The app works out their working weight from it, and their training log marks it 🎯 Gauge set. Full explanation in ☰ → Training each body part → Gauge test, so you can explain it to them.",
        "🌿 Recovery (Training tab): pick their recovery program (Training, Sports or Lifestyle), and see what they did in the last 2 weeks with how long and their notes, what's planned, what they skipped, and what the app is suggesting to them today and why. Their recovery also shows on their calendar in bright green.",
        "Abs between sets: switch it off on their Training tab if a client shouldn't do ab reps between sets.",
        "🌱 New clients tell you their training experience. For Never trained, Beginner and Intermediate you're asked to approve a 6-week foundation program on their Training tab; approving starts it and sends them a note explaining why.",
        "🛡️ Stability programs (Training tab): give a client a 4-8 week program for their ankle, knee, hip, core, shoulder, wrist or neck at Rehab, Beginner, Intermediate or Advanced level. They get a message and it appears in their menu. You see the week they're on, their logged holds and reps, and where they're ready to progress or struggling; move them up, repeat or stop it from there. Read every program first from your ☰ menu → Stability & Rehab programming, where you can tap any exercise for its video (or examples online) and how-to, handy for 1-on-1 sessions too. When a client reports pain or an injury (check-in or intake), a 🛡️ Recovery, mobility and rehab box on their profile opens the matching rehab programs.",
        "Diet: build their week of meals against their BMR, and see the meal plan they made themselves.",
        "Photos and Notes: progress photos, and private notes only you can see. On Notes, open a Body and mind section (pain, fatigue, mental exhaustion) and tap 💬 Send a check-in note to message the client about it; they see it at the top of their Check-in and can reply.",
      ],
    },
    {
      key: "programs",
      icon: "🏋️",
      title: "Programs and workouts",
      where: "Programs tab",
      points: [
        "Programs sit in three groups. Tap one to open it, then tap a heading inside to see its programs.",
        "🏋️ Gym (🏠 Home on the Home tab): beginner & intermediate foundations, 12-week goal programs, full body, upper and lower body, Chest & Bi, Back & Tri, Legs, drop sets (3 per body part, for intermediate and advanced lifters: 2 rounds for intermediate, 3 for advanced), and your own programs.",
        "Drop set round times show under the client's training log, with how many drops and reps they did, so you can see their output.",
        "⚡ Performance: explosive power, speed and sports strength programs, HIIT, sprint and threshold intervals, and 8-week fight sport conditioning. 🏅 A link inside (and Menu ☰ → Sports Performance) explains who each one suits.",
        "🧘 Functional: mobility and flexibility programs, plus a link to the 🛡️ stability & injury prevention programs, which run alongside a client's main program.",
        "The same three groups show when you choose a client's program or put a workout on their calendar. Tap + Build a program to make your own.",
        "Open any program and tap ▶ Check all exercises to see every exercise, week by week, before you give it to a client. Tap an exercise, or ▶ beside it, to watch its demo video and read how to do it.",
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
        "Your plan's prices depend on the country you applied from: rand in South Africa, dollars elsewhere. That's why location must be on when you apply.",
        "🎁 On free use? You pay no monthly subscription. Six months in, a per-client fee starts for each active client. Your plan card shows the date, and the app reminds you 30 days and 7 days before.",
        "🤝 Referrals: share your referral code with other trainers. Each one approved gives you 25% off a month, and 4 make a free month. A pop-up shows how many you've earned and banked once a week, and Profile > Plan & refer shows them any time. Banked referrals come off your plan payment, or off your client fees if you're on free use.",
        "💵 Profile > Income: set what your clients pay you a month, either a price table (Fully Online, or 1-on-1 clients using the app for 1, 2, 3 or 4 extra days a week) or one monthly fee for everyone. Then open each client and tap their package under What they pay you. Income adds up what your active clients bring in each month. Clients don't see your prices.",
        "📊 App owner only: Profile > Tracker shows every trainer's active clients, what clients pay their trainers, the monthly client fees and trainer subs, split South Africa (rand) and International (dollars). Tap Each trainer for one line per trainer.",
      ],
    },
  ],
  bottomLine: "Check the dashboard daily, clear the red, reply fast, and celebrate the gold stars with your clients.",
};
