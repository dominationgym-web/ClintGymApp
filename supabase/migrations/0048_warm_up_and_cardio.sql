-- Warm-up and cardio (GRIZZ, 2026-10-10).
-- Every program starts with a warm-up the trainer can reword; the built-in
-- programs get the default. And a trainer can drop cardio blocks into a
-- session, between exercises or at the end: program_exercises rows with kind
-- 'cardio', where exercise_name is the machine (or the trainer's own words)
-- and reps is how long, e.g. "30 sec".

alter table public.programs
  add column warm_up text not null
  default '5 minutes of light jogging or a brisk walk to get the blood flowing. Any easy cardio you enjoy works.';

alter table public.program_exercises
  add column kind text not null default 'exercise' check (kind in ('exercise', 'cardio'));
