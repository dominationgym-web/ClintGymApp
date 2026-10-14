-- Sports Performance (GRIZZ, 2026-10-14): 15 short programs of 6-8 weeks,
-- three each for Explosive Power, Speed, Sports Strength, Mobility and
-- Flexibility. Grouped under their own headings in the program pickers
-- (programFamily in src/lib/programs.ts) and described on the client's
-- Sports Performance menu page (src/lib/sportsPerformance.ts).
--
-- Written from the athletic development research: power comes from moving
-- moderate loads fast plus jumps and throws, done fresh with full rest, and
-- contrast pairs (a heavy lift straight into a jump) for trained athletes;
-- acceleration and top speed improve only from short, all-out sprints with
-- long rests, backed by hip, hamstring (Nordic curls) and calf strength;
-- agility needs low, controlled cutting and single-leg strength; strength
-- for sport is 2-3 full-body sessions a week with sets of 3-8 a rep or two
-- short of failure; mobility is controlled active range; flexibility gains
-- come from regular 30-60 sec static holds and contract-relax (PNF)
-- stretching, done warm.
--
-- Weeks (days 1-7 = Mon-Sun; training Mon, Wed, Fri): 6-week programs run
-- phase 1 in weeks 1-3 and phase 2 in weeks 4-6; 8-week programs run phase 1
-- in weeks 1-3, an easy week 4 (half the sets), phase 2 in weeks 5-7 and a
-- test week 8 (half the sets). Rows marked to grow gain a set in the 2nd and
-- 3rd week of a phase, up to 6 sets.
--
-- Most speed, plyometric, mobility and stretching moves aren't in the
-- MoveKit library, so they're added as library exercises with no video
-- (source own_library); the app shows written steps and a link to watch an
-- example online until GRIZZ uploads a clip. Mobility and flexibility
-- programs are added for both gym and home clients.
--
-- Only inserts what isn't there yet; nothing is removed.
insert into public.exercises (name, category, source, external_url, sort_order, home_friendly)
select v.name, v.category, 'own_library', null, 0, v.home_friendly
from (values
  ('Broad Jump', 'Plyometrics', true),
  ('Pogo Hops', 'Plyometrics', true),
  ('Lateral Bound', 'Plyometrics', true),
  ('Single-Leg Hop', 'Plyometrics', true),
  ('Depth Jump', 'Plyometrics', false),
  ('Tuck Jump', 'Plyometrics', true),
  ('Bounding', 'Plyometrics', false),
  ('Medicine Ball Chest Pass', 'Plyometrics', false),
  ('Medicine Ball Rotational Throw', 'Plyometrics', false),
  ('Medicine Ball Slam', 'Plyometrics', false),
  ('Medicine Ball Scoop Toss', 'Plyometrics', false),
  ('A-Skip', 'Speed & Agility', false),
  ('B-Skip', 'Speed & Agility', false),
  ('High Knees', 'Speed & Agility', true),
  ('Wall Drive Drill', 'Speed & Agility', true),
  ('Falling Start Sprint', 'Speed & Agility', false),
  ('Acceleration Sprint', 'Speed & Agility', false),
  ('Flying Sprint', 'Speed & Agility', false),
  ('Pro Agility Shuttle', 'Speed & Agility', false),
  ('Lateral Shuffle', 'Speed & Agility', false),
  ('Crossover Run', 'Speed & Agility', false),
  ('Ladder Quick Feet', 'Speed & Agility', false),
  ('Backpedal', 'Speed & Agility', false),
  ('Ankle Knee-to-Wall Rock', 'Mobility', true),
  ('90/90 Hip Switch', 'Mobility', true),
  ('Hip CARs', 'Mobility', true),
  ('Shoulder CARs', 'Mobility', true),
  ('Spiderman Lunge with Reach', 'Mobility', true),
  ('Deep Squat Hold', 'Mobility', true),
  ('Leg Swings', 'Mobility', true),
  ('Adductor Rock-Back', 'Mobility', true),
  ('Hip Airplane', 'Mobility', true),
  ('World''s Greatest Stretch', 'Mobility', true),
  ('Cat-Cow', 'Mobility', true),
  ('Thoracic Open Book', 'Mobility', true),
  ('Thread the Needle', 'Mobility', true),
  ('Wall Slide', 'Mobility', true),
  ('Band Shoulder Dislocate', 'Mobility', true),
  ('Inchworm', 'Mobility', true),
  ('Lying Hamstring Stretch', 'Flexibility', true),
  ('Half-Kneeling Hip Flexor Stretch', 'Flexibility', true),
  ('Couch Stretch', 'Flexibility', true),
  ('Standing Quad Stretch', 'Flexibility', true),
  ('Pigeon Stretch', 'Flexibility', true),
  ('Figure-Four Glute Stretch', 'Flexibility', true),
  ('Butterfly Stretch', 'Flexibility', true),
  ('Frog Stretch', 'Flexibility', true),
  ('Seated Forward Fold', 'Flexibility', true),
  ('Straddle Stretch', 'Flexibility', true),
  ('Wall Calf Stretch', 'Flexibility', true),
  ('Half Split Stretch', 'Flexibility', true),
  ('Doorway Chest Stretch', 'Flexibility', true),
  ('Child''s Pose Lat Stretch', 'Flexibility', true),
  ('Cross-Body Shoulder Stretch', 'Flexibility', true),
  ('Overhead Triceps Stretch', 'Flexibility', true),
  ('Cobra Stretch', 'Flexibility', true),
  ('Lying Spinal Twist', 'Flexibility', true),
  ('Neck Side Stretch', 'Flexibility', true)
) as v(name, category, home_friendly)
where not exists (select 1 from public.exercises e where e.name = v.name);

create or replace function pg_temp.add_sports_program(p_name text, p_place text, p_weeks int, p_description text, p_nutrition text, p_warm_up text, p_titles jsonb, p_rest text, p_tpl jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
  titles text[] := '{}';
  w int;
  dd int;
  ph text;
  wp int;
  half boolean;
  tag text;
  d text;
  r jsonb;
  i int;
  n int;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name and place = p_place) then
    return;
  end if;
  for w in 1..p_weeks loop
    tag := case when p_weeks = 8 and w = 4 then ' (easy week)' when p_weeks = 8 and w = 8 then ' (test week)' else '' end;
    for dd in 1..7 loop
      titles := titles || coalesce((p_titles ->> dd::text) || tag, p_rest);
    end loop;
  end loop;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, nutrition, warm_up, day_titles)
  values (null, p_name, 'weekly', p_place, p_weeks, p_description, p_nutrition, p_warm_up, titles)
  returning id into prog;
  for w in 1..p_weeks loop
    if p_weeks = 8 then
      ph := case when w <= 4 then 'p1' else 'p2' end;
      half := w in (4, 8);
      wp := case when w <= 3 then w when w between 5 and 7 then w - 4 else 1 end;
    else
      ph := case when w <= 3 then 'p1' else 'p2' end;
      half := false;
      wp := case when w <= 3 then w else w - 3 end;
    end if;
    for d in select jsonb_object_keys(p_tpl -> ph) loop
      i := 0;
      for r in select * from jsonb_array_elements(p_tpl -> ph -> d) loop
        i := i + 1;
        n := (r->>1)::int;
        n := case when half then greatest(1, ceil(n / 2.0)::int) when (r->>4)::boolean then greatest(n, least(6, n + wp - 1)) else n end;
        insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
        values (prog, w, d::smallint, i,
          (select e.id from public.exercises e where e.name = r->>0 order by e.sort_order limit 1),
          r->>0, n, r->>2, (r->>3)::smallint, 'exercise');
      end loop;
    end loop;
  end loop;
  if exists (select 1 from public.program_exercises pe where pe.program_id = prog and pe.exercise_id is null) then
    raise exception 'an exercise in % is not in the library', p_name;
  end if;
