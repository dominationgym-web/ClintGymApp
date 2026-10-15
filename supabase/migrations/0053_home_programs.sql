-- Ready-made home programs (GRIZZ, 2026-10-10), with the same structure as
-- the gym ones: a full-body week, three quick sessions and twelve 40-minute
-- superset workouts. Every exercise is home friendly and needs at most a pair
-- of dumbbells, a resistance band and a sturdy chair or bench. No hack squats.
--
-- programs.place says whether a program is for the gym or for home, so the
-- trainer's program list can show the right ones for each client.

alter table public.programs
  add column if not exists place text not null default 'gym' check (place in ('gym', 'home'));

create temporary table home_programs (
  name text,
  kind text,
  description text,
  day_titles text[]
) on commit drop;

insert into home_programs values
  ('Home full body week', 'weekly',
   'Six different full-body home workouts, Monday to Saturday, Sunday off. Each one: chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets, with new exercises every day. Needs dumbbells, a resistance band and a sturdy chair.',
   array['Full body 1', 'Full body 2', 'Full body 3', 'Full body 4', 'Full body 5', 'Full body 6', 'Rest day']),
  ('Home quick full body (35 min)', 'quick',
   'For a client short on time, at home: one exercise per body part. Chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets. Needs dumbbells and a chair.',
   '{}'),
  ('Home quick upper body (30 min)', 'quick', 'Chest, back, shoulders and arms at home in 30 minutes. Needs dumbbells.', '{}'),
  ('Home quick lower body (30 min)', 'quick', 'Legs, glutes and core at home in 30 minutes. Needs dumbbells and a towel.', '{}');

insert into home_programs
select 'Home ' || n.base || ' ' || g.i, 'quick',
  'Fast 40-minute home session: 2 supersets of 3 sets. Do a set of the ' || n.first_part
    || ', then go straight into the ' || n.second_part
    || ' with no rest. Rest 2 minutes and repeat for 3 rounds. Then do the same with the second pair. Needs dumbbells, a resistance band and a sturdy chair.',
  '{}'
from (values
  ('Chest & Bi', 'chest exercise', 'biceps exercise'),
  ('Back & Tri', 'back exercise', 'triceps exercise'),
  ('Legs', 'first exercise', 'second one')
) as n (base, first_part, second_part)
cross join generate_series(1, 4) as g (i);

insert into public.programs (name, kind, description, day_titles, place)
select h.name, h.kind, h.description, h.day_titles, 'home'
from home_programs h
where not exists (select 1 from public.programs p where p.trainer_id is null and p.name = h.name);

create temporary table home_rows (
  program_name text,
  day_number smallint,
  sort_order smallint,
  exercise_name text,
  sets smallint,
  reps text,
  rest_seconds smallint
) on commit drop;

