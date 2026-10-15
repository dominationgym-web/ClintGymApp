// "How to do it" guides for the Sports Performance moves (0093): jumps and
// throws, sprint and agility drills, mobility drills and stretches. Most of
// these aren't in the MoveKit library, so they have no video yet; the guide
// carries the steps and links out to examples online (watchOnlineUrl).
// Matched by exact exercise name, before the general pattern guides.
import type { ExerciseTechnique } from "@/lib/exerciseTechnique";
import { youtubeSearchUrl } from "@/lib/watchOnline";

const g = (pattern: string, feel: string, steps: string[], tips: string[], adapt: string[]): ExerciseTechnique => ({
  pattern,
  feel,
  steps,
  tips,
  adapt,
  // "Don't swing or bounce the weight" doesn't fit jumps, sprints or stretches.
  noWeightRule: true,
});

const LAND_SOFT = "Land softly on the balls of your feet, knees in line with your toes, hips back, like a spring.";
const STOP_PAIN = "Stretch to a mild pull, never pain. Breathe slowly and relax into it.";

export const SPORTS_GUIDES: Record<string, ExerciseTechnique> = {
  // ---------------------------------------------------------------- Jumps and throws
  "Broad Jump": g(
    "Jump",
    "Glutes, hamstrings and quads: explosive hip power.",
    ["Stand with feet hip width apart.", "Swing your arms back and dip your hips.", "Swing your arms forward and jump forward as far as you can.", `${LAND_SOFT} Hold it for a second, then walk back.`],
    ["Every jump is max effort; rest fully between them.", "Sticking the landing teaches you to absorb force, which protects your knees."],
    ["Start with shorter jumps until your landings are quiet and steady.", "Knee pain? Do box jumps instead (less impact landing)."],
  ),
  "Pogo Hops": g(
    "Jump",
    "Calves and ankles: springy, stiff ankles for speed.",
    ["Stand tall with feet hip width apart and knees almost straight.", "Hop up and down quickly, using only your ankles.", "Spend as little time on the ground as you can, like the floor is hot.", "Keep your heels just off the floor."],
    ["Think quick and bouncy, not high.", "Stay tall: don't let your knees or hips bend much."],
    ["Start with small hops on grass.", "Sore Achilles or shins? Skip these and tell your coach."],
  ),
  "Lateral Bound": g(
    "Jump",
    "Glutes and outer hips: side-to-side power for cutting.",
    ["Stand on your right leg with a slight knee bend.", "Push off hard and jump sideways to the left.", "Land on your left leg only, knee over toes, hip back.", "Hold for a second (stick it), then bound back."],
    ["Push the ground away sideways as hard as you can.", "Keep your knee from caving in on the landing."],
    ["Make the bound shorter until you can stick every landing.", "Touch the other foot down to help balance at first."],
  ),
  "Single-Leg Hop": g(
    "Jump",
    "Glutes, quads, calves and balance on one leg.",
    ["Stand on one leg with a slight knee bend.", "Swing your arms and hop forward.", "Land on the same leg, softly, knee in line with your toes.", "Stick the landing for a second, then go again."],
    ["Quality landings first, distance second.", "Do your weaker leg first."],
    ["Start with small hops on the spot.", "Any knee or ankle pain: stop and tell your coach."],
  ),
  "Depth Jump": g(
    "Jump",
    "Legs and calves: reactive power, the fastest way off the ground.",
    ["Stand on a low box (30-45 cm).", "Step off (don't jump off) and land on both feet.", "The moment you land, jump up as high as you can.", LAND_SOFT],
    ["Spend as little time on the ground as possible between landing and jumping.", "If your landings get loud or slow, the box is too high or you're tired: stop."],
    ["Start with a lower box.", "Not for beginners: do box jumps until your coach says you're ready."],
  ),
  "Tuck Jump": g(
    "Jump",
    "Legs and core: fast, high jumping.",
    ["Stand with feet hip width apart.", "Jump straight up as high as you can.", "Pull your knees up towards your chest at the top.", "Land softly and go straight into the next jump."],
    ["Drive your arms up hard.", "Stay on the balls of your feet between jumps."],
    ["Do one jump at a time with a reset in between.", "Knee pain? Do jump squats instead."],
  ),
  Bounding: g(
    "Jump",
    "Glutes, hamstrings and calves: long, powerful running strides.",
    ["Run forward in big, exaggerated strides, like leaping from one foot to the other.", "Drive your front knee up and forward on each bound.", "Push off hard from the back leg.", "Swing your opposite arm forward, like sprinting."],
    ["Aim for height and distance, with a short time on the ground.", "Land under your hips, not out in front."],
    ["Start with skipping for distance before bounding.", "Do these on grass."],
  ),
  "Medicine Ball Chest Pass": g(
    "Throw",
    "Chest, shoulders and triceps: fast pushing power.",
    ["Stand facing a solid wall about 2-3 m away, feet hip width apart.", "Hold a medicine ball (3-6 kg) at your chest.", "Step forward and throw it as hard as you can at the wall.", "Catch it on the bounce and reset."],
    ["Push through with your whole body, legs and hips too.", "Throw every rep as fast as you can."],
    ["Use a lighter ball if your form slows down.", "No wall? Throw it to a partner."],
  ),
  "Medicine Ball Rotational Throw": g(
    "Throw",
    "Hips, core and obliques: rotational power for hitting, throwing and punching.",
    ["Stand side-on to a solid wall, about 1-2 m away.", "Hold a medicine ball at your back hip.", "Turn your hips and shoulders hard and throw the ball into the wall.", "Catch it and do all your reps, then switch sides."],
    ["Power starts in your back leg and hips, not your arms.", "Let your back foot pivot as you throw."],
    ["Use a lighter ball to learn the move.", "Back pain? Keep the turn smaller and tell your coach."],
  ),
  "Medicine Ball Slam": g(
    "Throw",
    "Whole body: lats, core, shoulders and hips.",
    ["Stand with feet shoulder width apart, holding a slam ball.", "Lift it overhead and rise onto your toes.", "Slam it into the floor as hard as you can, hinging at the hips.", "Pick it up with a flat back and go again."],
    ["Use a proper slam ball that doesn't bounce back at your face.", "Every slam is max effort."],
    ["Use a lighter ball if your back rounds when you pick it up.", "Shoulders sore? Lift only to head height."],
  ),
  "Medicine Ball Scoop Toss": g(
    "Throw",
    "Glutes, hamstrings and back: hip power, like a jump.",
    ["Stand with feet shoulder width apart, holding a medicine ball between your legs.", "Hinge at the hips with a flat back, like a deadlift.", "Drive your hips forward and throw the ball up and behind you (or straight up).", "Let it land, then fetch it."],
    ["The power comes from your hips snapping forward.", "Use an open space and check no one is behind you."],
    ["Use a lighter ball to learn the hinge.", "Back pain? Use a kettlebell swing instead."],
  ),

  // ---------------------------------------------------------------- Sprint and agility drills
  "A-Skip": g(
    "Sprint drill",
    "Hip flexors, calves and coordination: good sprint posture.",
    ["Skip forward, driving one knee up to hip height.", "Strike the ground under your hips with the ball of your foot.", "Swing your opposite arm, elbows bent at 90 degrees.", "Stay tall with your hips high."],
    ["Quick, light contacts with the ground.", "Think: knee up, toes up, foot down under you."],
    ["Learn it as an A-march (walking) first.", "Slow it down until the rhythm feels natural."],
  ),
  "B-Skip": g(
    "Sprint drill",
    "Hamstrings and hip flexors: the claw-back action of fast running.",
    ["Start like an A-skip, driving the knee up.", "Kick the lower leg out in front.", "Pull it back down and under you, like you're clawing the ground.", "Stay tall and keep the rhythm."],
    ["The pull-back is what matters: snap the foot down under your hips.", "Keep it light and quick."],
    ["Master the A-skip first.", "Feel your hamstring tight? Stop for the day."],
  ),
  "High Knees": g(
    "Sprint drill",
    "Hip flexors, calves and speed of leg turnover.",
    ["Run forward slowly, driving your knees up to hip height.", "Land on the balls of your feet under your hips.", "Pump your arms, elbows at 90 degrees.", "Stay tall; don't lean back."],
    ["Fast feet, small forward movement.", "Keep your toes pulled up."],
    ["Do them on the spot first.", "Shorten the distance if your form fades."],
  ),
  "Wall Drive Drill": g(
    "Sprint drill",
    "Glutes, hip flexors and a strong acceleration lean.",
    ["Lean into a wall with your hands on it at shoulder height, body straight at about 45 degrees.", "Lift one knee up to hip height, toes pulled up.", "Switch legs quickly: drive the knee down and bring the other one up.", "Keep your body in a straight line the whole time."],
    ["This is the body angle of a fast start.", "Punch your foot down and back under your hips."],
    ["Do single switches with a pause first.", "Move your feet closer to the wall to make it easier."],
  ),
  "Falling Start Sprint": g(
    "Sprint",
    "Whole body: a fast first step and strong lean.",
    ["Stand tall on the balls of your feet.", "Lean forward from your ankles, keeping your body straight.", "When you feel you're about to fall, sprint.", "Drive your arms hard and push the ground back for the full distance."],
    ["The lean is the start: let gravity help you.", "Short, powerful first steps."],
    ["Start with a shorter distance.", "Rest fully between sprints: walk back slowly."],
  ),
  "Acceleration Sprint": g(
    "Sprint",
    "Glutes, hamstrings and quads: getting up to speed fast.",
    ["Start from the position shown (standing, 3-point or side-on).", "Push hard and stay low for the first few steps.", "Rise up gradually as you speed up.", "Sprint all-out through the finish, then slow down gradually."],
    ["Drive your arms as hard as your legs.", "Rest fully: walk back and take 1-2 minutes."],
    ["New to sprinting? Run at 80% for the first week.", "Any hamstring tightness: stop for the day."],
  ),
  "Flying Sprint": g(
    "Sprint",
    "Whole body: top speed.",
    ["Mark a build-up zone and a fast zone with cones.", "Build up gradually through the build-up zone.", "Hit your fastest speed as you enter the fast zone and hold it.", "Stay tall and relaxed: loose face and shoulders."],
    ["Relaxed is fast: don't strain.", "Rest 3-4 minutes; every rep must be your fastest."],
    ["Use a longer build-up if you feel tight.", "Not before you've done a few weeks of acceleration work."],
  ),
  "Pro Agility Shuttle": g(
    "Agility",
    "Legs and hips: changing direction fast.",
    ["Place 3 cones in a line, 5 m apart. Start at the middle cone.", "Sprint 5 m to one side and touch the line.", "Turn and sprint 10 m to the far cone and touch the line.", "Turn and sprint 5 m back through the middle."],
    ["Stay low as you turn, plant your outside foot and push off hard.", "Alternate which way you go first."],
    ["Do it at half speed until the turns feel solid.", "Knee pain on the turns: slow down and tell your coach."],
  ),
  "Lateral Shuffle": g(
    "Agility",
    "Glutes, outer hips and quads: moving side to side.",
    ["Stand in an athletic stance: feet wide, knees bent, hips back, chest up.", "Push off the trailing leg and step sideways.", "Keep your feet from crossing or clicking together.", "Stay low the whole way."],
    ["Push, don't pull, with your legs.", "Keep your head level; don't bob up and down."],
    ["Go slower and shorter at first.", "Use a narrower stance if your groin feels tight."],
  ),
  "Crossover Run": g(
    "Agility",
    "Hips and legs: turning and running sideways fast.",
    ["Stand side-on in an athletic stance.", "Turn your hips and drive the back leg across in front of the other.", "Keep running sideways with crossover steps.", "Pump your arms and stay low."],
    ["Lead with the hips, the feet follow.", "Do both directions equally."],
    ["Walk it through first, then build speed.", "Shorter distances until you're comfortable."],
  ),
  "Ladder Quick Feet": g(
    "Agility",
    "Feet and ankles: quick, light footwork.",
    ["Lay out an agility ladder (or draw squares with chalk).", "Run through it with both feet landing in each square.", "Stay on the balls of your feet and pump your arms.", "Look ahead, not at your feet, once you know the pattern."],
    ["Fast, light and clean: don't hit the rungs.", "Speed up only when your feet stay clean."],
    ["Start slow until the pattern is easy.", "One foot in each square is easier."],
  ),
  Backpedal: g(
    "Agility",
    "Quads, calves and balance: moving backwards with control.",
    ["Stand in an athletic stance, weight over the balls of your feet.", "Push off and step backwards with short, quick steps.", "Keep your chest over your knees; don't lean back.", "Stop under control or turn and sprint when the drill says so."],
    ["Stay low with your knees bent.", "Pump your arms as you go."],
    ["Go slower until you feel balanced.", "Use a short distance at first."],
  ),

  // ---------------------------------------------------------------- Mobility
  "Ankle Knee-to-Wall Rock": g(
    "Mobility",
    "Calves and ankles: more bend in the ankle for squats, landing and sprinting.",
    ["Face a wall in a half-kneeling position, front foot a hand's width from the wall.", "Keep your heel down and rock your knee forward to touch the wall.", "Rock back and repeat.", "Move your foot further away as it gets easier."],
    ["The knee travels over your middle toes, not inwards.", "The heel must stay flat on the floor."],
    ["Start closer to the wall.", "Pinching at the front of the ankle? Make the movement smaller."],
  ),
  "90/90 Hip Switch": g(
    "Mobility",
    "Hips: turning in and out, which helps squats, kicks and changing direction.",
    ["Sit on the floor with both knees bent at 90 degrees, one leg in front, one out to the side.", "Sit tall and lift your knees to switch both legs to the other side.", "Settle into the new 90/90 position.", "Keep switching slowly side to side."],
    ["Sit tall with your chest up.", "As it gets easier, do it without hands on the floor."],
    ["Lean back on your hands to start.", "Knees sore? Make the angles wider and the move smaller."],
  ),
  "Hip CARs": g(
    "Mobility",
    "Hip joint: full, controlled range of motion.",
    ["Stand tall holding a wall or rail for balance.", "Lift one knee up in front of you.", "Slowly open it out to the side and around behind you, making the biggest circle you can.", "Bring it back down, then reverse the circle."],
    ["Keep the rest of your body still: only the hip moves.", "Go slowly; the slower, the better."],
    ["Do smaller circles at first.", "Do them on your hands and knees if balance is hard."],
  ),
  "Shoulder CARs": g(
    "Mobility",
    "Shoulder joint: full, controlled range of motion.",
    ["Stand tall and make a fist with one hand.", "Raise your straight arm forward and up overhead.", "Keep going behind you and down in the biggest slow circle you can.", "Reverse the circle."],
    ["Keep your body still and your ribs down; only the arm moves.", "Squeeze your fist and the muscles around the shoulder."],
    ["Make the circle smaller if anything pinches.", "Bend the elbow slightly if needed."],
  ),
  "Spiderman Lunge with Reach": g(
    "Mobility",
    "Hips, groin and upper back.",
    ["Start in a push-up position.", "Step your right foot to the outside of your right hand.", "Sink your hips, then reach your right arm up to the ceiling, turning your chest.", "Bring the hand back down, step back, and switch sides."],
    ["Keep the back leg straight and strong.", "Follow your hand with your eyes."],
    ["Drop the back knee to the floor.", "Skip the reach and just hold the lunge."],
  ),
  "Deep Squat Hold": g(
    "Mobility",
    "Hips, ankles, groin and lower back.",
    ["Stand with feet a bit wider than shoulder width, toes slightly out.", "Squat down as low as you can with heels flat.", "Press your elbows into your knees and keep your chest up.", "Relax and breathe in the bottom."],
    ["Shift gently side to side to open your hips.", "Get a little deeper each session."],
    ["Hold onto a pole or door frame.", "Put small plates under your heels if they lift."],
  ),
  "Leg Swings": g(
    "Mobility",
    "Hips, hamstrings and groin: a loose, swinging warm-up.",
    ["Hold a wall or rail and stand on one leg.", "Swing the other leg forward and back, getting higher as you go.", "Then face the wall and swing it side to side across your body.", "Switch legs."],
    ["Keep your body tall and the standing leg slightly bent.", "Controlled swings, not wild kicks."],
    ["Start with small swings.", "Groin feels tight? Keep the side swings smaller."],
  ),
  "Adductor Rock-Back": g(
    "Mobility",
    "Groin (inner thigh) and hips.",
    ["Kneel on all fours, then straighten one leg out to the side, foot flat.", "Keep your back flat.", "Rock your hips back towards your heels until you feel the inner thigh stretch.", "Rock forward and repeat, then switch sides."],
    ["Move slowly and go a little further each rep.", "Breathe out as you rock back."],
    ["Bend the straight leg a little.", "Put a cushion under your knee."],
  ),
  "Hip Airplane": g(
    "Mobility",
    "Glutes and hip control: balance and stable hips for running and cutting.",
    ["Stand on one leg and hinge forward until your body is level with the floor, other leg straight behind you.", "Slowly turn your hips and chest open towards the ceiling.", "Turn them back down towards the floor.", "Keep the standing knee soft and steady."],
    ["Slow and controlled; balance is part of it.", "The turning comes from the standing hip."],
    ["Hold a wall or rail for balance.", "Don't hinge as far forward."],
  ),
  "World's Greatest Stretch": g(
    "Mobility",
    "Hips, hamstrings, groin and upper back, all in one.",
    ["Step into a long lunge with your right foot forward.", "Put your left hand on the floor and drop your right elbow towards your right ankle.", "Rotate and reach your right arm up to the ceiling.", "Put your hand down, straighten your front leg to stretch the hamstring, then switch sides."],
    ["Breathe out into each position.", "Keep the back leg strong and straight."],
    ["Drop the back knee to the floor.", "Skip the elbow drop if your hips are tight."],
  ),
  "Cat-Cow": g(
    "Mobility",
    "Whole spine: neck to lower back.",
    ["Start on all fours: hands under shoulders, knees under hips.", "Breathe out and round your back up to the ceiling, chin to chest (cat).", "Breathe in and let your belly drop, chest forward and eyes up (cow).", "Move slowly between the two."],
    ["Move one bit of your spine at a time.", "Match the movement to slow breaths."],
    ["Make the movement smaller if your back is sore.", "Sore wrists? Do it on your fists or forearms."],
  ),
  "Thoracic Open Book": g(
    "Mobility",
    "Upper back and chest: turning through the spine.",
    ["Lie on your side with knees bent up to hip height and arms straight out in front, palms together.", "Keep your knees together and on the floor.", "Open your top arm up and over to the other side, following it with your eyes.", "Hold briefly, then close the book."],
    ["Let your upper back turn, not your hips.", "Breathe out as you open."],
    ["Put a pillow under your head.", "Don't force the arm to the floor."],
  ),
  "Thread the Needle": g(
    "Mobility",
    "Upper back and the back of the shoulders.",
    ["Start on all fours.", "Slide one arm under your body, palm up, lowering that shoulder to the floor.", "Reach the same arm back up to the ceiling, turning your chest open.", "Repeat, then switch sides."],
    ["Follow your hand with your eyes.", "Keep your hips over your knees."],
    ["Make the movement smaller.", "Put a cushion under your knees."],
  ),
  "Wall Slide": g(
    "Mobility",
    "Shoulders and upper back: reaching overhead with good posture.",
    ["Stand with your back, head and bottom against a wall, feet a little forward.", "Put your arms against the wall in a goal-post shape (elbows at 90 degrees).", "Slide your arms up the wall as high as you can, keeping them in contact.", "Slide them back down."],
    ["Keep your lower back close to the wall and ribs down.", "Go slowly and only as high as you can keep contact."],
    ["Stand a step away from the wall.", "Shoulder pinching: keep the slide lower."],
  ),
  "Band Shoulder Dislocate": g(
    "Mobility",
    "Shoulders and chest: overhead and behind-the-back range.",
    ["Hold a light band (or a towel) with a wide grip in front of your hips.", "Keep your arms straight and lift it up overhead.", "Keep going over and behind you as far as you comfortably can.", "Bring it back the same way."],
    ["Go slowly and keep your ribs down.", "Bring your hands closer together over the weeks."],
    ["Use a wider grip.", "Any pain in the shoulder: stop and tell your coach."],
  ),
  Inchworm: g(
    "Mobility",
    "Hamstrings, shoulders and core.",
    ["Stand tall, then bend down and put your hands on the floor (bend your knees if you need to).", "Walk your hands out into a push-up position.", "Walk your feet in towards your hands, keeping your legs as straight as you can.", "Stand up and repeat."],
    ["Keep your core tight in the push-up position.", "Take small steps with your feet."],
    ["Bend your knees more.", "Don't walk your hands out as far."],
  ),

  // ---------------------------------------------------------------- Stretches
  "Lying Hamstring Stretch": g(
    "Stretch",
    "Back of the thigh (hamstrings).",
    ["Lie on your back with a towel or strap around one foot.", "Keep the other leg flat on the floor.", "Pull the straight leg up until you feel a stretch behind the thigh.", "Hold, breathing slowly, then switch legs."],
    ["Keep your lower back flat on the floor.", "Breathe out and let the leg come a little closer."],
    [STOP_PAIN, "Bend the other knee with the foot flat if your back is sore."],
  ),
  "Half-Kneeling Hip Flexor Stretch": g(
    "Stretch",
    "Front of the hip and thigh: tight from sitting.",
    ["Kneel on one knee (on a cushion) with the other foot flat in front.", "Squeeze the glute of the kneeling leg and tuck your hips under.", "Shift your hips gently forward until you feel the front of the hip stretch.", "Hold, then switch sides."],
    ["Squeezing the glute makes the stretch work much better.", "Reach the same-side arm up to stretch further."],
    [STOP_PAIN, "Put a thick pad under the knee."],
  ),
  "Couch Stretch": g(
    "Stretch",
    "Front of the thigh and hip (quads and hip flexors).",
    ["Kneel with your back to a couch or wall.", "Put one shin up against it, knee on the floor (on a cushion).", "Step the other foot forward into a lunge.", "Lift your chest up tall and squeeze your glute. Hold, then switch."],
    ["Stay tall: the more upright, the bigger the stretch.", "Breathe slowly into it."],
    [STOP_PAIN, "Move your knee further from the wall to make it easier."],
  ),
  "Standing Quad Stretch": g(
    "Stretch",
    "Front of the thigh (quads).",
    ["Stand tall, holding a wall for balance.", "Bend one knee and hold your foot behind you.", "Pull your heel gently towards your bottom, knees together.", "Tuck your hips under. Hold, then switch."],
    ["Keep your knees side by side.", "Push your hips slightly forward for more stretch."],
    [STOP_PAIN, "Use a towel around your foot if you can't reach."],
  ),
  "Pigeon Stretch": g(
    "Stretch",
    "Glutes and outer hip.",
    ["From all fours, bring one knee forward behind your wrist, shin across your body.", "Slide the other leg straight back.", "Sit your hips down and walk your hands forward.", "Hold, breathing slowly, then switch sides."],
    ["Keep your hips square to the front.", "Lean forward over the front leg to stretch more."],
    [STOP_PAIN, "Knee pain? Do the figure-four glute stretch on your back instead."],
  ),
  "Figure-Four Glute Stretch": g(
    "Stretch",
    "Glutes and outer hip.",
    ["Lie on your back with both knees bent.", "Cross one ankle over the other knee.", "Hold behind the bottom thigh and pull it towards your chest.", "Hold, then switch sides."],
    ["Keep your head and shoulders relaxed on the floor.", "Push the crossed knee gently away to stretch more."],
    [STOP_PAIN, "Do it sitting in a chair if lying down is hard."],
  ),
  "Butterfly Stretch": g(
    "Stretch",
    "Inner thighs (groin) and hips.",
    ["Sit tall and put the soles of your feet together.", "Hold your feet and let your knees drop out to the sides.", "Lean forward from your hips with a straight back.", "Hold and breathe."],
    ["Bring your feet closer to you for more stretch.", "Press your knees down gently with your elbows."],
    [STOP_PAIN, "Sit on a folded towel if your back rounds."],
  ),
  "Frog Stretch": g(
    "Stretch",
    "Inner thighs (groin): deep hip range.",
    ["Kneel on all fours on a soft surface.", "Slide your knees out wide with your feet out to the sides, in line with your knees.", "Lower onto your forearms and push your hips back gently.", "Hold and breathe."],
    ["Rock gently back and forth to ease into it.", "Keep your back flat."],
    [STOP_PAIN, "Put cushions under your knees and don't go as wide."],
  ),
  "Seated Forward Fold": g(
    "Stretch",
    "Hamstrings, calves and lower back.",
    ["Sit with your legs straight out in front.", "Sit tall, then hinge forward from your hips.", "Reach towards your feet, keeping your back as long as you can.", "Hold and breathe."],
    ["Lead with your chest, not your head.", "Pull your toes back towards you to stretch the calves too."],
    [STOP_PAIN, "Bend your knees a little, or use a towel around your feet."],
  ),
  "Straddle Stretch": g(
    "Stretch",
    "Inner thighs and hamstrings: side-split range.",
    ["Sit with your legs straight and as wide as is comfortable.", "Sit tall with your toes pointing up.", "Walk your hands forward and lean from your hips.", "Hold and breathe."],
    ["Keep your back long and your knees facing up.", "Lean over one leg, then the other, for variety."],
    [STOP_PAIN, "Sit on a folded towel and keep your legs a little narrower."],
  ),
  "Wall Calf Stretch": g(
    "Stretch",
    "Calves and Achilles.",
    ["Stand facing a wall with your hands on it.", "Step one foot back, keeping the heel flat and leg straight.", "Lean into the wall until you feel the calf stretch.", "Hold, then bend the back knee slightly to stretch lower down. Switch legs."],
    ["Point your back toes straight forward.", "Keep the back heel on the floor."],
    [STOP_PAIN, "Take a shorter step back."],
  ),
  "Half Split Stretch": g(
    "Stretch",
    "Hamstrings and calves: front-split range.",
    ["Kneel on one knee and straighten the other leg in front, heel on the floor.", "Sit your hips back towards your back heel.", "Lean forward from the hips with a straight back.", "Hold, then switch."],
    ["Pull your front toes back towards you.", "Keep your back long rather than reaching with your hands."],
    [STOP_PAIN, "Put blocks or books under your hands."],
  ),
  "Doorway Chest Stretch": g(
    "Stretch",
    "Chest and front of the shoulders.",
    ["Stand in a doorway and put your forearm on the frame, elbow at shoulder height.", "Step forward with the same-side foot.", "Turn your body gently away until you feel the chest stretch.", "Hold, then switch sides."],
    ["Keep your shoulder down, away from your ear.", "Try the elbow a bit higher or lower to stretch different parts."],
    [STOP_PAIN, "Any tingling in the arm: ease off and stretch lower."],
  ),
  "Child's Pose Lat Stretch": g(
    "Stretch",
    "Lats (the sides of your back) and shoulders.",
    ["Kneel and sit your hips back towards your heels.", "Reach both arms forward on the floor.", "Walk both hands over to one side until you feel the opposite side stretch.", "Hold, then walk your hands to the other side."],
    ["Press your hips back and down.", "Breathe into the side of your ribs."],
    [STOP_PAIN, "Put a cushion between your hips and heels."],
  ),
  "Cross-Body Shoulder Stretch": g(
    "Stretch",
    "Back of the shoulder.",
    ["Bring one straight arm across your chest.", "Hold it above the elbow with your other hand.", "Pull it gently closer to your chest.", "Hold, then switch."],
    ["Keep your shoulder down and relaxed.", "Turn your head away slightly for a bit more."],
    [STOP_PAIN, "Hold lower on the arm if anything pinches."],
  ),
  "Overhead Triceps Stretch": g(
    "Stretch",
    "Triceps and lats.",
    ["Reach one arm up overhead and bend the elbow so your hand drops behind your head.", "Hold the elbow with your other hand.", "Gently pull the elbow back and towards your head.", "Hold, then switch."],
    ["Stand tall and keep your ribs down.", "Lean a little to the side to stretch the lats too."],
    [STOP_PAIN, "Use a towel between your hands if your shoulder is tight."],
  ),
  "Cobra Stretch": g(
    "Stretch",
    "Stomach, hip flexors and the front of the spine.",
    ["Lie face down with your hands under your shoulders.", "Push your chest up, keeping your hips on the floor.", "Straighten your arms only as far as is comfortable.", "Hold and breathe, then lower slowly."],
    ["Keep your shoulders down away from your ears.", "Relax your bottom and legs."],
    [STOP_PAIN, "Stay on your forearms (sphinx) if your back is sore."],
  ),
  "Lying Spinal Twist": g(
    "Stretch",
    "Lower back, glutes and chest.",
    ["Lie on your back with your arms out to the sides.", "Bend one knee and let it drop across your body to the floor.", "Turn your head the other way.", "Hold, then switch sides."],
    ["Keep both shoulders on the floor.", "Breathe out and let the knee sink lower."],
    [STOP_PAIN, "Put a pillow under the knee."],
  ),
  "Neck Side Stretch": g(
    "Stretch",
    "Side of the neck and upper traps.",
    ["Sit or stand tall.", "Drop one shoulder down and tilt your head the other way, ear towards shoulder.", "Rest the hand on that side gently on your head for a little more stretch.", "Hold, then switch."],
    ["Keep your shoulders down and relaxed.", "Never pull hard on your head."],
    [STOP_PAIN, "Any tingling or dizziness: stop and tell your coach."],
  ),
};

