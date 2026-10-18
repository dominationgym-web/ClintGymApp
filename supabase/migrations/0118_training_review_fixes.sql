-- Training review fixes (2026-10-18). Built-in programs only (trainer_id is null);
-- trainers' own programs are left as they wrote them.

-- 1. Drop sets: 2-3 drops of about 20-25% from an 8-12 rep start weight, not
--    8-10 drops all to failure. Smith squats and leg presses get 1-2 drops and
--    stop short of failure. Total reps is the output, not the round time
--    (src/lib/dropSets.ts).
update programs
set description = regexp_replace(
  description,
  'Each round: pick a start weight.*$',
  'Each round: pick a start weight you can do about 8-12 reps with and go to failure, or stop 1 rep short. '
  || 'Then drop the weight by about 20-25% and go straight into the next set, again to failure or 1 rep short. '
  || 'Do 2-3 drops. Rest only long enough to change the weight, and rest 5 to 6 minutes between rounds because drop sets are very tiring. '
  || 'To log: put in your start weight and record your reps, then log each drop. Your total reps at the same start weight is your output, so try to beat it next time.'
)
where trainer_id is null
  and name ilike 'drop set%'
  and name not in ('Drop Set Quads 2', 'Drop Set Quads 3')
  and description ~ 'Each round: pick a start weight';

-- Leg press and Smith machine squat: a loaded sled or bar, so never to failure.
update programs
set description = regexp_replace(
  description,
  'Each round: pick a start weight.*$',
  'Each round: pick a start weight you can do about 8-12 reps with and stop when you have 1-2 good reps left. '
  || 'Then drop the weight by about 20-25% and go straight into the next set, again stopping 1-2 reps short. '
  || 'Do 1-2 drops at most, and never go to failure or let your form break under the load. '
  || 'Rest only long enough to change the weight, and rest 5 to 6 minutes between rounds because drop sets are very tiring. '
  || 'To log: put in your start weight and record your reps, then log each drop. Your total reps at the same start weight is your output, so try to beat it next time.'
)
where trainer_id is null
  and name in ('Drop Set Quads 2', 'Drop Set Quads 3')
  and description ~ 'Each round: pick a start weight';

-- 2. Abs between sets: 15 reps instead of 20 (the app also skips them after heavy
--    squats, hinges, lunges and rows, and caps them at 10 rounds a session).
alter table programs alter column abs_reps set default 15;
update programs set abs_reps = 15
where trainer_id is null and abs_between_sets and abs_reps = 20;

-- 3. Pace text: "Faster" keeps 90 s on heavy compound lifts, "Slower" never
--    shortens the planned rest (src/lib/trainingCalendar.ts paceRest).
update programs
set description = replace(
  replace(
    description,
    'keep rests to 45 seconds so your heart rate stays up.',
    'keep rests to 45 seconds so your heart rate stays up (at least 90 seconds on heavy squats, deadlifts, presses and rows).'
  ),
  'rest 90 seconds to 2 minutes so you''re ready for the next heavy set.',
  'rest at least 90 seconds, and never less than the planned rest, so you''re ready for the next heavy set.'
)
where trainer_id is null
  and (description like '%keep rests to 45 seconds so your heart rate stays up.%'
    or description like '%rest 90 seconds to 2 minutes so you''re ready for the next heavy set.%');

-- 4. Nordic hamstring curls: 3 x 4-6 slow (as the sports programs have), not 3 x 10-12.
update program_exercises pe
set reps = '4-6 slow'
from programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name in ('Lower Body Superset 2', 'Lower Body Superset 12')
  and pe.exercise_name = 'Nordic Hamstring Curl'
  and pe.reps = '10-12';

-- 5. Contrast pairs (Explosive Power 2, weeks 4-6): rest 3 min between the heavy
--    set and the jump or throw. The rows stay paired (rest 0), and the app reads
--    "rest 3 min" from the reps to run the timer (src/lib/programs.ts contrastRest).
update program_exercises pe
set reps = regexp_replace(pe.reps, ', then straight to the (jump|throw|slam)$', ', rest 3 min, then the \1')
from programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name like 'Explosive Power 2%'
  and pe.reps ~ ', then straight to the (jump|throw|slam)$';

update programs
set description = replace(
  description,
  'a heavy set goes straight into a jump or throw (the heavy lift switches the muscles on, so you jump higher). Rest fully after each pair.',
  'a heavy set, about 3 minutes of rest, then a jump or throw (the heavy lift switches the muscles on, so once the tiredness has passed you jump higher). The app runs that rest for you. Rest fully after each pair.'
)
where trainer_id is null
  and name like 'Explosive Power 2%';

-- 6. Default warm-up: easy cardio, then a few easy moves for the joints, then the
--    warm-up sets (src/lib/programs.ts DEFAULT_WARM_UP).
alter table programs alter column warm_up set default
  '5 minutes of easy cardio, like a light jog, brisk walk, bike or rower. Then a few easy moves for the joints you''ll train, like leg swings, arm circles and bodyweight squats. Then your warm-up sets.';
update programs
set warm_up = '5 minutes of easy cardio, like a light jog, brisk walk, bike or rower. Then a few easy moves for the joints you''ll train, like leg swings, arm circles and bodyweight squats. Then your warm-up sets.'
where trainer_id is null
  and warm_up = '5 minutes of light jogging or a brisk walk to get the blood flowing. Any easy cardio you enjoy works.';
