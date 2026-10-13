-- Beginner & Intermediate foundation programs (GRIZZ, 2026-10-13): 6-week
-- programs that prepare new clients' bodies for real training, for
-- Bodybuilding, Weight loss, Strength and Fitness. They focus on joint
-- stability, core strength and muscle and tendon development, in three
-- 2-week phases (learn, build, load). They have their own heading in the
-- program picker ("Beginner & Intermediate"), so nothing else changes. The
-- trainer is offered one when a client signs up as Never trained, Beginner
-- or Intermediate (0087).
--
-- Each program lists its sessions once as [day, exercise, role, cardio style]
-- and pg_temp.foundation_row works out the sets, reps and rest for each week.
-- Roles: m = main lift, a = accessory, r = core/stability for reps,
-- h = core/stability hold, p = jumps (low reps, full rest), cardio.
-- Only inserted when a built-in program with the same name isn't there yet.

create or replace function pg_temp.foundation_row(p_level text, p_goal text, p_name text, p_role text, p_style text, p_week int)
returns jsonb language plpgsql immutable as $f$
declare
  ph int := (p_week - 1) / 2;
  beg boolean := p_level = 'Beginner';
  side text := case when p_name in ('Bird Dog','Elbow Side Plank','Single-Leg Step-Down','Pallof Press','Dumbbell Goblet Split Squat',
    'Dumbbell Bulgarian Split Squat','Step-Up','Single-Leg Romanian Deadlift','Single-Leg Glute Bridge','Dumbbell Goblet Reverse Lunge',
    'Bodyweight Alternating Lateral Lunge','Walking Lunge') then ' each side' else '' end;
  sets int;
  reps text;
  rest int;
begin
  if p_role = 'cardio' then
    if p_style = 'intervals' then
      reps := (array['6','8','10'])[ph + 1] || ' x 20 sec hard / 40 sec easy';
    else
      reps := (case when beg then array[10,12,15] else array[12,15,20] end)[ph + 1] || ' min ' || p_style;
    end if;
    return jsonb_build_array(p_name, 1, reps, 0, 'cardio');
  elsif p_role = 'h' then
    return jsonb_build_array(p_name, (case when beg then array[2,2,3] else array[2,3,3] end)[ph + 1],
      (case when beg then array[20,30,40] else array[30,40,45] end)[ph + 1] || ' sec' || side, 45, 'exercise');
  elsif p_role = 'r' then
    return jsonb_build_array(p_name, (case when beg then array[2,2,3] else array[2,3,3] end)[ph + 1],
      (array['8-10','10-12','12-15'])[ph + 1] || side, 45, 'exercise');
  elsif p_role = 'p' then
    return jsonb_build_array(p_name, (array[2,3,3])[ph + 1], (array['5','5','6'])[ph + 1], 90, 'exercise');
  end if;
  if beg then
    if p_role = 'm' then
      sets := (array[2,3,3])[ph + 1];
      reps := case when p_goal = 'Strength' then (array['10-12','8-10','6-8'])[ph + 1] else (array['12-15','10-12','8-10'])[ph + 1] end;
      rest := case p_goal when 'Bodybuilding' then 75 when 'Strength' then (array[90,90,120])[ph + 1] else 60 end;
    else
      sets := (array[2,2,3])[ph + 1];
      reps := (array['12-15','12-15','10-12'])[ph + 1];
      rest := case when p_goal in ('Weight loss','Fitness') then 45 else 60 end;
    end if;
  else
    if p_role = 'm' then
      sets := (array[3,3,4])[ph + 1];
      reps := case p_goal
        when 'Bodybuilding' then (array['10-12','8-10','6-8'])[ph + 1]
        when 'Strength' then (array['8-10','6-8','5-6'])[ph + 1]
        else (array['10-12','10-12','8-10'])[ph + 1] end;
      rest := case p_goal when 'Bodybuilding' then 90 when 'Strength' then (array[120,150,180])[ph + 1] when 'Fitness' then 75 else 60 end;
    else
      sets := 3;
      reps := case when p_goal = 'Strength' then (array['10-12','8-10','8-10'])[ph + 1] else (array['12-15','10-12','10-12'])[ph + 1] end;
      rest := case when p_goal in ('Weight loss','Fitness') then 45 else 60 end;
    end if;
  end if;
  return jsonb_build_array(p_name, sets, reps || side, rest, 'exercise');