// Search terms for names that alone find the wrong videos or too few
// (checked 2026-10-14). Every other move searches by its name.
export const SPORTS_SEARCH: Record<string, string> = {
  "Single-Leg Hop": "single leg hop plyometric",
  "A-Skip": "a skip sprint drill",
  "B-Skip": "b skip sprint drill",
  "High Knees": "high knees drill",
  "Wall Drive Drill": "wall drive sprint drill",
  "Acceleration Sprint": "sprint acceleration drill",
  "Pro Agility Shuttle": "5 10 5 pro agility drill",
  "Lateral Shuffle": "lateral shuffle drill",
  "Crossover Run": "crossover run speed drill",
  "Ladder Quick Feet": "agility ladder quick feet",
  "Ankle Knee-to-Wall Rock": "knee to wall ankle mobility",
  "Hip CARs": "hip CARs mobility",
  "Shoulder CARs": "shoulder CARs mobility",
  "Leg Swings": "leg swings warm up",
  "Cat-Cow": "cat cow stretch",
  "Thread the Needle": "thread the needle stretch",
  "Wall Slide": "wall slide shoulder mobility",
  "Band Shoulder Dislocate": "band shoulder pass through",
};

/** A short YouTube search for examples of a move with no demo video. */
export function watchOnlineUrl(name: string): string {
  return youtubeSearchUrl(SPORTS_SEARCH[name] ?? name);
}
