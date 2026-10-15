-- GRIZZ (2026-10-10): more single-leg work for stability in Full body week.
-- Thursday's Hack Squat becomes a dumbbell forward lunge and Friday's Front
-- Squat a dumbbell split squat.

update public.program_exercises pe
set exercise_name = v.exercise_name,
    exercise_id = (select ex.id from public.exercises ex where ex.name = v.exercise_name order by ex.sort_order limit 1),
    reps = v.reps,
    rest_seconds = 90
from public.programs p,
  (values
    (4, 3, 'Dumbbell Alternating Forward Lunge', '10 each leg'),
    (5, 3, 'Dumbbell Goblet Split Squat', '8-10 each leg')
  ) as v (day_number, sort_order, exercise_name, reps)
where p.name = 'Full body week' and p.trainer_id is null
  and pe.program_id = p.id and pe.day_number = v.day_number and pe.sort_order = v.sort_order;
