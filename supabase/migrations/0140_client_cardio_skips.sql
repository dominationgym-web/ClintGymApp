-- Taking a cardio block off a client's workout (GRIZZ, 2026-10-22: two
-- cardio blocks ended up at the end of a workout and one had to go). The
-- trainer taps the block on the calendar and takes it off that day, or off
-- every week. cardio_key names the block: "row:<program_exercises id>" for
-- cardio in the program, "extra:<name>|<reps>|<after>" for cardio the trainer
-- added for the client (0136). workout_date null means every week.
create table if not exists public.client_cardio_skips (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  workout_date date,
  cardio_key text not null check (char_length(cardio_key) between 1 and 300),
  created_at timestamptz not null default now()
);

create unique index if not exists client_cardio_skips_unique on public.client_cardio_skips (client_id, coalesce(workout_date, '0001-01-01'::date), cardio_key);

alter table public.client_cardio_skips enable row level security;

create policy "cardio skips select own or trainer" on public.client_cardio_skips
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "cardio skips trainer writes" on public.client_cardio_skips
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
create policy "approved trainers only (insert)" on public.client_cardio_skips
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_cardio_skips
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));
create policy "approved trainers only (delete)" on public.client_cardio_skips
  as restrictive for delete to authenticated using ((select public.not_unapproved_trainer()));
