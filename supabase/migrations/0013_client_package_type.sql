-- Coaching package tiers - what's included, separate from plan_type (which
-- is only the billing duration: 1/6/12 months).
create type public.package_type as enum (
  'training_only',
  'training_nutrition',
  'training_nutrition_lifestyle'
);

alter table public.clients add column package_type public.package_type;

-- Same protection as plan_type: a client picks their package at signup, but
-- cannot change it afterwards via a self-update - only the trainer can, once
-- an upgrade/downgrade payment has actually been confirmed.
create or replace function public.prevent_client_self_privilege_escalation()
returns trigger as $$
begin
  if auth.uid() = old.id and auth.uid() <> old.trainer_id then
    if new.access_status is distinct from old.access_status
      or new.trainer_id is distinct from old.trainer_id
      or new.plan_type is distinct from old.plan_type
      or new.plan_started_at is distinct from old.plan_started_at
      or new.plan_expires_at is distinct from old.plan_expires_at
      or new.package_type is distinct from old.package_type
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
