-- Trainers change an exercise in a workout they built (GRIZZ, 2026-10-21):
-- for good (the row itself is updated) or just for now. A swap for now
-- keeps the original on the row and names the stand-in and the last day it
-- runs; after that day every client gets the original back by itself.
-- The existing "program exercises write own" policy already limits writes
-- to the trainer who owns the program.
alter table public.program_exercises
  add column if not exists swap_exercise_id uuid references public.exercises (id) on delete set null,
  add column if not exists swap_exercise_name text,
  add column if not exists swap_until date;

-- Clients without full library access can still open a stand-in exercise
-- (video, guide) in a workout they're on.
create or replace function public.my_changed_exercise_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct id), '{}') from (
    select exercise_id as id from public.client_exercise_changes
    where client_id = auth.uid() and exercise_id is not null
    union
    select pe.swap_exercise_id from public.program_exercises pe
    where pe.swap_exercise_id is not null and pe.program_id in (select unnest(public.my_program_ids()))
  ) x;
$$;
