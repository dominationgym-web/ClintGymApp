-- Twelve fast 40-minute split workouts GRIZZ asked for: Chest & Bi 1-4,
-- Back & Tri 1-4 and Legs 1-4. Each is two supersets of 3 sets: the first
-- exercise goes straight into the second (rest 0), then 2 minutes' rest.
-- The client sees the name without its number (displayProgramName).
--
-- The library didn't have enough chest, back, arm and leg exercises for four
-- different workouts each, so the missing ones are added here without a
-- video yet. Setting external_url later gives them their video everywhere.

insert into public.exercises (name, category, source, external_url, sort_order)
select v.name, v.category, 'own_library', null, v.sort_order
from (values
  ('Incline Barbell Press', 'Push', 30),
  ('Flat Dumbbell Press', 'Push', 31),
  ('Machine Chest Press', 'Push', 32),
  ('Cable Fly', 'Push', 33),
  ('Chest Dip', 'Push', 34),
  ('Push-Up', 'Push', 35),
  ('Barbell Curl', 'Biceps', 36),
  ('EZ-Bar Curl', 'Biceps', 37),
  ('Hammer Curl', 'Biceps', 38),
  ('Incline Dumbbell Curl', 'Biceps', 39),
  ('Cable Curl', 'Biceps', 40),
  ('Concentration Curl', 'Biceps', 41),
  ('Seated Cable Row', 'Pull', 42),
  ('Chest-Supported Row', 'Pull', 43),
  ('Close-Grip Lat Pulldown', 'Pull', 44),
  ('Straight-Arm Pulldown', 'Pull', 45),
  ('Overhead Dumbbell Extension', 'Triceps', 46),
  ('Skull Crusher', 'Triceps', 47),
  ('Close-Grip Bench Press', 'Triceps', 48),
  ('Bench Dip', 'Triceps', 49),
  ('Overhead Cable Extension', 'Triceps', 50),
  ('Tricep Kickback', 'Triceps', 51),
  ('Leg Press', 'Legs', 52),
  ('Hack Squat', 'Legs', 53),
  ('Goblet Squat', 'Legs', 54),
  ('Step-Up', 'Legs', 55),
  ('Seated Leg Curl', 'Hamstrings', 56),
  ('Hip Thrust', 'Glutes', 57),
  ('Standing Calf Raise', 'Calves', 58),
  ('Seated Calf Raise', 'Calves', 59)
) as v (name, category, sort_order)
where not exists (select 1 from public.exercises e where e.name = v.name);

create temporary table split_rows (
  program_name text,
  sort_order smallint,
  exercise_name text,
  reps text,
  rest_seconds smallint
) on commit drop;

