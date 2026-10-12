-- Training calendar (GRIZZ, 2026-10-12): a trainer plans a client's month by
-- putting a workout on each training day, picking from any quick workout
-- (built-in or their own). On a day with a calendar workout the client does
-- that workout, with the same logging, rest timer, guides and swaps as their
-- program; other days fall back to their program, if they have one.
--
-- A workout already on a client's calendar shows as "Used" until every
-- workout in its batch (the chooser heading, e.g. "Upper body") has been
-- used, or the trainer taps Reset for that batch. client_workout_resets keeps
-- when each batch was last reset for each client.
--
-- Also adds 30 built-in workouts for it: 15 upper body (chest, back,
-- shoulders, biceps, triceps, 2 exercises each) and 15 lower body (a compound
-- lift, then quads, hamstrings, glutes and calves, 2 exercises each), all 3
-- sets, with every other one as supersets.

create table if not exists public.client_calendar_workouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  workout_date date not null,
  program_id uuid not null references public.programs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, workout_date)
);

create index if not exists client_calendar_workouts_program_idx on public.client_calendar_workouts (program_id);

create table if not exists public.client_workout_resets (
  client_id uuid not null references public.clients (id) on delete cascade,
  batch text not null check (char_length(batch) between 1 and 40),
  reset_at timestamptz not null default now(),
  primary key (client_id, batch)
);

alter table public.client_calendar_workouts enable row level security;
alter table public.client_workout_resets enable row level security;

-- The client reads their own calendar; their trainer reads and plans it.
create policy "calendar select own or trainer" on public.client_calendar_workouts
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "calendar trainer writes" on public.client_calendar_workouts
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and exists (
      select 1 from public.programs p
      where p.id = program_id and (p.trainer_id is null or p.trainer_id = (select auth.uid()))
    )
  );
create policy "approved trainers only (insert)" on public.client_calendar_workouts
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_calendar_workouts
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));
create policy "approved trainers only (delete)" on public.client_calendar_workouts
  as restrictive for delete to authenticated using ((select public.not_unapproved_trainer()));

-- Only the trainer sees and resets the batches.
create policy "workout resets trainer" on public.client_workout_resets
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
create policy "approved trainers only (insert)" on public.client_workout_resets
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_workout_resets
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));

-- Every program the signed-in client may need: the one they're on and the
-- workouts on their calendar. Security definer, like my_program_id (0036),
-- so the programs policy doesn't loop through these tables' policies.
create or replace function public.my_program_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct id), '{}') from (
    select program_id as id from public.client_programs where client_id = auth.uid()
    union
    select program_id from public.client_calendar_workouts where client_id = auth.uid()
  ) x;
$$;

revoke execute on function public.my_program_ids() from public, anon;
grant execute on function public.my_program_ids() to authenticated;

alter policy "programs select" on public.programs
  using (
    trainer_id is null
    or trainer_id = (select auth.uid())
    or id in (select unnest(public.my_program_ids()))
  );

create or replace function public.my_program_swap_groups()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct public.swap_group(e.category)), '{}')
  from public.program_exercises pe
  join public.exercises e on e.id = pe.exercise_id
  where pe.program_id = any (public.my_program_ids()) and e.category is not null;
$$;

alter policy "exercises readable by authenticated" on public.exercises
  using (
    (select auth.role()) = 'authenticated'
    and (
      (select public.my_library_access())
      or id in (
        select pe.exercise_id from public.program_exercises pe
        where pe.program_id in (select unnest(public.my_program_ids()))
      )
      or (
        category <> 'Overhead Press'
        and public.swap_group(category) in (select unnest(public.my_program_swap_groups()))
      )
    )
  );

