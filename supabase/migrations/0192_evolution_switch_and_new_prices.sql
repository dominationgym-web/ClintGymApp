-- Trainer pricing and the Evolution switch (GRIZZ, 2026-11-06).
--
-- 1 on 1: R100 / $10 a month plus R10 / $1 for every client, no limit and no
--   cap (was: first 10 clients only, most R200 / $20, 0183).
-- Evolution: R200 / $20 a month, first 5 clients free, then R20 / $2 each for
--   clients 6-20. Nothing more after client 20, so the most is R500 / $50
--   (was: tiers up to client 65, most R1 100 / $110, 0179).
-- Referrals: each counted referral is 50% off a month of the trainer's own
--   subscription (was 25%). Credits still unused when a trainer cancels become
--   free extra months (2 credits = 1 month), never a cash payout.
--
-- The Evolution switch: every new trainer starts on the 1 on 1 side with
-- Evolution switched off (trainers.evolution_on). Switching it on starts 30
-- free days of Evolution (evolution_started_on, stamped once, so switching
-- off and on again doesn't give another 30 days). After that the trainer is on
-- the Evolution price. Switching it off stops it, once no active client is an
-- Evolution or Both client. The price side now follows the switch instead of
-- the clients (price_side_for). Every trainer who already has an account
-- keeps Evolution on. Their Evolution free days end with their free trial
-- (they start paying at launch, after their 30-day trial, GRIZZ 2026-11-06).

alter table public.trainers
  add column if not exists evolution_on boolean not null default false,
  add column if not exists evolution_started_on date;

update public.trainers
set evolution_on = true,
  evolution_started_on = coalesce(trial_ends_at, approved_at::date, created_at::date, public.sa_today()) - 29
where evolution_on = false;

create or replace function public.guard_evolution_switch()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;
  -- The 30 free days start once, stamped here (the owner can still change it for another trainer).
  if new.evolution_started_on is distinct from old.evolution_started_on
    and not (public.is_app_owner() and not old.is_owner)
  then
    new.evolution_started_on := old.evolution_started_on;
  end if;
  if new.evolution_on and not old.evolution_on and new.evolution_started_on is null then
    new.evolution_started_on := public.sa_today();
  end if;
  if old.evolution_on and not new.evolution_on and exists (
    select 1 from public.clients c
    where c.trainer_id = old.id and c.id <> c.trainer_id
      and c.archived_at is null and c.access_status <> 'expired'
      and c.plan_started_at is not null and not c.live_only
  ) then
    raise exception 'Move your Evolution clients to 1 on 1 first, or archive them.';
  end if;
  return new;
end;
$function$;

create or replace trigger guard_evolution_switch
  before update on public.trainers
  for each row execute function public.guard_evolution_switch();

-- New prices. A very high "upto" means no limit: every client pays.
update public.billing_settings
set one_on_one_tiers = '[{"upto": 100000, "ZAR": 10, "USD": 1}]'::jsonb,
  client_tiers = '[{"upto": 20, "ZAR": 20, "USD": 2}]'::jsonb,
  updated_at = now()
where id = 1;

alter table public.billing_settings
  alter column one_on_one_tiers set default '[{"upto": 100000, "ZAR": 10, "USD": 1}]'::jsonb,
  alter column client_tiers set default '[{"upto": 20, "ZAR": 20, "USD": 2}]'::jsonb;

-- 'evolution' once the switch is on and its 30 free days are over; '1 on 1' otherwise.
create or replace function public.price_side_for(p_trainer uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select case
      when t.evolution_on and (t.evolution_started_on is null or t.evolution_started_on + 30 <= public.sa_today())
        then 'evolution'
      else 'one_on_one'
    end
    from public.trainers t where t.id = p_trainer
  ), 'one_on_one')
$function$;
revoke execute on function public.price_side_for(uuid) from public, anon, authenticated;
grant execute on function public.price_side_for(uuid) to service_role;

-- Unused referrals given as free months when a trainer cancels.
alter table public.referral_payouts
  add column if not exists free_months numeric(5, 1);

-- Referral pushes say 50% (were 25%, 0166).
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
        coalesce(new.name, 'A trainer') || ' signed up with your code. Once they''ve been with Daily Evolution for 3 months after their free trial, you get 50% off a month.',
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
          || to_char(counts_from, 'FMDD FMMonth YYYY') || ' (3 months after their free trial), you get 50% off a month.',
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
      'You earned 50% off 🎉',
      coalesce(r.display, 'Your referral') || ' has been with Daily Evolution for 3 months. That''s ' || earned || ' referral'
        || case when earned = 1 then '' else 's' end || ' so far. 4 referrals = a free month.',
      jsonb_build_object('type', 'referral_approved', 'trainerId', r.id)
    );
    for owner_id in select t.id from public.trainers t where t.is_owner and t.id <> r.referred_by loop
      perform public.push_to_user(
        owner_id,
        'Referral reward earned',
        coalesce(r.referrer_name, 'A trainer') || ' earned 50% off: ' || coalesce(r.display, 'their referral')
          || ' has been on the app 3 months (' || earned || ' so far).',
        jsonb_build_object('type', 'referral_approved', 'trainerId', r.referred_by)
      );
    end loop;
  end loop;