insert into split_rows values
  ('Chest & Bi 1', 1, 'Bench Press', '8-10', 0),
  ('Chest & Bi 1', 2, 'EZ-Bar Preacher Curl', '10-12', 120),
  ('Chest & Bi 1', 3, 'Incline Dumbbell Press', '10-12', 0),
  ('Chest & Bi 1', 4, 'Seated Dumbbell Curl', '10-12', 120),

  ('Chest & Bi 2', 1, 'Incline Barbell Press', '8-10', 0),
  ('Chest & Bi 2', 2, 'Barbell Curl', '8-10', 120),
  ('Chest & Bi 2', 3, 'Cable Fly', '12-15', 0),
  ('Chest & Bi 2', 4, 'Hammer Curl', '10-12', 120),

  ('Chest & Bi 3', 1, 'Flat Dumbbell Press', '8-10', 0),
  ('Chest & Bi 3', 2, 'Incline Dumbbell Curl', '10-12', 120),
  ('Chest & Bi 3', 3, 'Chest Dip', '8-12', 0),
  ('Chest & Bi 3', 4, 'Cable Curl', '12-15', 120),

  ('Chest & Bi 4', 1, 'Machine Chest Press', '10-12', 0),
  ('Chest & Bi 4', 2, 'EZ-Bar Curl', '8-10', 120),
  ('Chest & Bi 4', 3, 'Push-Up', 'As many as possible', 0),
  ('Chest & Bi 4', 4, 'Concentration Curl', '10-12 each arm', 120),

  ('Back & Tri 1', 1, 'Lat Pulldown', '8-10', 0),
  ('Back & Tri 1', 2, 'Cable Rope Pushdown', '10-12', 120),
  ('Back & Tri 1', 3, 'Dumbbell Row', '10-12 each arm', 0),
  ('Back & Tri 1', 4, 'Overhead Dumbbell Extension', '10-12', 120),

  ('Back & Tri 2', 1, 'Pull-Up', '6-10', 0),
  ('Back & Tri 2', 2, 'Skull Crusher', '8-10', 120),
  ('Back & Tri 2', 3, 'Seated Cable Row', '10-12', 0),
  ('Back & Tri 2', 4, 'Reverse-Grip Tricep Pushdown', '12-15', 120),

  ('Back & Tri 3', 1, 'Bent-Over Barbell Row', '8-10', 0),
  ('Back & Tri 3', 2, 'Close-Grip Bench Press', '8-10', 120),
  ('Back & Tri 3', 3, 'Straight-Arm Pulldown', '12-15', 0),
  ('Back & Tri 3', 4, 'Bench Dip', '10-15', 120),

  ('Back & Tri 4', 1, 'Chest-Supported Row', '8-10', 0),
  ('Back & Tri 4', 2, 'Overhead Cable Extension', '10-12', 120),
  ('Back & Tri 4', 3, 'Close-Grip Lat Pulldown', '10-12', 0),
  ('Back & Tri 4', 4, 'Tricep Kickback', '12-15 each arm', 120),

  ('Legs 1', 1, 'Barbell Back Squat', '8-10', 0),
  ('Legs 1', 2, 'Lying Leg Curl', '10-12', 120),
  ('Legs 1', 3, 'Walking Lunge', '10 each leg', 0),
  ('Legs 1', 4, 'Standing Calf Raise', '15', 120),

  ('Legs 2', 1, 'Leg Press', '10-12', 0),
  ('Legs 2', 2, 'Seated Leg Curl', '10-12', 120),
  ('Legs 2', 3, 'Romanian Deadlift', '8-10', 0),
  ('Legs 2', 4, 'Leg Extension', '12-15', 120),

  ('Legs 3', 1, 'Goblet Squat', '10-12', 0),
  ('Legs 3', 2, 'Hip Thrust', '10-12', 120),
  ('Legs 3', 3, 'Bulgarian Split Squat', '8-10 each leg', 0),
  ('Legs 3', 4, 'Seated Calf Raise', '15', 120),

  ('Legs 4', 1, 'Hack Squat', '8-10', 0),
  ('Legs 4', 2, 'Lying Leg Curl', '10-12', 120),
  ('Legs 4', 3, 'Step-Up', '10 each leg', 0),
  ('Legs 4', 4, 'Hip Abduction', '15', 120);

insert into public.programs (name, kind, description, day_titles)
select n.base || ' ' || g.i, 'quick',
  'Fast 40-minute session: 2 supersets of 3 sets. Do a set of the ' || n.first_part
    || ', then go straight into the ' || n.second_part
    || ' with no rest. Rest 2 minutes and repeat for 3 rounds. Then do the same with the second pair.',
  '{}'
from (values
  ('Chest & Bi', 'chest exercise', 'biceps exercise'),
  ('Back & Tri', 'back exercise', 'triceps exercise'),
  ('Legs', 'first exercise', 'second one')
) as n (base, first_part, second_part)
cross join generate_series(1, 4) as g (i)
where not exists (select 1 from public.programs p where p.trainer_id is null and p.name = n.base || ' ' || g.i);

-- 3 working sets each. Only for programs with no exercises yet, so running
-- this twice can't double them up.
insert into public.program_exercises (program_id, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds)
select p.id, 1, s.sort_order, e.id, s.exercise_name, 3, s.reps, s.rest_seconds
from split_rows s
join public.programs p on p.name = s.program_name and p.trainer_id is null
left join lateral (
  select ex.id from public.exercises ex where ex.name = s.exercise_name order by ex.sort_order limit 1
) e on true
where not exists (select 1 from public.program_exercises pe where pe.program_id = p.id);
