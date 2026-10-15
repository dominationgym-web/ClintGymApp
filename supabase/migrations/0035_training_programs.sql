-- Training programs a trainer can switch on for a client with one tap.
--
--   * Built-in programs (trainer_id is null) ship with the app: quick 30-40
--     minute sessions for clients short on time, and a full-body week that
--     repeats every week. Every trainer can use them; nobody can edit them
--     from the app.
--   * A trainer's own programs (trainer_id = the trainer) come from the
--     "Build a program" screen: 4, 6 or 8 exercises with sets, reps and rest.
--   * client_programs holds the one program a client is on right now. Only the
--     client's trainer can set or clear it.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.trainers (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- quick: one session for any day. weekly: day_number 1 (Monday) to 7
  -- (Sunday), a day with no exercises is a rest day. custom: built by a trainer.
  kind text not null check (kind in ('quick', 'weekly', 'custom')),
  description text,
  -- Weekly programs: title for each day, index 0 = Monday.
  day_titles text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index programs_trainer_idx on public.programs (trainer_id);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  day_number smallint not null default 1 check (day_number between 1 and 7),
  sort_order smallint not null,
  -- Name kept as well, like workout_logs, so the program still reads fine if
  -- an exercise is later removed from the library.
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  sets smallint not null check (sets between 1 and 10),
  reps text not null,
  rest_seconds smallint not null check (rest_seconds between 0 and 600)
);

create index program_exercises_program_idx on public.program_exercises (program_id, day_number, sort_order);
create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

create table public.client_programs (
  client_id uuid primary key references public.clients (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  started_on date not null default current_date,
  assigned_at timestamptz not null default now()
);

create index client_programs_program_idx on public.client_programs (program_id);

alter table public.programs enable row level security;
alter table public.program_exercises enable row level security;
alter table public.client_programs enable row level security;

-- A client reads the program they are on; a trainer reads built-in programs
-- and their own.
create policy "programs select" on public.programs
  for select to authenticated using (
    trainer_id is null
    or trainer_id = (select auth.uid())
    or id in (select cp.program_id from public.client_programs cp where cp.client_id = (select auth.uid()))
  );
create policy "programs insert own" on public.programs
  for insert to authenticated with check (trainer_id = (select auth.uid()));
create policy "programs update own" on public.programs
  for update to authenticated using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy "programs delete own" on public.programs
  for delete to authenticated using (trainer_id = (select auth.uid()));

-- Readable whenever the program itself is (the subquery goes through the
-- programs policy above).
create policy "program exercises select" on public.program_exercises
  for select to authenticated using (program_id in (select p.id from public.programs p));
create policy "program exercises write own" on public.program_exercises
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.trainer_id = (select auth.uid())));

