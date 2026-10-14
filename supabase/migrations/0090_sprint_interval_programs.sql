-- 10 sprint interval and lactate threshold workouts (GRIZZ, 2026-10-14):
-- short, varied sessions across the bike, rower, SkiErg, treadmill, stair
-- climber, sled and battle ropes. Built-in quick programs named
-- "Sprint Intervals 1".."10" (clients see "Sprint Intervals"), grouped under
-- their own heading in the program pickers.
--
-- Written from the interval research: sprint interval training (4-8 all-out
-- efforts of 20-30 sec with long recoveries) builds power and VO2max in very
-- little time; threshold work (long efforts at "comfortably hard", the pace you
-- could hold for about an hour) raises the point where lactate builds up; and
-- lactate tolerance repeats (about 60 sec at 90-95%) teach the body to keep
-- going when the legs burn.
--
-- Library cardio exercises are 'exercise' rows (sets = efforts, reps = the
-- effort, rest = the recovery, so the rest timer times it). Treadmill and
-- easy cool-downs are 'cardio' rows. Only inserted when a built-in program
-- with the same name isn't there yet.

create or replace function pg_temp.add_program(p_name text, p_description text, p_nutrition text, p_warm_up text, p_rows jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, nutrition, warm_up, day_titles)
  values (null, p_name, 'quick', 'gym', 1, p_description, p_nutrition, p_warm_up, '{}'::text[])
  returning id into prog;
  insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
  select prog, 1, 1, (r->>0)::smallint,
    case when r->>5 = 'exercise' then (select e.id from public.exercises e where e.name = r->>1 order by e.sort_order limit 1) end,
    r->>1, (r->>2)::smallint, r->>3, (r->>4)::smallint, r->>5
  from jsonb_array_elements(p_rows) r;
  if exists (select 1 from public.program_exercises pe where pe.program_id = prog and pe.kind = 'exercise' and pe.exercise_id is null) then
    raise exception 'an exercise in % is not in the library', p_name;
  end if;
end $f$;

do $$
declare
  nutrition text := 'Hard intervals run on carbs, so fuel them. Have a small, easy-to-digest carb snack 60-90 minutes before, such as a banana, toast with honey or a rice cake with peanut butter. Afterwards, eat a meal with 25-40 g of protein and some carbs, such as chicken and rice, eggs on toast, or maas with fruit. To lose fat, eat 15-25% below maintenance on the other meals of the day; to keep fit or build, eat at maintenance. Aim for 1.6-2.2 g of protein per kg a day. Drink 500 ml of water in the 2 hours before and sip during the session; on hot days or long threshold sessions, add an electrolyte drink. Avoid a heavy meal in the 2 hours before.';
  warm_up text := '8-10 minutes on the machine you are about to use: 5 minutes easy to moderate, then 3 x 10-second pick-ups at about 80% with 50 seconds easy between them. Add 10 leg swings each side and 10 walking lunges before running or sled work. Never sprint cold.';