insert into home_rows values
  -- Full body week. Monday
  ('Home full body week', 1, 1, 'Push-Up', 4, '10-15', 90),
  ('Home full body week', 1, 2, 'Dumbbell Row', 4, '10-12 each arm', 90),
  ('Home full body week', 1, 3, 'Goblet Squat', 3, '12-15', 90),
  ('Home full body week', 1, 4, 'Single-Leg Dumbbell Romanian Deadlift', 3, '8-10 each leg', 60),
  ('Home full body week', 1, 5, 'Dumbbell Curl', 3, '10-12', 60),
  ('Home full body week', 1, 6, 'Bench Dip', 3, '10-15', 60),
  -- Tuesday
  ('Home full body week', 2, 1, 'Floor Press', 4, '8-10', 90),
  ('Home full body week', 2, 2, 'Band Seated Pulldown', 4, '12-15', 90),
  ('Home full body week', 2, 3, 'Dumbbell Bulgarian Split Squat', 3, '8-10 each leg', 90),
  ('Home full body week', 2, 4, 'Dumbbell Leg Curl', 3, '10-12', 60),
  ('Home full body week', 2, 5, 'Hammer Curl', 3, '10-12', 60),
  ('Home full body week', 2, 6, 'Overhead Dumbbell Extension', 3, '10-12', 60),
  -- Wednesday
  ('Home full body week', 3, 1, 'Decline Push-Up', 4, '8-12', 90),
  ('Home full body week', 3, 2, 'Band Row', 4, '12-15', 90),
  ('Home full body week', 3, 3, 'Dumbbell Goblet Reverse Lunge', 3, '10 each leg', 90),
  ('Home full body week', 3, 4, 'Towel Slide Leg Curl', 3, '10-12', 60),
  ('Home full body week', 3, 5, 'Zottman Curl', 3, '10-12', 60),
  ('Home full body week', 3, 6, 'Diamond Push-Up', 3, '8-12', 60),
  -- Thursday
  ('Home full body week', 4, 1, 'Dumbbell Chest Fly', 4, '12-15', 60),
  ('Home full body week', 4, 2, 'Dumbbell Single-Arm Row', 4, '10-12 each arm', 90),
  ('Home full body week', 4, 3, 'Dumbbell Sumo Squat', 3, '12-15', 90),
  ('Home full body week', 4, 4, 'Good Morning', 3, '10-12', 60),
  ('Home full body week', 4, 5, 'Concentration Curl', 3, '10-12 each arm', 60),
  ('Home full body week', 4, 6, 'Tricep Kickback', 3, '12-15 each arm', 60),
  -- Friday
  ('Home full body week', 5, 1, 'Dumbbell Single-Arm Chest Press', 4, '10-12 each arm', 90),
  ('Home full body week', 5, 2, 'Band Pullover', 4, '12-15', 60),
  ('Home full body week', 5, 3, 'Step-Up', 3, '10 each leg', 90),
  ('Home full body week', 5, 4, 'Nordic Hamstring Curl', 3, '5-8', 90),
  ('Home full body week', 5, 5, 'Seated Dumbbell Curl', 3, '10-12', 60),
  ('Home full body week', 5, 6, 'Single-Arm Tricep Extension', 3, '10-12 each arm', 60),
  -- Saturday
  ('Home full body week', 6, 1, 'Bodyweight Elevated Push-Up', 4, '10-15', 90),
  ('Home full body week', 6, 2, 'Inverted Row', 4, '8-12', 90),
  ('Home full body week', 6, 3, 'Dumbbell Lateral Lunge', 3, '10 each leg', 90),
  ('Home full body week', 6, 4, 'Band Leg Curl', 3, '12-15', 60),
  ('Home full body week', 6, 5, 'Band Curl', 3, '15', 60),
  ('Home full body week', 6, 6, 'Skull Crusher', 3, '10-12', 60),

  ('Home quick full body (35 min)', 1, 1, 'Push-Up', 4, '10-15', 90),
  ('Home quick full body (35 min)', 1, 2, 'Dumbbell Row', 4, '10-12 each arm', 90),
  ('Home quick full body (35 min)', 1, 3, 'Goblet Squat', 3, '12-15', 90),
  ('Home quick full body (35 min)', 1, 4, 'Single-Leg Dumbbell Romanian Deadlift', 3, '8-10 each leg', 60),
  ('Home quick full body (35 min)', 1, 5, 'Seated Dumbbell Curl', 3, '10-12', 45),
  ('Home quick full body (35 min)', 1, 6, 'Bench Dip', 3, '10-15', 45),

  ('Home quick upper body (30 min)', 1, 1, 'Floor Press', 3, '10-12', 60),
  ('Home quick upper body (30 min)', 1, 2, 'Dumbbell Single-Arm Row', 3, '10-12 each arm', 60),
  ('Home quick upper body (30 min)', 1, 3, 'Dumbbell Lateral Raise', 3, '12-15', 45),
  ('Home quick upper body (30 min)', 1, 4, 'Overhead Dumbbell Extension', 3, '12-15', 45),
  ('Home quick upper body (30 min)', 1, 5, 'Hammer Curl', 3, '12', 45),

  ('Home quick lower body (30 min)', 1, 1, 'Dumbbell Bulgarian Split Squat', 3, '10 each leg', 60),
  ('Home quick lower body (30 min)', 1, 2, 'Single-Leg Dumbbell Romanian Deadlift', 3, '10 each leg', 90),
  ('Home quick lower body (30 min)', 1, 3, 'Dumbbell Goblet Reverse Lunge', 3, '10 each leg', 45),
  ('Home quick lower body (30 min)', 1, 4, 'Towel Slide Leg Curl', 3, '12-15', 45),
  ('Home quick lower body (30 min)', 1, 5, 'Plank', 3, '45 sec', 45),

  -- Supersets: the first exercise goes straight into the second (rest 0),
  -- then 2 minutes' rest. 3 working sets each.
  ('Home Chest & Bi 1', 1, 1, 'Push-Up', 3, 'As many as possible', 0),
  ('Home Chest & Bi 1', 1, 2, 'Dumbbell Curl', 3, '10-12', 120),
  ('Home Chest & Bi 1', 1, 3, 'Dumbbell Chest Fly', 3, '12-15', 0),
  ('Home Chest & Bi 1', 1, 4, 'Hammer Curl', 3, '10-12', 120),

  ('Home Chest & Bi 2', 1, 1, 'Floor Press', 3, '8-10', 0),
  ('Home Chest & Bi 2', 1, 2, 'Zottman Curl', 3, '10-12', 120),
  ('Home Chest & Bi 2', 1, 3, 'Decline Push-Up', 3, '8-12', 0),
  ('Home Chest & Bi 2', 1, 4, 'Concentration Curl', 3, '10-12 each arm', 120),

  ('Home Chest & Bi 3', 1, 1, 'Dumbbell Single-Arm Chest Press', 3, '10-12 each arm', 0),
  ('Home Chest & Bi 3', 1, 2, 'Seated Dumbbell Curl', 3, '10-12', 120),
  ('Home Chest & Bi 3', 1, 3, 'Incline Push-Up', 3, '12-15', 0),
  ('Home Chest & Bi 3', 1, 4, 'Band Curl', 3, '15', 120),

  ('Home Chest & Bi 4', 1, 1, 'Bodyweight Elevated Push-Up', 3, '10-15', 0),
  ('Home Chest & Bi 4', 1, 2, 'Cross-Body Hammer Curl', 3, '10-12', 120),
  ('Home Chest & Bi 4', 1, 3, 'Push-Up', 3, '8-10, 3 seconds down', 0),
  ('Home Chest & Bi 4', 1, 4, 'Dumbbell Standing Single-Arm Curl', 3, '10-12 each arm', 120),

  ('Home Back & Tri 1', 1, 1, 'Dumbbell Row', 3, '10-12 each arm', 0),
  ('Home Back & Tri 1', 1, 2, 'Overhead Dumbbell Extension', 3, '10-12', 120),
  ('Home Back & Tri 1', 1, 3, 'Band Row', 3, '12-15', 0),
  ('Home Back & Tri 1', 1, 4, 'Bench Dip', 3, '10-15', 120),

  ('Home Back & Tri 2', 1, 1, 'Band Seated Pulldown', 3, '12-15', 0),
  ('Home Back & Tri 2', 1, 2, 'Diamond Push-Up', 3, '8-12', 120),
  ('Home Back & Tri 2', 1, 3, 'Band Pullover', 3, '12-15', 0),
  ('Home Back & Tri 2', 1, 4, 'Tricep Kickback', 3, '12-15 each arm', 120),

  ('Home Back & Tri 3', 1, 1, 'Inverted Row', 3, '8-12', 0),
  ('Home Back & Tri 3', 1, 2, 'Skull Crusher', 3, '10-12', 120),
  ('Home Back & Tri 3', 1, 3, 'Dumbbell Single-Arm Row', 3, '10-12 each arm', 0),
  ('Home Back & Tri 3', 1, 4, 'Single-Arm Tricep Extension', 3, '10-12 each arm', 120),

  ('Home Back & Tri 4', 1, 1, 'Band Kneeling Pulldown', 3, '12-15', 0),
  ('Home Back & Tri 4', 1, 2, 'Tate Press', 3, '10-12', 120),
  ('Home Back & Tri 4', 1, 3, 'Single-Arm Dumbbell Row (Unilateral)', 3, '10-12 each arm', 0),
  ('Home Back & Tri 4', 1, 4, 'Overhead Dumbbell Extension', 3, '12-15', 120),

  ('Home Legs 1', 1, 1, 'Goblet Squat', 3, '12-15', 0),
  ('Home Legs 1', 1, 2, 'Dumbbell Leg Curl', 3, '10-12', 120),
  ('Home Legs 1', 1, 3, 'Dumbbell Goblet Reverse Lunge', 3, '10 each leg', 0),
  ('Home Legs 1', 1, 4, 'Dumbbell Single-Leg Calf Raise', 3, '15 each leg', 120),

  ('Home Legs 2', 1, 1, 'Dumbbell Bulgarian Split Squat', 3, '8-10 each leg', 0),
  ('Home Legs 2', 1, 2, 'Single-Leg Glute Bridge', 3, '12 each leg', 120),
  ('Home Legs 2', 1, 3, 'Dumbbell Sumo Squat', 3, '12-15', 0),
  ('Home Legs 2', 1, 4, 'Towel Slide Leg Curl', 3, '10-12', 120),

  ('Home Legs 3', 1, 1, 'Step-Up', 3, '10 each leg', 0),
  ('Home Legs 3', 1, 2, 'Single-Leg Dumbbell Romanian Deadlift', 3, '8-10 each leg', 120),
  ('Home Legs 3', 1, 3, 'Dumbbell Lateral Lunge', 3, '10 each leg', 0),
  ('Home Legs 3', 1, 4, 'Single-Leg Standing Calf Raise', 3, '15 each leg', 120),

  ('Home Legs 4', 1, 1, 'Dumbbell Front Squat', 3, '10-12', 0),
  ('Home Legs 4', 1, 2, 'Nordic Hamstring Curl', 3, '5-8', 120),
  ('Home Legs 4', 1, 3, 'Dumbbell Goblet Split Squat', 3, '8-10 each leg', 0),
  ('Home Legs 4', 1, 4, 'Band Hip Abduction', 3, '15-20', 120);

-- Only for programs with no exercises yet, so running this twice can't double them up.
insert into public.program_exercises (program_id, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds)
select p.id, r.day_number, r.sort_order, e.id, r.exercise_name, r.sets, r.reps, r.rest_seconds
from home_rows r
join public.programs p on p.name = r.program_name and p.trainer_id is null
left join lateral (
  select ex.id from public.exercises ex where ex.name = r.exercise_name order by ex.sort_order limit 1
) e on true
where not exists (select 1 from public.program_exercises pe where pe.program_id = p.id);
