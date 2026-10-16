-- Calendar blocks (GRIZZ, 2026-10-16): instead of giving a client a whole
-- program, the trainer can put any single day from any program on a day of
-- their calendar (e.g. week 2 Wednesday of a mobility program), and add extra
-- blocks to a day (mobility, flexibility, a fight session...) to suit the
-- client and their energy.
--
-- day_slot on a calendar workout is the program's session, (week - 1) * 7 +
-- weekday (0065). Null means the whole workout, as before (quick workouts).
--
-- client_calendar_blocks holds the extra blocks. A block taken off a day keeps
-- its row with removed_at set, and readers skip it. Its ids are plain ids
-- with no foreign keys, so a program or account can still go as before;
-- readers skip blocks whose program isn't there any more.

alter table public.client_calendar_workouts add column if not exists day_slot int check (day_slot is null or day_slot > 0);

create table if not exists public.client_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  workout_date date not null,
  program_id uuid not null,
  day_slot int check (day_slot is null or day_slot > 0),
  position smallint not null default 1,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

create index if not exists client_calendar_blocks_client_date_idx on public.client_calendar_blocks (client_id, workout_date);
create index if not exists client_calendar_blocks_program_idx on public.client_calendar_blocks (program_id);

alter table public.client_calendar_blocks enable row level security;

-- The client reads their own blocks; their trainer reads and plans them.
create policy "calendar blocks select own or trainer" on public.client_calendar_blocks
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "calendar blocks trainer inserts" on public.client_calendar_blocks
  for insert to authenticated with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and exists (
      select 1 from public.programs p
      where p.id = program_id and (p.trainer_id is null or p.trainer_id = (select auth.uid()))
    )
  );
create policy "calendar blocks trainer updates" on public.client_calendar_blocks
  for update to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
create policy "approved trainers only (insert)" on public.client_calendar_blocks
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_calendar_blocks
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));

-- Every program the signed-in client may need: the one they're on, the
-- workouts on their calendar and their extra blocks (as in 0069).
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
    union
    select program_id from public.client_calendar_blocks where client_id = auth.uid() and removed_at is null
  ) x;
$$;

revoke execute on function public.my_program_ids() from public, anon;
grant execute on function public.my_program_ids() to authenticated;
