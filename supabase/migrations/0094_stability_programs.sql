-- Stability & injury prevention programs (GRIZZ, 2026-10-14). The programs
-- themselves live in the app (src/lib/stability): 7 areas (ankle, knee, hip,
-- core, shoulder, wrist, neck) x 4 levels (rehab, beginner, intermediate,
-- advanced), 4-8 weeks each. They run alongside the client's main program,
-- so they get their own tables instead of the single client_programs slot.
--
-- client_stability_programs: one row per program a client starts. One running
-- program per area at a time; finishing or switching sets ended_at (rows are
-- kept so the history stays).
-- stability_logs: each set, as seconds held or reps done before the client
-- lost control, per side for one-sided exercises.
-- Clients write their own rows (while they have access); their trainer reads them.

create table if not exists public.client_stability_programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  area text not null check (area in ('ankle', 'knee', 'hip', 'core', 'shoulder', 'wrist', 'neck')),
  level text not null check (level in ('rehab', 'beginner', 'intermediate', 'advanced')),
  started_on date not null default current_date,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists client_stability_programs_one_per_area
  on public.client_stability_programs (client_id, area) where ended_at is null;

alter table public.client_stability_programs enable row level security;

create policy "stability programs select own or trainer" on public.client_stability_programs
  for select using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_stability_programs.client_id and c.trainer_id = (select auth.uid()))
  );
create policy "stability programs insert own" on public.client_stability_programs
  for insert with check (client_id = (select auth.uid()) and public.client_has_access(client_id));
create policy "stability programs update own" on public.client_stability_programs
  for update using (client_id = (select auth.uid()) and public.client_has_access(client_id))
  with check (client_id = (select auth.uid()));

create table if not exists public.stability_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  stability_program_id uuid not null references public.client_stability_programs (id) on delete cascade,
  area text not null check (area in ('ankle', 'knee', 'hip', 'core', 'shoulder', 'wrist', 'neck')),
  level text not null check (level in ('rehab', 'beginner', 'intermediate', 'advanced')),
  week smallint not null check (week between 1 and 52),
  mode text not null default 'full' check (mode in ('primer', 'full')),
  exercise_key text not null check (char_length(exercise_key) between 1 and 60),
  set_number smallint not null check (set_number between 1 and 20),
  side text check (side in ('left', 'right')),
  seconds smallint check (seconds between 0 and 3600),
  reps smallint check (reps between 0 and 500),
  log_date date not null default current_date,
  created_at timestamptz not null default now(),
  check ((seconds is null) <> (reps is null))
);

create index if not exists stability_logs_program_idx
  on public.stability_logs (stability_program_id, exercise_key, log_date desc);
create index if not exists stability_logs_client_date_idx
  on public.stability_logs (client_id, log_date desc);

alter table public.stability_logs enable row level security;

create policy "stability logs select own or trainer" on public.stability_logs
  for select using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = stability_logs.client_id and c.trainer_id = (select auth.uid()))
  );
create policy "stability logs insert own" on public.stability_logs
  for insert with check (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
    and exists (
      select 1 from public.client_stability_programs p
      where p.id = stability_logs.stability_program_id and p.client_id = (select auth.uid())
    )
  );
create policy "stability logs update own" on public.stability_logs
  for update using (client_id = (select auth.uid()) and public.client_has_access(client_id))
  with check (client_id = (select auth.uid()));

-- Demo clips for the stability exercises. Clients without full library access
-- can only read their own program's exercises, so the fixed list of clips the
-- stability programs use is served here, to any client or trainer. Must match
-- stabilityVideoNames() in src/lib/stability (a test checks).
create or replace function public.stability_exercise_videos()
returns table (name text, external_url text)
language sql
stable
security definer
set search_path = public
as $$
  select e.name, e.external_url
  from public.exercises e
  where e.external_url is not null
  and e.name in (
    'Band External Rotation', 'Band Hip Abduction', 'Band Shrug', 'Bird Dog', 'Bodyweight Hip Abduction',
    'Cable Rope Kneeling Face Pull', 'Cable Wood Chopper', 'Cossack Squat', 'Dead Bug', 'Dead Hang',
    'Dumbbell Bulgarian Split Squat', 'Dumbbell Goblet Split Squat', 'Dumbbell Lateral Lunge', 'Dumbbell Wrist Curl',
    'Dumbbell Wrist Extension', 'Elbow Side Plank', 'Glute Bridge', 'Hand Plank', 'Jump Rope', 'Jump Squat',
    'Kettlebell Farmer''s Carry', 'Kettlebell Turkish Get-Up', 'Neck Curl', 'Neck Extension', 'Nordic Hamstring Curl',
    'Pallof Press', 'Plank', 'Plate Pinch', 'Push-Up', 'Single-Leg Glute Bridge', 'Single-Leg Romanian Deadlift',
    'Single-Leg Standing Calf Raise', 'Single-Leg Step-Down', 'Split Squat Isometric Hold', 'Standing Cable Hip Abduction',
    'Standing Calf Raise', 'Step-Up', 'Tibialis Raise', 'Wall Sit', 'Wrist Roller'
  )
  and (
    exists (select 1 from public.clients c where c.id = auth.uid())
    or exists (select 1 from public.trainers t where t.id = auth.uid())
  );
$$;

revoke execute on function public.stability_exercise_videos() from public, anon;
grant execute on function public.stability_exercise_videos() to authenticated;
