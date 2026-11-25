-- Personal heart rate zones (GRIZZ, 2026-11-25). The trainer works out a
-- client's zones from their weight, age and sex (from the profile) plus a few
-- taps (fitness level, exercise, resting heart rate, main goal) and sends them.
-- The zones themselves are worked out in the app (src/lib/heartRateZones.ts)
-- from what is saved here, so the trainer's chart and the client's card agree.
--
-- The client can measure their own resting heart rate with their strap or
-- watch (sit still for a minute); that goes in measured_resting_hr through
-- set_my_resting_hr, and the trainer sees it next time they open the zones.

create table if not exists public.client_hr_zones (
  client_id uuid primary key references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 25 and 400),
  age smallint check (age is null or age between 12 and 100),
  sex text check (sex is null or sex in ('male', 'female')),
  fitness text check (fitness is null or fitness in ('beginner', 'average', 'trained')),
  exercise text check (exercise is null or exercise in ('walk', 'bike', 'elliptical', 'rower')),
  resting_hr smallint check (resting_hr is null or resting_hr between 30 and 120),
  goal text check (goal is null or goal in ('fat', 'fitness', 'calories')),
  -- When the trainer last sent them; the client only sees zones once sent.
  sent_at timestamptz,
  measured_resting_hr smallint check (measured_resting_hr is null or measured_resting_hr between 30 and 120),
  measured_on date,
  updated_at timestamptz not null default now()
);

create index if not exists client_hr_zones_trainer_idx on public.client_hr_zones (trainer_id);

alter table public.client_hr_zones enable row level security;

create policy "hr zones select own or trainer" on public.client_hr_zones
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "hr zones trainer writes" on public.client_hr_zones
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (
    trainer_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "approved trainers only (insert)" on public.client_hr_zones
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_hr_zones
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));
create policy "approved trainers only (delete)" on public.client_hr_zones
  as restrictive for delete to authenticated using ((select public.not_unapproved_trainer()));

-- The client saves the resting heart rate their strap measured. Works before
-- the trainer has made any zones (the row is started for them).
create or replace function public.set_my_resting_hr(p_bpm integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  coach uuid;
begin
  if p_bpm is null or p_bpm < 30 or p_bpm > 120 then
    raise exception 'That resting heart rate looks wrong';
  end if;
  select trainer_id into coach from public.clients where id = me;
  if coach is null then
    raise exception 'Only clients can save a resting heart rate';
  end if;
  insert into public.client_hr_zones (client_id, trainer_id, measured_resting_hr, measured_on)
  values (me, coach, p_bpm, public.sa_today())
  on conflict (client_id) do update
    set measured_resting_hr = excluded.measured_resting_hr,
        measured_on = excluded.measured_on,
        updated_at = now();
end;
$$;
revoke execute on function public.set_my_resting_hr(integer) from public, anon;
grant execute on function public.set_my_resting_hr(integer) to authenticated;
