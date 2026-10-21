-- Abs and cardio for every workout (GRIZZ, 2026-10-21: "I can't select cardio
-- or ab options between sets ... Need to add those options between any and all
-- workouts except the longevity and bodybuilding. Can just add abs for
-- bodybuilding. As well as a cardio option at the end."). Programs only go on
-- the calendar now, so the trainer's extra cardio moves from the old-style
-- client_programs row to the client: it's added to every calendar workout
-- (src/lib/clientExtras.ts decides which). abs_all turns abs between sets on
-- for workouts that don't have them built in. Only the trainer changes them.
alter table public.clients
  add column if not exists abs_all boolean not null default false,
  add column if not exists extra_cardio jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extra_cardio) = 'array' and jsonb_array_length(extra_cardio) <= 10);

create or replace function public.prevent_client_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$function$;
