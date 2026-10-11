-- Full body becomes Monday, Wednesday and Friday, in 5 variations (GRIZZ,
-- 2026-10-11). Same structure in every workout: chest 4 sets, legs 3 sets,
-- back 4 sets, hamstrings 3 sets, biceps 4 sets, triceps 4 sets. Each
-- variation is one workout done on all three days; the trainer moves a client
-- on to the next variation when they want a change.
--
-- The old six-day "Full body week" becomes variation 1 (no client was on it),
-- and its exercise rows are reused rather than deleted.
-- Clients see the name without the number: "Full body 3-day".

do $$
declare
  old_id uuid := (select id from public.programs where trainer_id is null and name = 'Full body week');
  spare uuid[];
  prog uuid;
  v integer;
  d integer;
  i integer;
  -- [variation][slot] = name, sets, reps, rest
  plan jsonb := '[
    [["Bench Press",4,"6-8",120],["Barbell Back Squat",3,"6-8",120],["Pull-Up",4,"6-10",120],["Romanian Deadlift",3,"8-10",90],["EZ-Bar Curl",4,"8-10",60],["Cable Rope Pushdown",4,"10-12",60]],
    [["Incline Dumbbell Press",4,"8-10",90],["Leg Press",3,"10-12",90],["Barbell Bent-Over Row",4,"8-10",90],["Lying Leg Curl",3,"10-12",60],["Incline Dumbbell Curl",4,"10-12",60],["Overhead Cable Extension",4,"10-12",60]],
    [["Flat Dumbbell Press",4,"8-10",90],["Bulgarian Split Squat",3,"8-10 each leg",90],["Lat Pulldown",4,"10-12",90],["Seated Leg Curl",3,"10-12",60],["Hammer Curl",4,"10-12",60],["Skull Crusher",4,"8-10",60]],
    [["Incline Machine Chest Press",4,"10-12",90],["Goblet Squat",3,"10-12",90],["Chest-Supported Row",4,"8-10",90],["Single-Leg Romanian Deadlift",3,"8-10 each leg",90],["Dumbbell Preacher Curl",4,"10-12",60],["Close-Grip Bench Press",4,"8-10",60]],
    [["Cable Fly",4,"12-15",60],["Walking Lunge",3,"10 each leg",90],["Seated Cable Row",4,"10-12",90],["Nordic Hamstring Curl",3,"5-8",90],["Bayesian Curl",4,"10-12",60],["Machine Dip",4,"10-12",60]]
  ]';
  slot jsonb;
  ex_id uuid;
  reuse uuid;
  k integer := 0;
begin
  select coalesce(array_agg(id order by day_number, sort_order), '{}') into spare from public.program_exercises where program_id = old_id;

  for v in 1..5 loop
    if v = 1 and old_id is not null then
      prog := old_id;
    else
      select id into prog from public.programs where trainer_id is null and name = 'Full body 3-day ' || v;
      if prog is null then
        insert into public.programs (trainer_id, name, kind, place)
        values (null, 'Full body 3-day ' || v, 'weekly', 'gym')
        returning id into prog;
      end if;
    end if;

    update public.programs
    set name = 'Full body 3-day ' || v,
        kind = 'weekly',
        place = 'gym',
        day_titles = array['Full body', 'Rest day', 'Full body', 'Rest day', 'Full body', 'Rest day', 'Rest day'],
        description = 'Variation ' || v || ' of 5. Full body on Monday, Wednesday and Friday: chest 4 sets, legs 3 sets, '
          || 'back 4 sets, hamstrings 3 sets, biceps 4 sets, triceps 4 sets. Move on to the next variation when you want a change.'
    where id = prog;

    foreach d in array array[1, 3, 5] loop
      for i in 0..5 loop
        slot := plan -> (v - 1) -> i;
        select e.id into ex_id from public.exercises e where e.name = slot ->> 0 limit 1;
        if ex_id is null then
          raise exception 'exercise % not in the library', slot ->> 0;
        end if;
        k := k + 1;
        reuse := spare[k];
        if reuse is not null then
          update public.program_exercises
          set program_id = prog, day_number = d, sort_order = i + 1, exercise_id = ex_id, exercise_name = slot ->> 0,
              sets = (slot ->> 1)::smallint, reps = slot ->> 2, rest_seconds = (slot ->> 3)::smallint, kind = 'exercise'
          where id = reuse;
        else
          insert into public.program_exercises (program_id, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
          values (prog, d, i + 1, ex_id, slot ->> 0, (slot ->> 1)::smallint, slot ->> 2, (slot ->> 3)::smallint, 'exercise');
        end if;
      end loop;
    end loop;
  end loop;
end $$;
