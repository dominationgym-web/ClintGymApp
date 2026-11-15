-- At least 6 workouts in every body-part set (GRIZZ, 2026-11-15: "a minimum
-- of 6 workouts per program. Body part related"). Chest & Bi, Back & Tri and
-- Legs get 5 and 6, built like 1-4 (0039): two supersets of 3 sets, the first
-- exercise straight into the second, then 2 minutes' rest.
--
-- Quick upper and lower body get 2-6 ("another 4 upper and 4 lower. Well
-- structured.", plus a 6th each). Built like
-- the first two (0035): 5 exercises of 3 sets, about 30 minutes, 15 ab reps
-- between sets. Upper: one press, one pull, shoulders, biceps, triceps.
-- Lower: a squat or press, a hinge, single-leg or hamstring work, calves or
-- glutes, and core. Each has its own kit (barbell, machines, dumbbells,
-- cables, single-leg) so they don't repeat. No overhead pressing. Named
-- "Quick upper body 2 (30 min)".."6" so they sit on the Quick upper body card
-- next to the first one.
--
-- Drop sets get 4-6 for every muscle (one exercise each, like 1-3 in 0099):
-- description, nutrition, warm-up and reps are copied from Drop Set Chest 1
-- (machines, cables, dumbbells) or Drop Set Quads 2 (plate-loaded and
-- barbell), so they read and log the same.
--
-- Home gets Chest & Bi, Back & Tri and Legs 5-6 and Home quick upper and
-- lower body 2-6, with only dumbbells, a band, a sturdy chair and bodyweight,
-- copied from the matching Home workout 1.
--
-- The used-workout blackout (red until Reset) works on these with no change:
-- it goes by heading, and each new one sits under its set's heading.
-- Only inserted when a built-in program with the same name isn't there yet,
-- so it's safe to run again.

-- A new built-in quick workout like p_template (place, warm-up, nutrition, abs
-- between sets, and its description unless one is given).
create or replace function pg_temp.add_like(p_name text, p_template text, p_description text, p_rows jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
  t public.programs%rowtype;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  select * into t from public.programs where trainer_id is null and name = p_template;
  if t.id is null then
    raise exception 'template % is missing', p_template;
  end if;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, nutrition, warm_up, day_titles, abs_between_sets, abs_reps)
  values (null, p_name, 'quick', t.place, 1, coalesce(p_description, t.description), t.nutrition, t.warm_up, '{}'::text[], t.abs_between_sets, t.abs_reps)
  returning id into prog;
  -- Each row is [exercise, sets, reps, rest seconds].
  insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
  select prog, 1, 1, r.ord::smallint,
    (select e.id from public.exercises e where e.name = r.v->>0 order by e.sort_order limit 1),
    r.v->>0, (r.v->>1)::smallint, r.v->>2, (r.v->>3)::smallint, 'exercise'
  from jsonb_array_elements(p_rows) with ordinality as r(v, ord);
  if exists (select 1 from public.program_exercises pe where pe.program_id = prog and pe.exercise_id is null) then
    raise exception 'an exercise in % is not in the library', p_name;
  end if;
end $f$;

-- A drop set workout: one exercise, its own first sentence, then the rest of
-- the template's description and the template's reps and rest.
create or replace function pg_temp.add_drop(p_name text, p_template text, p_exercise text, p_lead text)
returns void language plpgsql as $f$
declare
  t_desc text;
  t_reps text;
  t_rest smallint;
begin
  select p.description, pe.reps, pe.rest_seconds into t_desc, t_reps, t_rest
  from public.programs p join public.program_exercises pe on pe.program_id = p.id
  where p.trainer_id is null and p.name = p_template
  order by pe.sort_order limit 1;
  if t_desc is null or position('Drop sets are for' in t_desc) = 0 then
    raise exception 'template % is missing or changed', p_template;
  end if;
  perform pg_temp.add_like(p_name, p_template,
    p_lead || ' ' || substring(t_desc from position('Drop sets are for' in t_desc)),
    jsonb_build_array(jsonb_build_array(p_exercise, 3, t_reps, t_rest)));
end $f$;

do $$
declare
  m text := 'Drop Set Chest 1';
  b text := 'Drop Set Quads 2';
  hu text := (select description from public.programs where trainer_id is null and name = 'Home quick upper body (30 min)');
  hl text := (select description from public.programs where trainer_id is null and name = 'Home quick lower body (30 min)');
begin
  -- Upper body
  perform pg_temp.add_like('Quick upper body 2 (30 min)', 'Quick upper body (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. Barbell and cables: a bench press, a pulldown, face pulls for the back of the shoulders, then arms.',
    '[["Bench Press", 3, "8-10", 90], ["Lat Pulldown", 3, "10-12", 75], ["Cable Bar Face Pull", 3, "12-15", 45], ["Barbell Curl", 3, "10-12", 45], ["Cable Bar Pushdown", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_like('Quick upper body 3 (30 min)', 'Quick upper body (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. All machines: quick to set up, easy on the joints and good for beginners or a busy gym.',
    '[["Machine Chest Press", 3, "10-12", 75], ["Machine Neutral Row", 3, "10-12", 75], ["Machine Lateral Raise", 3, "12-15", 45], ["Machine Preacher Curl", 3, "10-12", 45], ["Machine Tricep Extension", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_like('Quick upper body 4 (30 min)', 'Quick upper body (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. Dumbbells only: one pair of dumbbells and a bench, with single-arm rows to even out left and right.',
    '[["Flat Dumbbell Press", 3, "8-10", 75], ["Dumbbell Single-Arm Row", 3, "10 each arm", 60], ["Seated Dumbbell Lateral Raise", 3, "12-15", 45], ["Hammer Curl", 3, "10-12", 45], ["Overhead Dumbbell Extension", 3, "10-12", 45]]'::jsonb);
  perform pg_temp.add_like('Quick upper body 5 (30 min)', 'Quick upper body (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. Back first: a chest-supported row to start, then incline chest, rear shoulders and cable arms.',
    '[["Chest-Supported Row", 3, "8-10", 75], ["Incline Machine Chest Press", 3, "10-12", 75], ["Reverse Pec Deck", 3, "12-15", 45], ["Cable Curl", 3, "12-15", 45], ["Single-Arm Overhead Cable Extension", 3, "12-15 each arm", 45]]'::jsonb);

  -- Lower body
  perform pg_temp.add_like('Quick lower body 2 (30 min)', 'Quick lower body (30 min)',
    'Legs, glutes and core in 30 minutes. Squat focus: a barbell squat first, then lunges, a hinge for the hamstrings and calves.',
    '[["Barbell Back Squat", 3, "8-10", 120], ["Walking Lunge", 3, "10 each leg", 60], ["Good Morning", 3, "10-12", 60], ["Standing Calf Raise", 3, "12-15", 45], ["Dead Bug", 3, "10 each side", 30]]'::jsonb);
  perform pg_temp.add_like('Quick lower body 3 (30 min)', 'Quick lower body (30 min)',
    'Legs, glutes and core in 30 minutes. Glutes and hamstrings: hip thrusts and Romanian deadlifts, then reverse lunges and side glutes.',
    '[["Hip Thrust", 3, "10-12", 75], ["Dumbbell Romanian Deadlift", 3, "10-12", 75], ["Dumbbell Goblet Reverse Lunge", 3, "10 each leg", 60], ["Cable Hip Abduction", 3, "15 each leg", 45], ["Elbow Side Plank", 3, "30 sec each side", 30]]'::jsonb);
  perform pg_temp.add_like('Quick lower body 4 (30 min)', 'Quick lower body (30 min)',
    'Legs, glutes and core in 30 minutes. All machines: quick to set up and safe to push hard, good for beginners or a busy gym.',
    '[["Leg Press", 3, "10-12", 90], ["Machine Hip Thrust", 3, "10-12", 75], ["Seated Leg Curl", 3, "12-15", 45], ["Seated Calf Raise", 3, "12-15", 45], ["Machine Crunch", 3, "12-15", 30]]'::jsonb);
  perform pg_temp.add_like('Quick lower body 5 (30 min)', 'Quick lower body (30 min)',
    'Legs, glutes and core in 30 minutes. One leg at a time: step-ups, single-leg deadlifts and side lunges for balance and evening out left and right.',
    '[["Step-Up", 3, "10 each leg", 60], ["Single-Leg Romanian Deadlift", 3, "10 each leg", 60], ["Dumbbell Lateral Lunge", 3, "10 each side", 60], ["Stability Ball Leg Curl", 3, "12", 45], ["Pallof Press", 3, "10 each side", 30]]'::jsonb);
  perform pg_temp.add_like('Quick upper body 6 (30 min)', 'Quick upper body (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. Plate-loaded and cables: a chest press machine, a wide cable row, Y-raises for the shoulders, then arms.',
    '[["Hammer Strength Chest Press", 3, "10-12", 75], ["Wide-Grip Seated Cable Row", 3, "10-12", 75], ["Cable Y-Raise", 3, "12-15", 45], ["Dumbbell Preacher Curl", 3, "10-12", 45], ["Tricep Kickback", 3, "12-15 each arm", 45]]'::jsonb);
  perform pg_temp.add_like('Quick lower body 6 (30 min)', 'Quick lower body (30 min)',
    'Legs, glutes and core in 30 minutes. Hack squat and kettlebell: a hack squat first, then a hinge, split squats and single-leg curls.',
    '[["Hack Squat", 3, "8-10", 90], ["Kettlebell Romanian Deadlift", 3, "10-12", 75], ["Dumbbell Goblet Split Squat", 3, "10 each leg", 60], ["Cable Single-Leg Lying Leg Curl", 3, "12 each leg", 45], ["Hanging Knee Raise", 3, "10-15", 30]]'::jsonb);

  -- Superset splits 5 and 6. A rest of 0 goes straight into the next exercise.
  perform pg_temp.add_like('Chest & Bi 5', 'Chest & Bi 1', null,
    '[["Hammer Strength Incline Press", 3, "8-10", 0], ["Bayesian Curl", 3, "10-12 each arm", 120], ["Dumbbell Hex Press", 3, "10-12", 0], ["Spider Curl", 3, "10-12", 120]]'::jsonb);
  perform pg_temp.add_like('Chest & Bi 6', 'Chest & Bi 1', null,
    '[["Smith Machine Bench Press", 3, "8-10", 0], ["Close-Grip Barbell Curl", 3, "8-10", 120], ["Seated Cable Fly", 3, "12-15", 0], ["Cable Rope Hammer Curl", 3, "12-15", 120]]'::jsonb);
  perform pg_temp.add_like('Back & Tri 5', 'Back & Tri 1', null,
    '[["Neutral-Grip Lat Pulldown", 3, "8-10", 0], ["JM Press", 3, "8-10", 120], ["Seated Rope Cable Row", 3, "10-12", 0], ["Single-Arm Overhead Cable Extension", 3, "12-15 each arm", 120]]'::jsonb);
  perform pg_temp.add_like('Back & Tri 6', 'Back & Tri 1', null,
    '[["Chest-Supported T-Bar Row", 3, "8-10", 0], ["Dumbbell Skull Crusher", 3, "10-12", 120], ["Rope Straight-Arm Pulldown", 3, "12-15", 0], ["Cable Bar Pushdown", 3, "12-15", 120]]'::jsonb);
  perform pg_temp.add_like('Legs 5', 'Legs 1', null,
    '[["Pendulum Squat (V-Squat)", 3, "8-10", 0], ["Stability Ball Leg Curl", 3, "10-12", 120], ["Dumbbell Bulgarian Split Squat", 3, "8-10 each leg", 0], ["Single-Leg Standing Calf Raise", 3, "12-15 each leg", 120]]'::jsonb);
  perform pg_temp.add_like('Legs 6', 'Legs 1', null,
    '[["Trap Bar Deadlift", 3, "6-8", 0], ["Leg Extension", 3, "12-15", 120], ["Barbell Reverse Lunge", 3, "8-10 each leg", 0], ["Cable Kickback", 3, "12-15 each leg", 120]]'::jsonb);

  -- Drop sets 4-6 (no overhead pressing; shoulders are side and rear delts).
  perform pg_temp.add_drop('Drop Set Chest 4', b, 'Hammer Strength Chest Press', 'Plate-loaded chest press drop set. Take a plate off each side each time.');
  perform pg_temp.add_drop('Drop Set Chest 5', m, 'Incline Machine Chest Press', 'Incline chest press machine drop set for the upper chest.');
  perform pg_temp.add_drop('Drop Set Chest 6', m, 'Cable Chest Press', 'Cable chest press drop set. Move the pin up the stack each time.');
  perform pg_temp.add_drop('Drop Set Back 4', m, 'Wide-Grip Lat Pulldown', 'Wide-grip lat pulldown drop set.');
  perform pg_temp.add_drop('Drop Set Back 5', m, 'Machine Pulldown', 'Pulldown machine drop set.');
  perform pg_temp.add_drop('Drop Set Back 6', b, 'Hammer Strength Iso-Lateral Row', 'Plate-loaded row drop set. Take a plate off each side each time.');
  perform pg_temp.add_drop('Drop Set Quads 4', b, 'Hack Squat', 'Hack squat drop set. Rack it safely before each weight change.');
  perform pg_temp.add_drop('Drop Set Quads 5', b, 'Pendulum Squat (V-Squat)', 'Pendulum (V-squat) drop set. Rack it safely before each weight change.');
  perform pg_temp.add_drop('Drop Set Quads 6', b, 'Belt Squat', 'Belt squat drop set. Easy on the back, so the legs do all the work.');
  perform pg_temp.add_drop('Drop Set Hamstrings 4', m, 'Cable Single-Leg Lying Leg Curl', 'Single-leg cable leg curl drop set. Do each round on one leg, then the other.');
  perform pg_temp.add_drop('Drop Set Hamstrings 5', m, 'Dumbbell Leg Curl', 'Dumbbell leg curl drop set. Run down the dumbbell rack.');
  perform pg_temp.add_drop('Drop Set Hamstrings 6', m, 'Hamstring Curl', 'Hamstring curl machine drop set.');
  perform pg_temp.add_drop('Drop Set Glutes 4', m, 'Cable Kickback', 'Cable glute kickback drop set. Do each round on one leg, then the other.');
  perform pg_temp.add_drop('Drop Set Glutes 5', m, 'Cable Hip Abduction', 'Cable hip abduction drop set for the side glutes. Do each round on one leg, then the other.');
  perform pg_temp.add_drop('Drop Set Glutes 6', b, 'Hip Thrust', 'Barbell hip thrust drop set. Have a partner strip plates if you can.');
  perform pg_temp.add_drop('Drop Set Shoulders 4', m, 'Cable Low Single-Arm Lateral Raise', 'Single-arm cable lateral raise drop set for the side delts. Do each round on one arm, then the other.');
  perform pg_temp.add_drop('Drop Set Shoulders 5', m, 'Cable Rear Delt Fly', 'Cable rear delt fly drop set for the rear delts.');
  perform pg_temp.add_drop('Drop Set Shoulders 6', m, 'Seated Dumbbell Lateral Raise', 'Seated dumbbell lateral raise drop set for the side delts. Run down the dumbbell rack.');
  perform pg_temp.add_drop('Drop Set Biceps 4', b, 'Barbell Curl', 'Barbell curl drop set. Run down the fixed barbells or strip the plates.');
  perform pg_temp.add_drop('Drop Set Biceps 5', m, 'Hammer Curl', 'Hammer curl drop set. Run down the dumbbell rack.');
  perform pg_temp.add_drop('Drop Set Biceps 6', m, 'Cable Rope Hammer Curl', 'Cable rope hammer curl drop set.');
  perform pg_temp.add_drop('Drop Set Triceps 4', m, 'V-Bar Cable Pushdown', 'V-bar pushdown drop set.');
  perform pg_temp.add_drop('Drop Set Triceps 5', m, 'Overhead Cable Extension', 'Overhead cable extension drop set for the long head of the triceps.');
  perform pg_temp.add_drop('Drop Set Triceps 6', m, 'Machine Dip', 'Dip machine drop set.');
  perform pg_temp.add_drop('Drop Set Calves 4', b, 'Horizontal Leg Press Calf Press', 'Calf press on the leg press drop set. Take a plate off each time.');
  perform pg_temp.add_drop('Drop Set Calves 5', m, 'Dumbbell Single-Leg Calf Raise', 'Single-leg dumbbell calf raise drop set. Do each round on one leg, then the other.');
  perform pg_temp.add_drop('Drop Set Calves 6', m, 'Kettlebell Calf Raise', 'Kettlebell calf raise drop set. Run down the kettlebells.');

  -- Home superset splits 5 and 6 (dumbbells, a band, a sturdy chair).
  perform pg_temp.add_like('Home Chest & Bi 5', 'Home Chest & Bi 1', null,
    '[["Dumbbell Hex Press", 3, "10-12", 0], ["21s Curl", 3, "21", 120], ["Archer Push-Up", 3, "6-10 each side", 0], ["Dumbbell Standing Single-Arm Hammer Curl", 3, "10-12 each arm", 120]]'::jsonb);
  perform pg_temp.add_like('Home Chest & Bi 6', 'Home Chest & Bi 1', null,
    '[["Deficit Push-Up", 3, "10-15", 0], ["Kettlebell Goblet Curl", 3, "10-12", 120], ["Band Chest Fly", 3, "12-15", 0], ["Band Curl", 3, "15-20", 120]]'::jsonb);
  perform pg_temp.add_like('Home Back & Tri 5', 'Home Back & Tri 1', null,
    '[["Renegade Row", 3, "8-10 each arm", 0], ["Dumbbell Skull Crusher", 3, "10-12", 120], ["Kettlebell Gorilla Row", 3, "8-10 each arm", 0], ["Diamond Push-Up", 3, "8-12", 120]]'::jsonb);
  perform pg_temp.add_like('Home Back & Tri 6', 'Home Back & Tri 1', null,
    '[["Kettlebell Row (Single Arm)", 3, "10-12 each arm", 0], ["Bench Dip", 3, "12-15", 120], ["Band High Face Pull", 3, "15", 0], ["Overhead Dumbbell Extension", 3, "12-15", 120]]'::jsonb);
  perform pg_temp.add_like('Home Legs 5', 'Home Legs 1', null,
    '[["Heels-Elevated Goblet Squat", 3, "12-15", 0], ["Band Leg Curl", 3, "12-15", 120], ["Dumbbell Alternating Forward Lunge", 3, "10 each leg", 0], ["Dumbbell Heels-Elevated Hip Thrust", 3, "12-15", 120]]'::jsonb);
  perform pg_temp.add_like('Home Legs 6', 'Home Legs 1', null,
    '[["Dumbbell Cossack Squat", 3, "8 each side", 0], ["Dumbbell Romanian Deadlift", 3, "10-12", 120], ["Front-Foot-Elevated Split Squat", 3, "8-10 each leg", 0], ["Kettlebell Calf Raise", 3, "15-20", 120]]'::jsonb);

  -- Home quick upper body 2-6: press, pull, shoulders, biceps, triceps.
  perform pg_temp.add_like('Home quick upper body 2 (30 min)', 'Home quick upper body (30 min)', hu || ' Bands and bodyweight.',
    '[["Push-Up", 3, "10-15", 60], ["Band Row", 3, "12-15", 60], ["Band Lateral Raise", 3, "15", 45], ["Band Curl", 3, "15", 45], ["Diamond Push-Up", 3, "8-12", 45]]'::jsonb);
  perform pg_temp.add_like('Home quick upper body 3 (30 min)', 'Home quick upper body (30 min)', hu || ' Dumbbells on the floor.',
    '[["Dumbbell Hex Press", 3, "10-12", 60], ["Dumbbell Row", 3, "10-12 each arm", 60], ["Dumbbell Rear-Delt Fly", 3, "12-15", 45], ["Zottman Curl", 3, "10-12", 45], ["Dumbbell Skull Crusher", 3, "10-12", 45]]'::jsonb);
  perform pg_temp.add_like('Home quick upper body 4 (30 min)', 'Home quick upper body (30 min)', hu || ' Push-ups and a chair.',
    '[["Decline Push-Up", 3, "8-12", 60], ["Renegade Row", 3, "8 each arm", 60], ["Seated Dumbbell Lateral Raise", 3, "12-15", 45], ["Concentration Curl", 3, "10-12 each arm", 45], ["Bench Dip", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_like('Home quick upper body 5 (30 min)', 'Home quick upper body (30 min)', hu || ' One arm at a time.',
    '[["Dumbbell Single-Arm Chest Press", 3, "10-12 each arm", 60], ["Kettlebell Gorilla Row", 3, "8-10 each arm", 60], ["Lu Raise", 3, "10-12", 45], ["Seated Dumbbell Curl", 3, "10-12", 45], ["Tricep Kickback", 3, "12-15 each arm", 45]]'::jsonb);
  perform pg_temp.add_like('Home quick upper body 6 (30 min)', 'Home quick upper body (30 min)', hu || ' Band and dumbbells.',
    '[["Band Chest Press", 3, "12-15", 60], ["Band Seated Pulldown", 3, "12-15", 60], ["Band High Face Pull", 3, "15", 45], ["Cross-Body Hammer Curl", 3, "10-12", 45], ["Single-Arm Tricep Extension", 3, "10-12 each arm", 45]]'::jsonb);

  -- Home quick lower body 2-6: squat, hinge, single-leg, glutes or hamstrings, core.
  perform pg_temp.add_like('Home quick lower body 2 (30 min)', 'Home quick lower body (30 min)', hl || ' Squat focus.',
    '[["Goblet Squat", 3, "12-15", 60], ["Dumbbell Romanian Deadlift", 3, "10-12", 60], ["Dumbbell Goblet Reverse Lunge", 3, "10 each leg", 45], ["Dumbbell Single-Leg Calf Raise", 3, "15 each leg", 30], ["Dead Bug", 3, "10 each side", 30]]'::jsonb);
  perform pg_temp.add_like('Home quick lower body 3 (30 min)', 'Home quick lower body (30 min)', hl || ' Glutes and hamstrings.',
    '[["Dumbbell Heels-Elevated Hip Thrust", 3, "12-15", 60], ["Single-Leg Dumbbell Romanian Deadlift", 3, "10 each leg", 60], ["Dumbbell Lateral Lunge", 3, "10 each side", 45], ["Band Hip Abduction", 3, "15-20", 30], ["Elbow Side Plank", 3, "30 sec each side", 30]]'::jsonb);
  perform pg_temp.add_like('Home quick lower body 4 (30 min)', 'Home quick lower body (30 min)', hl || ' Front squats and step-ups.',
    '[["Dumbbell Front Squat", 3, "10-12", 60], ["Good Morning", 3, "10-12", 60], ["Step-Up", 3, "10 each leg", 45], ["Towel Slide Leg Curl", 3, "10-12", 45], ["Hollow Body Hold", 3, "30 sec", 30]]'::jsonb);
  perform pg_temp.add_like('Home quick lower body 5 (30 min)', 'Home quick lower body (30 min)', hl || ' Wide stance and single-leg glutes.',
    '[["Dumbbell Sumo Squat", 3, "12-15", 60], ["Dumbbell Single-Leg Hip Thrust", 3, "10 each leg", 60], ["Dumbbell Alternating Forward Lunge", 3, "10 each leg", 45], ["Band Leg Curl", 3, "12-15", 45], ["Reverse Crunch", 3, "12-15", 30]]'::jsonb);
  perform pg_temp.add_like('Home quick lower body 6 (30 min)', 'Home quick lower body (30 min)', hl || ' Split squats and deadlifts.',
    '[["Dumbbell Goblet Bulgarian Split Squat", 3, "8-10 each leg", 60], ["Dumbbell Deadlift", 3, "10-12", 60], ["Cossack Squat", 3, "8 each side", 45], ["Single-Leg Glute Bridge", 3, "12 each leg", 45], ["Plank Shoulder Tap", 3, "10 each side", 30]]'::jsonb);
end $$;
