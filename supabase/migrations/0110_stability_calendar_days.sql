-- Stability sessions on the calendar (GRIZZ, 2026-10-18): "The stability
-- programming needs to log on the calendar. So we can allocate it to
-- different day. Maybe a different colour."
--
-- The trainer puts a client's running stability program (0094) on calendar
-- days. Taking one off sets removed_at, as with calendar blocks (0098). Ids
-- are plain ids with no foreign keys, so a program or account can still go
-- as before; readers skip days whose program isn't there any more.

create table if not exists public.client_stability_days (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  stability_program_id uuid not null,
  day date not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

create unique index if not exists client_stability_days_one_per_day
  on public.client_stability_days (stability_program_id, day) where removed_at is null;
create index if not exists client_stability_days_client_day_idx on public.client_stability_days (client_id, day);

alter table public.client_stability_days enable row level security;

create policy "stability days select own or trainer" on public.client_stability_days
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "stability days trainer inserts" on public.client_stability_days
  for insert to authenticated with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and exists (
      select 1 from public.client_stability_programs p
      where p.id = stability_program_id and p.client_id = client_stability_days.client_id
    )
  );
create policy "stability days trainer updates" on public.client_stability_days
  for update to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
create policy "approved trainers only (insert)" on public.client_stability_days
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_stability_days
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));
