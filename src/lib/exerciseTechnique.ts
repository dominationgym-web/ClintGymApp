// Simple "how to do it" guides for clients, opened from the ? next to each
// exercise. One guide per movement pattern (all curls share the curl guide,
// all rows the row guide, and so on), matched by the exercise's name, then its
// body part. Written for clients, in plain words: how to move, how to get the
// most from it, and how to make it fit their body.

export type ExerciseTechnique = {
  // Short name of the movement pattern, e.g. "Bench press".
  pattern: string;
  // Where they should feel it working.
  feel: string;
  // How to do one rep, in order.
  steps: string[];
  // How to get the most from it.
  tips: string[];
  // How to make it fit their limits (sore joints, less mobility, beginners).
  adapt: string[];
};

type Rule = { match: RegExp; technique: ExerciseTechnique };

// GRIZZ's rule for every set, in his words. Shown when logging a set and at
// the top of every guide.
export const MUSCLE_NOT_WEIGHT =
  "If you need to swing, jerk or bounce, the weight is too heavy. We're training to build muscle, not move weight. Focus on the muscle, not the weight.";

// How to get the most from every rep: range of motion and muscle tension.
// Shown, tap to open, when logging a set.
export const EVERY_REP_TIPS: string[] = [
  "Full range of motion: lower until you feel a good stretch in the working muscle, then come all the way back up. Half reps build half the muscle.",
  "Control the way down: take 2 to 3 seconds to lower. That's where a lot of the muscle-building happens.",
  "Pause in the stretch for a moment at the bottom instead of bouncing out of it.",
  "Keep the tension on the muscle: don't rest at the top or lock out and relax between reps.",
  "Squeeze the muscle hard at the top of each rep, and think about the muscle doing the work, not your hands moving the weight.",
  "Breathe out as you lift and in as you lower. Brace your stomach on squats, lunges and deadlifts.",
  "Finish each set 1 to 3 reps short of failure with good form. If the form breaks, the set is over.",
];

// Shown under every guide.
export const SAFETY_NOTE =
  "A burn in the muscle is good. Sharp or pinching pain in a joint is not: stop, and tell your coach.";

const BENCH_PRESS: ExerciseTechnique = {
  pattern: "Chest press",
  feel: "Chest, front of the shoulders and triceps.",
  steps: [
    "Lie back with your feet flat and your shoulder blades squeezed together and down.",
    "Hold the weight over your chest with your wrists straight over your elbows.",
    "Lower it slowly to your mid or lower chest, elbows at about 45 degrees from your body, not flared out wide.",
    "Press back up, pushing yourself into the bench.",
  ],
  tips: [
    "Take 2 to 3 seconds to lower and feel your chest stretch at the bottom.",
    "Keep your shoulder blades pinned back the whole set so your chest does the work, not your shoulders.",
  ],
  adapt: [
    "Shoulders sore? Use dumbbells or a machine, tuck your elbows in more, and stop a little higher.",
    "New to it? A machine press is the safest place to start.",
  ],
};

const FLOOR_PRESS: ExerciseTechnique = {
  pattern: "Floor press",
  feel: "Chest and triceps.",
  steps: [
    "Lie on the floor with your knees bent and feet flat.",
    "Hold the weight over your chest, shoulder blades squeezed together.",
    "Lower until your upper arms touch the floor lightly, elbows at about 45 degrees.",
    "Pause for a second, then press straight back up.",
  ],
  tips: [
    "Don't bounce your arms off the floor. Pause, then press.",
    "Squeeze your chest hard at the top.",
  ],
  adapt: [
    "The floor stops you going too deep, so this is kind to sore shoulders.",
    "Use one dumbbell in each hand if a bar feels awkward.",
  ],
};

const PUSH_UP: ExerciseTechnique = {
  pattern: "Push-up",
  feel: "Chest, shoulders, triceps and core.",
  steps: [
    "Hands a little wider than your shoulders, body in one straight line from head to heels.",
    "Brace your stomach and squeeze your bum.",
    "Lower your chest towards the floor, elbows at about 45 degrees from your body.",
    "Push the floor away until your arms are straight.",
  ],
  tips: [
    "Go slow on the way down and touch your chest close to the floor.",
    "Keep your hips in line. Don't let them sag or stick up.",
  ],
  adapt: [
    "Too hard? Put your hands on a bench or wall, or do them from your knees.",
    "Wrists sore? Hold dumbbell handles or make fists so your wrists stay straight.",
  ],
};

const DIAMOND_PUSH_UP: ExerciseTechnique = {
  pattern: "Close-hands push-up",
  feel: "Triceps, and inner chest.",
  steps: [
    "Hands close together under your chest, thumbs and fingers making a diamond.",
    "Body in one straight line, stomach tight.",
    "Lower your chest to your hands, keeping your elbows close to your sides.",
    "Push back up until your arms are straight.",
  ],
  tips: ["Keep your elbows pointing back, not out, to load the triceps.", "Squeeze the back of your arms at the top."],
  adapt: [
    "Wrists or elbows sore? Move your hands a little wider apart.",
    "Too hard? Do them from your knees or with your hands on a bench.",
  ],
};

const CHEST_FLY: ExerciseTechnique = {
  pattern: "Chest fly",
  feel: "Chest, especially when it's stretched.",
  steps: [
    "Start with your arms out in front of your chest, elbows slightly bent.",
    "Keep that bend fixed and open your arms out wide in a big arc.",
    "Go until you feel a good stretch across your chest.",
    "Hug the weight back together, like wrapping your arms round a big tree.",
  ],
  tips: [
    "Think of moving your upper arms, not your hands. The elbow bend never changes.",
    "Control the stretch on the way out. That's where most of the growth comes from.",
  ],
  adapt: [
    "Shoulders sore? Don't go as wide, and use a machine or cables.",
    "Use lighter weight than you think. This is a feel exercise, not a heavy one.",
  ],
};

const DIP: ExerciseTechnique = {
  pattern: "Dip",
  feel: "Chest (leaning forward) or triceps (staying upright).",
  steps: [
    "Support yourself on straight arms, shoulders pushed down away from your ears.",
    "Lean slightly forward for chest, or stay upright for triceps.",
    "Lower until your upper arms are about level with the floor.",
    "Push back up to straight arms.",
  ],
  tips: ["Go slow on the way down.", "Keep your shoulders down and back, never shrugged up."],
  adapt: [
    "Shoulders sore? Only go down halfway, or swap to a machine dip or close-grip press.",
    "Too hard? Use the assisted dip machine or a band.",
  ],
};

const BENCH_DIP: ExerciseTechnique = {
  pattern: "Bench dip",
  feel: "Triceps.",
  steps: [
    "Hands on the edge of a bench behind you, fingers pointing forward.",
    "Legs out in front, bum just off the bench.",
    "Bend your elbows straight back and lower your bum a short way.",
    "Push back up to straight arms.",
  ],
  tips: ["Keep your bum close to the bench.", "Squeeze your triceps hard at the top."],
  adapt: [
    "This one can be hard on the front of the shoulder. Only go as low as feels comfortable.",
    "Bend your knees to make it easier, or skip it if your shoulders complain.",
  ],
};

const CLOSE_GRIP_PRESS: ExerciseTechnique = {
  pattern: "Close-grip press",
  feel: "Triceps, and some chest.",
  steps: [
    "Lie on the bench and hold the bar with your hands about shoulder width apart.",
    "Lower the bar to your lower chest, keeping your elbows close to your sides.",
    "Press back up until your arms are straight.",
  ],
  tips: ["Elbows in, not flared, to load the triceps.", "Lower slowly with control."],
  adapt: [
    "Wrists sore? Don't bring your hands too close. Shoulder width is enough.",
    "Use a machine or dumbbells with palms facing each other if the bar hurts.",
  ],
};