end $f$;

do $$
declare
  power_nutrition text := 'Power and speed work needs fuel and fresh legs. Eat protein at every meal (about 1.6-2.2 g per kg of bodyweight a day) and have carbs before and after training (rice, potatoes, fruit, pap, bread) so you can move fast. Eat a proper meal 2-3 hours before a session and another within 2 hours after. Drink 35 ml of water per kg a day plus extra on training days. Creatine monohydrate 3-5 g a day is safe and helps short, explosive efforts. Sleep 8-9 hours: speed and power are the first things to suffer when you''re tired.';
  strength_nutrition text := 'Strength needs food. Eat protein at every meal (1.6-2.2 g per kg of bodyweight a day), carbs around training for energy, and enough overall to recover: if you''re losing weight and your lifts are stalling, eat a little more. Eat a proper meal 2-3 hours before training and another within 2 hours after. Drink 35 ml of water per kg a day plus extra on training days. Creatine monohydrate 3-5 g a day is safe and well proven for strength. Sleep 8-9 hours.';
  move_nutrition text := 'No special diet is needed for mobility and flexibility work, but well-hydrated muscles stretch better: drink 35 ml of water per kg of bodyweight a day. Eating enough protein (about 1.6 g per kg a day) and getting 7-9 hours of sleep helps your muscles and joints recover so they move better.';
  power_warm text := 'RAMP warm-up, 10 minutes, never jump cold: 3 minutes easy bike, rower or skipping; then leg swings, hip circles, world''s greatest stretch and arm circles; then 2 x 20 m A-skips and 3 easy practice jumps at half effort. Before the first lift, do 2-3 lighter ramp-up sets. Do the jumps and throws first while you''re fresh, and rest fully between sets: power is about quality, not tiredness.';
  speed_warm text := 'Never sprint cold. 12-15 minutes on grass, a track or a flat field: jog 400 m easy; then leg swings, walking lunges, high-knee walks and arm swings; then 2 x 20 m A-skips; then 3 build-up runs of 30 m at about 60%, 75% and 90%. Wear proper running shoes. Rest fully between sprints (walk back slowly): speed only improves when every rep is fast.';
  strength_warm text := '10 minutes: 5 minutes easy bike or rower; then leg swings, hip circles, world''s greatest stretch, band pull-aparts and 10 bodyweight squats. Before each main lift, do 2-3 lighter ramp-up sets (about 40%, 60% and 80% of your working weight) for fewer reps.';
  move_warm text := 'Warm up first, never stretch cold: 3-5 minutes of easy movement (marching on the spot, arm circles, easy bike or a brisk walk). Move slowly and breathe out as you go into each position. Work to a mild stretch you can breathe through, never pain. This session also works well straight after a training session or in the evening.';
  place text;
