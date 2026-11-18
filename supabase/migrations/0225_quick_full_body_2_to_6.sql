-- Quick full body 2-6 (GRIZZ, 2026-11-18: "add another 5 well structured
-- Quick full body workouts. We only have 1."). Built like the first one
-- (0042): one exercise per body part, chest 4 sets, back 4 sets, legs 3,
-- hamstrings 3, biceps 3, triceps 3, about 35 minutes, with the same warm-up
-- and 15 ab reps between sets. Each has its own kit so they don't repeat:
-- dumbbells only, all machines, barbell strength, plate-loaded and cables,
-- and one leg / one arm at a time. No overhead pressing. Every exercise is in
-- the library with its video. Named "Quick full body 2 (35 min)".."6" so they
-- sit on the Quick full body card next to the first one.
-- Only inserted when a built-in program with the same name isn't there yet,
-- so it's safe to run again.

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

do $$
declare
  t text := 'Quick full body (35 min)';
begin
  perform pg_temp.add_like('Quick full body 2 (35 min)', t,
    'For a client short on time: one exercise per body part with one pair of dumbbells and a bench. Chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets.',
    '[["Flat Dumbbell Press", 4, "8-10", 90], ["Dumbbell Single-Arm Row", 4, "10 each arm", 90], ["Goblet Squat", 3, "10-12", 90], ["Single-Leg Dumbbell Romanian Deadlift", 3, "8-10 each leg", 60], ["Hammer Curl", 3, "10-12", 45], ["Overhead Dumbbell Extension", 3, "10-12", 45]]'::jsonb);
  perform pg_temp.add_like('Quick full body 3 (35 min)', t,
    'For a client short on time: one exercise per body part, all on machines. Quick to set up, easy on the joints and good for beginners or a busy gym. Chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets.',
    '[["Machine Chest Press", 4, "10-12", 75], ["Machine Neutral Row", 4, "10-12", 75], ["Hack Squat", 3, "10-12", 90], ["Seated Leg Curl", 3, "12-15", 60], ["Machine Preacher Curl", 3, "10-12", 45], ["Machine Tricep Extension", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_like('Quick full body 4 (35 min)', t,
    'For a client short on time who wants to get stronger: one barbell exercise per body part, lower reps and a bit more rest. Chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets.',
    '[["Incline Barbell Press", 4, "6-8", 90], ["Bent-Over Barbell Row", 4, "6-8", 90], ["Barbell Back Squat", 3, "6-8", 120], ["Romanian Deadlift", 3, "8-10", 75], ["Barbell Curl", 3, "8-10", 45], ["Close-Grip Bench Press", 3, "8-10", 60]]'::jsonb);
  perform pg_temp.add_like('Quick full body 5 (35 min)', t,
    'For a client short on time: one exercise per body part on plate-loaded machines and cables. Safe to push hard with no spotter. Chest 4 sets, back 4 sets, legs 3 sets, glutes and hamstrings 3 sets, biceps 3 sets, triceps 3 sets.',
    '[["Hammer Strength Chest Press", 4, "8-10", 90], ["Chest-Supported T-Bar Row", 4, "8-10", 90], ["Pendulum Squat (V-Squat)", 3, "10-12", 90], ["Machine Hip Thrust", 3, "10-12", 60], ["Cable Curl", 3, "12-15", 45], ["Cable Bar Pushdown", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_like('Quick full body 6 (35 min)', t,
    'For a client short on time: one exercise per body part, with legs and arms done one side at a time to even out left and right. Chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets.',
    '[["Incline Dumbbell Press", 4, "8-10", 90], ["Neutral-Grip Lat Pulldown", 4, "10-12", 90], ["Dumbbell Bulgarian Split Squat", 3, "8-10 each leg", 75], ["Cable Single-Leg Lying Leg Curl", 3, "12 each leg", 45], ["Bayesian Curl", 3, "10-12 each arm", 45], ["Single-Arm Overhead Cable Extension", 3, "12-15 each arm", 45]]'::jsonb);
end $$;