const OVERHEAD_PRESS: ExerciseTechnique = {
  pattern: "Overhead press (optional)",
  feel: "Shoulders and triceps.",
  steps: [
    "Stand or sit tall, weight at shoulder height, stomach and bum tight.",
    "Press straight up, moving your head slightly back so the weight passes your face.",
    "Finish with the weight over your head, arms straight.",
    "Lower back to your shoulders with control.",
  ],
  tips: ["Don't lean back. Keep your ribs down and stomach braced.", "Lower slowly to shoulder height."],
  adapt: [
    "Overhead pressing is optional. If your shoulders pinch, ask your coach to swap it for a landmine press or lateral raise.",
    "Seated with back support is easier on your lower back.",
  ],
};

const PUSH_PRESS: ExerciseTechnique = {
  pattern: "Push press",
  feel: "Shoulders, triceps and legs.",
  steps: [
    "Weight at your shoulders, feet hip width apart.",
    "Dip by bending your knees slightly, keeping your chest up.",
    "Drive up hard with your legs and use that push to press the weight overhead.",
    "Lower back to your shoulders with control.",
  ],
  tips: ["The dip is short and fast, not a squat.", "Lock your arms out at the top with your stomach tight."],
  adapt: [
    "Optional: if overhead work bothers your shoulders, ask your coach for a swap.",
    "Learn it light first. Speed matters more than weight here.",
  ],
};

const LANDMINE_PRESS: ExerciseTechnique = {
  pattern: "Landmine press",
  feel: "Front of the shoulders, upper chest and triceps.",
  steps: [
    "Hold the end of the bar at your shoulder, standing or half kneeling.",
    "Brace your stomach.",
    "Press up and forward along the bar's natural angle until your arm is straight.",
    "Lower back to your shoulder slowly.",
  ],
  tips: ["Let your shoulder blade move forward a little at the top.", "Keep your body still. Only the arm moves."],
  adapt: ["The angle is kind to shoulders, so it's a good swap for overhead pressing.", "Kneel if standing feels unsteady."],
};

const THRUSTER: ExerciseTechnique = {
  pattern: "Squat to press",
  feel: "Legs, shoulders and lungs.",
  steps: [
    "Weight at your shoulders, feet shoulder width apart.",
    "Squat down with your chest up.",
    "Drive up hard and use that speed to press the weight overhead in one smooth movement.",
    "Bring it back to your shoulders as you go into the next squat.",
  ],
  tips: ["Use your legs to do most of the work.", "Breathe out as you press up."],
  adapt: ["Squat only as deep as is comfortable.", "Shoulders sore? Do just the squat part holding the weight at your chest."],
};

const OVERHEAD_SQUAT: ExerciseTechnique = {
  pattern: "Overhead squat",
  feel: "Legs, shoulders, upper back and core.",
  steps: [
    "Hold the weight straight up over your head, arm locked.",
    "Feet about shoulder width, stomach tight.",
    "Squat down slowly, keeping the weight over the middle of your foot.",
    "Stand back up without letting the arm bend.",
  ],
  tips: ["Push up into the weight the whole time.", "Go slow. Control matters more than depth."],
  adapt: [
    "Needs a lot of shoulder and hip mobility. Practise with a broomstick first.",
    "Shoulders pinch? Ask your coach for a goblet squat instead.",
  ],
};

const OLYMPIC_LIFT: ExerciseTechnique = {
  pattern: "Olympic lift",
  feel: "Whole body, especially legs, hips and upper back.",
  steps: [
    "Start with the bar close to your legs, back flat, arms long.",
    "Push through your legs and stand up fast, keeping the bar close to your body.",
    "As your hips open, shrug and pull yourself under the bar.",
    "Catch it with soft knees, then stand up tall.",
  ],
  tips: ["Think jump, not arm pull. The power comes from your hips.", "Keep the bar close the whole way."],
  adapt: [
    "These are technical. Learn them with your coach and an empty bar first.",
    "Back or wrists sore? Ask your coach for a kettlebell swing or jump instead.",
  ],
};

const KETTLEBELL_SWING: ExerciseTechnique = {
  pattern: "Kettlebell swing",
  feel: "Bum, hamstrings and core.",
  steps: [
    "Feet a bit wider than your hips, kettlebell on the floor in front of you.",
    "Hinge at your hips, grab it and hike it back between your legs.",
    "Snap your hips forward and stand tall. The bell rises to about chest height.",
    "Let it swing back down and hinge again.",
  ],
  tips: ["It's a hip snap, not a squat and not an arm lift.", "Squeeze your bum hard at the top."],
  adapt: ["Keep your back flat. If it rounds, use a lighter bell.", "Lower back sore? Try a glute bridge or hip thrust instead."],
};

const TURKISH_GET_UP: ExerciseTechnique = {
  pattern: "Turkish get-up",
  feel: "Shoulders, core and hips.",
  steps: [
    "Lie down holding the weight straight up over your shoulder, same-side knee bent.",
    "Roll onto your other elbow, then hand, keeping your eyes on the weight.",
    "Lift your hips, sweep your leg under to a kneel, then stand up.",
    "Reverse each step slowly back down.",
  ],
  tips: ["Keep the arm with the weight straight and locked the whole time.", "Move slowly. Each step is a position."],
  adapt: ["Practise with no weight or a shoe balanced on your fist first.", "Stop at the half-way sitting position if standing is too much."],
};

const MAN_MAKER: ExerciseTechnique = {
  pattern: "Man maker",
  feel: "Whole body.",
  steps: [
    "Hold dumbbells on the floor and step or jump back into a push-up position.",
    "Do a push-up, then a row with each arm.",
    "Jump your feet in, stand up and press the dumbbells overhead.",
  ],
  tips: ["Keep your hips steady during the rows.", "Pace yourself. It's a lot of work in one rep."],
  adapt: ["Step back instead of jumping.", "Skip the press if overhead work bothers your shoulders."],
};

const WALL_BALL: ExerciseTechnique = {
  pattern: "Wall ball",
  feel: "Legs, shoulders and lungs.",
  steps: [
    "Hold the ball at your chest, standing an arm's length from the wall.",
    "Squat down with your chest up.",
    "Drive up and throw the ball to the target on the wall.",
    "Catch it and go straight into the next squat.",
  ],
  tips: ["Use your legs to throw, not just your arms.", "Find a steady rhythm."],
  adapt: ["Use a lighter ball or a lower target.", "Squat only as deep as is comfortable."],
};

const PULL_UP: ExerciseTechnique = {
  pattern: "Pull-up",
  feel: "Lats (the wide muscles of your back) and biceps.",
  steps: [
    "Hang from the bar with straight arms.",
    "Pull your shoulders down away from your ears first.",
    "Pull your elbows down towards your ribs until your chin is over the bar.",
    "Lower slowly all the way to straight arms.",
  ],
  tips: ["Think elbows to your back pockets.", "Take 2 to 3 seconds to lower. Don't drop."],
  adapt: ["Too hard? Use the assisted machine, a band, or a lat pulldown.", "Palms facing each other is easiest on the elbows and shoulders."],
};

const PULLDOWN: ExerciseTechnique = {
  pattern: "Lat pulldown",
  feel: "Lats (the wide muscles of your back) and biceps.",
  steps: [
    "Sit with your thighs under the pad and arms straight up holding the bar.",
    "Lean back slightly and push your chest up.",
    "Pull the bar down to your upper chest, driving your elbows down and back.",
    "Let it rise slowly until your arms are straight and you feel a stretch.",
  ],
  tips: ["Pull with your elbows, not your hands.", "Get the full stretch at the top of every rep."],
  adapt: ["Shoulders sore? Use a neutral (palms facing) grip and don't pull behind your neck.", "Don't swing. Lower the weight if you have to lean far back."],
};

const PULLOVER: ExerciseTechnique = {
  pattern: "Pullover",
  feel: "Lats, and a stretch through your back and chest.",
  steps: [
    "Arms nearly straight, holding the weight or handle out in front or above you.",
    "Keep your arms long and sweep the weight down towards your thighs (or up behind your head when lying).",
    "Feel your lats work, then return slowly.",
  ],
  tips: ["Keep your elbows only slightly bent and fixed.", "Squeeze your lats at your thighs and control the stretch."],
  adapt: ["Shoulders sore? Shorten the stretch.", "Go light. This is a feel exercise."],
};

