-- More than one injury per client (GRIZZ 2026-10-17): clients list each
-- injury (where and what) on their profile and tick it off once healed. The
-- trainer sees them, and the injury check (src/lib/injuryRisk.ts) flags
-- exercises in the client's plan that could aggravate any open one.
create table if not exists public.client_injuries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  area text not null check (length(area) between 1 and 60),
  notes text check (notes is null or length(notes) <= 1000),
  healed_on date,
  created_at timestamptz not null default now()
);

create index if not exists client_injuries_client_idx on public.client_injuries (client_id);

alter table public.client_injuries enable row level security;

-- The client adds, edits and ticks off their own.
create policy "injuries client manages own" on public.client_injuries
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

-- Their trainer sees them and can add or update them too.
create policy "injuries trainer manages" on public.client_injuries
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
