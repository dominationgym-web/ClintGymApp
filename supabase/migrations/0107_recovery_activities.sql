-- Client Recovery section (GRIZZ 2026-10-17): clients plan and log recovery
-- activities (sleep, hydration, breathing, cold & heat, stretching, foam
-- rolling, easy movement, rest). Planned ones show on their calendar in
-- bright green, and their coach sees what was planned and done.
-- suggested_reason keeps why the app suggested it, when it came from a
-- suggestion (src/lib/recoverySuggest.ts).
create table if not exists public.recovery_activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  activity text not null check (activity in (
    'sleep', 'hydration', 'breathing', 'cold_heat', 'stretching', 'foam_rolling', 'easy_movement', 'rest'
  )),
  planned_on date not null default public.sa_today(),
  done_on date,
  minutes integer check (minutes is null or minutes between 0 and 600),
  suggested_reason text,
  created_at timestamptz not null default now()
);

create index if not exists recovery_activities_client_idx on public.recovery_activities (client_id, planned_on);

alter table public.recovery_activities enable row level security;

-- The client plans, ticks off and removes their own.
create policy "recovery client manages own" on public.recovery_activities
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

-- Their trainer can see them.
create policy "recovery trainer reads" on public.recovery_activities
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