const BENT_OVER_ROW: ExerciseTechnique = {
  pattern: "Bent-over row",
  feel: "Upper and middle back, lats and biceps.",
  steps: [
    "Hold the weight, knees soft, and hinge forward from your hips with a flat back.",
    "Let the weight hang below your shoulders.",
    "Row it towards your belly button, squeezing your shoulder blades together.",
    "Lower slowly until your arms are straight.",
  ],
  tips: ["Keep your back flat and still. Don't jerk the weight up.", "Pause and squeeze at the top."],
  adapt: ["Lower back sore? Use a chest-supported row or a cable row instead.", "Don't bend over as far if your hamstrings are tight."],
};

const ROW: ExerciseTechnique = {
  pattern: "Row",
  feel: "Middle back, lats and biceps.",
  steps: [
    "Sit or brace yourself so your back stays still, arms straight out holding the handle.",
    "Pull your shoulder blades back first.",
    "Row your elbows back past your body, keeping them fairly close to your sides.",
    "Let the weight forward slowly until you feel your back stretch.",
  ],
  tips: ["Pull with your elbows and squeeze your shoulder blades together at the end.", "Control the stretch on the way back."],
  adapt: ["Lower back sore? A chest-supported or machine row takes the strain off.", "Elbows sore? Try a neutral (palms facing) grip."],
};

const SINGLE_ARM_ROW: ExerciseTechnique = {
  pattern: "Single-arm row",
  feel: "Lats, middle back and biceps.",
  steps: [
    "Support yourself with one hand and knee on a bench (or a staggered stance), back flat.",
    "Let the weight hang straight down.",
    "Row it towards your hip, keeping your elbow close to your side.",
    "Lower slowly until your arm is straight and you feel a stretch.",
  ],
  tips: ["Pull towards your hip, not your chest, to hit your lats.", "Keep your shoulders square. Don't twist to lift it."],
  adapt: ["Supporting yourself on a bench keeps your lower back safe.", "Use a lighter weight and pause at the top if you can't control it."],
};

const INVERTED_ROW: ExerciseTechnique = {
  pattern: "Inverted row",
  feel: "Upper back and biceps.",
  steps: [
    "Lie under a bar or rings and hold on, body straight from head to heels.",
    "Pull your chest up to the bar, squeezing your shoulder blades together.",
    "Lower slowly to straight arms.",
  ],
  tips: ["Keep your hips up in line.", "Pause at the top."],
  adapt: ["Bend your knees or raise the bar to make it easier.", "Put your feet on a bench to make it harder."],
};

const FACE_PULL: ExerciseTechnique = {
  pattern: "Face pull",
  feel: "Back of the shoulders and upper back.",
  steps: [
    "Set the rope at face height and hold it with your thumbs pointing back.",
    "Pull towards your face, splitting the rope apart.",
    "Finish with your elbows high and hands beside your ears.",
    "Return slowly.",
  ],
  tips: ["Think pull apart and rotate back, like showing your biceps.", "Use light weight and pause at the end."],
  adapt: ["Great for posture and healthy shoulders, so it suits almost everyone.", "Use a band at home."],
};

const REAR_DELT_FLY: ExerciseTechnique = {
  pattern: "Rear shoulder fly",
  feel: "Back of the shoulders.",
  steps: [
    "Bend forward (or face the pec deck) with your arms out in front, elbows slightly bent.",
    "Sweep your arms out to the sides in a wide arc.",
    "Stop when your arms are in line with your body.",
    "Lower slowly.",
  ],
  tips: ["Lead with your elbows and keep your shoulders down.", "Light weight, no swinging."],
  adapt: ["Lie chest-down on an incline bench to protect your lower back.", "Use bands at home."],
};

const LATERAL_RAISE: ExerciseTechnique = {
  pattern: "Lateral raise",
  feel: "Side of the shoulders.",
  steps: [
    "Stand tall with the weights at your sides, elbows slightly bent.",
    "Lift your arms out to the sides, leading with your elbows.",
    "Stop at about shoulder height.",
    "Lower slowly.",
  ],
  tips: ["Think of pushing your hands out wide, not up.", "Light weight and slow. Don't shrug."],
  adapt: ["Shoulders sore? Only lift to where it's comfortable, and bring your arms slightly forward.", "Cables or a machine keep the tension on and are easier to control."],
};

const FRONT_RAISE: ExerciseTechnique = {
  pattern: "Front raise",
  feel: "Front of the shoulders.",
  steps: [
    "Stand tall holding the weight in front of your thighs.",
    "Lift it in front of you with nearly straight arms.",
    "Stop at about shoulder height.",
    "Lower slowly.",
  ],
  tips: ["Don't swing or lean back.", "Pause at the top."],
  adapt: ["Front shoulders already work hard in presses, so keep this light.", "Shoulders sore? Lift only to chest height."],
};

const EXTERNAL_ROTATION: ExerciseTechnique = {
  pattern: "External rotation",
  feel: "Small muscles at the back of the shoulder (rotator cuff).",
  steps: [
    "Elbow bent at 90 degrees and tucked into your side.",
    "Rotate your forearm out away from your stomach, keeping your elbow in place.",
    "Return slowly.",
  ],
  tips: ["A towel under your arm helps keep your elbow tucked.", "Very light weight. This is about control."],
  adapt: ["Good for keeping shoulders healthy. Do it slowly and pain-free.", "Use a band at home."],
};

const UPRIGHT_ROW: ExerciseTechnique = {
  pattern: "Upright row",
  feel: "Side of the shoulders and traps.",
  steps: [
    "Hold the weight in front of your thighs, hands about shoulder width apart.",
    "Lift it up close to your body, leading with your elbows.",
    "Stop when your elbows are at about shoulder height.",
    "Lower slowly.",
  ],
  tips: ["A wider grip is kinder to your shoulders.", "Keep the weight close to your body."],
  adapt: ["If it pinches your shoulders, stop lower or ask your coach for a lateral raise instead.", "Dumbbells let your arms move more naturally."],
};

const SHRUG: ExerciseTechnique = {
  pattern: "Shrug",
  feel: "Traps (top of your shoulders and neck).",
  steps: [
    "Stand tall holding the weights at your sides or in front.",
    "Lift your shoulders straight up towards your ears.",
    "Pause and squeeze.",
    "Lower slowly to a full stretch.",
  ],
  tips: ["Straight up and down. Don't roll your shoulders.", "Hold the top for a second."],
  adapt: ["Neck sore? Use a lighter weight and keep your chin tucked.", "Straps help if your grip gives out first."],
};

const FARMERS_CARRY: ExerciseTechnique = {
  pattern: "Loaded carry",
  feel: "Grip, forearms, traps and core.",
  steps: [
    "Pick up a heavy weight in each hand.",
    "Stand tall, shoulders down and back, stomach tight.",
    "Walk with short, steady steps.",
  ],
  tips: ["Don't lean to one side.", "Squeeze the handles hard."],
  adapt: ["Back sore? Use lighter weights and walk a shorter distance.", "One hand at a time also trains your core."],
};

const FOREARM: ExerciseTechnique = {
  pattern: "Forearm and grip",
  feel: "Forearms and grip.",
  steps: [
    "Rest your forearms on your thighs or a bench, wrists over the edge.",
    "Move only at the wrist (or roll, or pinch, depending on the exercise).",
    "Go through the full range slowly.",
  ],
  tips: ["Small movement, full range.", "Higher reps work well for forearms."],
  adapt: ["Wrists sore? Use lighter weight and a shorter range.", "Stop if you feel tingling in your hands."],
};

