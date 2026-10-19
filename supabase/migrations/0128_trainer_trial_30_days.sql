-- The trainer free trial is 30 days (GRIZZ, 2026-10-19: "The free trial will
-- be 30 days."), up from 14 (0060). Only the line that stamps trial_ends_at on
-- first approval changes; trials already running keep their end date.
create or replace function public.guard_trainer_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;
    new.approved_at := null;
    new.is_owner := false;
    new.join_code := public.generate_trainer_join_code();
    new.trial_ends_at := null;
    new.referral_credits_used := 0;
    new.referred_by := null;
    new.billing_plan := null;
    new.billing_currency := null;
    new.billing_started_on := null;
    new.paid_until := null;
    new.free_use_from := null;
    new.signup_country := nullif(upper(trim(coalesce(new.signup_country, ''))), '');
    new.signup_location_checked_at := case when new.signup_country is not null then now() end;
    new.billing_currency := case
      when new.signup_country = 'ZA' then 'ZAR'
      when new.signup_country is not null then 'USD'
    end;
    new.referred_by_code := nullif(upper(trim(coalesce(new.referred_by_code, ''))), '');
    if new.referred_by_code is not null then
      select t.id into new.referred_by
      from public.trainers t
      where t.join_code = new.referred_by_code and t.approved and t.id <> new.id;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.is_owner is distinct from old.is_owner
    or new.join_code is distinct from old.join_code
    or new.referred_by is distinct from old.referred_by
    or new.referred_by_code is distinct from old.referred_by_code
    or new.approved_at is distinct from old.approved_at
    or new.signup_country is distinct from old.signup_country
    or new.signup_location_checked_at is distinct from old.signup_location_checked_at
  then
    raise exception 'these trainer fields can''t be changed from the app';
  end if;

  if (new.approved is distinct from old.approved
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.referral_credits_used is distinct from old.referral_credits_used
      or new.billing_plan is distinct from old.billing_plan
      or new.billing_currency is distinct from old.billing_currency
      or new.billing_started_on is distinct from old.billing_started_on
      or new.paid_until is distinct from old.paid_until
      or new.free_use_from is distinct from old.free_use_from)
    and (not public.is_app_owner() or old.is_owner)
  then
    raise exception 'only the app owner can change approval, trials, referral credits, plans and free use';
  end if;

  if auth.uid() <> old.id
    and (to_jsonb(new) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until' - 'free_use_from')
      is distinct from (to_jsonb(old) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until' - 'free_use_from')
  then
    raise exception 'only a trainer can edit their own profile';
  end if;

  -- First approval starts the 30-day free trial.
  if new.approved and not coalesce(old.approved, false) then
    new.approved_at := coalesce(old.approved_at, now());
    if new.trial_ends_at is null and not new.is_owner then
      new.trial_ends_at := public.sa_today() + 30;
    end if;
  end if;

  return new;
end;
$function$;