begin
  perform pg_temp.add_program('Sprint Intervals 1', 'Bike Wingate Sprints. The classic sprint interval session: 6 all-out 30-second sprints on the Assault bike with 4 minutes of very easy pedalling between them, then a 5-minute easy spin (about 32 min). All-out means as hard as you possibly can from the first second; the long rest is what lets you hit every sprint hard. Start with 4 sprints and build to 6. Once a week is plenty, with 48 hours before your next hard session.',
    nutrition, warm_up,
    '[[1, "Assault Bike", 6, "30 sec all-out", 240, "exercise"], [2, "Cycle", 1, "5 min easy spin to cool down", 0, "cardio"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 2', 'Rower 250 m Repeats. 8 hard 250 m pieces on the rower with 90 seconds easy between them, then a short core finisher (about 25 min). Row each 250 m at about 85-90% effort and aim to keep every split within 3 seconds of your first; if you drop more than that, rest a little longer. Drive with the legs first, then lean back, then pull.',
    nutrition, warm_up,
    '[[1, "Rowing Sprint", 8, "250 m hard (85-90%)", 90, "exercise"], [2, "Dead Bug", 3, "40 sec", 20, "exercise"], [3, "Hand Plank", 3, "40 sec", 40, "exercise"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 3', 'Lactate Threshold Bike 3 x 10. A threshold session: 3 blocks of 10 minutes at threshold on the bike with 3 minutes easy between them (36 min). Threshold is "comfortably hard": about 7/10 effort, breathing hard but steady, able to say a few words but not chat, the pace you could just about hold for an hour. Ride it evenly; the last block should feel hard but controlled, not a sprint.',
    nutrition, warm_up,
    '[[1, "Cycle", 1, "3 x 10 min at threshold (7/10) / 3 min easy", 0, "cardio"], [2, "Cycle", 1, "4 min easy spin to cool down", 0, "cardio"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 4', 'Treadmill Threshold Cruise. 5 x 5-minute runs at threshold pace with 1 minute walking between them (30 min). Set the speed to the pace you could hold for about an hour, around 7/10 effort; if you can''t hold it for the fifth rep, go 0.5 km/h slower next time. Use a 1% incline to match running outside.',
    nutrition, warm_up,
    '[[1, "Treadmill", 1, "5 x 5 min at threshold pace / 1 min walk", 0, "cardio"], [2, "Treadmill", 1, "3 min easy walk to cool down", 0, "cardio"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 5', 'SkiErg & Sled Sprints. Part 1: 6 all-out 20-second SkiErg sprints with 100 seconds easy between them (12 min). Part 2: 6 heavy sled push sprints of about 15 m with 90 seconds rest (about 10 min). Upper body first, then legs, so each part is fresh. Load the sled so a push takes 8-12 seconds of hard driving; stay low with straight arms.',
    nutrition, warm_up,
    '[[1, "SkiErg", 6, "20 sec all-out", 100, "exercise"], [2, "Sled Push", 6, "15 m sprint push", 90, "exercise"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 6', 'Rower Over-Unders. A threshold session that teaches your body to clear lactate: 4 blocks of 6 minutes, switching every minute between just above threshold (8/10) and just below it (6/10), with 3 minutes easy between blocks (33 min). On the "over" minutes push 2-3 seconds per 500 m faster than your threshold split; on the "unders" ease off but keep rowing steady, never stopping.',
    nutrition, warm_up,
    '[[1, "Rowing Intervals", 4, "6 min: 1 min over / 1 min under threshold", 180, "exercise"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 7', 'Lactate Tolerance 60s. Six 60-second efforts on the bike at 90-95% with 2 minutes easy between them, then four 60-second SkiErg efforts at 90% with 2 minutes easy (about 30 min). This is the burn session: your legs and arms will fill with lactate, and the job is to hold your pace through it. Keep each effort even rather than starting all-out and fading.',
    nutrition, warm_up,
    '[[1, "Cycling Sprint", 6, "60 sec at 90-95%", 120, "exercise"], [2, "SkiErg", 4, "60 sec at 90%", 120, "exercise"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 8', 'Incline Sprint Ladder + Stairs. Part 1: a treadmill sprint ladder on an 8% incline of 10, 20, 30, 40, 30, 20 and 10 seconds, walking for 3 times as long as each sprint (about 9 min). Part 2: 3 x 3 minutes on the stair climber at threshold with 1 minute rest (12 min). Incline sprints are kind to the knees and hamstrings; hold the rails only to get on and off.',
    nutrition, warm_up,
    '[[1, "Treadmill", 1, "8% incline: 10/20/30/40/30/20/10 sec sprints, walk 3x as long after each", 0, "cardio"], [2, "Stair Climber", 3, "3 min at threshold (7/10)", 60, "exercise"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 9', 'Machine Medley. 5 rounds of 30 seconds hard on each of 4 stations, straight from one to the next, with 90 seconds rest after each round (about 20 min): Assault bike, rower, SkiErg, battle ropes. Work at about 85% so round 5 matches round 1. Set the machines up next to each other before you start so you lose no time switching.',
    nutrition, warm_up,
    '[[1, "Assault Bike", 5, "30 sec hard", 0, "exercise"], [2, "Rowing Sprint", 5, "30 sec hard", 0, "exercise"], [3, "SkiErg", 5, "30 sec hard", 0, "exercise"], [4, "Battle Ropes", 5, "30 sec hard", 90, "exercise"]]'::jsonb);
  perform pg_temp.add_program('Sprint Intervals 10', 'Threshold + Speed. Part 1: 2 x 12 minutes at threshold on the rower with 4 minutes easy between them (28 min). Part 2: 6 flat-out 10-second bike sprints with 50 seconds easy between them (6 min). The long threshold work builds your engine, and the short sprints at the end keep your top speed sharp without much extra fatigue.',
    nutrition, warm_up,
    '[[1, "Rowing Intervals", 2, "12 min at threshold (7/10)", 240, "exercise"], [2, "Cycling Sprint", 6, "10 sec flat-out", 50, "exercise"]]'::jsonb);
end $$;
