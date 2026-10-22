-- Progress section (GRIZZ, 2026-10-22): graphs of main lifts, timed cardio
-- tests, and weight and measurements, with the trainer choosing how often
-- the client weighs in.
--
-- client_body_stats (0142) now takes weigh-ins typed in the app, from the
-- client or their trainer. client_cardio_tests holds timed machine tests:
-- "Assault bike, 10 min: 3.2 km, 150 cal". clients.weigh_in_every is the
-- trainer's choice; weigh_in_reminders() pushes the client when it's due.

create policy client_body_stats_write on public.client_body_stats
  for insert with check (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_body_stats.client_id and c.trainer_id = auth.uid())
  );

create policy client_body_stats_remove on public.client_body_stats
  for delete using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_body_stats.client_id and c.trainer_id = auth.uid())
  );

create table public.client_cardio_tests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  test_date date not null,
  machine text not null check (char_length(machine) between 1 and 60),
  seconds integer not null check (seconds between 10 and 36000),
  distance_m numeric check (distance_m > 0 and distance_m <= 200000),
  calories numeric check (calories > 0 and calories <= 10000),
  logged_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (distance_m is not null or calories is not null)
);

create index client_cardio_tests_client_idx on public.client_cardio_tests (client_id, test_date);

alter table public.client_cardio_tests enable row level security;

create policy client_cardio_tests_read on public.client_cardio_tests
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_cardio_tests.client_id and c.trainer_id = auth.uid())
  );

create policy client_cardio_tests_write on public.client_cardio_tests
  for insert with check (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_cardio_tests.client_id and c.trainer_id = auth.uid())
  );

create policy client_cardio_tests_remove on public.client_cardio_tests
  for delete using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_cardio_tests.client_id and c.trainer_id = auth.uid())
  );

alter table public.clients
  add column if not exists weigh_in_every text check (weigh_in_every in ('week', '2weeks', 'month')),
  add column if not exists weigh_in_reminded_on date;

-- Clients can't change their own weigh-in schedule.
CREATE OR REPLACE FUNCTION public.prevent_client_self_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() = old.id and auth.uid() <> old.trainer_id then
    if new.access_status is distinct from old.access_status
      or new.trainer_id is distinct from old.trainer_id
      or new.plan_type is distinct from old.plan_type
      or new.plan_started_at is distinct from old.plan_started_at
      or new.plan_expires_at is distinct from old.plan_expires_at
      or new.package_type is distinct from old.package_type
      or new.lifestyle_reset_started_at is distinct from old.lifestyle_reset_started_at
      or new.library_access is distinct from old.library_access
      or new.created_at is distinct from old.created_at
      or (old.consent_accepted_at is not null and new.consent_accepted_at is distinct from old.consent_accepted_at)
      or new.abs_between_sets is distinct from old.abs_between_sets
      or new.abs_all is distinct from old.abs_all
      or new.extra_cardio is distinct from old.extra_cardio
      or new.foundation_status is distinct from old.foundation_status
      or (old.training_level is not null and new.training_level is distinct from old.training_level)
      or new.archived_at is distinct from old.archived_at
      or new.first_stint_ended_at is distinct from old.first_stint_ended_at
      or new.returned_at is distinct from old.returned_at
      or new.first_intake_responses is distinct from old.first_intake_responses
      or new.price_package is distinct from old.price_package
      or new.weigh_in_every is distinct from old.weigh_in_every
      or new.weigh_in_reminded_on is distinct from old.weigh_in_reminded_on
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.weigh_in_days(p_every text)
returns integer
language sql
immutable
as $$
  select case p_every when 'week' then 7 when '2weeks' then 14 when 'month' then 30 end
$$;

-- Daily: push each client whose weigh-in is due (no weight in the last
-- 7/14/30 days), at most once per due period.
create or replace function public.weigh_in_reminders()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
  today date := public.sa_today();
begin
  for c in
    select cl.id, public.weigh_in_days(cl.weigh_in_every) as days
    from public.clients cl
    where cl.weigh_in_every is not null
      and cl.archived_at is null
      and cl.access_status <> 'expired'
      and (cl.weigh_in_reminded_on is null or cl.weigh_in_reminded_on <= today - public.weigh_in_days(cl.weigh_in_every))
      and not exists (
        select 1 from public.client_body_stats b
        where b.client_id = cl.id and b.weight_kg is not null
          and b.measured_on > today - public.weigh_in_days(cl.weigh_in_every)
      )
  loop
    update public.clients set weigh_in_reminded_on = today where id = c.id;
    perform public.push_to_user(
      c.id,
      'Weigh-in day',
      'Time for your weigh-in. Open Profile, then My progress, to add your weight and measurements.',
      jsonb_build_object('type', 'weigh_in')
    );
  end loop;
end;
$$;

revoke execute on function public.weigh_in_reminders() from public, anon, authenticated;

select cron.schedule('weigh-in-reminders-daily', '0 5 * * *', $$select public.weigh_in_reminders();$$);
