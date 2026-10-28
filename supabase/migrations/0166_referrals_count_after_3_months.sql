-- A referral only counts once the referred trainer has stayed 3 months
-- (GRIZZ, 2026-10-28): 3 months after their free trial ends, still approved
-- and up to date with their payments. Then the referrer gets the 25% off.
--
-- * trainers.referral_counted_at is stamped on the REFERRED trainer's row the
--   day their referral starts counting. Nobody can set it from the app; the
--   daily job referral_rewards() does, and tells the referrer and the owner.
-- * my_referral_progress() shows a trainer their referrals with the date each
--   one starts counting (my_referrals stays for older app versions).
-- * Card payments (card-billing) now take banked referral credit off
--   automatically: card_charges.referral_credits and credit_amount record it,
--   and add_referral_credits_used() marks the credits used once paid.

alter table public.trainers
  add column if not exists referral_counted_at timestamptz;

alter table public.card_charges
  add column if not exists referral_credits integer not null default 0 check (referral_credits >= 0),
  add column if not exists credit_amount numeric(10, 2) not null default 0 check (credit_amount >= 0);

-- The day a referral starts counting: 3 months after the trial ends (or approval).
create or replace function public.referral_counts_from(p_trial_ends_at date, p_approved_at timestamptz)
returns date
language sql
immutable
set search_path = public
as $$
  select (coalesce(p_trial_ends_at, (p_approved_at at time zone 'Africa/Johannesburg')::date) + interval '3 months')::date
$$;

-- Column guard (0149), plus referral_counted_at, which only the daily job sets.
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
    new.referral_counted_at := null;
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
    or new.referral_counted_at is distinct from old.referral_counted_at
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

  -- First approval starts the 30-day free trial, which runs at least until
  -- the launch date.
  if new.approved and not coalesce(old.approved, false) then
    new.approved_at := coalesce(old.approved_at, now());
    if new.trial_ends_at is null and not new.is_owner then
      new.trial_ends_at := greatest(public.sa_today() + 30, date '2027-01-31');
    end if;
  end if;

  return new;
end;
$function$;

-- Signup and approval alerts (0060): the referrer now hears when their
-- referral will count, not that they've earned it already.
create or replace function public.notify_trainer_signup_and_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  referrer_name text;
  counts_from date;
begin
  if new.referred_by is not null then
    select coalesce(t.business_name, t.name) into referrer_name from public.trainers t where t.id = new.referred_by;
  end if;

  if tg_op = 'INSERT' and not coalesce(new.approved, false) then
    for owner_id in select t.id from public.trainers t where t.is_owner loop
      perform public.push_to_user(
        owner_id,
        'New trainer application',
        coalesce(new.name, 'A trainer') || ' wants to join'
          || case when referrer_name is not null then ', referred by ' || referrer_name else '' end
          || '. Approve them on the Trainers tab.',
        jsonb_build_object('type', 'trainer_signup', 'trainerId', new.id)
      );
    end loop;
    if new.referred_by is not null then
      perform public.push_to_user(
        new.referred_by,
        'Someone used your referral code',
        coalesce(new.name, 'A trainer') || ' signed up with your code. Once they''ve been with Daily Evolution for 3 months after their free trial, you get 25% off a month.',
        jsonb_build_object('type', 'referral_signup', 'trainerId', new.id)
      );
    end if;
  elsif tg_op = 'UPDATE' and new.approved and not coalesce(old.approved, false) then
    perform public.push_to_user(
      new.id,
      'You''re approved! 🎉',
      'Your trainer account is ready'
        || case when new.trial_ends_at is not null
             then ' and your free trial runs until ' || to_char(new.trial_ends_at, 'FMDD FMMonth') else '' end
        || '. Open the app to set up your profile and invite clients.',
      jsonb_build_object('type', 'trainer_approved')
    );
    if new.referred_by is not null then
      counts_from := public.referral_counts_from(new.trial_ends_at, coalesce(new.approved_at, now()));
      perform public.push_to_user(
        new.referred_by,
        'Your referral is approved',
        coalesce(new.name, 'Your referral') || ' is approved. If they''re still with Daily Evolution on '
          || to_char(counts_from, 'FMDD FMMonth YYYY') || ' (3 months after their free trial), you get 25% off a month.',
        jsonb_build_object('type', 'referral_signup', 'trainerId', new.id)
      );
    end if;
  end if;
  return new;
exception when others then
  raise warning 'trainer signup notification failed: %', sqlerrm;
  return new;
end;
$$;

-- A trainer's referrals with when each counts, for their own profile.
create or replace function public.my_referral_progress()
returns table (name text, approved boolean, counts_from date, counted boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t.business_name, t.name),
         t.approved,
         case when t.approved then public.referral_counts_from(t.trial_ends_at, t.approved_at) end,
         t.referral_counted_at is not null,
         t.created_at
  from public.trainers t
  where t.referred_by = (select auth.uid())
  order by t.created_at desc
$$;

revoke execute on function public.my_referral_progress() from public, anon;
grant execute on function public.my_referral_progress() to authenticated;

-- Daily: referrals that have reached 3 months after the trial, with the
-- referred trainer still approved and up to date, start counting.
create or replace function public.referral_rewards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  owner_id uuid;
  earned integer;
begin
  for r in
    select t.id, t.referred_by, coalesce(t.business_name, t.name) as display,
           (select coalesce(x.business_name, x.name) from public.trainers x where x.id = t.referred_by) as referrer_name
    from public.trainers t
    cross join lateral public.billing_status_for(t.id) s
    where t.referred_by is not null
      and t.approved
      and t.referral_counted_at is null
      and public.referral_counts_from(t.trial_ends_at, t.approved_at) <= public.sa_today()
      and not coalesce(s.plan_overdue, false)
      and coalesce(s.client_fees_overdue, 0) = 0
  loop
    update public.trainers set referral_counted_at = now() where id = r.id;
    select count(*) into earned from public.trainers t where t.referred_by = r.referred_by and t.referral_counted_at is not null;
    perform public.push_to_user(
      r.referred_by,
      'You earned 25% off 🎉',
      coalesce(r.display, 'Your referral') || ' has been with Daily Evolution for 3 months. That''s ' || earned || ' referral'
        || case when earned = 1 then '' else 's' end || ' so far. 4 referrals = a free month.',
      jsonb_build_object('type', 'referral_approved', 'trainerId', r.id)
    );
    for owner_id in select t.id from public.trainers t where t.is_owner and t.id <> r.referred_by loop
      perform public.push_to_user(
        owner_id,
        'Referral reward earned',
        coalesce(r.referrer_name, 'A trainer') || ' earned 25% off: ' || coalesce(r.display, 'their referral')
          || ' has been on the app 3 months (' || earned || ' so far).',
        jsonb_build_object('type', 'referral_approved', 'trainerId', r.referred_by)
      );
    end loop;
  end loop;
end;
$$;

revoke execute on function public.referral_rewards() from public, anon, authenticated;

-- card-billing marks credits used once a card payment goes through.
create or replace function public.add_referral_credits_used(p_trainer uuid, p_credits integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.trainers
  set referral_credits_used = referral_credits_used + greatest(0, p_credits)
  where id = p_trainer
$$;

revoke execute on function public.add_referral_credits_used(uuid, integer) from public, anon, authenticated;

select cron.unschedule('referral-rewards-daily') where exists (select 1 from cron.job where jobname = 'referral-rewards-daily');
-- 06:15 UTC is 08:15 in South Africa.
select cron.schedule('referral-rewards-daily', '15 6 * * *', $$select public.referral_rewards();$$);