const CURL: ExerciseTechnique = {
  pattern: "Biceps curl",
  feel: "Biceps (front of the upper arm).",
  steps: [
    "Stand or sit tall, arms straight, palms facing forward.",
    "Keep your elbows by your sides.",
    "Curl the weight up by bending your elbows.",
    "Lower slowly all the way to straight arms.",
  ],
  tips: ["Don't swing your body or move your elbows forward.", "The slow lowering and full stretch at the bottom count most."],
  adapt: ["Elbows or wrists sore? An EZ bar, dumbbells or a cable feel kinder than a straight bar.", "Sit with your back supported to stop swinging."],
};

const STRETCH_CURL: ExerciseTechnique = {
  pattern: "Stretched biceps curl",
  feel: "Biceps, especially the long head (the outer part that gives the peak).",
  steps: [
    "Set up so your arm hangs behind your body (on an incline bench or facing away from a cable).",
    "Start with your arm straight and feel the stretch.",
    "Curl up without moving your elbow forward.",
    "Lower slowly back to the full stretch.",
  ],
  tips: ["The stretched position is the point of this exercise. Don't cut it short.", "Use lighter weight than a normal curl."],
  adapt: ["Front of the shoulder sore? Use a less steep incline.", "Shorten the stretch if your elbow complains."],
};

const PREACHER_CURL: ExerciseTechnique = {
  pattern: "Supported curl",
  feel: "Biceps, especially the short head (inner part).",
  steps: [
    "Rest the back of your upper arm on the pad or your inner thigh.",
    "Start with your arm nearly straight.",
    "Curl the weight up and squeeze.",
    "Lower slowly, stopping just short of locking your elbow.",
  ],
  tips: ["The pad stops cheating, so go strict and slow.", "Squeeze hard at the top."],
  adapt: ["Elbows sore? Don't drop fully straight at the bottom, and go lighter.", "A machine is easier to control than free weights."],
};

const HAMMER_CURL: ExerciseTechnique = {
  pattern: "Hammer curl",
  feel: "Biceps, brachialis (under the biceps) and forearms.",
  steps: [
    "Stand tall holding the weights with palms facing each other.",
    "Keep your elbows by your sides.",
    "Curl up, keeping your thumbs pointing up.",
    "Lower slowly to straight arms.",
  ],
  tips: ["No swinging.", "Builds arm thickness and grip."],
  adapt: ["Usually the kindest curl for sore wrists and elbows.", "Do one arm at a time if you find you swing."],
};

const REVERSE_CURL: ExerciseTechnique = {
  pattern: "Reverse curl",
  feel: "Forearms and brachialis (under the biceps).",
  steps: [
    "Hold the weight with palms facing down.",
    "Keep your elbows by your sides.",
    "Curl up, keeping your wrists straight.",
    "Lower slowly.",
  ],
  tips: ["Use lighter weight than a normal curl.", "Keep your wrists in line with your forearms."],
  adapt: ["Wrists sore? An EZ bar helps.", "Stop if your elbows ache."],
};

const PUSHDOWN: ExerciseTechnique = {
  pattern: "Triceps pushdown",
  feel: "Triceps (back of the upper arm).",
  steps: [
    "Stand facing the cable, elbows tucked at your sides.",
    "Push the handle down until your arms are straight.",
    "Squeeze the back of your arms.",
    "Let it come up slowly to about chest height, elbows still at your sides.",
  ],
  tips: ["Only your forearms move. Your elbows stay pinned.", "With a rope, spread it apart at the bottom."],
  adapt: ["Elbows sore? A rope is usually kinder than a bar.", "Lean forward slightly if you need to."],
};

const OVERHEAD_EXTENSION: ExerciseTechnique = {
  pattern: "Overhead triceps extension",
  feel: "Triceps, especially the long head (most of the back of the arm).",
  steps: [
    "Hold the weight overhead with your elbows pointing up.",
    "Lower it behind your head by bending only your elbows.",
    "Feel the stretch in the back of your arm.",
    "Straighten your arms back up.",
  ],
  tips: ["Keep your elbows fairly close, not flared wide.", "The deep stretch is what makes this one work."],
  adapt: ["Shoulders sore? Use a cable or try skull crushers or pushdowns instead.", "Sit with back support to protect your lower back."],
};

const SKULL_CRUSHER: ExerciseTechnique = {
  pattern: "Lying triceps extension",
  feel: "Triceps.",
  steps: [
    "Lie on the bench with the weight held straight up over your chest.",
    "Let your arms angle slightly back towards your head.",
    "Bend your elbows to lower the weight towards your forehead or just behind your head.",
    "Straighten your arms back up.",
  ],
  tips: ["Keep your elbows still and pointing up.", "Lower slowly."],
  adapt: ["Elbows sore? Use dumbbells or an EZ bar and go lighter.", "A machine extension is easier to control."],
};

const KICKBACK: ExerciseTechnique = {
  pattern: "Triceps kickback",
  feel: "Triceps.",
  steps: [
    "Lean forward with a flat back, upper arm tucked by your side and parallel to the floor.",
    "Straighten your arm behind you.",
    "Squeeze the back of your arm.",
    "Bend back slowly.",
  ],
  tips: ["Keep your upper arm still.", "Pause at the top."],
  adapt: ["Support yourself on a bench to protect your back.", "A cable keeps the tension on through the whole rep."],
};

const SQUAT: ExerciseTechnique = {
  pattern: "Squat",
  feel: "Quads (front of the thighs), bum and inner thighs.",
  steps: [
    "Feet about shoulder width apart, toes turned out slightly.",
    "Brace your stomach and keep your chest up.",
    "Sit down between your heels, knees pushing out over your toes.",
    "Go as deep as you can with a flat back, then stand up through your whole foot.",
  ],
  tips: ["Control the way down and don't bounce at the bottom.", "Deeper squats grow the legs more, as long as your form holds."],
  adapt: ["Knees or hips sore? Squat to a box or bench and go only as low as is pain-free.", "Heels lifting? Put small plates under them or use a goblet squat."],
};

const FRONT_SQUAT: ExerciseTechnique = {
  pattern: "Front-loaded squat",
  feel: "Quads, bum and core.",
  steps: [
    "Hold the weight at your chest (goblet) or on the front of your shoulders.",
    "Feet about shoulder width, toes slightly out.",
    "Sit straight down between your heels with your chest tall.",
    "Stand up through your whole foot.",
  ],
  tips: ["The weight in front helps you stay upright and go deep.", "Keep your elbows up so the weight doesn't pull you forward."],
  adapt: ["A goblet squat is the best way to learn squatting.", "Squat to a box if depth is a problem."],
};

const MACHINE_SQUAT: ExerciseTechnique = {
  pattern: "Machine squat",
  feel: "Quads and bum.",
  steps: [
    "Set up with your back against the pad (or the belt fitted) and feet about shoulder width.",
    "Release the safety.",
    "Lower slowly as deep as is comfortable, knees following your toes.",
    "Push back up through your whole foot without locking your knees hard.",
  ],
  tips: ["The machine keeps you stable so you can push hard safely.", "Feet lower on the platform works the quads more."],
  adapt: ["Kind to your lower back, so it's good if your back gets sore.", "Shorten the depth if your knees complain."],
};

const LEG_PRESS: ExerciseTechnique = {
  pattern: "Leg press",
  feel: "Quads and bum.",
  steps: [
    "Sit back with your feet about shoulder width on the platform.",
    "Release the safety and lower the platform slowly.",
    "Go as deep as you can without your lower back lifting off the seat.",
    "Press back up without locking your knees.",
  ],
  tips: ["Feet lower works the quads more. Feet higher works the bum and hamstrings more.", "Control the bottom. Don't bounce."],
  adapt: ["Knees sore? Put your feet a little higher and don't go as deep.", "Keep your bum on the seat the whole time to protect your back."],
};

const SPLIT_SQUAT: ExerciseTechnique = {
  pattern: "Split squat",
  feel: "Quads and bum of the front leg.",
  steps: [
    "Stand in a long stride (back foot on a bench for Bulgarian), front foot flat.",
    "Lower straight down until your back knee nearly touches the floor.",
    "Keep most of your weight on the front leg.",
    "Push up through your front heel.",
  ],
  tips: ["Lean slightly forward for more bum, stay upright for more quad.", "Finish all reps on one leg before switching."],
  adapt: ["Balance an issue? Hold onto something with one hand.", "Knees sore? Take a longer stride and don't go as low."],
};

