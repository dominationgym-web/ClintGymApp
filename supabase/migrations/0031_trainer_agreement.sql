-- Trainer agreement (see src/screens/auth/TrainerAgreementContent.tsx).
--
-- Every trainer reads and signs the agreement by typing their full name. The
-- row records which version they signed, the name they typed, and when. The
-- time is stamped here from the database clock, never taken from the phone,
-- and can't be edited afterwards: it only moves when a new version is signed.

alter table public.trainers
  add column agreement_version text,
  add column agreement_signed_name text,
  add column agreement_accepted_at timestamptz;

alter table public.trainers add constraint trainers_agreement_signed
  check (agreement_version is null or length(trim(coalesce(agreement_signed_name, ''))) > 1);

create or replace function public.stamp_trainer_agreement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.agreement_accepted_at := case when new.agreement_version is null then null else now() end;
  elsif new.agreement_version is distinct from old.agreement_version then
    new.agreement_accepted_at := now();
  else
    new.agreement_signed_name := old.agreement_signed_name;
    new.agreement_accepted_at := old.agreement_accepted_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_trainer_agreement() from public, anon, authenticated;

create trigger trainers_stamp_agreement
  before insert or update on public.trainers
  for each row execute function public.stamp_trainer_agreement();
