-- Upper body push and pull workouts (GRIZZ, 2026-10-26): 6 push and 6 pull
-- built-in single workouts, "Upper Body Push 1".."6" and "Upper Body Pull 1".."6"
-- (clients see "Upper Body Push" / "Upper Body Pull"). Push is chest, side and
-- front shoulders and triceps; pull is back, rear shoulders, traps and biceps.
-- Each one has a different focus and kit (barbell, dumbbells, machines,
-- cables, kettlebells, bodyweight) so they don't repeat. No overhead pressing:
-- the shoulders get lateral and front raises and landmine presses instead.
-- 15 ab reps between sets like the other upper body workouts (none after
-- heavy rows, see absAfterExercise). Only inserted when a built-in program
-- with the same name isn't there yet, so it's safe to run again.

create or replace function pg_temp.add_push_pull(p_name text, p_focus text, p_rows jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
  is_push boolean := p_name like 'Upper Body Push%';
  v_description text := p_focus || case when is_push
    then ' Push day: chest, shoulders and triceps.'
    else ' Pull day: back, rear shoulders, traps and biceps.'
  end || ' Do all the sets of each exercise before moving on. Finish each set with 1-2 good reps left in the tank, and add weight next time once you hit the top of the rep range on every set. Pair it with an Upper Body '
  || case when is_push then 'Pull' else 'Push' end
  || ' workout later in the week so the front and back of your upper body get the same work.';
  v_warm_up text := case when is_push
    then '5 minutes on the rower or bike, then 2 rounds of 10 band pull-aparts, 10 arm circles each way, 10 band external rotations each arm and 10 push-ups. Do 2 light ramp-up sets of the first exercise before your working sets.'
    else '5 minutes on the rower or SkiErg, then 2 rounds of 10 band pull-aparts, 10 scapular pull-ups (hang and squeeze your shoulder blades down), 10 band face pulls and 10 cat-cows. Do 2 light ramp-up sets of the first exercise before your working sets.'
  end;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, warm_up, day_titles, abs_between_sets, abs_reps)
  values (null, p_name, 'quick', 'gym', 1, v_description, v_warm_up, '{}'::text[], true, 15)
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
  -- Push
  perform pg_temp.add_push_pull('Upper Body Push 1', 'Heavy barbell push: one big bench press first, then dumbbell, cable and landmine work.',
    '[["Bench Press", 4, "6-8", 150], ["Incline Dumbbell Press", 3, "8-10", 90], ["Cable Fly", 3, "12-15", 60], ["Landmine Press", 3, "8-10", 75], ["Dumbbell Lateral Raise", 3, "12-15", 45], ["Skull Crusher", 3, "8-10", 75], ["Cable Rope Pushdown", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Push 2', 'Upper chest focus: incline work first, then flat dumbbells and long-head triceps.',
    '[["Incline Barbell Press", 4, "6-8", 120], ["Flat Dumbbell Press", 3, "8-10", 90], ["Dumbbell Incline Chest Fly", 3, "10-12", 60], ["Leaning Cable Lateral Raise", 3, "12-15", 45], ["Cable Front Raise", 3, "12-15", 45], ["Overhead Dumbbell Extension", 3, "10-12", 60], ["V-Bar Cable Pushdown", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Push 3', 'Machine push: steady, controlled reps that are easy on the joints and let you push close to failure safely.',
    '[["Machine Chest Press", 4, "8-10", 90], ["Incline Machine Chest Press", 3, "10-12", 75], ["Machine Pec Fly", 3, "12-15", 60], ["Machine Lateral Raise", 4, "12-15", 45], ["Machine Dip", 3, "10-12", 75], ["Machine Tricep Extension", 3, "12-15", 45], ["Reverse-Grip Tricep Pushdown", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Push 4', 'Cable push: constant tension all the way through each rep, with single-arm work to even out left and right.',
    '[["Cable Incline Bench Press", 4, "8-10", 90], ["Cable Standing Single-Arm Chest Press", 3, "10-12 each arm", 60], ["Cable Low-to-High Fly", 3, "12-15", 60], ["Cable Low Single-Arm Lateral Raise", 3, "12-15 each arm", 45], ["Cable Front Raise", 3, "12-15", 45], ["Single-Arm Overhead Cable Extension", 3, "12-15 each arm", 45], ["Cable Single-Arm Rope Pushdown", 3, "12-15 each arm", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Push 5', 'Strength push: heavier presses, dips and a big triceps lift, with lower chest work.',
    '[["Smith Machine Incline Bench Press", 4, "5-7", 150], ["Chest Dip", 3, "6-10", 120], ["Dumbbell Decline Bench Press", 3, "8-10", 90], ["Single-Arm Landmine Press", 3, "8-10 each arm", 60], ["Dumbbell Lateral Raise", 4, "15-20", 45], ["JM Press", 3, "8-10", 75], ["Diamond Push-Up", 2, "10-15", 60]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Push 6', 'Free weight volume: dumbbells and kettlebells, a neutral grip that is kind to the shoulders, and a push-up finisher.',
    '[["Neutral-Grip Dumbbell Bench Press", 4, "8-10", 90], ["Kettlebell Incline Bench Press", 3, "10-12", 75], ["Single-Arm Cable Fly", 3, "12-15 each arm", 45], ["Machine Lateral Raise", 3, "12-15", 45], ["Plate Front Raise", 3, "12-15", 45], ["Tate Press", 3, "10-12", 60], ["Tricep Kickback", 3, "12-15", 45], ["Push-Up", 2, "15-20", 60]]'::jsonb);

  -- Pull
  perform pg_temp.add_push_pull('Upper Body Pull 1', 'Heavy barbell pull: a big row first, then pull-ups, cable rows and traps.',
    '[["Barbell Bent-Over Row", 4, "6-8", 150], ["Pull-Up", 3, "6-10", 120], ["Seated Cable Row", 3, "10-12", 75], ["Reverse Pec Deck", 3, "12-15", 45], ["Barbell Shrug", 3, "10-12", 60], ["Barbell Curl", 3, "8-10", 60], ["Hammer Curl", 3, "10-12", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Pull 2', 'Lat width: vertical pulls from wide, underhand and single-arm angles. Use the assisted pull-up machine or a band for chin-ups if you need to.',
    '[["Wide-Grip Lat Pulldown", 4, "8-10", 90], ["Chin-Up", 3, "6-10", 120], ["Single-Arm Lat Pulldown", 3, "10-12 each arm", 60], ["Straight-Arm Pulldown", 3, "12-15", 60], ["Cable Seated Rope Face Pull", 3, "12-15", 45], ["Incline Dumbbell Curl", 3, "10-12", 60], ["Cable Rope Hammer Curl", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Pull 3', 'Machine pull: chest-supported machines take the lower back out of it, so all the work goes into the back and arms.',
    '[["Hammer Strength Iso-Lateral Row", 4, "8-10", 90], ["Machine Pulldown", 3, "10-12", 75], ["Machine Neutral Row", 3, "10-12", 75], ["Machine Lat Pullover", 3, "12-15", 60], ["Machine Face Pull", 3, "12-15", 45], ["Smith Machine Standing Shrug", 3, "10-12", 60], ["Machine Preacher Curl", 3, "10-12", 60]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Pull 4', 'Dumbbell and single-arm pull: one side at a time to fix imbalances, with a chest-down row to keep strict form.',
    '[["Dumbbell Single-Arm Row", 4, "8-10 each arm", 75], ["Seal Row", 3, "8-10", 90], ["Cable Rope Pullover", 3, "12-15", 60], ["Dumbbell Rear-Delt Fly", 3, "12-15", 45], ["Dumbbell Shrug", 3, "12-15", 45], ["Zottman Curl", 3, "10-12", 60], ["Concentration Curl", 3, "12-15 each arm", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Pull 5', 'Back thickness: T-bar and landmine rows for the mid back, then neutral and underhand pulls for the lats.',
    '[["Chest-Supported T-Bar Row", 4, "8-10", 90], ["Meadows Row", 3, "8-10 each arm", 75], ["Neutral-Grip Lat Pulldown", 3, "10-12", 75], ["Cable Single-Arm Underhand-Grip Row", 3, "10-12 each arm", 60], ["Cable Bar Face Pull", 3, "12-15", 45], ["Bayesian Curl", 3, "10-12 each arm", 60], ["Cross-Body Hammer Curl", 3, "12-15", 45]]'::jsonb);
  perform pg_temp.add_push_pull('Upper Body Pull 6', 'Strength pull: weighted pull-ups, explosive rows from the floor, kettlebells and bodyweight. If you can''t do 8 pull-ups with your bodyweight yet, leave out the added weight or use the assisted pull-up machine.',
    '[["Weighted Pull-Up", 4, "5-8", 150], ["Pendlay Row", 3, "6-8", 120], ["Kettlebell Gorilla Row", 3, "8-10 each arm", 75], ["Inverted Row", 3, "10-15", 60], ["Dumbbell Seated Rear-Delt Fly", 3, "12-15", 45], ["Trap Bar Shrug", 3, "10-12", 60], ["Spider Curl", 3, "10-12", 60]]'::jsonb);
end $$;