const LUNGE: ExerciseTechnique = {
  pattern: "Lunge",
  feel: "Quads and bum.",
  steps: [
    "Stand tall with your feet hip width apart.",
    "Step forward or back into a long stride.",
    "Lower until your back knee nearly touches the floor.",
    "Push back to standing through your front foot.",
  ],
  tips: ["Reverse lunges are usually easier on the knees than forward ones.", "Keep your chest up and move with control."],
  adapt: ["Knees sore? Use reverse lunges and shorten the depth.", "Hold a wall or rail for balance."],
};

const LATERAL_LUNGE: ExerciseTechnique = {
  pattern: "Side lunge",
  feel: "Inner thighs, quads and bum.",
  steps: [
    "Stand with your feet wide.",
    "Shift your weight to one side, bending that knee and sitting your hips back.",
    "Keep the other leg straight and both feet flat.",
    "Push back to the middle and switch sides.",
  ],
  tips: ["Sit back as if into a chair.", "Go slowly and feel the stretch in the straight leg."],
  adapt: ["Only go as low as is comfortable.", "Hold onto something for balance."],
};

const STEP_UP: ExerciseTechnique = {
  pattern: "Step-up",
  feel: "Quads and bum of the working leg.",
  steps: [
    "Put one foot fully on a box or bench.",
    "Push through that heel and stand up on the box.",
    "Lower back down slowly with control.",
  ],
  tips: ["Let the top leg do the work. Don't push off the back foot.", "Lower slowly. That's where the strength comes from."],
  adapt: ["Use a lower step if your knees are sore.", "Hold a rail for balance."],
};

const JUMP: ExerciseTechnique = {
  pattern: "Jump",
  feel: "Legs, power and speed.",
  steps: [
    "Stand with your feet hip width apart.",
    "Dip into a quarter squat and swing your arms back.",
    "Jump up explosively.",
    "Land softly with bent knees, then reset.",
  ],
  tips: ["Land as quietly as you can.", "Quality over quantity. Rest between jumps."],
  adapt: ["Knees or ankles sore? Swap to a fast squat with no jump.", "Use a low box, and step down rather than jumping down."],
};

const WALL_SIT: ExerciseTechnique = {
  pattern: "Hold",
  feel: "Quads.",
  steps: [
    "Get into position (back against a wall, or in a split squat).",
    "Lower until your knees are bent to the depth you can hold.",
    "Hold still and breathe.",
  ],
  tips: ["Keep breathing. Don't hold your breath.", "Keep your weight through your heels."],
  adapt: ["Hold higher up if it's too hard on your knees.", "Shorter holds with rests work too."],
};

const LEG_EXTENSION: ExerciseTechnique = {
  pattern: "Leg extension",
  feel: "Quads (front of the thighs).",
  steps: [
    "Sit with your knees lined up with the machine's pivot and the pad on your lower shins.",
    "Hold the handles and straighten your legs.",
    "Squeeze your quads at the top.",
    "Lower slowly.",
  ],
  tips: ["Pause at the top for a second.", "Lean back slightly to stretch the quads more."],
  adapt: ["Knees sore? Use lighter weight and a shorter range.", "One leg at a time evens out a weaker side."],
};

const SISSY_SQUAT: ExerciseTechnique = {
  pattern: "Sissy squat",
  feel: "Quads.",
  steps: [
    "Hold onto something for balance.",
    "Rise onto your toes and lean back, keeping a straight line from knees to shoulders.",
    "Bend your knees forward and lower.",
    "Push back up.",
  ],
  tips: ["Go slowly.", "Only go as deep as you can control."],
  adapt: ["This is hard on the knees. Stop at a shallow depth if they complain.", "A leg extension works the same muscle more gently."],
};

const COSSACK: ExerciseTechnique = {
  pattern: "Cossack squat",
  feel: "Inner thighs, quads and bum.",
  steps: [
    "Stand with your feet very wide.",
    "Squat down over one leg, keeping the other straight with toes pointing up.",
    "Keep your chest up and heel down.",
    "Push back up and switch sides.",
  ],
  tips: ["Move slowly and go only as deep as you can control.", "Great for hip mobility."],
  adapt: ["Hold onto something for balance.", "Stop at a shallower depth if your knees or hips complain."],
};

const CALF_RAISE: ExerciseTechnique = {
  pattern: "Calf raise",
  feel: "Calves.",
  steps: [
    "Stand with the balls of your feet on a step or platform, heels hanging off.",
    "Lower your heels slowly as far as you can.",
    "Pause in the stretch for a second.",
    "Rise up as high as you can onto your toes.",
  ],
  tips: ["The pause at the bottom stops you bouncing. Calves love a full stretch.", "Seated raises work the lower calf. Standing raises work the upper calf."],
  adapt: ["Hold onto something for balance.", "Achilles sore? Don't go as low, and keep it slow."],
};

const TIBIALIS_RAISE: ExerciseTechnique = {
  pattern: "Tibialis raise",
  feel: "Front of the shins.",
  steps: [
    "Lean your back against a wall with your heels a little way out.",
    "Lift your toes up towards your shins.",
    "Lower slowly.",
  ],
  tips: ["High reps work well.", "Good for knees and shin splints."],
  adapt: ["Move your feet closer to the wall to make it easier.", "Do one leg at a time to make it harder."],
};

const HIP_THRUST: ExerciseTechnique = {
  pattern: "Hip thrust or glute bridge",
  feel: "Bum (glutes).",
  steps: [
    "Upper back on a bench (or lying on the floor for a bridge), knees bent, feet flat.",
    "Tuck your chin and ribs down.",
    "Drive through your heels and lift your hips until your body is flat from knees to shoulders.",
    "Squeeze your bum hard, then lower slowly.",
  ],
  tips: ["Pause for a second at the top.", "Shins should be upright at the top. Move your feet if not."],
  adapt: ["Lower back aches? Tuck your pelvis more and don't arch at the top.", "Use a pad on the bar so it's comfortable on your hips."],
};

const KICKBACK_GLUTE: ExerciseTechnique = {
  pattern: "Glute kickback",
  feel: "Bum (glutes).",
  steps: [
    "Lean slightly forward holding on, or set up on the machine.",
    "Push one leg back and slightly out, keeping your hips square.",
    "Squeeze your bum at the end.",
    "Return slowly.",
  ],
  tips: ["Don't arch your lower back to get the leg higher.", "Small, squeezed movement beats a big swing."],
  adapt: ["Lower back sore? Shorten the range.", "Use a band at home."],
};

const ABDUCTION: ExerciseTechnique = {
  pattern: "Hip abduction",
  feel: "Side of the bum (glute medius).",
  steps: [
    "Sit in the machine, or stand side-on to the cable or with a band round your legs.",
    "Push your legs (or leg) out to the side.",
    "Pause and squeeze.",
    "Return slowly.",
  ],
  tips: ["Leaning slightly forward in the machine works more of the bum.", "Control the return."],
  adapt: ["Good for knee and hip health.", "Use a band at home."],
};

const ADDUCTION: ExerciseTechnique = {
  pattern: "Hip adduction",
  feel: "Inner thighs.",
  steps: [
    "Sit in the machine with the pads on the inside of your knees.",
    "Squeeze your legs together.",
    "Open back out slowly to a comfortable stretch.",
  ],
  tips: ["Control the stretch.", "Pause when your legs meet."],
  adapt: ["Don't start too wide if your groin is tight.", "Lighter weight with slow reps works well."],
};

const RDL: ExerciseTechnique = {
  pattern: "Romanian deadlift",
  feel: "Hamstrings (back of the thighs) and bum.",
  steps: [
    "Stand tall holding the weight, knees soft.",
    "Push your hips back like closing a car door with your bum.",
    "Slide the weight down your legs with a flat back until you feel a strong stretch in your hamstrings.",
    "Squeeze your bum and drive your hips forward to stand up.",
  ],
  tips: ["The stretch in your hamstrings is the goal, not touching the floor.", "Keep the weight close to your legs."],
  adapt: ["Lower back sore? Stop higher and use lighter weight.", "Hamstrings tight? Bend your knees a little more."],
};

