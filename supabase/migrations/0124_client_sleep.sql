-- Sleep from the client's watch (GRIZZ, 2026-10-19: "Now that the app is
-- linked to the health apps I need it to please track their sleep as well ...
-- log their sleep when the clients logs into his app"). Each time the client
-- opens the app, the last nights are read from Apple Health or Health Connect
-- (src/lib/healthLink.ts) and saved here, one row per night, dated the morning
-- they woke up. A night can grow while the watch syncs, so rows are upserted.
create table if not exists public.client_sleep (
  client_id uuid not null references public.clients (id) on delete cascade,
  sleep_date date not null,
  bed_at timestamptz not null,
  wake_at timestamptz not null,
  asleep_minutes integer not null check (asleep_minutes between 0 and 1440),
  awake_minutes integer not null default 0 check (awake_minutes between 0 and 1440),
  source text not null check (source in ('apple_health', 'health_connect')),
  updated_at timestamptz not null default now(),
  primary key (client_id, sleep_date)
);

alter table public.client_sleep enable row level security;

create policy "sleep client manages own" on public.client_sleep
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create policy "sleep trainer reads" on public.client_sleep
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