create policy "client programs select own or trainer" on public.client_programs
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "client programs trainer writes" on public.client_programs
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    -- Only a program this trainer can see: built-in or their own.
    and exists (
      select 1 from public.programs p
      where p.id = program_id and (p.trainer_id is null or p.trainer_id = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- Built-in programs
-- ---------------------------------------------------------------------------
create temporary table seed_program_rows (
  program_name text,
  day_number smallint,
  sort_order smallint,
  exercise_name text,
  sets smallint,
  reps text,
  rest_seconds smallint
) on commit drop;

insert into public.programs (name, kind, description, day_titles) values
  ('Quick full body (35 min)', 'quick', 'For a client short on time: one tight full-body session.', '{}'),
  ('Quick upper body (30 min)', 'quick', 'Chest, back, shoulders and arms in 30 minutes.', '{}'),
  ('Quick lower body (30 min)', 'quick', 'Legs, glutes and core in 30 minutes.', '{}'),
  ('Full body week', 'weekly',
   'Three full-body workouts (A, B, C) twice a week, Sunday off. Repeats every week.',
   array['Workout A', 'Workout B', 'Workout C', 'Workout A', 'Workout B', 'Workout C', 'Rest day']);

insert into seed_program_rows values
  ('Quick full body (35 min)', 1, 1, 'Barbell Back Squat', 3, '8-10', 90),
  ('Quick full body (35 min)', 1, 2, 'Bench Press', 3, '8-10', 90),
  ('Quick full body (35 min)', 1, 3, 'Lat Pulldown', 3, '10-12', 60),
  ('Quick full body (35 min)', 1, 4, 'Romanian Deadlift', 3, '10', 90),
  ('Quick full body (35 min)', 1, 5, 'Plank', 3, '30-45 sec', 45),

  ('Quick upper body (30 min)', 1, 1, 'Incline Dumbbell Press', 3, '10-12', 60),
  ('Quick upper body (30 min)', 1, 2, 'Dumbbell Row', 3, '10-12', 60),
  ('Quick upper body (30 min)', 1, 3, 'Dumbbell Lateral Raise', 3, '12-15', 45),
  ('Quick upper body (30 min)', 1, 4, 'Cable Rope Pushdown', 3, '12-15', 45),
  ('Quick upper body (30 min)', 1, 5, 'Seated Dumbbell Curl', 3, '12', 45),

  ('Quick lower body (30 min)', 1, 1, 'Bulgarian Split Squat', 3, '10 each leg', 60),
  ('Quick lower body (30 min)', 1, 2, 'Romanian Deadlift', 3, '10', 90),
  ('Quick lower body (30 min)', 1, 3, 'Leg Extension', 3, '12-15', 45),
  ('Quick lower body (30 min)', 1, 4, 'Lying Leg Curl', 3, '12-15', 45),
  ('Quick lower body (30 min)', 1, 5, 'Plank', 3, '45 sec', 45);

-- Full body week: A on Monday and Thursday, B on Tuesday and Friday, C on
-- Wednesday and Saturday.
insert into seed_program_rows
select 'Full body week', d.day_number, w.sort_order, w.exercise_name, w.sets, w.reps, w.rest_seconds
from (values
  ('A', 1, 'Barbell Back Squat', 4, '6-8', 120),
  ('A', 2, 'Bench Press', 4, '6-8', 120),
  ('A', 3, 'Bent-Over Barbell Row', 3, '8-10', 90),
  ('A', 4, 'Dumbbell Lateral Raise', 3, '12-15', 60),
  ('A', 5, 'Plank', 3, '45 sec', 60),
  ('B', 1, 'Conventional Deadlift', 4, '5', 180),
  ('B', 2, 'Incline Dumbbell Press', 3, '8-10', 90),
  ('B', 3, 'Pull-Up', 3, '6-10', 120),
  ('B', 4, 'Walking Lunge', 3, '10 each leg', 90),
  ('B', 5, 'Cable Rope Pushdown', 3, '12', 60),
  ('B', 6, 'EZ-Bar Preacher Curl', 3, '12', 60),
  ('C', 1, 'Bulgarian Split Squat', 3, '8-10 each leg', 90),
  ('C', 2, 'Romanian Deadlift', 3, '8-10', 120),
  ('C', 3, 'Lat Pulldown', 3, '10-12', 90),
  ('C', 4, 'Dumbbell Row', 3, '10-12', 60),
  ('C', 5, 'Lying Leg Curl', 3, '12', 60),
  ('C', 6, 'Seated Dumbbell Curl', 3, '12', 60)
) as w (workout, sort_order, exercise_name, sets, reps, rest_seconds)
join (values (1, 'A'), (2, 'B'), (3, 'C'), (4, 'A'), (5, 'B'), (6, 'C')) as d (day_number, workout)
  on d.workout = w.workout;

insert into public.program_exercises (program_id, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds)
select p.id, s.day_number, s.sort_order, e.id, s.exercise_name, s.sets, s.reps, s.rest_seconds
from seed_program_rows s
join public.programs p on p.name = s.program_name and p.trainer_id is null
left join public.exercises e on e.name = s.exercise_name;