const SINGLE_LEG_RDL: ExerciseTechnique = {
  pattern: "Single-leg Romanian deadlift",
  feel: "Hamstrings, bum and balance.",
  steps: [
    "Stand on one leg holding the weight, knee soft.",
    "Hinge forward, letting the other leg go back behind you.",
    "Keep your hips square and back flat until you feel the stretch.",
    "Squeeze your bum to stand back up.",
  ],
  tips: ["Move slowly. Balance is part of the exercise.", "Keep your hips level. Don't let them open up."],
  adapt: ["Hold onto something with your free hand.", "Kickstand version (back toe touching the floor) is easier to balance."],
};

const DEADLIFT: ExerciseTechnique = {
  pattern: "Deadlift",
  feel: "Bum, hamstrings, back and grip.",
  steps: [
    "Stand close to the weight, feet hip width apart.",
    "Hinge down and grip it, back flat, chest up, shoulders over the bar.",
    "Brace your stomach and push the floor away with your legs.",
    "Stand tall, then lower it back down with the same flat back.",
  ],
  tips: ["Keep the bar close, brushing your legs.", "Squeeze your bum to finish. Don't lean back."],
  adapt: ["Lower back sore? A trap bar or raising the bar on blocks is easier.", "Keep reps lower and stop before your form slips."],
};

const GOOD_MORNING: ExerciseTechnique = {
  pattern: "Good morning",
  feel: "Hamstrings, bum and lower back.",
  steps: [
    "Bar on your upper back, feet hip width, knees soft.",
    "Push your hips back and lean forward with a flat back.",
    "Stop when you feel a strong hamstring stretch.",
    "Squeeze your bum to stand up.",
  ],
  tips: ["Light weight and slow.", "Keep your back flat the whole time."],
  adapt: ["Lower back sore? Use a Romanian deadlift or leg curl instead.", "Start with an empty bar or a broomstick."],
};

const LEG_CURL: ExerciseTechnique = {
  pattern: "Leg curl",
  feel: "Hamstrings (back of the thighs).",
  steps: [
    "Set up with the pad just above your heels and knees lined up with the pivot.",
    "Curl your heels towards your bum.",
    "Squeeze at the end.",
    "Lower slowly to nearly straight legs.",
  ],
  tips: ["Seated leg curls stretch the hamstrings more and are great for growth.", "Keep your hips pressed down. Don't lift them."],
  adapt: ["Cramping? Point your toes slightly and go lighter.", "Use a band or towel slide at home."],
};

const NORDIC: ExerciseTechnique = {
  pattern: "Nordic curl",
  feel: "Hamstrings.",
  steps: [
    "Kneel with your ankles held down by a partner or a pad.",
    "Keep a straight line from knees to head.",
    "Lower yourself forward as slowly as you can.",
    "Catch yourself with your hands and push back up.",
  ],
  tips: ["The slow lowering is what builds strong, injury-resistant hamstrings.", "A few good reps are enough."],
  adapt: ["Very hard. Only lower part of the way at first.", "Use a band round your chest for help."],
};

const BACK_EXTENSION: ExerciseTechnique = {
  pattern: "Back extension",
  feel: "Bum, hamstrings and lower back.",
  steps: [
    "Set the pad just below your hips, feet secured.",
    "Hinge down from your hips with a flat back.",
    "Rise up until your body is in a straight line. Don't over-arch.",
    "Lower slowly.",
  ],
  tips: ["Round your upper back slightly and squeeze your bum to target the glutes.", "Pause at the top."],
  adapt: ["Lower back sore? Do fewer reps and stop at straight.", "Hold a weight to your chest to make it harder."],
};

const REVERSE_HYPER: ExerciseTechnique = {
  pattern: "Reverse hyperextension",
  feel: "Bum, hamstrings and lower back.",
  steps: [
    "Lie face down on the bench with your hips at the edge, legs hanging.",
    "Lift your legs up behind you until they're in line with your body.",
    "Squeeze your bum, then lower slowly.",
  ],
  tips: ["Controlled, not swinging.", "Good for lower-back health."],
  adapt: ["Lift only to straight, not higher.", "Bend your knees to make it easier."],
};

const PULL_THROUGH: ExerciseTechnique = {
  pattern: "Cable pull-through",
  feel: "Bum and hamstrings.",
  steps: [
    "Face away from a low cable with the rope between your legs.",
    "Push your hips back and let the rope pull through.",
    "Squeeze your bum to stand up tall.",
  ],
  tips: ["It's a hip hinge. Keep your arms long and relaxed.", "Pause and squeeze at the top."],
  adapt: ["A great way to learn hip hinging.", "Lower back sore? Shorten the range."],
};

const PLANK: ExerciseTechnique = {
  pattern: "Plank",
  feel: "Core (stomach and sides).",
  steps: [
    "Forearms or hands under your shoulders.",
    "Straight line from head to heels.",
    "Squeeze your bum and pull your belly button in.",
    "Hold and breathe.",
  ],
  tips: ["A short hold done well beats a long sloppy one.", "Don't let your hips sag or stick up."],
  adapt: ["Too hard? Drop to your knees.", "Wrists sore? Use your forearms."],
};

const SIDE_PLANK: ExerciseTechnique = {
  pattern: "Side plank",
  feel: "Sides of your stomach (obliques) and hips.",
  steps: [
    "Lie on your side with your elbow under your shoulder.",
    "Lift your hips so your body is straight.",
    "Hold and breathe.",
  ],
  tips: ["Push your top hip slightly forward.", "Keep your head in line."],
  adapt: ["Bend your knees to make it easier.", "Shorter holds are fine."],
};

const DEAD_BUG: ExerciseTechnique = {
  pattern: "Core control",
  feel: "Deep core.",
  steps: [
    "Set up (on your back for dead bug, on hands and knees for bird dog).",
    "Press your lower back gently towards the floor or keep it flat.",
    "Slowly reach the opposite arm and leg away.",
    "Return and switch sides.",
  ],
  tips: ["Slow and controlled. Your back shouldn't move.", "Breathe out as you reach."],
  adapt: ["Great for sore backs.", "Move just the legs or just the arms to make it easier."],
};

const PALLOF: ExerciseTechnique = {
  pattern: "Pallof press",
  feel: "Core, especially the sides.",
  steps: [
    "Stand side-on to a cable or band at chest height, holding it at your chest.",
    "Press your hands straight out in front.",
    "Don't let it twist you. Hold for a second.",
    "Bring your hands back to your chest.",
  ],
  tips: ["Stand tall with your stomach tight.", "The further from the anchor, the harder."],
  adapt: ["Kind to the back.", "Kneel to make it steadier."],
};

const ROTATION: ExerciseTechnique = {
  pattern: "Rotation and side bend",
  feel: "Sides of your stomach (obliques).",
  steps: [
    "Set up tall with your stomach braced.",
    "Turn or bend through your middle with control.",
    "Return to the middle slowly.",
  ],
  tips: ["Move with control. Don't swing.", "Breathe out as you turn."],
  adapt: ["Lower back sore? Use a smaller range and lighter weight.", "Bands work well at home."],
};

const WINDMILL: ExerciseTechnique = {
  pattern: "Kettlebell windmill",
  feel: "Sides of your stomach, shoulders and hips.",
  steps: [
    "Hold the kettlebell straight up overhead, feet wider than hips.",
    "Push your hip out to the side and slide your free hand down your leg.",
    "Keep your eyes on the bell and arm locked.",
    "Return to standing.",
  ],
  tips: ["Move slowly.", "Learn it with no weight first."],
  adapt: ["Only go as low as is comfortable.", "Skip it if your shoulder pinches overhead."],
};