end $f$;

-- p_aim finishes "prepares your body for real training and ..."; p_detail is
-- the goal's own sentence. The rest of the description is the same for all.
create or replace function pg_temp.add_foundation(p_level text, p_goal text, p_aim text, p_detail text, p_nutrition text, p_warm_up text, p_sessions jsonb)
returns void language plpgsql as $f$
declare
  p_name text := p_level || ' Foundation - ' || p_goal;
  p_description text := case when p_level = 'Beginner'
      then 'If you''ve never trained or are just starting out, this 6-week foundation program prepares your body for real training and ' || p_aim
        || '. You train 3 days a week (Monday, Wednesday, Friday), training the whole body each time.'
      else 'If you''ve trained before but want a solid base, this 6-week foundation program prepares your body for real training and ' || p_aim
        || '. You train 4 days a week (Monday, Tuesday, Thursday, Friday) on an upper/lower split.' end
    || ' Every session includes joint stability and core work (dead bugs, bird dogs, planks, Pallof presses and single-leg moves)'
    || ' and slow, controlled reps that build muscle and tendon strength together. Lower every rep over 3 seconds. '
    || p_detail
    || ' Weeks 1-2: learn the movements with light weights and 2-3 reps left in the tank.'
    || ' Weeks 3-4: add a set and a bit more weight, still leaving 2 reps in the tank.'
    || ' Weeks 5-6: fewer reps and heavier weights, leaving 1-2 reps in the tank.'
    || ' Stop any exercise that causes sharp pain and tell your coach. Sleep 7-9 hours.'
    || ' After 6 weeks your coach moves you onto your main program.';
  prog uuid;
  week_titles text[] := case when p_level = 'Beginner'
    then array['Full body A','Rest day','Full body B','Rest day','Full body C','Rest day','Rest day']
    else array['Upper body A','Lower body A','Rest day','Upper body B','Lower body B','Rest day','Rest day'] end;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, nutrition, warm_up, day_titles)
  values (null, p_name, 'weekly', 'gym', 6, p_description, p_nutrition, p_warm_up,
    week_titles || week_titles || week_titles || week_titles || week_titles || week_titles)
  returning id into prog;
  insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
  select prog, w, (s.item->>0)::smallint, s.ord::smallint,
    case when r->>4 = 'exercise' then (select e.id from public.exercises e where e.name = r->>0 order by e.sort_order limit 1) end,
    r->>0, (r->>1)::smallint, r->>2, (r->>3)::smallint, r->>4
  from generate_series(1, 6) w,
    lateral (
      select item, row_number() over (partition by item->>0 order by i) as ord
      from jsonb_array_elements(p_sessions) with ordinality as t(item, i)
    ) s,
    lateral (select pg_temp.foundation_row(p_level, p_goal, s.item->>1, s.item->>2, coalesce(s.item->>3, ''), w) as r) x;
  if exists (select 1 from public.program_exercises pe where pe.program_id = prog and pe.kind = 'exercise' and pe.exercise_id is null) then
    raise exception 'an exercise in % is not in the library', p_name;
  end if;
end $f$;

do $$
declare
  warm_up text := '5 minutes of easy cardio (bike, walk or rower), then 1 round of: 10 glute bridges, 6 bird dogs each side, 10 bodyweight squats, 10 arm circles each way and 8 cat-camels. Then do 1 light set of your first exercise.';
