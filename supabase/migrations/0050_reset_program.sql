-- Women's Health Reset rework (GRIZZ, 2026-10-10).
-- The trainer still switches the Reset on for a client (lifestyle_reset_started_at,
-- which shows the Reset tab). The client then browses the 12 weeks and taps
-- Start herself, which sets reset_started_on: her week 1 begins that day.
-- Clients may change this column (it isn't in the protected list).

alter table public.clients add column reset_started_on date;

-- Clients already on the Reset keep the week they're on.
update public.clients
set reset_started_on = lifestyle_reset_started_at
where lifestyle_reset_started_at is not null;

-- A daily "how did you feel / did it help" note next to the tick boxes.
-- Same table, so the same rules: the client writes it, her trainer can read it.
alter table public.lifestyle_reset_daily_logs
  add column feeling smallint check (feeling between 1 and 5),
  add column helped text check (helped in ('yes', 'a_little', 'not_yet')),
  add column note text check (char_length(note) <= 1000);

-- Demo videos for the Reset training sessions. Clients without full library
-- access can only read their own program's exercises, so the Reset's fixed
-- list is served here instead, to clients on the Reset (and trainers).
create or replace function public.reset_exercise_videos()
returns table (name text, external_url text)
language sql
stable
security definer
set search_path = public
as $$
  select e.name, e.external_url
  from public.exercises e
  where e.name in (
    'Barbell Back Squat', 'Bench Press', 'Bent-Over Barbell Row', 'Lat Pulldown', 'Plank',
    'Walking Lunge', 'Romanian Deadlift', 'Incline Dumbbell Press', 'Pull-Up', 'Dumbbell Lateral Raise',
    'Leg Extension', 'Cable Rope Pushdown', 'Seated Dumbbell Curl', 'EZ-Bar Preacher Curl',
    'Bulgarian Split Squat', 'Lying Leg Curl', 'Hip Abduction', 'Hip Adduction',
    'Reverse-Grip Tricep Pushdown', 'Dumbbell Row'
  )
  and (
    exists (select 1 from public.clients c where c.id = auth.uid() and c.lifestyle_reset_started_at is not null)
    or exists (select 1 from public.trainers t where t.id = auth.uid())
  );
$$;

revoke execute on function public.reset_exercise_videos() from public, anon;
grant execute on function public.reset_exercise_videos() to authenticated;
