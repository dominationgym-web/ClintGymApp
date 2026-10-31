-- Live client only (GRIZZ, 2026-10-31: "the trainer is going to need to
-- decide if this client is only a live client ... he won't have access to the
-- daily check-ins ... daily programming, only live training ... he'll have
-- access to the menu function where the nutrition, workout, meal programming,
-- all of that is. But nothing like the daily habits").
--
-- clients.live_only: set by the trainer. The client app then shows My
-- sessions, Profile and the ☰ menu only, and the online reminders stop.

alter table public.clients add column if not exists live_only boolean not null default false;

-- Clients can't switch it themselves.
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
      or new.live_only is distinct from old.live_only
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$function$;

-- No online reminders (check-in, training, habits, steps, weigh-ins,
-- challenges) for a live client. Live session pushes carry no category, so
-- they still go.
create or replace function public.push_wanted(p_user uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_category is null or (
    not exists (
      select 1 from public.clients c
      where c.id = p_user and c.live_only
        and p_category in ('checkin_reminders', 'training', 'habits', 'progress')
    )
    and coalesce((
      select case p_category
        when 'checkin_reminders' then n.checkin_reminders
        when 'training' then n.training
        when 'habits' then n.habits
        when 'progress' then n.progress
        when 'womens_health' then n.womens_health
        else true
      end
      from public.client_notification_prefs n
      where n.client_id = p_user
    ), true)
  )
$$;

revoke execute on function public.push_wanted(uuid, text) from public, anon, authenticated;

-- The trainer sees a live client in person, so no "Check in on ..." nudge.
create or replace function public.quiet_clients_for(p_trainer uuid, p_days integer default 4)
returns table (client_id uuid, name text, phone text, last_spoke_at timestamptz, days_quiet integer)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.name, q.phone, q.spoke, public.sa_today() - (q.since at time zone 'Africa/Johannesburg')::date
  from (
    select c.id, c.name, c.phone,
      greatest(tapped.last_at, coach.last_at, video.last_at) as spoke,
      coalesce(
        greatest(tapped.last_at, coach.last_at, video.last_at),
        greatest(c.returned_at, c.plan_started_at::timestamptz, c.created_at)
      ) as since
    from public.clients c
    left join public.client_contacts tapped on tapped.client_id = c.id and tapped.trainer_id = c.trainer_id
    left join lateral (
      select max(cm.created_at) as last_at from public.coach_messages cm
      where cm.client_id = c.id and cm.trainer_id = c.trainer_id
    ) coach on true
    left join lateral (
      select max(v.starts_at) as last_at from public.video_checkins v
      where v.client_id = c.id and v.trainer_id = c.trainer_id and v.status = 'confirmed' and v.starts_at <= now()
    ) video on true
    where c.trainer_id = p_trainer
      and c.id <> c.trainer_id
      and c.archived_at is null
      and c.access_status <> 'expired'
      and not c.live_only
  ) q
  where public.sa_today() - (q.since at time zone 'Africa/Johannesburg')::date >= p_days
  order by q.since, q.name;
$$;

revoke execute on function public.quiet_clients_for(uuid, integer) from public, anon, authenticated;
