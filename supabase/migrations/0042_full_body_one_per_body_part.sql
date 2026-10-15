-- GRIZZ's new full-body structure (2026-10-10): one exercise per body part,
-- in this order: chest 4 sets, back 4 sets, a leg compound or quad exercise
-- 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets. Every training
-- day of the week uses different exercises and angles (range of motion).
--
-- Rows are rewritten in place (update where the slot exists, insert where it
-- doesn't) rather than deleted and re-added, so the SQL has no DELETE.

create temporary table full_body_rows (
  program_name text,
  day_number smallint,
  sort_order smallint,
  exercise_name text,
  sets smallint,
  reps text,
  rest_seconds smallint
) on commit drop;

insert into full_body_rows
select 'Full body week', v.day_number, v.sort_order, v.exercise_name, v.sets, v.reps, v.rest_seconds
from (values
  -- Monday: flat press, vertical pull, back squat
  (1, 1, 'Bench Press', 4, '6-8', 120),
  (1, 2, 'Pull-Up', 4, '6-10', 120),
  (1, 3, 'Barbell Back Squat', 3, '6-8', 120),
  (1, 4, 'Lying Leg Curl', 3, '10-12', 60),
  (1, 5, 'EZ-Bar Preacher Curl', 3, '10-12', 60),
  (1, 6, 'Cable Rope Pushdown', 3, '10-12', 60),
  -- Tuesday: incline press, horizontal row, leg press
  (2, 1, 'Incline Dumbbell Press', 4, '8-10', 90),
  (2, 2, 'Bent-Over Barbell Row', 4, '8-10', 90),
  (2, 3, 'Leg Press', 3, '10-12', 90),
  (2, 4, 'Romanian Deadlift', 3, '8-10', 90),
  (2, 5, 'Hammer Curl', 3, '10-12', 60),
  (2, 6, 'Overhead Dumbbell Extension', 3, '10-12', 60),
  -- Wednesday: decline press, wide pulldown, single-leg squat
  (3, 1, 'Decline Barbell Bench Press', 4, '8-10', 90),
  (3, 2, 'Lat Pulldown', 4, '10-12', 90),
  (3, 3, 'Bulgarian Split Squat', 3, '8-10 each leg', 90),
  (3, 4, 'Seated Leg Curl', 3, '10-12', 60),
  (3, 5, 'Incline Dumbbell Curl', 3, '10-12', 60),
  (3, 6, 'Skull Crusher', 3, '8-10', 60),
  -- Thursday: flat dumbbell press, seated row, hack squat
  (4, 1, 'Flat Dumbbell Press', 4, '8-10', 90),
  (4, 2, 'Seated Cable Row', 4, '10-12', 90),
  (4, 3, 'Hack Squat', 3, '8-10', 90),
  (4, 4, 'Nordic Hamstring Curl', 3, '5-8', 90),
  (4, 5, 'Barbell Curl', 3, '8-10', 60),
  (4, 6, 'Close-Grip Bench Press', 3, '8-10', 60),
  -- Friday: fly (stretch), chest-supported row, front squat
  (5, 1, 'Cable Fly', 4, '12-15', 60),
  (5, 2, 'Chest-Supported Row', 4, '8-10', 90),
  (5, 3, 'Front Squat', 3, '6-8', 120),
  (5, 4, 'Good Morning', 3, '8-10', 90),
  (5, 5, 'Spider Curl', 3, '10-12', 60),
  (5, 6, 'Overhead Cable Extension', 3, '10-12', 60),
  -- Saturday: machine press, one-arm row, walking lunge
  (6, 1, 'Machine Chest Press', 4, '10-12', 90),
  (6, 2, 'Dumbbell Row', 4, '10-12 each arm', 90),
  (6, 3, 'Walking Lunge', 3, '10 each leg', 90),
  (6, 4, 'Stability Ball Leg Curl', 3, '12-15', 60),
  (6, 5, 'Concentration Curl', 3, '10-12 each arm', 60),
  (6, 6, 'Machine Dip', 3, '10-12', 60)
) as v (day_number, sort_order, exercise_name, sets, reps, rest_seconds);

-- The quick full body session follows the same shape in one go.
insert into full_body_rows values
  ('Quick full body (35 min)', 1, 1, 'Bench Press', 4, '8-10', 90),
  ('Quick full body (35 min)', 1, 2, 'Lat Pulldown', 4, '10-12', 90),
  ('Quick full body (35 min)', 1, 3, 'Leg Press', 3, '10-12', 90),
  ('Quick full body (35 min)', 1, 4, 'Lying Leg Curl', 3, '10-12', 60),
  ('Quick full body (35 min)', 1, 5, 'Seated Dumbbell Curl', 3, '10-12', 45),
  ('Quick full body (35 min)', 1, 6, 'Cable Rope Pushdown', 3, '10-12', 45);

update public.program_exercises pe
set exercise_name = r.exercise_name,
    exercise_id = (select ex.id from public.exercises ex where ex.name = r.exercise_name order by ex.sort_order limit 1),
    sets = r.sets,
    reps = r.reps,
    rest_seconds = r.rest_seconds
from full_body_rows r
join public.programs p on p.name = r.program_name and p.trainer_id is null
where pe.program_id = p.id and pe.day_number = r.day_number and pe.sort_order = r.sort_order;

insert into public.program_exercises (program_id, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds)
select p.id, r.day_number, r.sort_order,
  (select ex.id from public.exercises ex where ex.name = r.exercise_name order by ex.sort_order limit 1),
  r.exercise_name, r.sets, r.reps, r.rest_seconds
from full_body_rows r
join public.programs p on p.name = r.program_name and p.trainer_id is null
where not exists (
  select 1 from public.program_exercises pe
  where pe.program_id = p.id and pe.day_number = r.day_number and pe.sort_order = r.sort_order
);

update public.programs
set day_titles = array['Full body 1', 'Full body 2', 'Full body 3', 'Full body 4', 'Full body 5', 'Full body 6', 'Rest day'],
    description = 'Six different full-body workouts, Monday to Saturday, Sunday off. Each one: chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets, with new exercises and angles every day. Repeats every week.'
where name = 'Full body week' and trainer_id is null;

update public.programs
set description = 'For a client short on time: one exercise per body part. Chest 4 sets, back 4 sets, legs 3 sets, hamstrings 3 sets, biceps 3 sets, triceps 3 sets.'
where name = 'Quick full body (35 min)' and trainer_id is null;
