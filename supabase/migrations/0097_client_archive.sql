-- Archive old clients (2026-10-16). Nothing is deleted: an archived client is
-- hidden from the trainer's lists and their access is closed. Bringing them
-- back keeps everything, and the app compares their first time with the
-- trainer ("prime") against the time since they came back.
alter table public.clients
  add column if not exists archived_at timestamptz,
  -- The first time they were archived: the end of their first stint. Set once.
  add column if not exists first_stint_ended_at timestamptz,
  -- When they were last brought back.
  add column if not exists returned_at timestamptz,
  -- Their intake answers from the first time, kept when they fill it in again.
  add column if not exists first_intake_responses jsonb;

create index if not exists clients_trainer_archived_idx on public.clients (trainer_id) where archived_at is not null;

-- Same guard as 0089, plus the four archive columns, which belong to the trainer.
create or replace function public.prevent_client_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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
      or new.foundation_status is distinct from old.foundation_status
      or (old.training_level is not null and new.training_level is distinct from old.training_level)
      or new.archived_at is distinct from old.archived_at
      or new.first_stint_ended_at is distinct from old.first_stint_ended_at
      or new.returned_at is distinct from old.returned_at
      or new.first_intake_responses is distinct from old.first_intake_responses
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$$;
