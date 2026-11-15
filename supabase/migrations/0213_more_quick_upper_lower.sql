-- 4 more quick upper body and 4 more quick lower body workouts (GRIZZ,
-- 2026-11-15: "another 4 upper and 4 lower. Well structured."). Built like
-- the first two (0035): 5 exercises of 3 sets, about 30 minutes, 15 ab reps
-- between sets. Upper: one press, one pull, shoulders, biceps, triceps.
-- Lower: a squat or press, a hinge, single-leg or hamstring work, calves or
-- glutes, and core. Each has its own kit (barbell, machines, dumbbells,
-- cables, single-leg) so they don't repeat. No overhead pressing. Named
-- "Quick upper body 2 (30 min)".."5" so they sit on the Quick upper body card
-- next to the first one. Only inserted when a built-in program with the same
-- name isn't there yet, so it's safe to run again.

create or replace function pg_temp.add_quick(p_name text, p_description text, p_rows jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, warm_up, day_titles, abs_between_sets, abs_reps)
  values (null, p_name, 'quick', 'gym', 1, p_description,
    '5 minutes of easy cardio, like a light jog, brisk walk, bike or rower. Then a few easy moves for the joints you''ll train, like leg swings, arm circles and bodyweight squats. Then your warm-up sets.',
    '{}'::text[], true, 15)
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

do $$
begin
  -- Upper body
  perform pg_temp.add_quick('Quick upper body 2 (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. Barbell and cables: a bench press, a pulldown, face pulls for the back of the shoulders, then arms.',
    '[["Bench Press", 3, "8-10", 90], ["Lat Pulldown", 3, "10-12", 75], ["Cable Bar Face Pull", 3, "12-15", 45], ["Barbell Curl", 3, "10-12", 45], ["Cable Bar Pushdown", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_quick('Quick upper body 3 (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. All machines: quick to set up, easy on the joints and good for beginners or a busy gym.',
    '[["Machine Chest Press", 3, "10-12", 75], ["Machine Neutral Row", 3, "10-12", 75], ["Machine Lateral Raise", 3, "12-15", 45], ["Machine Preacher Curl", 3, "10-12", 45], ["Machine Tricep Extension", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_quick('Quick upper body 4 (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. Dumbbells only: one pair of dumbbells and a bench, with single-arm rows to even out left and right.',
    '[["Flat Dumbbell Press", 3, "8-10", 75], ["Dumbbell Single-Arm Row", 3, "10 each arm", 60], ["Seated Dumbbell Lateral Raise", 3, "12-15", 45], ["Hammer Curl", 3, "10-12", 45], ["Overhead Dumbbell Extension", 3, "10-12", 45]]'::jsonb);
  perform pg_temp.add_quick('Quick upper body 5 (30 min)',
    'Chest, back, shoulders and arms in 30 minutes. Back first: a chest-supported row to start, then incline chest, rear shoulders and cable arms.',
    '[["Chest-Supported Row", 3, "8-10", 75], ["Incline Machine Chest Press", 3, "10-12", 75], ["Reverse Pec Deck", 3, "12-15", 45], ["Cable Curl", 3, "12-15", 45], ["Single-Arm Overhead Cable Extension", 3, "12-15 each arm", 45]]'::jsonb);

  -- Lower body
  perform pg_temp.add_quick('Quick lower body 2 (30 min)',
    'Legs, glutes and core in 30 minutes. Squat focus: a barbell squat first, then lunges, a hinge for the hamstrings and calves.',
    '[["Barbell Back Squat", 3, "8-10", 120], ["Walking Lunge", 3, "10 each leg", 60], ["Good Morning", 3, "10-12", 60], ["Standing Calf Raise", 3, "12-15", 45], ["Dead Bug", 3, "10 each side", 30]]'::jsonb);
  perform pg_temp.add_quick('Quick lower body 3 (30 min)',
    'Legs, glutes and core in 30 minutes. Glutes and hamstrings: hip thrusts and Romanian deadlifts, then reverse lunges and side glutes.',
    '[["Hip Thrust", 3, "10-12", 75], ["Dumbbell Romanian Deadlift", 3, "10-12", 75], ["Dumbbell Goblet Reverse Lunge", 3, "10 each leg", 60], ["Cable Hip Abduction", 3, "15 each leg", 45], ["Elbow Side Plank", 3, "30 sec each side", 30]]'::jsonb);
  perform pg_temp.add_quick('Quick lower body 4 (30 min)',
    'Legs, glutes and core in 30 minutes. All machines: quick to set up and safe to push hard, good for beginners or a busy gym.',
    '[["Leg Press", 3, "10-12", 90], ["Machine Hip Thrust", 3, "10-12", 75], ["Seated Leg Curl", 3, "12-15", 45], ["Seated Calf Raise", 3, "12-15", 45], ["Machine Crunch", 3, "12-15", 30]]'::jsonb);
  perform pg_temp.add_quick('Quick lower body 5 (30 min)',
    'Legs, glutes and core in 30 minutes. One leg at a time: step-ups, single-leg deadlifts and side lunges for balance and evening out left and right.',
    '[["Step-Up", 3, "10 each leg", 60], ["Single-Leg Romanian Deadlift", 3, "10 each leg", 60], ["Dumbbell Lateral Lunge", 3, "10 each side", 60], ["Stability Ball Leg Curl", 3, "12", 45], ["Pallof Press", 3, "10 each side", 30]]'::jsonb);
end $$;
