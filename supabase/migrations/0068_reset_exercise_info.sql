-- Women's Health Reset set logging (2026-10-11): the Reset workouts now log
-- weight and reps like the normal workouts, so the app needs each exercise's
-- id and body part as well as its video (for the "how to do it" guide and the
-- weight suggestion). Same exercise list and access rule as
-- reset_exercise_videos (0051), which stays for older app versions.

create or replace function public.reset_exercise_info()
returns table (id uuid, name text, category text, external_url text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.name, e.category, e.external_url
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

revoke execute on function public.reset_exercise_info() from public, anon;
grant execute on function public.reset_exercise_info() to authenticated;