end;
$$;

-- Discounts the owner gives a trainer (GRIZZ, 2026-11-06), e.g. 50% for 6
-- months for helping test the app. discount_percent comes off their plan and
-- client fees while today (or the month being billed) is on or before
-- discount_until. Only the owner can set these (guard_trainer_columns below).
alter table public.trainers
  add column if not exists discount_percent integer check (discount_percent between 1 and 100),
  add column if not exists discount_until date;

-- The share taken off on a day: 0.5 for 50%, 0 with no discount.
create or replace function public.trainer_discount_on(p_trainer uuid, p_day date)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select t.discount_percent / 100.0 from public.trainers t
    where t.id = p_trainer and t.discount_percent is not null and t.discount_until >= p_day
  ), 0)
$function$;
revoke execute on function public.trainer_discount_on(uuid, date) from public, anon, authenticated;
grant execute on function public.trainer_discount_on(uuid, date) to service_role;

-- A plan's price for this trainer's side, less any discount today.
create or replace function public.trainer_plan_price(p_trainer uuid, p_plan text, p_currency text)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select round(coalesce((
    case when public.price_side_for(p_trainer) = 'one_on_one' then s.one_on_one_prices else s.prices end
      -> coalesce(p_currency, 'USD') ->> p_plan
  )::numeric, 0) * (1 - public.trainer_discount_on(p_trainer, public.sa_today())), 2)
  from public.billing_settings s where s.id = 1
$function$;
revoke execute on function public.trainer_plan_price(uuid, text, text) from public, anon, authenticated;

-- Client fees per month (0183), less the owner's discount.
CREATE OR REPLACE FUNCTION public.billing_month_rows(p_month date)
 RETURNS TABLE(trainer_id uuid, active_clients integer, new_activations integer, currency text, free boolean, client_fee numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  month_start date := date_trunc('month', p_month)::date;
  month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
  if auth.uid() is not null and not public.is_app_owner() then
    raise exception 'only the app owner can see billing';
  end if;
  return query
  with counts as (
    select
      t.id,
      t.billing_currency,
      t.free_use_from is not null as free_use,
      public.client_fees_start(t.id) as fees_from,
      public.price_side_for(t.id) as side,
      (
        select count(distinct x.cid)::integer from (
          select c.id as cid from public.clients c
          where c.trainer_id = t.id and c.id <> c.trainer_id
            and c.access_status <> 'expired' and c.created_at::date <= month_end
          union
          select a.client_id from public.client_activations a
          where a.trainer_id = t.id and a.activated_on between month_start and month_end and a.client_id is not null
        ) x
      ) + public.diary_only_clients(t.id, month_start) as evo_active,
      public.calendar_clients(t.id, month_start) as cal_active,
      (
        select count(*)::integer from public.client_activations a
        where a.trainer_id = t.id and a.activated_on between month_start and month_end
      ) as activations
    from public.trainers t
    where not t.is_owner
      and (t.billing_started_on <= month_end or t.free_use_from <= month_end)
  )
  select
    counts.id,
    case when counts.side = 'one_on_one' then counts.cal_active else counts.evo_active end,
    counts.activations,
    counts.billing_currency,
    (counts.fees_from is null or counts.fees_from > month_start) as is_free,
    -- Less any discount the owner gave for that month (0192).
    round((1 - public.trainer_discount_on(counts.id, month_start)) * case
      when counts.fees_from is null or counts.fees_from > month_start then 0::numeric
      when counts.side = 'one_on_one' then
        public.tier_fee_total(counts.cal_active, 0, coalesce(counts.billing_currency, 'USD'), s.one_on_one_tiers)
      -- Free-use trainers pay for every active client; plan trainers get their first few free.
      else public.tier_fee_total(counts.evo_active, case when counts.free_use then 0 else s.free_clients end, coalesce(counts.billing_currency, 'USD'), s.client_tiers)
    end, 2)
  from counts, public.billing_settings s
  where s.id = 1;
end;
$function$;


-- Only the owner sets a trainer's discount (otherwise as in 0166).
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
    new.discount_percent := null;
    new.discount_until := null;
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
      or new.free_use_from is distinct from old.free_use_from
      or new.discount_percent is distinct from old.discount_percent
      or new.discount_until is distinct from old.discount_until)
    and (not public.is_app_owner() or old.is_owner)
  then
    raise exception 'only the app owner can change approval, trials, referral credits, plans, free use and discounts';
  end if;

  if auth.uid() <> old.id
    and (to_jsonb(new) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until' - 'free_use_from' - 'discount_percent' - 'discount_until')
      is distinct from (to_jsonb(old) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until' - 'free_use_from' - 'discount_percent' - 'discount_until')
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
