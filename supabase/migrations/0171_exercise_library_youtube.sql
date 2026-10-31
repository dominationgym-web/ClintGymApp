-- A much bigger exercise library (GRIZZ, 2026-10-31): "a lot of exercises
-- are not in our exercise library ... they all have different names, so we
-- can't find them", and a picture of each move for clients who don't know
-- the names.
--
-- 1. source 'youtube': external_url is a YouTube watch link to a good-form
--    demo rather than a clip file. The app shows the video's thumbnail and
--    opens YouTube when tapped (it can't play YouTube in its own player).
-- 2. aka: other names the same move goes by (pec deck = butterfly machine).
--    Search looks at them, so a trainer or client finds it by any name.
-- 3. 59 common exercises that weren't in the library, each with a video
--    checked to work. Only added when no exercise of that name exists.

alter table public.exercises drop constraint exercises_source_check;
alter table public.exercises add constraint exercises_source_check
  check (source in ('movekit', 'muscle_and_motion', 'own_library', 'youtube'));

alter table public.exercises add column if not exists aka text[] not null default '{}';

-- New exercises. Each goes after the last one in its body part.
insert into public.exercises (name, category, source, external_url, home_friendly, aka, sort_order)
select v.name, v.category, 'youtube', 'https://www.youtube.com/watch?v=' || v.video, v.home, v.aka,
       coalesce((select max(e.sort_order) from public.exercises e where e.category = v.category), 0) + v.n
from (values
  -- Core
  ('Crunch', 'Core', 'GWIEON0VSaY', true, array['ab crunch', 'crunches', 'floor crunch'], 1),
  ('Bicycle Crunch', 'Core', '1we3bh9uhqY', true, array['bicycle kicks', 'elbow to knee crunch', 'bicycles'], 2),
  ('Reverse Crunch', 'Core', 'nYcE7-Dhpzk', true, array['lying knee tuck', 'hip raise crunch'], 3),
  ('Lying Leg Raise', 'Core', 'sY2ZgV2Sj_s', true, array['leg lifts', 'floor leg raise', 'lower ab raise'], 4),
  ('Hanging Leg Raise', 'Core', 'fLbZrF6MZuE', false, array['hanging straight leg raise', 'bar leg raise'], 5),
  ('Ab Wheel Rollout', 'Core', 'nCh8VfWY5_g', true, array['ab roller', 'ab wheel', 'rollout'], 6),
  ('Flutter Kicks', 'Core', '6D23AyECRGQ', true, array['scissor kicks', 'leg flutters'], 7),
  ('Hollow Body Hold', 'Core', '0yPin8hSc8o', true, array['hollow hold', 'dish hold', 'banana hold'], 8),
  ('Side Plank Hip Dip', 'Core', 'V4A0wIh5HNk', true, array['side plank hip lift', 'side plank dips'], 9),
  ('Plank Shoulder Tap', 'Core', 'l2KsRCiDsts', true, array['shoulder taps', 'high plank tap'], 10),
  ('Heel Touches', 'Core', 'RzaD0I3yeKY', true, array['alternating heel touch', 'heel taps', 'oblique reach'], 11),
  ('Bear Crawl', 'Core', 'Gb2e9edK8a4', true, array['bear walk', 'crawl'], 12),
  ('Landmine 180', 'Core', 'YC7poHGaVFE', false, array['landmine twist', 'landmine rotation', 'rainbow'], 13),
  ('Sit-Up', 'Core', 'fTxaDVXhMnw', true, array['situp', 'sit ups', 'full sit-up'], 14),
  ('Machine Torso Rotation', 'Core', '97boSjZ0erk', false, array['rotary torso', 'torso twist machine', 'oblique machine'], 15),
  ('Waiter''s Carry', 'Core', 'BOiPn_WHytg', true, array['overhead carry', 'waiter walk', 'single-arm overhead carry'], 16),
  -- Adductors
  ('Copenhagen Plank', 'Adductors', 'YRRnnZsRs9U', true, array['copenhagen side plank', 'copenhagen adduction', 'adductor plank'], 1),
  ('Cable Hip Adduction', 'Adductors', 'P1pLE1jmnI0', false, array['standing cable adduction', 'inner thigh cable'], 2),
  ('Side-Lying Hip Adduction', 'Adductors', 'lhwT35sshrI', true, array['inner thigh lift', 'lying adduction'], 3),
  -- Push
  ('Dumbbell Pullover', 'Push', 'tcHaHIQStsk', true, array['db pullover', 'lying pullover'], 1),
  ('Svend Press', 'Push', 'cIoUZOnypS8', true, array['plate squeeze press', 'plate press', 'plate pinch press'], 2),
  ('Archer Push-Up', 'Push', 'jiA3RnMxFU0', true, array['archer press-up', 'side to side push-up'], 3),
  -- Shoulders
  ('Pike Push-Up', 'Shoulders', 'pHR5yG6xBps', true, array['pike press', 'pike press-up'], 1),
  ('Seated Dumbbell Lateral Raise', 'Shoulders', 'yKAxVcU3nfw', true, array['seated side raise', 'seated lateral raise'], 2),
  ('Cable Y-Raise', 'Shoulders', 'NBkMIWWkIKQ', false, array['cable y raise', 'cross cable y raise'], 3),
  ('Lu Raise', 'Shoulders', 'r2yP7tcUz1s', true, array['lu xiaojun raise', 'overhead lateral raise', 'full range lateral raise'], 4),
  ('Cable Rear Delt Fly', 'Shoulders', 'lq9K3lnHWKk', false, array['cable reverse fly', 'cross cable rear delt fly', 'cable rear delt raise'], 5),
  ('Band Pull-Apart', 'Shoulders', 'smSSXITNpCI', true, array['pull aparts', 'band pull apart'], 6),
  ('Prone Y-T-W Raise', 'Shoulders', 'egcK49J5Q-Y', true, array['ytw', 'y t w raise', 'i y t w', 'prone y raise'], 7),
  ('Kettlebell Halo', 'Shoulders', 'LEjVh4scVy4', true, array['kb halo', 'halo'], 8),
  -- Pull
  ('Renegade Row', 'Pull', 'GxABNbLsSCg', true, array['plank row', 'dumbbell plank row'], 1),
  ('Scapular Pull-Up', 'Pull', '-ZIpSoTRsuE', false, array['scap pull-up', 'scap pulls', 'shoulder blade pull-up'], 2),
  -- Posterior Chain
  ('Barbell Sumo Deadlift', 'Posterior Chain', 'JbY72Him34Q', true, array['sumo deadlift', 'wide stance deadlift'], 1),
  ('Kettlebell Deadlift', 'Posterior Chain', 'sDbMsk3d6F4', true, array['kb deadlift'], 2),
  -- Hamstrings
  ('Glute-Ham Raise', 'Hamstrings', 'RtwVVDS3vAM', false, array['ghr', 'glute ham raise', 'glute ham developer'], 1),
  -- Legs
  ('Barbell Box Squat', 'Legs', 'u87j5n6ClC8', true, array['box squat'], 1),
  ('Overhead Squat', 'Legs', 'BYi-TBOtNTo', true, array['barbell overhead squat', 'ohs'], 2),
  ('Pistol Squat', 'Legs', 'T74bU2vNWG4', true, array['single-leg squat', 'one leg squat', 'pistol'], 3),
  ('Skater Squat', 'Legs', 'sShokB1TxjQ', true, array['single-leg skater squat'], 4),
  ('Landmine Squat', 'Legs', 'X0lRwV368HI', false, array['landmine goblet squat', 'landmine front squat'], 5),
  -- Quads
  ('Reverse Nordic', 'Quads', 'XHCz7nkfap4', true, array['reverse nordic curl', 'kneeling quad lean back'], 1),
  ('Spanish Squat', 'Quads', '3igyh6eqGvc', true, array['banded spanish squat', 'band knee squat'], 2),
  ('Heels-Elevated Goblet Squat', 'Quads', 'RUXLuZ_GLrE', true, array['cyclist squat', 'heel elevated squat', 'heels up squat'], 3),
  -- Glutes
  ('Clamshell', 'Glutes', '_dMOwuSt8O4', true, array['clams', 'clam shell', 'banded clamshell'], 1),
  ('Fire Hydrant', 'Glutes', 'KOMtxRvGACA', true, array['hip abduction on all fours', 'fire hydrants'], 2),
  ('Donkey Kick', 'Glutes', 'vElEKAdulIE', true, array['quadruped kickback', 'donkey kicks', 'glute kickback on all fours'], 3),
  ('Lateral Band Walk', 'Glutes', 'y_bqFDQZSHQ', true, array['band side walk', 'monster walk', 'crab walk'], 4),
  -- Biceps
  ('21s Curl', 'Biceps', '8YzaAwkjrM4', true, array['21s', 'twenty-ones', '21 curls'], 1),
  -- Triceps
  ('Dumbbell Skull Crusher', 'Triceps', 'uXOm7MpK4HQ', true, array['dumbbell lying triceps extension', 'db skull crusher'], 1),
  ('Triceps Dip', 'Triceps', 'J3WYrjNDLI4', false, array['parallel bar dip', 'bar dips', 'tricep dips'], 2),
  -- Full Body
  ('Kettlebell Clean', 'Full Body', 'rndZDA3vUnU', true, array['kb clean'], 1),
  ('Kettlebell Snatch', 'Full Body', 'NRHNSQWabYg', true, array['kb snatch'], 2),
  ('Dumbbell Snatch', 'Full Body', 'nGuu6GjT1QI', true, array['single-arm dumbbell snatch', 'db snatch'], 3),
  ('Clean and Jerk', 'Full Body', 'cnmHXtRH_Bk', true, array['barbell clean and jerk', 'c&j'], 4),
  ('Tire Flip', 'Full Body', '4gTIr19XCDQ', false, array['tyre flip', 'tire flips'], 5),
  -- Plyometrics
  ('Clap Push-Up', 'Plyometrics', 'MH4gcTKQiEc', true, array['plyometric push-up', 'plyo push-up', 'explosive push-up'], 1),
  ('Skater Jumps', 'Plyometrics', '9_jLW6VkU8A', true, array['speed skaters', 'skater hops', 'lateral skaters'], 2),
  ('Jumping Lunge', 'Plyometrics', 'Nnb9bXV3o0s', true, array['jump lunge', 'split jump', 'switch lunge'], 3),
  -- Speed & Agility
  ('Butt Kicks', 'Speed & Agility', 'oMW59TKZvaI', true, array['butt kickers', 'heel flicks'], 1)
) as v(name, category, video, home, aka, n)
where not exists (select 1 from public.exercises e where lower(e.name) = lower(v.name));

-- Other names for exercises already in the library.
update public.exercises e set aka = v.aka
from (values
  ('Machine Pec Fly', array['pec deck', 'butterfly machine', 'chest fly machine']),
  ('Reverse Pec Deck', array['rear delt machine', 'reverse fly machine']),
  ('Cable Fly', array['cable crossover', 'cable chest fly']),
  ('Cable High-to-Low Fly', array['high cable crossover', 'decline cable fly']),
  ('Cable Low-to-High Fly', array['low cable crossover', 'incline cable fly']),
  ('Bench Press', array['barbell bench press', 'flat bench', 'chest press']),
  ('Flat Dumbbell Press', array['dumbbell bench press', 'db bench press', 'dumbbell chest press']),
  ('Incline Barbell Press', array['incline bench press']),
  ('Incline Dumbbell Press', array['incline db press', 'incline dumbbell bench press']),
  ('Machine Chest Press', array['seated chest press', 'chest press machine']),
  ('Chest Dip', array['dips', 'parallel bar dip']),
  ('Machine Dip', array['assisted dip', 'seated dip machine']),
  ('Bench Dip', array['chair dip', 'triceps bench dip']),
  ('Diamond Push-Up', array['close-grip push-up', 'triangle push-up']),
  ('Push-Up', array['press-up', 'pushup']),
  ('Bodyweight Knee Push-Up', array['knee push-up', 'kneeling push-up']),
  ('Machine Assisted Pull-Up', array['assisted pull-up machine', 'gravitron']),
  ('Lat Pulldown', array['lat pull down', 'pulldown']),
  ('Seated Cable Row', array['cable row', 'low row']),
  ('Straight-Arm Pulldown', array['lat prayer', 'straight-arm cable pulldown']),
  ('Inverted Row', array['australian pull-up', 'body row', 'trx row']),
  ('Dumbbell Single-Arm Row', array['one-arm dumbbell row', 'kroc row']),
  ('Bent-Over Barbell Row', array['barbell row', 'bent over row']),
  ('Chest-Supported Row', array['incline dumbbell row', 'prone row']),
  ('Landmine T-Bar Row', array['t-bar row', 't bar row']),
  ('Barbell Overhead Press', array['military press', 'ohp', 'shoulder press', 'standing press']),
  ('Dumbbell Seated Overhead Press', array['seated dumbbell shoulder press']),
  ('Machine Front Military Press', array['machine shoulder press', 'shoulder press machine']),
  ('Dumbbell Lateral Raise', array['side raise', 'side lateral raise', 'lateral raises']),
  ('Dumbbell Rear-Delt Fly', array['bent-over lateral raise', 'rear delt raise', 'reverse fly']),
  ('Cable Rope Kneeling Face Pull', array['face pull', 'rope face pull']),
  ('Cable Seated Rope Face Pull', array['face pull', 'rope face pull']),
  ('Barbell Shrug', array['shrugs']),
  ('Barbell Back Squat', array['back squat', 'squat', 'barbell squat']),
  ('Leg Press', array['leg press machine', '45 degree leg press']),
  ('Hack Squat', array['hack squat machine']),
  ('Bulgarian Split Squat', array['rear foot elevated split squat', 'rfess']),
  ('Walking Lunge', array['lunges', 'walking lunges']),
  ('Step-Up', array['box step-up', 'dumbbell step-up']),
  ('Goblet Squat', array['dumbbell goblet squat']),
  ('Leg Extension', array['quad extension', 'knee extension machine']),
  ('Lying Leg Curl', array['prone leg curl', 'hamstring curl machine']),
  ('Seated Leg Curl', array['seated hamstring curl']),
  ('Hip Thrust', array['barbell hip thrust', 'glute thrust']),
  ('Glute Bridge', array['bridge', 'hip bridge']),
  ('Hip Abduction', array['abductor machine', 'outer thigh machine']),
  ('Hip Adduction', array['adductor machine', 'inner thigh machine']),
  ('Cable Kickback', array['glute kickback', 'cable glute kickback']),
  ('Romanian Deadlift', array['rdl', 'barbell rdl']),
  ('Dumbbell Romanian Deadlift', array['dumbbell rdl', 'db rdl']),
  ('Single-Leg Romanian Deadlift', array['single leg rdl', 'one leg deadlift']),
  ('Conventional Deadlift', array['deadlift', 'barbell deadlift']),
  ('Trap Bar Deadlift', array['hex bar deadlift']),
  ('Back Extension', array['hyperextension', 'back hyper', 'roman chair']),
  ('Reverse Hyperextension', array['reverse hyper']),
  ('Good Morning', array['barbell good morning']),
  ('Nordic Hamstring Curl', array['nordic curl', 'nordics']),
  ('Standing Calf Raise', array['calf raises', 'standing calf machine']),
  ('Seated Calf Raise', array['seated calf machine']),
  ('Horizontal Leg Press Calf Press', array['leg press calf raise']),
  ('Barbell Curl', array['bicep curl', 'biceps curl', 'barbell bicep curl']),
  ('Dumbbell Curl', array['bicep curl', 'dumbbell bicep curl']),
  ('Hammer Curl', array['neutral grip curl']),
  ('EZ-Bar Preacher Curl', array['preacher curl', 'scott curl']),
  ('Spider Curl', array['prone incline curl']),
  ('Cable Rope Pushdown', array['rope pushdown', 'tricep pushdown', 'triceps rope extension']),
  ('Cable Bar Pushdown', array['tricep pushdown', 'straight bar pushdown']),
  ('Skull Crusher', array['lying triceps extension', 'ez-bar skull crusher', 'french press']),
  ('Overhead Dumbbell Extension', array['french press', 'overhead tricep extension', 'seated triceps extension']),
  ('Overhead Cable Extension', array['rope overhead extension', 'overhead tricep rope']),
  ('Tricep Kickback', array['dumbbell kickback', 'triceps kickback']),
  ('Close-Grip Bench Press', array['cgbp', 'narrow grip bench']),
  ('Kneeling Cable Crunch', array['cable crunch', 'rope crunch']),
  ('Machine Crunch', array['ab crunch machine']),
  ('Captain''s Chair Knee Raise', array['roman chair knee raise', 'vertical knee raise']),
  ('Hanging Knee Raise', array['hanging knee tuck']),
  ('Hand Plank', array['high plank', 'straight-arm plank']),
  ('Plank', array['forearm plank', 'elbow plank']),
  ('Elbow Side Plank', array['side plank']),
  ('Bodyweight Russian Twist', array['russian twist', 'seated twist']),
  ('Cable Wood Chopper', array['woodchop', 'cable chop']),
  ('Pallof Press', array['anti-rotation press']),
  ('Dumbbell Farmer''s Carry', array['farmer''s walk', 'farmers carry']),
  ('Kettlebell Swing', array['kb swing', 'russian swing']),
  ('Kettlebell Turkish Get-Up', array['tgu', 'turkish get up']),
  ('Jumping Jack', array['star jumps']),
  ('Jump Rope', array['skipping', 'skipping rope']),
  ('Assault Bike', array['air bike', 'airdyne', 'fan bike']),
  ('Rowing Machine Steady State', array['rower', 'erg', 'rowing']),
  ('Elliptical', array['cross trainer']),
  ('Stair Climber', array['stairmaster', 'step mill']),
  ('Indoor Cycling Spin', array['spinning', 'stationary bike']),
  ('Sled Push', array['prowler push']),
  ('Barbell Upright Row', array['upright row']),
  ('Barbell Thruster', array['thruster']),
  ('Power Clean', array['clean']),
  ('Wall Sit', array['wall squat']),
  ('Bodyweight Squat', array['air squat']),
  ('Superman', array['prone superman', 'floor back extension']),
  ('Dead Hang', array['bar hang']),
  ('Cat-Cow', array['cat camel']),
  ('Child''s Pose Lat Stretch', array['child''s pose']),
  ('Pigeon Stretch', array['pigeon pose']),
  ('Cobra Stretch', array['cobra pose']),
  ('Couch Stretch', array['kneeling quad stretch']),
  ('Medicine Ball Slam', array['ball slam', 'slam ball']),
  ('Jump Squat', array['squat jump']),
  ('Smith Machine Squat', array['smith squat']),
  ('Pendulum Squat (V-Squat)', array['v squat']),
  ('Cable Pull Through', array['pull through']),
  ('Seal Row', array['bench row']),
  ('Hip CARs', array['hip circles']),
  ('Wrist Roller', array['forearm roller'])
) as v(name, aka)
where e.name = v.name;