begin
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Explosive Power 1 – Jump & Throw Basics', place, 6,
      'For anyone new to jump and throw training: learn to jump, land and throw with good form, then start adding speed. Builds a quicker first step, higher jumps and more snap in everything you do. Every jump: land softly, knees over toes, and stick the landing for a second. Every throw: as hard and fast as you can. It runs for 6 weeks: weeks 1-3 build the base (a set is added to the key exercise each week), then weeks 4-6 move on to harder, more explosive versions that build again each week. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      power_nutrition, power_warm,
      '{"1":"Lower-body power","3":"Upper-body power & core","5":"Full-body power"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["Pogo Hops",3,"10, quick and springy",60,false],["Box Jump",3,"5, step down",90,true],["Broad Jump",3,"4, stick the landing",90,false],["Goblet Squat",3,"8",90,false],["Single-Leg Romanian Deadlift",3,"8 each leg",60,false],["Plank",3,"30 sec",30,false]],"3":[["Medicine Ball Chest Pass",4,"6 fast",60,true],["Medicine Ball Slam",3,"8",60,false],["Push-Up",3,"8-10",60,false],["Inverted Row",3,"8-10",60,false],["Medicine Ball Rotational Throw",3,"5 each side",60,false],["Dead Bug",3,"8 each side",30,false]],"5":[["Kettlebell Swing",4,"10 fast",90,true],["Jump Squat",3,"5",90,false],["Medicine Ball Scoop Toss",3,"5",60,false],["Dumbbell Goblet Reverse Lunge",3,"8 each leg",60,false],["Single-Arm Dumbbell Row (Unilateral)",3,"10 each arm",60,false],["Pallof Press",3,"10 each side",30,false]]},"p2":{"1":[["Lateral Bound",3,"4 each side, stick it",90,true],["Box Jump",4,"4, step down",120,false],["Broad Jump",4,"3, max distance",120,false],["Dumbbell Front Squat",4,"6",120,false],["Single-Leg Romanian Deadlift",3,"8 each leg",60,false],["Elbow Side Plank",3,"30 sec each side",30,false]],"3":[["Medicine Ball Chest Pass",4,"5 max effort",90,true],["Push-Up",4,"5 explosive, hands leave the floor",90,false],["Medicine Ball Rotational Throw",4,"5 each side, max effort",60,false],["Band Assisted Pull-Up",3,"5-8",90,false],["Medicine Ball Slam",3,"6 max effort",60,false],["Dead Bug",3,"10 each side",30,false]],"5":[["Kettlebell Swing",5,"8 explosive",90,true],["Tuck Jump",3,"5",90,false],["Medicine Ball Scoop Toss",4,"4 max height",90,false],["Dumbbell Bulgarian Split Squat",3,"6 each leg",90,false],["Chest-Supported Row",3,"8",60,false],["Pallof Press",3,"10 each side",30,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Explosive Power 2 – Strength to Power', place, 6,
      'For athletes who already lift: turn your strength into power. Weeks 1-3 build heavy strength alongside jumps and throws. Weeks 4-6 use contrast training: a heavy set goes straight into a jump or throw (the heavy lift switches the muscles on, so you jump higher). Rest fully after each pair. Leave 1-2 reps in the tank on heavy lifts. It runs for 6 weeks: weeks 1-3 build the base (a set is added to the key exercise each week), then weeks 4-6 move on to harder, more explosive versions that build again each week. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      power_nutrition, power_warm,
      '{"1":"Lower-body power","3":"Upper-body power","5":"Olympic lift & single-leg power"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["Trap Bar Deadlift",4,"5",150,true],["Box Jump",3,"4, step down",90,false],["Barbell Back Squat",3,"5",150,false],["Broad Jump",3,"3",90,false],["Nordic Hamstring Curl",3,"4-6 slow",90,false],["Hanging Knee Raise",3,"10",45,false]],"3":[["Bench Press",4,"5",150,true],["Medicine Ball Chest Pass",3,"5 max effort",60,false],["Weighted Pull-Up",3,"5",120,false],["Medicine Ball Slam",3,"6",60,false],["Medicine Ball Rotational Throw",3,"5 each side",60,false],["Pallof Press",3,"10 each side",30,false]],"5":[["Hang Power Clean",5,"3, crisp and fast",120,true],["Lateral Bound",3,"4 each side",90,false],["Barbell Split Squat",3,"6 each leg",120,false],["Kettlebell Swing",3,"10 fast",60,false],["Single-Leg Romanian Deadlift",3,"6 each leg",60,false],["Elbow Side Plank",3,"30 sec each side",30,false]]},"p2":{"1":[["Trap Bar Deadlift",4,"3 heavy, then straight to the jump",0,true],["Box Jump",4,"3, max height",150,true],["Barbell Back Squat",3,"3 heavy, then straight to the jump",0,false],["Broad Jump",3,"3, max distance",150,false],["Nordic Hamstring Curl",3,"5 slow",90,false],["Hanging Knee Raise",3,"12",45,false]],"3":[["Bench Press",4,"3 heavy, then straight to the throw",0,true],["Medicine Ball Chest Pass",4,"4 max effort",150,true],["Weighted Pull-Up",3,"3-5, then straight to the slam",0,false],["Medicine Ball Slam",3,"5 max effort",120,false],["Medicine Ball Rotational Throw",4,"4 each side, max effort",60,false],["Pallof Press",3,"10 each side",30,false]],"5":[["Power Clean",5,"2, explosive",150,true],["Depth Jump",4,"3, step off and explode up",120,false],["Barbell Split Squat",3,"4 each leg",120,false],["Kettlebell Swing",4,"6 explosive",60,false],["Single-Leg Romanian Deadlift",3,"6 each leg",60,false],["Elbow Side Plank",3,"40 sec each side",30,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Explosive Power 3 – Elite Power', place, 8,
      'For experienced, strong athletes: Olympic lifts, depth jumps and max-effort throws to reach peak power. Weeks 1-3 build strength-power with heavier lifts. Weeks 5-7 shift to speed-strength: lighter, faster lifts and the most explosive jumps. Every rep should be fast; if you slow down, end the set. Only do depth jumps from a low box (30-45 cm) and stop if your landings get loud. It runs for 8 weeks: weeks 1-3 build (a set is added to the key exercise each week), week 4 is an easy week with half the sets so your body catches up, weeks 5-7 are the harder phase, and week 8 is a test week: half the sets at full quality, so you finish fresh and can see how far you''ve come. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      power_nutrition, power_warm,
      '{"1":"Lower-body power","3":"Upper-body power","5":"Pull & bound"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["Power Clean",5,"3",150,true],["Front Squat",4,"4",180,false],["Depth Jump",4,"3, step off and explode up",120,false],["Romanian Deadlift",3,"6",120,false],["Single-Leg Hop",3,"3 each leg, stick it",90,false],["Hanging Knee Raise",3,"10",45,false]],"3":[["Bench Press",4,"4",180,true],["Push-Up",4,"5 explosive, hands leave the floor",90,false],["Weighted Pull-Up",4,"4",150,false],["Medicine Ball Rotational Throw",4,"5 each side, max effort",60,false],["Medicine Ball Slam",3,"6",60,false],["Pallof Press",3,"10 each side",30,false]],"5":[["Snatch Grip High Pull",4,"3 explosive",120,true],["Trap Bar Deadlift",4,"4",180,false],["Lateral Bound",4,"4 each side",90,false],["Barbell Split Squat",3,"5 each leg",120,false],["Nordic Hamstring Curl",3,"5 slow",90,false],["V-Up",3,"12",45,false]]},"p2":{"1":[["Hang Power Clean",5,"2, max speed",150,true],["Jump Squat",4,"4, light weight, max speed",120,false],["Depth Jump",5,"3, step off and explode up",120,false],["Single-Leg Hop",3,"4 each leg, continuous",90,false],["Romanian Deadlift",3,"5",120,false],["Hanging Knee Raise",3,"12",45,false]],"3":[["Medicine Ball Chest Pass",5,"4 max effort",90,true],["Bench Press",4,"3 fast, about 70% of your best",150,false],["Medicine Ball Rotational Throw",4,"4 each side, max effort",60,false],["Weighted Pull-Up",3,"3",150,false],["Medicine Ball Slam",4,"5 max effort",60,false],["Pallof Press",3,"10 each side",30,false]],"5":[["Power Clean",6,"2",150,true],["Box Jump",4,"3, max height",120,false],["Lateral Bound",4,"5 each side, continuous",90,false],["Trap Bar Deadlift",3,"3 fast",150,false],["Nordic Hamstring Curl",3,"4 slow",90,false],["V-Up",3,"15",45,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Speed 1 – Acceleration', place, 6,
      'Get faster over the first 5-20 metres, where most sports are won: a quicker first step, a strong forward lean and powerful leg drive. Two sessions are on a field or track (sprints and drills) and one is in the gym (strength for speed). Every sprint is all-out with a full walk-back rest; stop the session if you start slowing down. Sprint on grass or a track in proper running shoes. It runs for 6 weeks: weeks 1-3 build the base (a set is added to the key exercise each week), then weeks 4-6 move on to harder, more explosive versions that build again each week. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      power_nutrition, speed_warm,
      '{"1":"Acceleration (field)","3":"Strength for speed (gym)","5":"Acceleration & hills (field)"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["A-Skip",3,"20 m",30,false],["Wall Drive Drill",3,"5 quick switches each leg",45,false],["Falling Start Sprint",5,"10 m",90,true],["Acceleration Sprint",4,"20 m from a standing start",120,false],["Broad Jump",3,"3",90,false],["Pogo Hops",3,"15",45,false]],"3":[["Trap Bar Deadlift",4,"5",150,true],["Dumbbell Bulgarian Split Squat",3,"6 each leg",90,false],["Hip Thrust",3,"8",90,false],["Nordic Hamstring Curl",3,"4-6 slow",90,false],["Single-Leg Standing Calf Raise",3,"12 each leg",45,false],["Plank",3,"30 sec",30,false]],"5":[["A-Skip",3,"20 m",30,false],["High Knees",3,"15 m fast",30,false],["Sled Push",5,"15 m, drive low and hard",120,true],["Acceleration Sprint",4,"15 m",120,false],["Hill Climb Repeats",4,"10 sec uphill sprint, walk back down",90,false],["Lateral Bound",3,"3 each side",60,false]]},"p2":{"1":[["A-Skip",3,"20 m",30,false],["Wall Drive Drill",3,"5 fast switches each leg",45,false],["Falling Start Sprint",4,"15 m",90,false],["Acceleration Sprint",6,"30 m from a 3-point start",150,true],["Broad Jump",4,"3 in a row",90,false]],"3":[["Trap Bar Deadlift",4,"3 fast",150,true],["Box Jump",3,"4, step down",90,false],["Barbell Split Squat",3,"5 each leg",120,false],["Hip Thrust",3,"6",90,false],["Nordic Hamstring Curl",3,"5 slow",90,false],["Single-Leg Standing Calf Raise",3,"15 each leg",45,false]],"5":[["High Knees",3,"15 m fast",30,false],["Sled Push",4,"10 m sprint push, lighter",120,false],["Acceleration Sprint",5,"20 m",120,true],["Hill Climb Repeats",6,"8 sec all-out uphill, walk back down",90,false],["Single-Leg Hop",3,"3 each leg",60,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Speed 2 – Top Speed', place, 6,
      'Raise your top speed: upright sprinting mechanics, flying sprints and bounding for stiff, springy legs. For athletes who already sprint without pain. Flying sprints mean you build up over 20 m, then hold your fastest speed through the timed zone. Rest 3-4 minutes between flying sprints: tired sprinting teaches you to be slow. It runs for 6 weeks: weeks 1-3 build the base (a set is added to the key exercise each week), then weeks 4-6 move on to harder, more explosive versions that build again each week. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      power_nutrition, speed_warm,
      '{"1":"Top speed (field)","3":"Strength for speed (gym)","5":"Speed & tempo (field)"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["A-Skip",2,"20 m",30,false],["B-Skip",3,"20 m",30,false],["Acceleration Sprint",3,"20 m build-up",120,false],["Flying Sprint",4,"10 m fast after a 20 m build-up",180,true],["Bounding",3,"20 m",90,false]],"3":[["Barbell Back Squat",4,"5",150,true],["Romanian Deadlift",3,"6",120,false],["Barbell Step-Up Knee Drive",3,"6 each leg",90,false],["Nordic Hamstring Curl",3,"5 slow",90,false],["Single-Leg Standing Calf Raise",3,"12 each leg",45,false],["Hanging Knee Raise",3,"10",45,false]],"5":[["B-Skip",3,"20 m",30,false],["Flying Sprint",3,"10 m fast after a 20 m build-up",180,false],["Running Intervals",6,"100 m at 70%, walk back",60,true],["Pogo Hops",3,"20",45,false],["Lateral Bound",3,"4 each side",60,false]]},"p2":{"1":[["A-Skip",2,"20 m",30,false],["B-Skip",3,"20 m",30,false],["Flying Sprint",5,"20 m fast after a 20 m build-up",240,true],["Bounding",4,"30 m",120,false],["Single-Leg Hop",3,"4 each leg",60,false]],"3":[["Trap Bar Deadlift",4,"3 fast",180,true],["Barbell Step-Up Knee Drive",3,"5 explosive each leg",90,false],["Hip Thrust",3,"6",90,false],["Nordic Hamstring Curl",3,"6 slow",90,false],["Single-Leg Standing Calf Raise",3,"15 each leg",45,false],["Hanging Knee Raise",3,"12",45,false]],"5":[["B-Skip",2,"20 m",30,false],["Flying Sprint",4,"30 m fast after a 20 m build-up",240,false],["Running Intervals",4,"150 m at 85%, walk back",120,true],["Pogo Hops",3,"20",45,false],["Depth Jump",3,"3, step off and bounce up fast",90,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Speed 3 – Agility & Change of Direction', place, 6,
      'For field and court sports: cut, shuffle, turn and re-accelerate faster and with more control. Builds quick feet, low and balanced cutting, and the leg strength to stop and go without injury. Stay low when you change direction, plant the outside foot and push off hard. You''ll need cones (or water bottles) and some space; an agility ladder helps, or draw one with chalk. It runs for 6 weeks: weeks 1-3 build the base (a set is added to the key exercise each week), then weeks 4-6 move on to harder, more explosive versions that build again each week. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      power_nutrition, speed_warm,
      '{"1":"Footwork & cutting (field)","3":"Strength for agility (gym)","5":"Reaction & re-acceleration (field)"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["Ladder Quick Feet",4,"2 runs, quick feet",45,false],["Lateral Shuffle",4,"10 m each way",60,true],["Crossover Run",3,"10 m each way",60,false],["Pro Agility Shuttle",4,"1 run (5-10-5)",120,false],["Lateral Bound",3,"4 each side, stick it",60,false]],"3":[["Trap Bar Deadlift",4,"5",150,true],["Dumbbell Lateral Lunge",3,"8 each side",90,false],["Dumbbell Bulgarian Split Squat",3,"8 each leg",90,false],["Cossack Squat",3,"6 each side",60,false],["Pallof Press",3,"10 each side",30,false],["Single-Leg Standing Calf Raise",3,"12 each leg",45,false]],"5":[["A-Skip",2,"20 m",30,false],["Backpedal",3,"10 m, then sprint forward 10 m",60,false],["Pro Agility Shuttle",5,"1 run (5-10-5)",120,true],["Acceleration Sprint",4,"10 m",90,false],["Lateral Bound",3,"4 each side, continuous",60,false]]},"p2":{"1":[["Ladder Quick Feet",4,"2 runs, as fast as you can stay clean",45,false],["Lateral Shuffle",4,"5 m and back, 3 times",60,false],["Pro Agility Shuttle",6,"1 run, max effort",120,true],["Crossover Run",3,"15 m each way",60,false],["Lateral Bound",4,"5 each side, continuous",60,false]],"3":[["Trap Bar Deadlift",4,"3 fast",150,true],["Dumbbell Lateral Lunge",3,"6 explosive each side",90,false],["Single-Leg Romanian Deadlift",3,"8 each leg",60,false],["Box Jump",3,"4, step down",90,false],["Pallof Press",3,"12 each side",30,false],["Single-Leg Standing Calf Raise",3,"15 each leg",45,false]],"5":[["Backpedal",4,"10 m, then turn and sprint 10 m",90,true],["Pro Agility Shuttle",4,"1 run (5-10-5)",120,false],["Acceleration Sprint",4,"15 m from a side-on start",90,false],["Lateral Shuffle",3,"5 m and back, then sprint 10 m",60,false],["Tuck Jump",3,"5",60,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Sports Strength 1 – Base Strength', place, 8,
      'The base every athlete needs: three full-body sessions a week on the big lifts (squat, hinge, push, pull, carry) plus hamstring and core work that protects you from injury. Good for anyone new to strength training for sport. Use a weight you could lift 2 more times with good form; add a little weight when all sets feel solid. It runs for 8 weeks: weeks 1-3 build (a set is added to the key exercise each week), week 4 is an easy week with half the sets so your body catches up, weeks 5-7 are the harder phase, and week 8 is a test week: half the sets at full quality, so you finish fresh and can see how far you''ve come. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      strength_nutrition, strength_warm,
      '{"1":"Full body A","3":"Full body B","5":"Full body C"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["Barbell Back Squat",3,"8",120,true],["Romanian Deadlift",3,"8",120,false],["Bench Press",3,"8",120,false],["Chest-Supported Row",3,"10",90,false],["Single-Leg Standing Calf Raise",3,"12 each leg",45,false],["Plank",3,"40 sec",30,false]],"3":[["Trap Bar Deadlift",3,"6",150,true],["Dumbbell Bulgarian Split Squat",3,"8 each leg",90,false],["Pull-Up",3,"6-8",120,false],["Push-Up",3,"10-15",60,false],["Nordic Hamstring Curl",3,"4-6 slow",90,false],["Pallof Press",3,"10 each side",30,false]],"5":[["Front Squat",3,"6",150,true],["Hip Thrust",3,"10",90,false],["Flat Dumbbell Press",3,"10",90,false],["Single-Arm Dumbbell Row (Unilateral)",3,"10 each arm",60,false],["Kettlebell Farmer''s Carry",3,"30 m",60,false],["Dead Bug",3,"8 each side",30,false]]},"p2":{"1":[["Barbell Back Squat",4,"5",180,true],["Romanian Deadlift",3,"6",120,false],["Bench Press",4,"5",180,false],["Barbell Bent-Over Row",3,"6",120,false],["Single-Leg Standing Calf Raise",3,"15 each leg",45,false],["Elbow Side Plank",3,"30 sec each side",30,false]],"3":[["Trap Bar Deadlift",4,"4",180,true],["Barbell Split Squat",3,"6 each leg",120,false],["Weighted Pull-Up",3,"5",150,false],["Floor Press",3,"6",120,false],["Nordic Hamstring Curl",3,"5 slow",90,false],["Pallof Press",3,"12 each side",30,false]],"5":[["Front Squat",4,"4",180,true],["Hip Thrust",3,"8",90,false],["Incline Dumbbell Press",3,"8",90,false],["Chest-Supported Row",3,"8",90,false],["Kettlebell Farmer''s Carry",3,"40 m heavy",90,false],["Hanging Knee Raise",3,"10",45,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Sports Strength 2 – Single-Leg & Athletic', place, 6,
      'Sport happens on one leg: running, cutting, jumping and landing. This program builds strength one side at a time, evens out left-right differences, and trains balance, hips and trunk so you''re stronger and harder to injure. Always start with your weaker side and match the reps on the other. It runs for 6 weeks: weeks 1-3 build the base (a set is added to the key exercise each week), then weeks 4-6 move on to harder, more explosive versions that build again each week. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      strength_nutrition, strength_warm,
      '{"1":"Single-leg strength A","3":"Hinge & pull","5":"Single-leg strength B"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["Dumbbell Bulgarian Split Squat",4,"8 each leg",90,true],["Single-Leg Romanian Deadlift",3,"8 each leg",90,false],["Step-Up",3,"8 each leg",60,false],["Dumbbell Single-Arm Chest Press",3,"10 each arm",60,false],["Single-Arm Dumbbell Row (Unilateral)",3,"10 each arm",60,false],["Pallof Press",3,"10 each side",30,false]],"3":[["Trap Bar Deadlift",4,"5",150,true],["Dumbbell Lateral Lunge",3,"8 each side",60,false],["Single-Leg Hip Thrust",3,"10 each leg",60,false],["Pull-Up",3,"6-8",120,false],["Push-Up",3,"10-15",60,false],["Kettlebell Turkish Get-Up",3,"2 each side, slow",60,false]],"5":[["Front-Foot-Elevated Split Squat",3,"8 each leg",90,true],["Nordic Hamstring Curl",3,"5 slow",90,false],["Cossack Squat",3,"6 each side",60,false],["Single-Arm Landmine Press",3,"8 each arm",60,false],["Kettlebell Gorilla Row",3,"8 each arm",60,false],["Single-Leg Standing Calf Raise",3,"12 each leg",45,false]]},"p2":{"1":[["Barbell Split Squat",4,"6 each leg",120,true],["Single-Leg Romanian Deadlift",3,"6 each leg, heavier",90,false],["Barbell Step-Up Knee Drive",3,"5 explosive each leg",90,false],["Dumbbell Single-Arm Chest Press",3,"8 each arm",60,false],["Meadows Row",3,"8 each arm",60,false],["Pallof Press",3,"12 each side",30,false]],"3":[["Trap Bar Deadlift",4,"3 fast",150,true],["Lateral Bound",3,"4 each side, stick it",60,false],["Single-Leg Hip Thrust",3,"8 each leg, add weight",60,false],["Weighted Pull-Up",3,"5",150,false],["Push-Up",3,"6 explosive, hands leave the floor",60,false],["Kettlebell Turkish Get-Up",3,"2 each side",60,false]],"5":[["Dumbbell Bulgarian Split Squat",4,"6 each leg, heavier",120,true],["Nordic Hamstring Curl",3,"6 slow",90,false],["Dumbbell Cossack Squat",3,"6 each side",60,false],["Single-Arm Landmine Press",3,"6 each arm",60,false],["Kettlebell Gorilla Row",3,"10 each arm",60,false],["Single-Leg Standing Calf Raise",3,"15 each leg",45,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym'] loop
    perform pg_temp.add_sports_program('Sports Strength 3 – Max Strength', place, 8,
      'For experienced lifters who want to get as strong as possible for their sport: heavy squats, bench, deadlifts and weighted pull-ups, with sets of 5 moving to sets of 3. Always use a spotter or safety bars on squats and bench. Leave 1 rep in the tank; never grind out an ugly rep. In week 8, work up to a heavy set of 3 with perfect form to see your progress. It runs for 8 weeks: weeks 1-3 build (a set is added to the key exercise each week), week 4 is an easy week with half the sets so your body catches up, weeks 5-7 are the harder phase, and week 8 is a test week: half the sets at full quality, so you finish fresh and can see how far you''ve come. Train Monday, Wednesday and Friday. Tuesday, Thursday and the weekend are for rest or your own sport.',
      strength_nutrition, strength_warm,
      '{"1":"Squat day","3":"Press & pull day","5":"Deadlift day"}'::jsonb, 'Rest or your sport',
      '{"p1":{"1":[["Barbell Back Squat",4,"5",180,true],["Pause Squat",3,"4",150,false],["Romanian Deadlift",3,"6",120,false],["Bulgarian Split Squat",3,"6 each leg",90,false],["Hanging Knee Raise",3,"10",45,false]],"3":[["Bench Press",4,"5",180,true],["Weighted Pull-Up",4,"5",150,false],["Close-Grip Bench Press",3,"6",120,false],["Barbell Bent-Over Row",3,"6",120,false],["Cable Bar Face Pull",3,"12-15",45,false]],"5":[["Conventional Deadlift",4,"4",180,true],["Front Squat",3,"5",150,false],["Hip Thrust",3,"6",120,false],["Kettlebell Farmer''s Carry",3,"40 m heavy",90,false],["Pallof Press",3,"10 each side",30,false]]},"p2":{"1":[["Barbell Back Squat",5,"3",210,true],["Pause Squat",3,"3",150,false],["Romanian Deadlift",3,"5",120,false],["Box Jump",3,"3, step down",90,false],["Hanging Knee Raise",3,"12",45,false]],"3":[["Bench Press",5,"3",210,true],["Weighted Pull-Up",4,"3",150,false],["Close-Grip Bench Press",3,"5",120,false],["Pendlay Row",3,"5",120,false],["Cable Bar Face Pull",3,"15",45,false]],"5":[["Conventional Deadlift",4,"2-3",240,true],["Front Squat",3,"3",180,false],["Hip Thrust",3,"5",120,false],["Kettlebell Farmer''s Carry",3,"40 m heavy",90,false],["Pallof Press",3,"12 each side",30,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym', 'home'] loop
    perform pg_temp.add_sports_program('Mobility 1 – Hips & Ankles', place, 6,
      'Mobility is moving well through a full range with control, not just being stretchy. This program opens up stiff hips and ankles so you can squat deeper, change direction, sprint and land better, and take pressure off your knees and lower back. Move slowly and with control: each rep should go a little further than the last. No equipment needed. Most moves have written steps plus a link to watch an example online. It runs for 6 weeks: weeks 1-3 build the base (a set is added to one move each week), then weeks 4-6 go further with longer holds and harder versions, building again each week. Do it Monday, Wednesday and Friday, about 20-25 minutes. On the other days, a short walk or your normal training is fine.',
      move_nutrition, move_warm,
      '{"1":"Hips & ankles A","3":"Hips & ankles B","5":"Hips & ankles C"}'::jsonb, 'Rest (or an easy walk)',
      '{"p1":{"1":[["Ankle Knee-to-Wall Rock",2,"10 each side",15,true],["90/90 Hip Switch",2,"8 each side, slow",15,false],["Hip CARs",2,"3 slow circles each way, each leg",15,false],["Spiderman Lunge with Reach",2,"5 each side",15,false],["Cossack Squat",2,"6 each side, slow",30,false],["Deep Squat Hold",2,"45 sec",30,false]],"3":[["Leg Swings",2,"10 each way, each leg",15,false],["Adductor Rock-Back",2,"10 each side",15,true],["Hip Airplane",2,"4 each side, hold a wall if needed",30,false],["World''s Greatest Stretch",2,"4 each side",15,false],["Glute Bridge",2,"12",30,false],["Bird Dog",2,"8 each side",15,false]],"5":[["Ankle Knee-to-Wall Rock",2,"10 each side",15,false],["Deep Squat Hold",2,"45 sec",30,true],["90/90 Hip Switch",2,"8 each side",15,false],["Hip CARs",2,"3 slow circles each way, each leg",15,false],["Cossack Squat",2,"6 each side",30,false],["Half-Kneeling Hip Flexor Stretch",2,"30 sec each side",15,false]]},"p2":{"1":[["Ankle Knee-to-Wall Rock",3,"12 each side, hold 2 sec at the end",15,false],["90/90 Hip Switch",3,"6 each side, hands off the floor",15,true],["Hip CARs",3,"4 slow circles each way, each leg",15,false],["Spiderman Lunge with Reach",3,"6 each side",15,false],["Dumbbell Cossack Squat",3,"6 each side, light",30,false],["Deep Squat Hold",2,"60 sec",30,false]],"3":[["Leg Swings",2,"12 each way, each leg",15,false],["Adductor Rock-Back",3,"12 each side",15,true],["Hip Airplane",3,"5 each side, no wall",30,false],["World''s Greatest Stretch",3,"5 each side",15,false],["Single-Leg Glute Bridge",3,"10 each leg",30,false],["Bird Dog",3,"10 each side",15,false]],"5":[["Ankle Knee-to-Wall Rock",3,"12 each side",15,false],["Deep Squat Hold",3,"60 sec",30,true],["90/90 Hip Switch",3,"6 each side, hands off the floor",15,false],["Hip CARs",3,"4 slow circles each way, each leg",15,false],["Dumbbell Cossack Squat",3,"6 each side, light",30,false],["Couch Stretch",2,"45 sec each side",15,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym', 'home'] loop
    perform pg_temp.add_sports_program('Mobility 2 – Spine & Shoulders', place, 6,
      'Loosen a stiff upper back and shoulders so you can reach overhead, rotate, throw and swing freely, and sit and stand taller. Great for anyone who sits a lot or plays throwing, racket, swimming or contact sports. Move slowly, breathe out as you go further, and never force a shoulder into pain. You''ll need a resistance band (or a towel) and a bar to hang from. It runs for 6 weeks: weeks 1-3 build the base (a set is added to one move each week), then weeks 4-6 go further with longer holds and harder versions, building again each week. Do it Monday, Wednesday and Friday, about 20-25 minutes. On the other days, a short walk or your normal training is fine.',
      move_nutrition, move_warm,
      '{"1":"Spine & shoulders A","3":"Spine & shoulders B","5":"Spine & shoulders C"}'::jsonb, 'Rest (or an easy walk)',
      '{"p1":{"1":[["Cat-Cow",2,"10 slow",15,false],["Thoracic Open Book",2,"8 each side",15,true],["Thread the Needle",2,"8 each side",15,false],["Wall Slide",2,"10 slow",30,false],["Shoulder CARs",2,"3 slow circles each way, each arm",15,false],["Dead Hang",2,"20 sec",30,false]],"3":[["Cat-Cow",2,"10 slow",15,false],["Band Shoulder Dislocate",2,"10 slow, wide grip",15,true],["Band External Rotation",2,"12 each arm",30,false],["Bird Dog",2,"8 each side",15,false],["Bodyweight Spinal Jefferson Curl",2,"6 slow",30,false],["Child''s Pose Lat Stretch",2,"30 sec each side",15,false]],"5":[["Thoracic Open Book",2,"8 each side",15,false],["Thread the Needle",2,"8 each side",15,false],["Wall Slide",2,"10 slow",30,true],["Shoulder CARs",2,"3 slow circles each way, each arm",15,false],["Dead Bug",2,"8 each side",15,false],["Doorway Chest Stretch",2,"30 sec each side",15,false]]},"p2":{"1":[["Cat-Cow",2,"12 slow",15,false],["Thoracic Open Book",3,"8 each side, hold 3 sec open",15,true],["Thread the Needle",3,"8 each side, hold 3 sec",15,false],["Wall Slide",3,"12 slow, lift off the wall at the top",30,false],["Shoulder CARs",3,"4 slow circles each way, each arm",15,false],["Dead Hang",3,"30 sec",30,false]],"3":[["Cat-Cow",2,"12 slow",15,false],["Band Shoulder Dislocate",3,"10 slow, a little narrower",15,true],["Band External Rotation",3,"15 each arm",30,false],["Bird Dog",3,"10 each side, hold 2 sec",15,false],["Bodyweight Spinal Jefferson Curl",3,"8 slow",30,false],["Child''s Pose Lat Stretch",2,"45 sec each side",15,false]],"5":[["Thoracic Open Book",3,"8 each side, hold 3 sec open",15,false],["Thread the Needle",3,"8 each side",15,false],["Wall Slide",3,"12 slow, lift off the wall at the top",30,true],["Shoulder CARs",3,"4 slow circles each way, each arm",15,false],["Dead Hang",3,"30 sec",30,false],["Doorway Chest Stretch",2,"45 sec each side",15,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym', 'home'] loop
    perform pg_temp.add_sports_program('Mobility 3 – Full-Body Flow', place, 6,
      'A full-body mobility routine that links hips, spine and shoulders, so you move freely from head to toe. Ideal for athletes on their rest days, and for anyone who wants to feel less stiff. Each session flows from one move to the next with short rests. Move with control and breathe slowly; it should leave you feeling looser and fresher, not tired. It runs for 6 weeks: weeks 1-3 build the base (a set is added to one move each week), then weeks 4-6 go further with longer holds and harder versions, building again each week. Do it Monday, Wednesday and Friday, about 20-25 minutes. On the other days, a short walk or your normal training is fine.',
      move_nutrition, move_warm,
      '{"1":"Full-body flow A","3":"Full-body flow B","5":"Full-body flow C"}'::jsonb, 'Rest (or an easy walk)',
      '{"p1":{"1":[["Inchworm",2,"5 slow",15,false],["World''s Greatest Stretch",2,"4 each side",15,true],["90/90 Hip Switch",2,"8 each side",15,false],["Cat-Cow",2,"10 slow",15,false],["Deep Squat Hold",2,"45 sec",30,false],["Shoulder CARs",2,"3 slow circles each way, each arm",15,false]],"3":[["Leg Swings",2,"10 each way, each leg",15,false],["Spiderman Lunge with Reach",2,"5 each side",15,true],["Thoracic Open Book",2,"8 each side",15,false],["Cossack Squat",2,"6 each side",30,false],["Hip CARs",2,"3 slow circles each way, each leg",15,false],["Dead Hang",2,"20 sec",30,false]],"5":[["Inchworm",2,"5 slow",15,false],["Kettlebell Turkish Get-Up",2,"1 each side, no weight or very light",30,true],["Adductor Rock-Back",2,"10 each side",15,false],["Thread the Needle",2,"8 each side",15,false],["Ankle Knee-to-Wall Rock",2,"10 each side",15,false],["Lying Spinal Twist",2,"30 sec each side",15,false]]},"p2":{"1":[["Inchworm",3,"6 slow, add a push-up",15,false],["World''s Greatest Stretch",3,"5 each side",15,true],["90/90 Hip Switch",3,"6 each side, hands off the floor",15,false],["Cat-Cow",2,"12 slow",15,false],["Deep Squat Hold",3,"60 sec",30,false],["Shoulder CARs",3,"4 slow circles each way, each arm",15,false]],"3":[["Leg Swings",2,"12 each way, each leg",15,false],["Spiderman Lunge with Reach",3,"6 each side",15,true],["Thoracic Open Book",3,"8 each side, hold 3 sec",15,false],["Dumbbell Cossack Squat",3,"6 each side, light",30,false],["Hip Airplane",3,"4 each side",30,false],["Dead Hang",3,"30 sec",30,false]],"5":[["Inchworm",3,"6 slow",15,false],["Kettlebell Turkish Get-Up",3,"1 each side, light",30,true],["Adductor Rock-Back",3,"12 each side",15,false],["Thread the Needle",3,"8 each side",15,false],["Ankle Knee-to-Wall Rock",3,"12 each side",15,false],["Pigeon Stretch",2,"45 sec each side",15,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym', 'home'] loop
    perform pg_temp.add_sports_program('Flexibility 1 – Lower Body', place, 6,
      'Longer, looser hamstrings, hips, quads, glutes and calves: helps with sprinting, kicking, squatting and back comfort. Hold each stretch still (no bouncing), breathe slowly and relax into it; it should feel like a mild pull, never pain. Holds start at 30 seconds and move to 45 seconds. Best done after training or in the evening. No equipment needed (a towel or strap helps). Each stretch has written steps plus a link to watch an example online. It runs for 6 weeks: weeks 1-3 build the base (a set is added to one move each week), then weeks 4-6 go further with longer holds and harder versions, building again each week. Do it Monday, Wednesday and Friday, about 20-25 minutes. On the other days, a short walk or your normal training is fine.',
      move_nutrition, move_warm,
      '{"1":"Lower-body stretch A","3":"Lower-body stretch B","5":"Lower-body stretch C"}'::jsonb, 'Rest (or an easy walk)',
      '{"p1":{"1":[["Lying Hamstring Stretch",2,"30 sec each side",15,true],["Half-Kneeling Hip Flexor Stretch",2,"30 sec each side",15,false],["Standing Quad Stretch",2,"30 sec each side",15,false],["Figure-Four Glute Stretch",2,"30 sec each side",15,false],["Butterfly Stretch",2,"30 sec",15,false],["Wall Calf Stretch",2,"30 sec each side",15,false]],"3":[["Seated Forward Fold",2,"30 sec",15,true],["Half Split Stretch",2,"30 sec each side",15,false],["Figure-Four Glute Stretch",2,"30 sec each side",15,false],["Frog Stretch",2,"30 sec",15,false],["Half-Kneeling Hip Flexor Stretch",2,"30 sec each side",15,false],["Wall Calf Stretch",2,"30 sec each side",15,false]],"5":[["Lying Hamstring Stretch",2,"30 sec each side",15,false],["Couch Stretch",2,"30 sec each side",15,true],["Butterfly Stretch",2,"30 sec",15,false],["Pigeon Stretch",2,"30 sec each side",15,false],["Straddle Stretch",2,"30 sec",15,false],["Lying Spinal Twist",2,"30 sec each side",15,false]]},"p2":{"1":[["Lying Hamstring Stretch",3,"45 sec each side",15,true],["Couch Stretch",2,"45 sec each side",15,false],["Standing Quad Stretch",2,"45 sec each side",15,false],["Pigeon Stretch",2,"45 sec each side",15,false],["Butterfly Stretch",2,"45 sec",15,false],["Wall Calf Stretch",2,"45 sec each side",15,false]],"3":[["Seated Forward Fold",3,"45 sec",15,true],["Half Split Stretch",2,"45 sec each side",15,false],["Figure-Four Glute Stretch",2,"45 sec each side",15,false],["Frog Stretch",2,"45 sec",15,false],["Half-Kneeling Hip Flexor Stretch",2,"45 sec each side",15,false],["Straddle Stretch",2,"45 sec",15,false]],"5":[["Lying Hamstring Stretch",2,"45 sec each side",15,false],["Couch Stretch",3,"45 sec each side",15,true],["Butterfly Stretch",2,"45 sec",15,false],["Pigeon Stretch",2,"45 sec each side",15,false],["Straddle Stretch",2,"45 sec",15,false],["Lying Spinal Twist",2,"45 sec each side",15,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym', 'home'] loop
    perform pg_temp.add_sports_program('Flexibility 2 – Upper Body & Spine', place, 6,
      'Open up tight chest, lats, shoulders, triceps, neck and spine: better posture, easier overhead reach, and less upper-back and neck tension. Great for desk workers and throwing, swimming, racket and lifting athletes. Hold each stretch still, breathe slowly, mild pull only, never pain. Holds start at 30 seconds and move to 45 seconds. Each stretch has written steps plus a link to watch an example online. It runs for 6 weeks: weeks 1-3 build the base (a set is added to one move each week), then weeks 4-6 go further with longer holds and harder versions, building again each week. Do it Monday, Wednesday and Friday, about 20-25 minutes. On the other days, a short walk or your normal training is fine.',
      move_nutrition, move_warm,
      '{"1":"Upper-body stretch A","3":"Upper-body stretch B","5":"Upper-body stretch C"}'::jsonb, 'Rest (or an easy walk)',
      '{"p1":{"1":[["Doorway Chest Stretch",2,"30 sec each side",15,true],["Child''s Pose Lat Stretch",2,"30 sec each side",15,false],["Cross-Body Shoulder Stretch",2,"30 sec each side",15,false],["Overhead Triceps Stretch",2,"30 sec each side",15,false],["Neck Side Stretch",2,"30 sec each side",15,false],["Cat-Cow",2,"10 slow",15,false]],"3":[["Cobra Stretch",2,"30 sec",15,true],["Lying Spinal Twist",2,"30 sec each side",15,false],["Thread the Needle",2,"8 each side",15,false],["Ab Stretch 1",2,"30 sec",15,false],["Child''s Pose Lat Stretch",2,"30 sec each side",15,false],["Dead Hang",2,"20 sec, relaxed",30,false]],"5":[["Doorway Chest Stretch",2,"30 sec each side",15,false],["Cross-Body Shoulder Stretch",2,"30 sec each side",15,true],["Overhead Triceps Stretch",2,"30 sec each side",15,false],["Thoracic Open Book",2,"8 each side",15,false],["Neck Side Stretch",2,"30 sec each side",15,false],["Lying Spinal Twist",2,"30 sec each side",15,false]]},"p2":{"1":[["Doorway Chest Stretch",3,"45 sec each side",15,true],["Child''s Pose Lat Stretch",2,"45 sec each side",15,false],["Cross-Body Shoulder Stretch",2,"45 sec each side",15,false],["Overhead Triceps Stretch",2,"45 sec each side",15,false],["Neck Side Stretch",2,"45 sec each side",15,false],["Cat-Cow",2,"12 slow",15,false]],"3":[["Cobra Stretch",3,"45 sec",15,true],["Lying Spinal Twist",2,"45 sec each side",15,false],["Thread the Needle",2,"8 each side, hold 3 sec",15,false],["Ab Stretch 2",2,"45 sec",15,false],["Child''s Pose Lat Stretch",2,"45 sec each side",15,false],["Dead Hang",2,"30 sec, relaxed",30,false]],"5":[["Doorway Chest Stretch",2,"45 sec each side",15,false],["Cross-Body Shoulder Stretch",3,"45 sec each side",15,true],["Overhead Triceps Stretch",2,"45 sec each side",15,false],["Thoracic Open Book",2,"8 each side, hold 3 sec",15,false],["Neck Side Stretch",2,"45 sec each side",15,false],["Lying Spinal Twist",2,"45 sec each side",15,false]]}}'::jsonb);
  end loop;
  foreach place in array array['gym', 'home'] loop
    perform pg_temp.add_sports_program('Flexibility 3 – Splits & Deep Range', place, 6,
      'For athletes who need big range: martial arts, dance, gymnastics, goalkeepers, hurdlers. Works toward front-split and side-split range through the hamstrings, hip flexors and groin. Weeks 4-6 add contract-relax stretching (push gently against the stretch for 5 seconds, then relax and sink a little deeper), the quickest proven way to gain range. Only stretch when warm, never bounce, and never push into sharp pain. Each stretch has written steps plus a link to watch an example online. It runs for 6 weeks: weeks 1-3 build the base (a set is added to one move each week), then weeks 4-6 go further with longer holds and harder versions, building again each week. Do it Monday, Wednesday and Friday, about 20-25 minutes. On the other days, a short walk or your normal training is fine.',
      move_nutrition, move_warm,
      '{"1":"Front-split work","3":"Side-split & groin work","5":"Deep range flow"}'::jsonb, 'Rest (or an easy walk)',
      '{"p1":{"1":[["Half Split Stretch",3,"30 sec each side",15,true],["Couch Stretch",2,"30 sec each side",15,false],["Half-Kneeling Hip Flexor Stretch",2,"30 sec each side",15,false],["Lying Hamstring Stretch",2,"30 sec each side",15,false],["Pigeon Stretch",2,"30 sec each side",15,false]],"3":[["Butterfly Stretch",2,"45 sec",15,false],["Frog Stretch",3,"45 sec",15,true],["Straddle Stretch",2,"45 sec",15,false],["Cossack Squat",2,"6 each side, slow",30,false],["Adductor Rock-Back",2,"10 each side",15,false]],"5":[["Deep Squat Hold",2,"45 sec",30,false],["Seated Forward Fold",3,"45 sec",15,true],["Pigeon Stretch",2,"30 sec each side",15,false],["Straddle Stretch",2,"45 sec",15,false],["Couch Stretch",2,"30 sec each side",15,false]]},"p2":{"1":[["Half Split Stretch",3,"30 sec each side: stretch, push against it gently for 5 sec, then relax deeper",15,true],["Couch Stretch",2,"45 sec each side",15,false],["Half-Kneeling Hip Flexor Stretch",2,"30 sec each side: stretch, push against it gently for 5 sec, then relax deeper",15,false],["Lying Hamstring Stretch",2,"30 sec each side: stretch, push against it gently for 5 sec, then relax deeper",15,false],["Pigeon Stretch",2,"45 sec each side",15,false]],"3":[["Butterfly Stretch",2,"30 sec stretch, push against it gently for 5 sec, then relax deeper",15,false],["Frog Stretch",3,"60 sec",15,true],["Straddle Stretch",2,"30 sec stretch, push against it gently for 5 sec, then relax deeper",15,false],["Dumbbell Cossack Squat",2,"6 each side, light and slow",30,false],["Adductor Rock-Back",2,"12 each side",15,false]],"5":[["Deep Squat Hold",2,"60 sec",30,false],["Seated Forward Fold",3,"30 sec stretch, push against it gently for 5 sec, then relax deeper",15,true],["Pigeon Stretch",2,"45 sec each side",15,false],["Straddle Stretch",2,"60 sec",15,false],["Couch Stretch",2,"45 sec each side",15,false]]}}'::jsonb);
  end loop;
end $$;