-- The 30 workouts. Only inserted when a built-in program with the same name
-- isn't there yet.
create or replace function pg_temp.add_workout(p_name text, p_style text, p_rows jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
  pace text := 'Choose your pace for each set. Faster: use a weight you can move for the top of the rep range, lift in 1 second and lower in 2, and keep rests to 45 seconds so your heart rate stays up. Slower: go heavier, lower for 3 seconds, pause for 1, lift strong, and rest 90 seconds to 2 minutes so you''re ready for the next heavy set. Either way, finish each set with 1-2 good reps left in the tank, and add weight next time once you hit the top of the rep range on all 3 sets.';
  v_description text := case p_style
    when 'upper' then 'Upper body for muscle with your heart rate up: chest, back, shoulders, biceps and triceps, 2 exercises each, 3 sets of every exercise. '
    when 'upper_superset' then 'Upper body supersets: do each pair back to back with no rest (chest with back, the two shoulder moves, biceps with triceps), then rest before the next round. 3 rounds of each pair. '
    when 'lower' then 'Lower body for muscle with your heart rate up: one big compound lift first, then quads, hamstrings, glutes and calves, 2 exercises each, 3 sets of every exercise. '
    else 'Lower body supersets: start with the big compound lift on its own, then do each pair back to back with no rest (quads with hamstrings, glutes with calves) and rest before the next round. 3 rounds of each pair. '
  end || pace;
  v_warm_up text := case when p_style like 'upper%' then '5 minutes on the rower or bike, then 2 rounds of 10 band pull-aparts, 10 arm circles each way and 10 push-ups. Do 1 light set of the first exercise before your working sets.' else '5 minutes on the bike or a brisk incline walk, then 2 rounds of 10 bodyweight squats, 10 glute bridges, 10 leg swings each leg and 5 walking lunges each leg. Do 2 lighter ramp-up sets of the first lift.' end;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, warm_up, day_titles)
  values (null, p_name, 'quick', 'gym', 1, v_description, v_warm_up, '{}'::text[])
  returning id into prog;
  -- Each row is [exercise, reps, rest seconds]; 3 sets each, rest 0 = superset.
  insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
  select prog, 1, 1, r.ord::smallint,
    (select e.id from public.exercises e where e.name = r.v->>0 order by e.sort_order limit 1),
    r.v->>0, 3, r.v->>1, (r.v->>2)::smallint, 'exercise'
  from jsonb_array_elements(p_rows) with ordinality as r(v, ord);
  if exists (select 1 from public.program_exercises pe where pe.program_id = prog and pe.exercise_id is null) then
    raise exception 'an exercise in % is not in the library', p_name;
  end if;
end $f$;

