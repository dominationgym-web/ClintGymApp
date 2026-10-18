-- Exercise done outside the programs (GRIZZ, 2026-10-18): "the client to be
-- able to log any form of exercise they do outside the programs. Like run,
-- cycles hike. Whatever. Even walks. They can log the distance and times and
-- average HR." Feeds the recovery suggestions and the trainer's daily summary.
create table if not exists public.client_activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  activity_date date not null default public.sa_today(),
  -- walk, run, cycle, hike, swim, sport, other (src/lib/otherActivities.ts).
  kind text not null check (kind in ('walk', 'run', 'cycle', 'hike', 'swim', 'sport', 'other')),
  -- The client's own name for it ("Padel", "Parkrun"); optional.
  name text check (name is null or char_length(name) <= 60),
  minutes integer not null check (minutes between 1 and 1440),
  distance_km numeric(6, 2) check (distance_km is null or distance_km between 0 and 1000),
  avg_hr smallint check (avg_hr is null or avg_hr between 30 and 230),
  effort text check (effort is null or effort in ('easy', 'moderate', 'hard')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists client_activities_client_idx on public.client_activities (client_id, activity_date);

alter table public.client_activities enable row level security;

create policy "activities client manages own" on public.client_activities
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create policy "activities trainer reads" on public.client_activities
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

-- The trainer's daily summary of a client's energy and needs (GRIZZ,
-- 2026-10-18: "a brief summary and suggestion on the client's energy and
-- needs ... Not just end of week. Daily based on the weeks training."). One
-- row per client per day, written by the client-daily-summary edge function
-- (service role) after it checks the caller is the client's trainer. facts is
-- the last 7 days the app sent, so the summary is only rewritten when they
-- change.
create table if not exists public.client_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  summary_date date not null,
  energy text not null,
  summary text not null,
  suggestions jsonb not null default '[]'::jsonb,
  facts jsonb not null,
  created_at timestamptz not null default now(),
  unique (client_id, summary_date)
);

alter table public.client_daily_summaries enable row level security;

create policy "daily summaries trainer reads" on public.client_daily_summaries
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
