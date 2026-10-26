-- APRE Program (GRIZZ, 2026-10-26): Autoregulating Progressive Resistance
-- Exercise, as coach Danny Williams runs it. The weight follows what the
-- client can do on the day (Mann et al. 2010, J Strength Cond Res: APRE beat
-- fixed linear periodisation over 6 weeks; Siff's original protocol):
--   your 7-rep weight: one you think you can lift about 7 times
--   set 1: 10-12 reps at 50%, rest 1 min
--   set 2: 8-10 reps at 75%, rest 2 min
--   set 3: the 7-rep weight for as many clean reps as you can
--   next session: 7+ reps → 5% more, 5-6 → the same, under 5 twice in a row → 5% less
-- After 6-12 weeks he adds a fourth set (a second all-out set). The app works
-- each set's weight out from rows whose reps start with "APRE" (src/lib/apre.ts).
--
-- 16 weeks, three sessions a week every other day with the weekend off
-- (Mon push, Wed pull, Fri legs), 3 exercises per body part. GRIZZ: "needs
-- to be followed for a while before changing", so the exercises stay the
-- same for 8 weeks (long enough to keep progressing on each lift, inside the
-- 6-12 weeks Danny uses), then block 2 (weeks 9-16) changes the variations
-- and adds the fourth set. No fixed deload weeks: the 5% drop after two
-- short sessions does that job. No overhead pressing and no bodyweight-only
-- lifts (every set needs a weight to work from). Re-runnable.

create or replace function pg_temp.add_apre(p_name text, p_description text, p_warm_up text, p_titles jsonb, p_tpl jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
  titles text[] := '{}';
  w int;
  dd int;
  bk text;
  d text;
  r jsonb;
  i int;
  four boolean;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  for w in 1..16 loop
    for dd in 1..7 loop
      titles := titles || case when p_titles ? dd::text
        then 'Block ' || case when w <= 8 then 1 else 2 end || ': ' || (p_titles ->> dd::text)
        else 'Rest and recover' end;
    end loop;
  end loop;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, warm_up, day_titles)
  values (null, p_name, 'weekly', 'gym', 16, p_description, p_warm_up, titles)
  returning id into prog;
  for w in 1..16 loop
    four := w > 8;
    bk := case when four then 'b2' else 'b1' end;
    for d in select jsonb_object_keys(p_tpl -> bk) loop
      i := 0;
      for r in select * from jsonb_array_elements(p_tpl -> bk -> d) loop
        i := i + 1;
        insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
        values (prog, w, d::smallint, i,
          (select e.id from public.exercises e where e.name = r #>> '{}' order by e.sort_order limit 1),
          r #>> '{}', case when four then 4 else 3 end,
          case when four then 'APRE: 10-12, 8-10, 7+, 7+' else 'APRE: 10-12, 8-10, 7+' end,
          120, 'exercise');
      end loop;
    end loop;
  end loop;
  if exists (select 1 from public.program_exercises pe where pe.program_id = prog and pe.exercise_id is null) then
    raise exception 'an exercise in % is not in the library', p_name;
  end if;
end $f$;

select pg_temp.add_apre('APRE Program',
'APRE (autoregulating progressive resistance exercise): the weight follows what you can actually do on the day, so you keep getting stronger without guessing. Three sessions a week, every other day with the weekend off: Monday chest and triceps, Wednesday back and biceps, Friday legs, with 3 exercises for each body part.
Each exercise starts from your 7-rep weight (a weight you think you can lift about 7 times). Set 1: 10-12 easy reps at half of it, rest 1 minute. Set 2: 8-10 reps at 75%, rest 2 minutes. Set 3: your 7-rep weight for as many clean reps as you can, stopping when the next rep would break your form. The app works out every weight for you.
Next session: 7 or more reps on your all-out set and the weight goes up 5%. 5 or 6 reps, it stays the same. Under 5 reps two sessions in a row, it comes down 5%.
Block 1 (weeks 1-8): the same exercises every week so you can keep beating your numbers. Block 2 (weeks 9-16): new variations and a fourth set, a second all-out set where the weight moves with what you did on set 3.
There are no set deload weeks: the 5% drop takes care of a bad patch. Use a spotter or the safety pins on squats and bench press. Sleep 7-9 hours and eat enough protein (1.6-2.2 g per kg of bodyweight a day) to recover between sessions.',
'5 minutes easy on the bike, rower or treadmill, then 10 leg swings each way, 10 hip circles, 10 band pull-aparts and 10 arm circles each way. Sets 1 and 2 of each exercise are your warm-up for the heavy set.',
'{"1": "Chest & triceps", "3": "Back & biceps", "5": "Legs"}'::jsonb,
'{"b1":{"1":["Bench Press","Incline Dumbbell Press","Machine Chest Press","Close-Grip Bench Press","Skull Crusher","Cable Rope Pushdown"],"3":["Lat Pulldown","Barbell Bent-Over Row","Seated Cable Row","Barbell Curl","Incline Dumbbell Curl","Hammer Curl"],"5":["Barbell Back Squat","Leg Press","Leg Extension","Romanian Deadlift","Hip Thrust","Lying Leg Curl"]},"b2":{"1":["Incline Barbell Press","Flat Dumbbell Press","Cable Chest Press","JM Press","Machine Dip","Overhead Cable Extension"],"3":["Neutral-Grip Lat Pulldown","Chest-Supported T-Bar Row","Dumbbell Single-Arm Row","Close-Grip Barbell Curl","Machine Preacher Curl","Cable Rope Hammer Curl"],"5":["Front Squat","Dumbbell Bulgarian Split Squat","Machine Plate-Loaded Leg Extension","Trap Bar Deadlift","Machine Hip Thrust","Seated Leg Curl"]}}'::jsonb);