do $$
begin
  perform pg_temp.add_workout('Upper Body 1', 'upper', '[["Bench Press", "8-10", 75], ["Cable Fly", "10-12", 60], ["Lat Pulldown", "8-10", 75], ["Seated Cable Row", "10-12", 60], ["Dumbbell Lateral Raise", "12-15", 45], ["Reverse Pec Deck", "12-15", 45], ["EZ-Bar Curl", "10-12", 60], ["Hammer Curl", "12-15", 45], ["Cable Rope Pushdown", "10-12", 60], ["Overhead Cable Extension", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Upper Body Superset 2', 'upper_superset', '[["Incline Dumbbell Press", "8-10", 0], ["Chest-Supported Row", "8-10", 75], ["Machine Pec Fly", "10-12", 0], ["Neutral-Grip Lat Pulldown", "10-12", 75], ["Leaning Cable Lateral Raise", "12-15", 0], ["Cable Seated Rope Face Pull", "12-15", 60], ["Dumbbell Curl", "10-12", 0], ["Skull Crusher", "10-12", 60], ["Cable Rope Hammer Curl", "12-15", 0], ["V-Bar Cable Pushdown", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Upper Body 3', 'upper', '[["Flat Dumbbell Press", "8-10", 75], ["Cable Low-to-High Fly", "10-12", 60], ["Wide-Grip Lat Pulldown", "8-10", 75], ["Dumbbell Single-Arm Row", "10-12", 60], ["Machine Lateral Raise", "12-15", 45], ["Dumbbell Rear-Delt Fly", "12-15", 45], ["Incline Dumbbell Curl", "10-12", 60], ["Cable Curl", "12-15", 45], ["Close-Grip Bench Press", "10-12", 60], ["Single-Arm Overhead Cable Extension", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Upper Body Superset 4', 'upper_superset', '[["Incline Barbell Press", "8-10", 0], ["Barbell Bent-Over Row", "8-10", 75], ["Dumbbell Chest Fly", "10-12", 0], ["Straight-Arm Pulldown", "10-12", 75], ["Dumbbell Lateral Raise", "12-15", 0], ["Cable Bar Face Pull", "12-15", 60], ["Bayesian Curl", "10-12", 0], ["Overhead Dumbbell Extension", "10-12", 60], ["Hammer Curl", "12-15", 0], ["Cable Bar Pushdown", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Upper Body 5', 'upper', '[["Machine Chest Press", "8-10", 75], ["Cable High-to-Low Fly", "10-12", 60], ["Close-Grip Lat Pulldown", "8-10", 75], ["Machine Neutral Row", "10-12", 60], ["Cable Low Single-Arm Lateral Raise", "12-15", 45], ["Reverse Pec Deck", "12-15", 45], ["EZ-Bar Preacher Curl", "10-12", 60], ["Cross-Body Hammer Curl", "12-15", 45], ["Machine Dip", "10-12", 60], ["Tricep Kickback", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Upper Body Superset 6', 'upper_superset', '[["Smith Machine Incline Bench Press", "8-10", 0], ["Pull-Up", "8-10", 75], ["Cable Fly", "10-12", 0], ["Chest-Supported T-Bar Row", "10-12", 75], ["Leaning Cable Lateral Raise", "12-15", 0], ["Dumbbell Seated Rear-Delt Fly", "12-15", 60], ["Barbell Curl", "10-12", 0], ["Cable Rope Pushdown", "10-12", 60], ["Concentration Curl", "12-15", 0], ["Skull Crusher", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Upper Body 7', 'upper', '[["Neutral-Grip Dumbbell Bench Press", "8-10", 75], ["Dumbbell Incline Chest Fly", "10-12", 60], ["Seated Cable Row", "8-10", 75], ["Single-Arm Lat Pulldown", "10-12", 60], ["Machine Lateral Raise", "12-15", 45], ["Machine Face Pull", "12-15", 45], ["Spider Curl", "10-12", 60], ["Hammer Curl", "12-15", 45], ["JM Press", "10-12", 60], ["Reverse-Grip Tricep Pushdown", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Upper Body Superset 8', 'upper_superset', '[["Incline Machine Chest Press", "8-10", 0], ["Lat Pulldown", "8-10", 75], ["Machine Pec Fly", "10-12", 0], ["Hammer Strength Iso-Lateral Row", "10-12", 75], ["Dumbbell Lateral Raise", "12-15", 0], ["Dumbbell Rear-Delt Fly", "12-15", 60], ["Cable Curl", "10-12", 0], ["Overhead Cable Extension", "10-12", 60], ["Zottman Curl", "12-15", 0], ["V-Bar Cable Pushdown", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Upper Body 9', 'upper', '[["Bench Press", "8-10", 75], ["Cable Low-to-High Fly", "10-12", 60], ["Wide-Grip Seated Cable Row", "8-10", 75], ["Machine Lat Pullover", "10-12", 60], ["Cable Low Single-Arm Lateral Raise", "12-15", 45], ["Cable Seated Rope Face Pull", "12-15", 45], ["Machine Preacher Curl", "10-12", 60], ["Dumbbell Incline Hammer Curl", "12-15", 45], ["Close-Grip Bench Press", "10-12", 60], ["Cable Single-Arm Rope Pushdown", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Upper Body Superset 10', 'upper_superset', '[["Incline Dumbbell Press", "8-10", 0], ["Neutral-Grip Lat Pulldown", "8-10", 75], ["Chest Dip", "10-12", 0], ["Meadows Row", "10-12", 75], ["Leaning Cable Lateral Raise", "12-15", 0], ["Reverse Pec Deck", "12-15", 60], ["EZ-Bar Curl", "10-12", 0], ["Machine Tricep Extension", "10-12", 60], ["Cable Rope Hammer Curl", "12-15", 0], ["Tricep Kickback", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Upper Body 11', 'upper', '[["Flat Dumbbell Press", "8-10", 75], ["Cable High-to-Low Fly", "10-12", 60], ["Chest-Supported Row", "8-10", 75], ["Straight-Arm Pulldown", "10-12", 60], ["Machine Lateral Raise", "12-15", 45], ["Cable Bar Face Pull", "12-15", 45], ["Seated Dumbbell Curl", "10-12", 60], ["Hammer Curl", "12-15", 45], ["Skull Crusher", "10-12", 60], ["Cable Bar Pushdown", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Upper Body Superset 12', 'upper_superset', '[["Decline Machine Chest Press", "8-10", 0], ["Wide-Grip Lat Pulldown", "8-10", 75], ["Dumbbell Chest Fly", "10-12", 0], ["Cable Single-Arm Neutral-Grip Row", "10-12", 75], ["Dumbbell Lateral Raise", "12-15", 0], ["Dumbbell Seated Rear-Delt Fly", "12-15", 60], ["Incline Dumbbell Curl", "10-12", 0], ["Overhead Dumbbell Extension", "10-12", 60], ["Cable Curl", "12-15", 0], ["Cable Rope Pushdown", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Upper Body 13', 'upper', '[["Incline Barbell Press", "8-10", 75], ["Cable Fly", "10-12", 60], ["Barbell Bent-Over Row", "8-10", 75], ["Close-Grip Lat Pulldown", "10-12", 60], ["Cable Low Single-Arm Lateral Raise", "12-15", 45], ["Machine Face Pull", "12-15", 45], ["Dumbbell Preacher Curl", "10-12", 60], ["Cross-Body Hammer Curl", "12-15", 45], ["Machine Dip", "10-12", 60], ["Single-Arm Overhead Cable Extension", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Upper Body Superset 14', 'upper_superset', '[["Machine Chest Press", "8-10", 0], ["Pull-Up", "8-10", 75], ["Dumbbell Incline Chest Fly", "10-12", 0], ["Seated Cable Row", "10-12", 75], ["Leaning Cable Lateral Raise", "12-15", 0], ["Dumbbell Rear-Delt Fly", "12-15", 60], ["Bayesian Curl", "10-12", 0], ["JM Press", "10-12", 60], ["Zottman Curl", "12-15", 0], ["V-Bar Cable Pushdown", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Upper Body 15', 'upper', '[["Smith Machine Incline Bench Press", "8-10", 75], ["Machine Pec Fly", "10-12", 60], ["Lat Pulldown", "8-10", 75], ["Dumbbell Single-Arm Row", "10-12", 60], ["Machine Lateral Raise", "12-15", 45], ["Reverse Pec Deck", "12-15", 45], ["Barbell Curl", "10-12", 60], ["Hammer Curl", "12-15", 45], ["Cable Rope Pushdown", "10-12", 60], ["Overhead Cable Extension", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 1', 'lower', '[["Barbell Back Squat", "8-10", 120], ["Dumbbell Bulgarian Split Squat", "10-12", 75], ["Leg Extension", "12-15", 60], ["Romanian Deadlift", "10-12", 75], ["Lying Leg Curl", "10-12", 60], ["Hip Thrust", "10-12", 60], ["Cable Kickback", "12-15", 45], ["Standing Calf Raise", "12-15", 45], ["Seated Calf Raise", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body Superset 2', 'lower_superset', '[["Trap Bar Deadlift", "8-10", 90], ["Walking Lunge", "10-12", 0], ["Seated Leg Curl", "10-12", 75], ["Leg Extension", "12-15", 0], ["Nordic Hamstring Curl", "10-12", 75], ["B-Stance Hip Thrust", "10-12", 0], ["Smith Machine Calf Raise", "12-15", 60], ["Hip Abduction", "12-15", 0], ["Seated Calf Raise", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 3', 'lower', '[["Front Squat", "8-10", 120], ["Step-Up", "10-12", 75], ["Sissy Squat", "12-15", 60], ["Single-Leg Romanian Deadlift", "10-12", 75], ["Lying Leg Curl", "10-12", 60], ["Cable Pull Through", "10-12", 60], ["Glute Kickback Machine", "12-15", 45], ["Horizontal Leg Press Calf Press", "12-15", 45], ["Single-Leg Standing Calf Raise", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body Superset 4', 'lower_superset', '[["Leg Press", "8-10", 90], ["Dumbbell Goblet Reverse Lunge", "10-12", 0], ["Romanian Deadlift", "10-12", 75], ["Leg Extension", "12-15", 0], ["Seated Leg Curl", "10-12", 75], ["Machine Hip Thrust", "10-12", 0], ["Standing Calf Raise", "12-15", 60], ["Cable Hip Abduction", "12-15", 0], ["Dumbbell Single-Leg Calf Raise", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 5', 'lower', '[["Smith Machine Squat", "8-10", 120], ["Dumbbell Goblet Split Squat", "10-12", 75], ["Machine Plate-Loaded Leg Extension", "12-15", 60], ["Good Morning", "10-12", 75], ["Stability Ball Leg Curl", "10-12", 60], ["Dumbbell Single-Leg Hip Thrust", "10-12", 60], ["Cable Kickback", "12-15", 45], ["Seated Calf Raise", "12-15", 45], ["Smith Machine Calf Raise", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body Superset 6', 'lower_superset', '[["Conventional Deadlift", "8-10", 90], ["Single-Leg Press", "10-12", 0], ["Lying Leg Curl", "10-12", 75], ["Leg Extension", "12-15", 0], ["Cable Single-Leg Lying Leg Curl", "10-12", 75], ["Hip Thrust", "10-12", 0], ["Single-Leg Standing Calf Raise", "12-15", 60], ["Standing Cable Hip Abduction", "12-15", 0], ["Seated Calf Raise", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 7', 'lower', '[["Belt Squat", "8-10", 120], ["Front-Foot-Elevated Split Squat", "10-12", 75], ["Leg Extension", "12-15", 60], ["Barbell Stiff-Leg Deadlift", "10-12", 75], ["Seated Leg Curl", "10-12", 60], ["Frog Pump", "10-12", 60], ["Glute Kickback Machine", "12-15", 45], ["Standing Calf Raise", "12-15", 45], ["Kettlebell Calf Raise", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body Superset 8', 'lower_superset', '[["Pendulum Squat (V-Squat)", "8-10", 90], ["Dumbbell Alternating Forward Lunge", "10-12", 0], ["Romanian Deadlift", "10-12", 75], ["Sissy Squat", "12-15", 0], ["Dumbbell Leg Curl", "10-12", 75], ["Kettlebell Hip Thrust", "10-12", 0], ["Horizontal Leg Press Calf Press", "12-15", 60], ["Hip Abduction", "12-15", 0], ["Seated Calf Raise", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 9', 'lower', '[["Barbell Back Squat", "8-10", 120], ["Dumbbell Goblet Bulgarian Split Squat", "10-12", 75], ["Leg Extension", "12-15", 60], ["Kettlebell Romanian Deadlift", "10-12", 75], ["Lying Leg Curl", "10-12", 60], ["Single-Leg Hip Thrust", "10-12", 60], ["Cable Pull Through", "12-15", 45], ["Smith Machine Calf Raise", "12-15", 45], ["Dumbbell Single-Leg Calf Raise", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body Superset 10', 'lower_superset', '[["Trap Bar Deadlift", "8-10", 90], ["Leg Press", "10-12", 0], ["Seated Leg Curl", "10-12", 75], ["Machine Plate-Loaded Leg Extension", "12-15", 0], ["Single-Leg Dumbbell Romanian Deadlift", "10-12", 75], ["B-Stance Hip Thrust", "10-12", 0], ["Standing Calf Raise", "12-15", 60], ["Cable Hip Abduction", "12-15", 0], ["Seated Calf Raise", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 11', 'lower', '[["Front Squat", "8-10", 120], ["Walking Lunge", "10-12", 75], ["Leg Extension", "12-15", 60], ["Good Morning", "10-12", 75], ["Cable Single-Leg Lying Leg Curl", "10-12", 60], ["Machine Hip Thrust", "10-12", 60], ["Reverse Hyperextension", "12-15", 45], ["Single-Leg Standing Calf Raise", "12-15", 45], ["Smith Machine Calf Raise", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body Superset 12', 'lower_superset', '[["Leg Press", "8-10", 90], ["Barbell Step-Up Knee Drive", "10-12", 0], ["Romanian Deadlift", "10-12", 75], ["Sissy Squat", "12-15", 0], ["Nordic Hamstring Curl", "10-12", 75], ["Hip Thrust", "10-12", 0], ["Seated Calf Raise", "12-15", 60], ["Standing Cable Hip Abduction", "12-15", 0], ["Kettlebell Calf Raise", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 13', 'lower', '[["Pause Squat", "8-10", 120], ["Dumbbell Goblet Reverse Lunge", "10-12", 75], ["Leg Extension", "12-15", 60], ["Barbell Stiff-Leg Deadlift", "10-12", 75], ["Lying Leg Curl", "10-12", 60], ["Dumbbell Single-Leg Hip Thrust", "10-12", 60], ["Glute Kickback Machine", "12-15", 45], ["Horizontal Leg Press Calf Press", "12-15", 45], ["Single-Leg Standing Calf Raise", "12-15", 45]]'::jsonb);
  perform pg_temp.add_workout('Lower Body Superset 14', 'lower_superset', '[["Conventional Deadlift", "8-10", 90], ["Goblet Squat", "10-12", 0], ["Seated Leg Curl", "10-12", 75], ["Machine Plate-Loaded Leg Extension", "12-15", 0], ["Stability Ball Leg Curl", "10-12", 75], ["Kettlebell Hip Thrust", "10-12", 0], ["Standing Calf Raise", "12-15", 60], ["Cable Kickback", "12-15", 0], ["Dumbbell Single-Leg Calf Raise", "12-15", 60]]'::jsonb);
  perform pg_temp.add_workout('Lower Body 15', 'lower', '[["Smith Machine Front Squat", "8-10", 120], ["Dumbbell Bulgarian Split Squat", "10-12", 75], ["Leg Extension", "12-15", 60], ["Single-Leg Romanian Deadlift", "10-12", 75], ["Seated Leg Curl", "10-12", 60], ["Hip Thrust", "10-12", 60], ["Hip Abduction", "12-15", 45], ["Smith Machine Calf Raise", "12-15", 45], ["Seated Calf Raise", "12-15", 45]]'::jsonb);
end $$;
