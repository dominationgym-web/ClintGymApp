-- Trainer free trial and referral rewards (2026-10-11).
--
--   * Free trial: when the owner approves a trainer, they get 14 days
--     (trainers.trial_ends_at). The trial ending doesn't lock anyone out yet,
--     because there is no trainer fee: the owner is told and decides.
--   * Referrals: a new trainer can enter another trainer's code (the same code
--     clients use to join them) when they sign up. Each referred trainer the
--     owner approves earns the referrer 25% off a month; 4 = a free month. The
--     owner marks each 25% as used when he applies it (referral_credits_used).
--   * Alerts: the owner and the trainers involved get a phone notification for
--     referral signups and approvals, 3 days before a trial ends and when it ends.

alter table public.trainers
  add column if not exists trial_ends_at date,
  add column if not exists referred_by_code text,
  add column if not exists referred_by uuid references public.trainers (id) on delete set null,
  add column if not exists referral_credits_used integer not null default 0;

alter table public.trainers drop constraint if exists trainers_referral_credits_used_check;
alter table public.trainers add constraint trainers_referral_credits_used_check check (referral_credits_used >= 0);

-- Today in South Africa, where the owner and trainers are.
create or replace function public.sa_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Africa/Johannesburg')::date $$;

-- Column guard (0029), extended: trainers can't set their own trial, referrer
-- or credits; the owner may change another trainer's approval, trial end date
-- and used credits, and nothing else about them. Approval starts the trial.
create or replace function public.guard_trainer_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;
    new.is_owner := false;
    new.join_code := public.generate_trainer_join_code();
    new.trial_ends_at := null;
    new.referral_credits_used := 0;
    new.referred_by := null;
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
  then
    raise exception 'these trainer fields can''t be changed from the app';
  end if;

  if (new.approved is distinct from old.approved
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.referral_credits_used is distinct from old.referral_credits_used)
    and (not public.is_app_owner() or old.is_owner)
  then
    raise exception 'only the app owner can change approval, trials and referral credits';
  end if;

  -- The owner may change another trainer's approval, trial and credits, and nothing else.
  if auth.uid() <> old.id
    and (to_jsonb(new) - 'approved' - 'trial_ends_at' - 'referral_credits_used')
      is distinct from (to_jsonb(old) - 'approved' - 'trial_ends_at' - 'referral_credits_used')
  then
    raise exception 'only a trainer can edit their own profile';
  end if;

  -- First approval starts the 14-day free trial.
  if new.approved and not coalesce(old.approved, false) and new.trial_ends_at is null and not new.is_owner then
    new.trial_ends_at := public.sa_today() + 14;
  end if;

  return new;
end;
$$;

-- Alerts for trainer signups and approvals (0056), plus referrals and trials.
create or replace function public.notify_trainer_signup_and_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  referrer_name text;
  earned integer;
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
        coalesce(new.name, 'A trainer') || ' signed up with your code. Once they''re approved you earn 25% off a month.',
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
      select count(*) into earned from public.trainers t where t.referred_by = new.referred_by and t.approved;
      perform public.push_to_user(
        new.referred_by,
        'You earned 25% off 🎉',
        coalesce(new.name, 'Your referral') || ' is approved. That''s ' || earned || ' referral'
          || case when earned = 1 then '' else 's' end || ' so far. 4 referrals = a free month.',
        jsonb_build_object('type', 'referral_approved', 'trainerId', new.id)
      );
      for owner_id in select t.id from public.trainers t where t.is_owner and t.id <> new.referred_by loop
        perform public.push_to_user(
          owner_id,
          'Referral reward earned',
          coalesce(referrer_name, 'A trainer') || ' earned 25% off for referring ' || coalesce(new.name, 'a trainer')
            || ' (' || earned || ' so far).',
          jsonb_build_object('type', 'referral_approved', 'trainerId', new.referred_by)
        );
      end loop;
    end if;
  end if;
  return new;
exception when others then
  raise warning 'trainer signup notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_trainer_signup_and_approval() from public, anon, authenticated;

-- The trainers someone referred, for their own profile (they can't read other
-- trainers' rows directly).
create or replace function public.my_referrals()
returns table (name text, approved boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t.business_name, t.name), t.approved, t.created_at
  from public.trainers t
  where t.referred_by = (select auth.uid())
  order by t.created_at desc
$$;

revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- Daily trial alerts: 3 days before the end and on the last day, to the
-- trainer and the owner.
create or replace function public.trial_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  owner_id uuid;
  days_left integer;
begin
  for t in
    select id, coalesce(business_name, name) as display, trial_ends_at
    from public.trainers
    where approved and not is_owner and trial_ends_at in (public.sa_today() + 3, public.sa_today())
  loop
    days_left := t.trial_ends_at - public.sa_today();
    perform public.push_to_user(
      t.id,
      case when days_left = 0 then 'Your free trial ends today' else 'Your free trial ends in 3 days' end,
      'Thanks for trying Daily Evolution. Your coach access stays on while we sort out your plan.',
      jsonb_build_object('type', 'trial_reminder', 'daysLeft', days_left)
    );
    for owner_id in select o.id from public.trainers o where o.is_owner loop
      perform public.push_to_user(
        owner_id,
        case when days_left = 0 then 'Trainer trial ends today' else 'Trainer trial ends in 3 days' end,
        t.display || '''s free trial ' || case when days_left = 0 then 'ends today.' else 'ends in 3 days.' end
          || ' See them on the Trainers tab.',
        jsonb_build_object('type', 'trial_reminder', 'trainerId', t.id, 'daysLeft', days_left)
      );
    end loop;
  end loop;
end;
$$;

revoke execute on function public.trial_reminders() from public, anon, authenticated;

select cron.unschedule('trainer-trial-reminders-daily')
where exists (select 1 from cron.job where jobname = 'trainer-trial-reminders-daily');
select cron.schedule('trainer-trial-reminders-daily', '0 6 * * *', $$select public.trial_reminders();$$);