const LEG_RAISE: ExerciseTechnique = {
  pattern: "Leg raise",
  feel: "Lower stomach and hip flexors.",
  steps: [
    "Hang from a bar or lean back on the captain's chair, or lie down for V-ups.",
    "Lift your knees (or legs) up by curling your pelvis towards you.",
    "Lower slowly without swinging.",
  ],
  tips: ["Curl your hips up at the top. That's what works the stomach.", "No swinging."],
  adapt: ["Bent knees are easier than straight legs.", "Lower back sore? Try dead bugs instead."],
};

const CRUNCH: ExerciseTechnique = {
  pattern: "Crunch or sit-up",
  feel: "Stomach (abs).",
  steps: [
    "Set up lying, kneeling at the cable, or in the machine.",
    "Curl your ribs down towards your hips.",
    "Squeeze your stomach.",
    "Return slowly.",
  ],
  tips: ["Think of curling your spine, not pulling with your neck or arms.", "Slow and squeezed beats fast."],
  adapt: ["Neck sore? Rest your head in your hands without pulling.", "Lower back sore? Use a smaller range."],
};

const SUPERMAN: ExerciseTechnique = {
  pattern: "Superman",
  feel: "Lower back and bum.",
  steps: [
    "Lie face down with your arms stretched out in front.",
    "Lift your arms, chest and legs a little way off the floor.",
    "Hold for a second, then lower.",
  ],
  tips: ["Small lift. Squeeze your bum.", "Keep your neck in line, looking at the floor."],
  adapt: ["Lift only arms or only legs to make it easier.", "Stop if your lower back pinches."],
};

const NECK: ExerciseTechnique = {
  pattern: "Neck training",
  feel: "Neck muscles.",
  steps: ["Lie on a bench with your head over the edge.", "Move your head slowly through a small, comfortable range.", "Control it all the way back."],
  tips: ["Very light weight, slow reps.", "Never jerk."],
  adapt: ["Start with no weight at all.", "Skip it if you've had neck problems. Ask your coach."],
};

const MOBILITY: ExerciseTechnique = {
  pattern: "Mobility and stretching",
  feel: "Gentle stretch in the target area.",
  steps: ["Move slowly into the stretch.", "Breathe and relax into it.", "Come out of it slowly."],
  tips: ["Gentle is better. Breathe out to go a little further.", "A little every day beats a lot once a week."],
  adapt: ["Stretch to mild tension, never pain.", "Use less range on stiff days."],
};

const JEFFERSON_CURL: ExerciseTechnique = {
  pattern: "Jefferson curl",
  feel: "Stretch through your back and hamstrings.",
  steps: [
    "Stand on a step holding a very light weight.",
    "Tuck your chin and roll down slowly, one bit of spine at a time.",
    "Let the weight hang towards your feet.",
    "Roll back up slowly.",
  ],
  tips: ["Very light weight and very slow.", "Breathe out as you roll down."],
  adapt: ["Do it with no weight first.", "Skip it if you have a back injury. Ask your coach."],
};

const DEAD_HANG: ExerciseTechnique = {
  pattern: "Dead hang",
  feel: "Shoulders, grip and a stretch through your back.",
  steps: ["Hold the bar with your hands shoulder width apart.", "Let your body hang, feet off the floor.", "Breathe and relax your shoulders."],
  tips: ["Build up your time a little each week.", "Great for grip and shoulder health."],
  adapt: ["Keep your toes on a box to take some weight off.", "Stop if your shoulders pinch."],
};

const CARDIO_RUN: ExerciseTechnique = {
  pattern: "Running",
  feel: "Heart, lungs and legs.",
  steps: [
    "Start with a few minutes of easy walking or jogging.",
    "Run tall with relaxed shoulders, landing under your body.",
    "Hold the pace your coach set, then finish with a few easy minutes.",
  ],
  tips: ["Easy runs should feel easy enough to talk.", "Short, quick steps are kinder to your joints."],
  adapt: ["Knees sore? Walk-run intervals, or swap to the bike or elliptical.", "Build up slowly, about 10% more each week."],
};

const CARDIO_WALK: ExerciseTechnique = {
  pattern: "Walking and climbing",
  feel: "Heart, lungs, legs and bum.",
  steps: ["Start easy to warm up.", "Stand tall and push through your whole foot.", "Hold the pace or incline your coach set."],
  tips: ["Try not to hold onto the rails. Swing your arms.", "Incline makes it harder without the pounding of running."],
  adapt: ["Lower the incline or speed to suit you.", "Great for sore joints."],
};

const CARDIO_CYCLE: ExerciseTechnique = {
  pattern: "Cycling",
  feel: "Heart, lungs and legs.",
  steps: [
    "Set the seat so your knee is slightly bent at the bottom of the pedal stroke.",
    "Start with a few easy minutes.",
    "Hold the effort your coach set, then finish easy.",
  ],
  tips: ["Push and pull through the whole pedal circle.", "Keep your upper body relaxed."],
  adapt: ["Very kind to the knees and back.", "Lower the resistance on tired days."],
};

const CARDIO_ROW: ExerciseTechnique = {
  pattern: "Rowing and ski machine",
  feel: "Legs, back, arms and lungs.",
  steps: [
    "Rowing: push with your legs first, then lean back slightly, then pull your arms in.",
    "Return in reverse: arms, body, then legs.",
    "Ski machine: pull down by hinging your hips and driving your arms.",
  ],
  tips: ["Most of the power comes from your legs.", "Long, strong strokes beat fast, short ones."],
  adapt: ["Lower back sore? Keep it easy and focus on form.", "Use a lower damper setting."],
};

const CARDIO_SWIM: ExerciseTechnique = {
  pattern: "Swimming",
  feel: "Whole body, heart and lungs.",
  steps: ["Warm up with a few easy lengths.", "Keep a steady rhythm and breathe out under water.", "Do the sets your coach planned, then swim easy to finish."],
  tips: ["Smooth and long beats fast and choppy.", "Rest at the wall when you need to."],
  adapt: ["Very kind to joints.", "Use a kickboard to work just arms or just legs."],
};

const CARDIO_CONDITIONING: ExerciseTechnique = {
  pattern: "Conditioning",
  feel: "Heart, lungs and whole body.",
  steps: ["Warm up first.", "Work hard for the time your coach set, keeping good form.", "Rest, then go again."],
  tips: ["Keep your form even when tired.", "Breathe steadily."],
  adapt: ["Slow it down or take out jumps if your joints complain.", "Shorter rounds with more rest are fine."],
};

const CARDIO_SLED: ExerciseTechnique = {
  pattern: "Sled",
  feel: "Legs, bum and lungs.",
  steps: ["Lean into the sled with your arms straight (push) or hold the rope (pull).", "Drive with short, powerful steps.", "Keep your back flat."],
  tips: ["Low body angle for pushing.", "Steady steps, don't sprint into it from standing."],
  adapt: ["Lighter load on sore days.", "Kind to knees because there's no lowering part."],
};

const CARDIO_GENERAL: ExerciseTechnique = {
  pattern: "Cardio",
  feel: "Heart and lungs.",
  steps: ["Start with a few easy minutes.", "Hold the effort your coach set.", "Finish with a few easy minutes."],
  tips: ["Steady and consistent wins.", "Breathe in a rhythm."],
  adapt: ["Lower the effort on tired days.", "Pick a machine that's kind to any sore joints."],
};

const CARDIO_RULES: Rule[] = [
  { match: /rowing|skierg/, technique: CARDIO_ROW },
  { match: /cycl|bike|spin|ride/, technique: CARDIO_CYCLE },
  { match: /swim/, technique: CARDIO_SWIM },
  { match: /sled/, technique: CARDIO_SLED },
  { match: /burpee|jump rope|jumping jack|mountain climber|battle rope|shadow boxing/, technique: CARDIO_CONDITIONING },
  { match: /walk|hik|hill|stair|versaclimber|elliptical|arc trainer/, technique: CARDIO_WALK },
  { match: /run/, technique: CARDIO_RUN },
];