begin
  perform pg_temp.add_foundation('Beginner', 'Bodybuilding',
    'building muscle', 'Each session builds the big muscle groups with controlled machine and dumbbell work, so your joints and tendons get used to the load before the volume goes up.',
    'Eat at maintenance or a small surplus (about 200-300 kcal over), with 1.6-2.2 g of protein per kg of body weight a day spread over 3-5 meals. Have carbs around training, such as rice, potatoes or fruit. Drink 2-3 litres of water a day.', warm_up,
    '[[1,"Leg Press","m"],[1,"Machine Chest Press","m"],[1,"Seated Cable Row","m"],[1,"Lying Leg Curl","a"],[1,"Dumbbell Lateral Raise","a"],[1,"Dead Bug","r"],[1,"Plank","h"],[3,"Goblet Squat","m"],[3,"Lat Pulldown","m"],[3,"Incline Dumbbell Press","m"],[3,"Glute Bridge","a"],[3,"Cable Rope Pushdown","a"],[3,"Dumbbell Curl","a"],[3,"Bird Dog","r"],[5,"Dumbbell Goblet Split Squat","m"],[5,"Chest-Supported Row","m"],[5,"Flat Dumbbell Press","m"],[5,"Kettlebell Romanian Deadlift","a"],[5,"Cable Bar Face Pull","a"],[5,"Pallof Press","r"],[5,"Elbow Side Plank","h"]]'::jsonb);
  perform pg_temp.add_foundation('Beginner', 'Weight loss',
    'losing fat while keeping your muscle', 'Each session finishes with steady cardio or easy intervals that grow over the 6 weeks, so you burn more while your body adapts.',
    'Eat about 300-500 kcal below maintenance, never a crash diet. Keep protein high (1.8-2.2 g per kg a day) so you keep your muscle, keep carbs lower and mostly around training, and fill half your plate with vegetables. Biltong makes an easy protein snack. Drink 2-3 litres of water a day.', warm_up,
    '[[1,"Goblet Squat","m"],[1,"Machine Chest Press","m"],[1,"Seated Cable Row","m"],[1,"Glute Bridge","a"],[1,"Dead Bug","r"],[1,"Treadmill","cardio","brisk incline walk"],[3,"Leg Press","m"],[3,"Lat Pulldown","m"],[3,"Incline Push-Up","m"],[3,"Kettlebell Romanian Deadlift","a"],[3,"Bird Dog","r"],[3,"Cycle","cardio","steady, able to talk"],[5,"Step-Up","m"],[5,"Dumbbell Row","m"],[5,"Flat Dumbbell Press","m"],[5,"Lying Leg Curl","a"],[5,"Plank","h"],[5,"Assault bike","cardio","easy pace"]]'::jsonb);
  perform pg_temp.add_foundation('Beginner', 'Strength',
    'getting stronger', 'The main lifts get longer rests and fewer reps as the weeks go on, but always with perfect form first. Strength is a skill, and this is where you learn it.',
    'Eat at maintenance or slightly above, with 1.6-2.2 g of protein per kg a day. Have a carb-based meal 2-3 hours before training so you have energy for the main lifts. Drink 2-3 litres of water a day.', warm_up,
    '[[1,"Goblet Squat","m"],[1,"Flat Dumbbell Press","m"],[1,"Seated Cable Row","m"],[1,"Glute Bridge","a"],[1,"Dead Bug","r"],[1,"Kettlebell Farmer''s Carry","h"],[3,"Kettlebell Romanian Deadlift","m"],[3,"Lat Pulldown","m"],[3,"Incline Push-Up","m"],[3,"Step-Up","a"],[3,"Pallof Press","r"],[3,"Elbow Side Plank","h"],[5,"Leg Press","m"],[5,"Chest-Supported Row","m"],[5,"Machine Chest Press","m"],[5,"Single-Leg Glute Bridge","a"],[5,"Bird Dog","r"],[5,"Plank","h"]]'::jsonb);
  perform pg_temp.add_foundation('Beginner', 'Fitness',
    'better all-round fitness', 'Each session mixes strength work with cardio that builds from steady to intervals, so your heart, lungs and muscles improve together.',
    'Eat at maintenance with 1.6 g of protein per kg a day, plenty of vegetables and wholefood carbs for energy. Have a small snack such as a banana 60 minutes before training if you train early. Drink 2-3 litres of water a day, more on hot days.', warm_up,
    '[[1,"Goblet Squat","m"],[1,"Incline Push-Up","m"],[1,"Dumbbell Row","m"],[1,"Glute Bridge","a"],[1,"Dead Bug","r"],[1,"Cycle","cardio","intervals"],[3,"Step-Up","m"],[3,"Lat Pulldown","m"],[3,"Machine Chest Press","m"],[3,"Kettlebell Romanian Deadlift","a"],[3,"Bird Dog","r"],[3,"Treadmill","cardio","steady"],[5,"Dumbbell Goblet Reverse Lunge","m"],[5,"Seated Cable Row","m"],[5,"Incline Dumbbell Press","m"],[5,"Kettlebell Farmer''s Carry","h"],[5,"Plank","h"],[5,"Assault bike","cardio","intervals"]]'::jsonb);
  perform pg_temp.add_foundation('Intermediate', 'Bodybuilding',
    'building muscle', 'Each session builds the big muscle groups with controlled machine and dumbbell work, so your joints and tendons get used to the load before the volume goes up.',
    'Eat at maintenance or a small surplus (about 200-300 kcal over), with 1.6-2.2 g of protein per kg of body weight a day spread over 3-5 meals. Have carbs around training, such as rice, potatoes or fruit. Drink 2-3 litres of water a day.', warm_up,
    '[[1,"Incline Dumbbell Press","m"],[1,"Chest-Supported Row","m"],[1,"Machine Chest Press","a"],[1,"Lat Pulldown","a"],[1,"Dumbbell Lateral Raise","a"],[1,"Cable Rope Pushdown","a"],[1,"Dumbbell Curl","a"],[1,"Band External Rotation","r"],[2,"Leg Press","m"],[2,"Romanian Deadlift","m"],[2,"Dumbbell Bulgarian Split Squat","a"],[2,"Lying Leg Curl","a"],[2,"Leg Extension","a"],[2,"Standing Calf Raise","a"],[2,"Dead Bug","r"],[4,"Flat Dumbbell Press","m"],[4,"Seated Cable Row","m"],[4,"Neutral-Grip Lat Pulldown","a"],[4,"Cable Fly","a"],[4,"Cable Bar Face Pull","a"],[4,"Overhead Cable Extension","a"],[4,"Hammer Curl","a"],[4,"Pallof Press","r"],[5,"Smith Machine Squat","m"],[5,"Hip Thrust","m"],[5,"Single-Leg Romanian Deadlift","a"],[5,"Seated Leg Curl","a"],[5,"Single-Leg Step-Down","r"],[5,"Seated Calf Raise","a"],[5,"Plank","h"]]'::jsonb);
  perform pg_temp.add_foundation('Intermediate', 'Weight loss',
    'losing fat while keeping your muscle', 'Each session finishes with steady cardio or easy intervals that grow over the 6 weeks, so you burn more while your body adapts.',
    'Eat about 300-500 kcal below maintenance, never a crash diet. Keep protein high (1.8-2.2 g per kg a day) so you keep your muscle, keep carbs lower and mostly around training, and fill half your plate with vegetables. Biltong makes an easy protein snack. Drink 2-3 litres of water a day.', warm_up,
    '[[1,"Machine Chest Press","m"],[1,"Seated Cable Row","m"],[1,"Incline Dumbbell Press","a"],[1,"Lat Pulldown","a"],[1,"Dumbbell Lateral Raise","a"],[1,"Dead Bug","r"],[1,"Assault bike","cardio","intervals"],[2,"Goblet Squat","m"],[2,"Kettlebell Romanian Deadlift","m"],[2,"Walking Lunge","a"],[2,"Lying Leg Curl","a"],[2,"Glute Bridge","a"],[2,"Plank","h"],[2,"Treadmill","cardio","incline walk"],[4,"Flat Dumbbell Press","m"],[4,"Chest-Supported Row","m"],[4,"Neutral-Grip Lat Pulldown","a"],[4,"Cable Bar Face Pull","a"],[4,"Cable Rope Pushdown","a"],[4,"Pallof Press","r"],[4,"Cycle","cardio","intervals"],[5,"Leg Press","m"],[5,"Hip Thrust","m"],[5,"Step-Up","a"],[5,"Seated Leg Curl","a"],[5,"Kettlebell Swing","a"],[5,"Bird Dog","r"],[5,"Ski Erg","cardio","steady"]]'::jsonb);
  perform pg_temp.add_foundation('Intermediate', 'Strength',
    'getting stronger', 'The main lifts get longer rests and fewer reps as the weeks go on, but always with perfect form first. Strength is a skill, and this is where you learn it.',
    'Eat at maintenance or slightly above, with 1.6-2.2 g of protein per kg a day. Have a carb-based meal 2-3 hours before training so you have energy for the main lifts. Drink 2-3 litres of water a day.', warm_up,
    '[[1,"Bench Press","m"],[1,"Barbell Bent-Over Row","m"],[1,"Lat Pulldown","a"],[1,"Incline Dumbbell Press","a"],[1,"Cable Bar Face Pull","a"],[1,"Band External Rotation","r"],[2,"Barbell Back Squat","m"],[2,"Romanian Deadlift","m"],[2,"Dumbbell Bulgarian Split Squat","a"],[2,"Lying Leg Curl","a"],[2,"Dead Bug","r"],[2,"Pallof Press","r"],[4,"Incline Barbell Press","m"],[4,"Chest-Supported Row","m"],[4,"Machine Assisted Pull-Up","a"],[4,"Flat Dumbbell Press","a"],[4,"Dumbbell Lateral Raise","a"],[4,"Kettlebell Farmer''s Carry","h"],[5,"Trap Bar Deadlift","m"],[5,"Goblet Squat","m"],[5,"Hip Thrust","a"],[5,"Single-Leg Romanian Deadlift","a"],[5,"Tibialis Raise","a"],[5,"Elbow Side Plank","h"]]'::jsonb);
  perform pg_temp.add_foundation('Intermediate', 'Fitness',
    'better all-round fitness', 'Each session mixes strength work with cardio that builds from steady to intervals, so your heart, lungs and muscles improve together.',
    'Eat at maintenance with 1.6 g of protein per kg a day, plenty of vegetables and wholefood carbs for energy. Have a small snack such as a banana 60 minutes before training if you train early. Drink 2-3 litres of water a day, more on hot days.', warm_up,
    '[[1,"Push-Up","m"],[1,"Dumbbell Row","m"],[1,"Incline Dumbbell Press","a"],[1,"Lat Pulldown","a"],[1,"Kettlebell Farmer''s Carry","h"],[1,"Pallof Press","r"],[1,"Ski Erg","cardio","intervals"],[2,"Goblet Squat","m"],[2,"Kettlebell Swing","m"],[2,"Dumbbell Goblet Reverse Lunge","a"],[2,"Step-Up","a"],[2,"Dead Bug","r"],[2,"Cycle","cardio","intervals"],[4,"Machine Chest Press","m"],[4,"Seated Cable Row","m"],[4,"Inverted Row","a"],[4,"Cable Bar Face Pull","a"],[4,"Plank","h"],[4,"Assault bike","cardio","intervals"],[5,"Kettlebell Romanian Deadlift","m"],[5,"Leg Press","m"],[5,"Bodyweight Alternating Lateral Lunge","a"],[5,"Box Jump","p"],[5,"Elbow Side Plank","h"],[5,"Treadmill","cardio","steady"]]'::jsonb);
end $$;
