-- Per-client exercise changes (GRIZZ, 2026-10-12): a trainer taps an
-- exercise in a client's program or calendar workout and changes the
-- exercise, sets or reps for that client only, e.g. around an injury. The
-- preset program itself stays as it is.
--
-- A change either targets one row of one workout (program_exercise_id), or
-- swaps an exercise out of every workout for the client
-- (original_exercise_id). A one-workout change wins over an every-workout
-- one, field by field; null fields keep what the workout says.

create table if not exists public.client_exercise_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  program_exercise_id uuid references public.program_exercises (id) on delete cascade,
  original_exercise_id uuid references public.exercises (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete cascade,
  exercise_name text check (exercise_name is null or char_length(exercise_name) between 1 and 120),
  sets smallint check (sets is null or sets between 1 and 20),
  reps text check (reps is null or char_length(reps) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((program_exercise_id is null) <> (original_exercise_id is null)),
  unique (client_id, program_exercise_id),
  unique (client_id, original_exercise_id)
);

create index if not exists client_exercise_changes_exercise_idx on public.client_exercise_changes (exercise_id);

alter table public.client_exercise_changes enable row level security;

create policy "exercise changes select own or trainer" on public.client_exercise_changes
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "exercise changes trainer writes" on public.client_exercise_changes
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
create policy "approved trainers only (insert)" on public.client_exercise_changes
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_exercise_changes
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));
create policy "approved trainers only (delete)" on public.client_exercise_changes
  as restrictive for delete to authenticated using ((select public.not_unapproved_trainer()));

-- The exercises a trainer swapped in for the signed-in client, so a client
-- without full library access can still see them (video, guide).
create or replace function public.my_changed_exercise_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct exercise_id), '{}')
  from public.client_exercise_changes
  where client_id = auth.uid() and exercise_id is not null;
$$;

revoke execute on function public.my_changed_exercise_ids() from public, anon;
grant execute on function public.my_changed_exercise_ids() to authenticated;

alter policy "exercises readable by authenticated" on public.exercises
  using (
    (select auth.role()) = 'authenticated'
    and (
      (select public.my_library_access())
      or id in (
        select pe.exercise_id from public.program_exercises pe
        where pe.program_id in (select unnest(public.my_program_ids()))
      )
      or id in (select unnest(public.my_changed_exercise_ids()))
      or (
        category <> 'Overhead Press'
        and public.swap_group(category) in (select unnest(public.my_program_swap_groups()))
      )
    )
  );
