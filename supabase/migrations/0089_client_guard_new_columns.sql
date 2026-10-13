-- Clients could change three newer columns on their own row: the trainer's
-- abs-between-sets switch, the foundation offer's status, and their training
-- level (each change pushing their trainer). Training level is set once, at
-- intake; the other two belong to the trainer.
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
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$$;
