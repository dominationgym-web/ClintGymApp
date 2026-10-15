-- GRIZZ doesn't want hack squats in the built-in programs (2026-10-10): too
-- much strain on the knees. Legs 4 gets a dumbbell goblet split squat instead
-- (he likes unilateral leg work). The hack squats stay in the library so each
-- trainer can decide for themselves. Applied live with his OK.
update public.program_exercises
set exercise_id = (select id from public.exercises where name = 'Dumbbell Goblet Split Squat'),
    exercise_name = 'Dumbbell Goblet Split Squat',
    reps = '8-10 each leg'
where exercise_name in ('Hack Squat', 'Reverse Hack Squat')
  and program_id in (select id from public.programs where trainer_id is null);