// First match wins, so more specific patterns come first.
const RULES: Rule[] = [
  // Olympic lifts and full-body moves.
  { match: /snatch grip deadlift/, technique: DEADLIFT },
  { match: /snatch|clean|jerk|high pull/, technique: OLYMPIC_LIFT },
  { match: /kettlebell swing/, technique: KETTLEBELL_SWING },
  { match: /turkish get-up/, technique: TURKISH_GET_UP },
  { match: /man maker/, technique: MAN_MAKER },
  { match: /wall ball/, technique: WALL_BALL },
  { match: /overhead squat/, technique: OVERHEAD_SQUAT },
  { match: /thruster/, technique: THRUSTER },

  // Mobility, neck, core.
  { match: /jefferson curl/, technique: JEFFERSON_CURL },
  { match: /dead hang/, technique: DEAD_HANG },
  { match: /stretch/, technique: MOBILITY },
  { match: /neck curl|neck extension/, technique: NECK },
  { match: /side plank/, technique: SIDE_PLANK },
  { match: /plank/, technique: PLANK },
  { match: /dead bug|bird dog/, technique: DEAD_BUG },
  { match: /pallof/, technique: PALLOF },
  { match: /windmill/, technique: WINDMILL },
  { match: /wood chopper|russian twist|side bend/, technique: ROTATION },
  { match: /knee raise|toes-to-bar|v-up/, technique: LEG_RAISE },
  { match: /crunch|sit-up/, technique: CRUNCH },
  { match: /superman/, technique: SUPERMAN },

  // Forearms and carries.
  { match: /wrist|plate pinch/, technique: FOREARM },
  { match: /farmer|carry/, technique: FARMERS_CARRY },

  // Calves (before leg press, for the calf press on the leg press).
  { match: /tibialis/, technique: TIBIALIS_RAISE },
  { match: /calf/, technique: CALF_RAISE },

  // Hamstrings (before arm curls).
  { match: /nordic/, technique: NORDIC },
  { match: /leg curl|hamstring curl/, technique: LEG_CURL },
  { match: /good morning/, technique: GOOD_MORNING },
  { match: /single-leg.*romanian/, technique: SINGLE_LEG_RDL },
  { match: /romanian|stiff-leg/, technique: RDL },
  { match: /deadlift|rack pull/, technique: DEADLIFT },
  { match: /reverse hyper/, technique: REVERSE_HYPER },
  { match: /back extension/, technique: BACK_EXTENSION },
  { match: /pull through/, technique: PULL_THROUGH },

  // Glutes.
  { match: /hip thrust|glute bridge|frog pump/, technique: HIP_THRUST },
  { match: /tricep kickback/, technique: KICKBACK },
  { match: /kickback/, technique: KICKBACK_GLUTE },
  { match: /abduction/, technique: ABDUCTION },
  { match: /adduction/, technique: ADDUCTION },

  // Legs.
  { match: /leg press/, technique: LEG_PRESS },
  { match: /leg extension/, technique: LEG_EXTENSION },
  { match: /sissy/, technique: SISSY_SQUAT },
  { match: /wall sit|isometric hold/, technique: WALL_SIT },
  { match: /box jump|jump squat/, technique: JUMP },
  { match: /step-up|step-down/, technique: STEP_UP },
  { match: /bulgarian|split squat/, technique: SPLIT_SQUAT },
  { match: /lateral lunge/, technique: LATERAL_LUNGE },
  { match: /cossack/, technique: COSSACK },
  { match: /lunge/, technique: LUNGE },
  { match: /goblet squat|front squat|zercher/, technique: FRONT_SQUAT },
  { match: /pendulum|hack|belt squat|smith machine squat/, technique: MACHINE_SQUAT },
  { match: /squat/, technique: SQUAT },

  // Back.
  { match: /pullover|straight-arm pulldown/, technique: PULLOVER },
  { match: /pull-up|chin-up/, technique: PULL_UP },
  { match: /pulldown/, technique: PULLDOWN },
  { match: /face pull/, technique: FACE_PULL },
  { match: /upright row/, technique: UPRIGHT_ROW },
  { match: /inverted row/, technique: INVERTED_ROW },
  { match: /chest-supported|seal row/, technique: ROW },
  { match: /bent-over|pendlay|yates|underhand barbell row|gorilla|t-bar/, technique: BENT_OVER_ROW },
  { match: /single-arm.*row|^dumbbell row|meadows|kettlebell row|iso-lateral/, technique: SINGLE_ARM_ROW },
  { match: /row/, technique: ROW },

  // Shoulders and traps.
  { match: /rear-delt|reverse fly|reverse pec deck/, technique: REAR_DELT_FLY },
  { match: /lateral raise/, technique: LATERAL_RAISE },
  { match: /front raise/, technique: FRONT_RAISE },
  { match: /external rotation/, technique: EXTERNAL_ROTATION },
  { match: /shrug/, technique: SHRUG },
  { match: /landmine press/, technique: LANDMINE_PRESS },
  { match: /push press/, technique: PUSH_PRESS },
  { match: /overhead press|military press|arnold|z-press|behind-the-neck|cuban/, technique: OVERHEAD_PRESS },

  // Arms.
  { match: /hammer curl/, technique: HAMMER_CURL },
  { match: /reverse.*curl|zottman/, technique: REVERSE_CURL },
  { match: /preacher|spider|concentration/, technique: PREACHER_CURL },
  { match: /incline.*curl|bayesian/, technique: STRETCH_CURL },
  { match: /curl/, technique: CURL },
  { match: /pushdown/, technique: PUSHDOWN },
  { match: /overhead.*extension/, technique: OVERHEAD_EXTENSION },
  { match: /skull crusher|tricep extension/, technique: SKULL_CRUSHER },
  { match: /close-grip.*bench|jm press|tate press/, technique: CLOSE_GRIP_PRESS },
  { match: /bench dip/, technique: BENCH_DIP },
  { match: /dip/, technique: DIP },

  // Chest.
  { match: /diamond push-up/, technique: DIAMOND_PUSH_UP },
  { match: /push-up/, technique: PUSH_UP },
  { match: /fly/, technique: CHEST_FLY },
  { match: /floor press/, technique: FLOOR_PRESS },
  { match: /bench press|chest press|dumbbell press|incline barbell press/, technique: BENCH_PRESS },
];

// When the name doesn't match, fall back on the body part.
const CATEGORY_FALLBACK: Record<string, ExerciseTechnique> = {
  Push: BENCH_PRESS,
  Pull: ROW,
  Legs: SQUAT,
  Quads: LEG_EXTENSION,
  Hamstrings: LEG_CURL,
  "Posterior Chain": RDL,
  Glutes: HIP_THRUST,
  Adductors: ADDUCTION,
  Calves: CALF_RAISE,
  Shoulders: LATERAL_RAISE,
  "Overhead Press": OVERHEAD_PRESS,
  Traps: SHRUG,
  Biceps: CURL,
  Triceps: PUSHDOWN,
  "Forearms & Grip": FOREARM,
  Core: CRUNCH,
  Mobility: MOBILITY,
  Neck: NECK,
  "Full Body": CARDIO_CONDITIONING,
  Cardio: CARDIO_GENERAL,
};

// The guide for an exercise. Null only when neither its name nor body part
// is recognised (e.g. a trainer's own exercise with no body part).
export function techniqueFor(name: string, category?: string | null): ExerciseTechnique | null {
  const lower = name.toLowerCase();
  if (category === "Cardio") {
    return CARDIO_RULES.find((r) => r.match.test(lower))?.technique ?? CARDIO_GENERAL;
  }
  const rule = RULES.find((r) => r.match.test(lower)) ?? CARDIO_RULES.find((r) => r.match.test(lower));
  if (rule) return rule.technique;
  return (category && CATEGORY_FALLBACK[category]) || null;
}

// Every distinct guide, for tests.
export const ALL_TECHNIQUES: ExerciseTechnique[] = Array.from(
  new Set([...RULES, ...CARDIO_RULES].map((r) => r.technique).concat(Object.values(CATEGORY_FALLBACK))),
);
