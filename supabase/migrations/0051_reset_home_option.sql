-- Women's Health Reset: train at the gym or at home (GRIZZ, 2026-10-10).
-- She picks before tapping Start and can switch later. Clients may change it.
alter table public.clients
  add column reset_location text check (reset_location in ('gym', 'home'));

-- Clients already on the Reset were following the gym sessions.
update public.clients set reset_location = 'gym' where reset_started_on is not null;

-- Demo videos for the gym and the home sessions.
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
    -- Gym
    'Barbell Back Squat', 'Bench Press', 'Bent-Over Barbell Row', 'Lat Pulldown', 'Plank',
    'Walking Lunge', 'Romanian Deadlift', 'Incline Dumbbell Press', 'Pull-Up', 'Dumbbell Lateral Raise',
    'Leg Extension', 'Cable Rope Pushdown', 'Seated Dumbbell Curl', 'EZ-Bar Preacher Curl',
    'Bulgarian Split Squat', 'Lying Leg Curl', 'Hip Abduction', 'Hip Adduction',
    'Reverse-Grip Tricep Pushdown', 'Dumbbell Row',
    -- Home
    'Bodyweight Box Squat', 'Bodyweight Squat', 'Incline Push-Up', 'Bodyweight Knee Push-Up', 'Push-Up',
    'Band Row', 'Glute Bridge', 'Goblet Squat', 'Dumbbell Deadlift', 'Dumbbell Goblet Reverse Lunge',
    'Floor Press', 'Bench Dip', 'Hammer Curl', 'Dumbbell Curl', 'Dumbbell Rear-Delt Fly',
    'Dumbbell Bulgarian Split Squat', 'Single-Leg Glute Bridge', 'Towel Slide Leg Curl', 'Band Hip Abduction',
    'Dead Bug', 'Overhead Dumbbell Extension', 'Single-Leg Dumbbell Romanian Deadlift'
  )
  and (
    exists (select 1 from public.clients c where c.id = auth.uid() and c.lifestyle_reset_started_at is not null)
    or exists (select 1 from public.trainers t where t.id = auth.uid())
  );
$$;

revoke execute on function public.reset_exercise_videos() from public, anon;
grant execute on function public.reset_exercise_videos() to authenticated;
