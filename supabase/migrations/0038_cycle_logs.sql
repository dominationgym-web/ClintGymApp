-- Women's Health Reset cycle tracker. A client logs the first day of each
-- period and the app works out her phase from it (src/lib/cycle.ts).
--
-- Private to the client: this is health data she logs for herself, so there
-- is deliberately no trainer policy, like progress photos before she shares
-- them (0027). It goes with her account (on delete cascade).

create table public.cycle_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  unique (client_id, period_start)
);

alter table public.cycle_logs enable row level security;

-- One policy for reading, adding and removing her own entries. Adding needs
-- access, like every other client write (0022).
create policy "cycle logs own" on public.cycle_logs
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()) and public.client_has_access(client_id));
