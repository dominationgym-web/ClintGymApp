-- Pre-start health and safety form for the Longevity (60+) programs (GRIZZ,
-- 2026-10-20). The trainer fills it in with the client before they start and
-- again every 8 weeks, so each one is a new row and the first stays as the
-- baseline. answers holds the form (src/lib/preStart.ts), risk_level the
-- app's overall sign when it was saved. Only the client's trainer reads and
-- writes it, and a saved form can be corrected but not deleted.
create table if not exists public.client_prestart_forms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  trainer_id uuid not null default auth.uid(),
  filled_on date not null,
  answers jsonb not null,
  risk_level text not null check (risk_level in ('green', 'amber', 'red')),
  created_at timestamptz not null default now()
);

create index if not exists client_prestart_forms_client on public.client_prestart_forms (client_id, filled_on desc);

alter table public.client_prestart_forms enable row level security;

create policy "prestart trainer reads" on public.client_prestart_forms
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

create policy "prestart trainer adds" on public.client_prestart_forms
  for insert to authenticated
  with check (
    trainer_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );

create policy "prestart trainer corrects" on public.client_prestart_forms
  for update to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
