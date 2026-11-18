-- Trainers cancel their own Daily Evolution subscription (GRIZZ, 2026-11-18).
--
-- Policy (Trainer Agreement section 9): cancel any time, no fee, no refunds.
-- The trainer keeps full use until the end of what they've paid for (or their
-- free trial), nothing renews, and unused referral credit becomes free months
-- (each is half a month) instead of cash. On the end date the account and the
-- clients' access are paused, nothing removed. The owner re-approves a trainer
-- who comes back; after 90 days the owner's Billing page says their data can
-- be cleared.
--
-- An undo is recorded in the status column; rows are never removed.

create table if not exists public.trainer_cancellations (
  trainer_id uuid primary key references public.trainers(id) on delete cascade,
  -- pending: cancelled, still has access until the end date
  -- undone: the trainer changed their mind before the end date
  -- ended: end date passed, account paused
  -- reactivated: the owner switched them back on after they ended
  status text not null default 'pending' check (status in ('pending', 'undone', 'ended', 'reactivated')),
  reason text,
  requested_at timestamptz not null default now(),
  requested_on date not null default public.sa_today(),
  ended_at timestamptz,
  ended_on date,
  reminded_at timestamptz
);

alter table public.trainer_cancellations enable row level security;

create policy "trainer or owner reads cancellations" on public.trainer_cancellations
  for select to authenticated
  using (trainer_id = (select auth.uid()) or public.is_app_owner());
-- Writes only through the functions below.

-- Unused referral credits (counted referrals less those already used).
create or replace function public.unused_referral_credits(p_trainer uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0,
    (select count(*)::integer from public.trainers r where r.referred_by = p_trainer and r.referral_counted_at is not null)
    - coalesce((select t.referral_credits_used from public.trainers t where t.id = p_trainer), 0))
$$;
revoke execute on function public.unused_referral_credits(uuid) from public, anon, authenticated;

-- The last day a cancelling trainer keeps full use, if they cancel on p_from:
-- the end of their free trial or paid plan (whichever is later), the end of
-- the month for free-use trainers, plus half a month (15 days) for every
-- unused referral credit, as on the owner's Referrals as free months.
create or replace function public.cancel_end_date(p_trainer uuid, p_from date)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (
    case
      when t.free_use_from is not null then (date_trunc('month', p_from) + interval '1 month - 1 day')::date
      else greatest(
        p_from,
        case when t.billing_started_on is null or t.billing_started_on > p_from then t.trial_ends_at end,
        t.paid_until
      )
    end
    + make_interval(months => public.unused_referral_credits(t.id) / 2, days => 15 * (public.unused_referral_credits(t.id) % 2))
  )::date
  from public.trainers t
  where t.id = p_trainer
$$;
revoke execute on function public.cancel_end_date(uuid, date) from public, anon, authenticated;

-- Is this trainer cancelling (still has access) right now? For billing
-- reminders and emails to skip.
create or replace function public.trainer_cancelling(p_trainer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trainer_cancellations c where c.trainer_id = p_trainer and c.status = 'pending')
$$;
revoke execute on function public.trainer_cancelling(uuid) from public, anon, authenticated;

-- The signed-in trainer's cancellation, or what the end date would be.
create or replace function public.my_cancellation()
returns table (status text, reason text, requested_on date, ends_on date, ended_on date, free_months numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.status,
    c.reason,
    c.requested_on,
    case when c.status = 'pending' then public.cancel_end_date(t.id, c.requested_on)
         else public.cancel_end_date(t.id, public.sa_today()) end,
    c.ended_on,
    public.unused_referral_credits(t.id) * 0.5
  from public.trainers t
  left join public.trainer_cancellations c on c.trainer_id = t.id
  where t.id = (select auth.uid()) and not t.is_owner
$$;
revoke execute on function public.my_cancellation() from public, anon;
grant execute on function public.my_cancellation() to authenticated;

create or replace function public.cancel_my_subscription(p_reason text)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.trainers;
  ends date;
  owner_id uuid;
begin
  select * into me from public.trainers where id = (select auth.uid());
  if me.id is null or me.is_owner or not me.approved then
    raise exception 'only an active trainer can cancel a subscription';
  end if;

  insert into public.trainer_cancellations (trainer_id, status, reason, requested_at, requested_on, ended_at, ended_on, reminded_at)
  values (me.id, 'pending', nullif(trim(p_reason), ''), now(), public.sa_today(), null, null, null)
  on conflict (trainer_id) do update
    set status = 'pending', reason = excluded.reason, requested_at = now(), requested_on = public.sa_today(),
        ended_at = null, ended_on = null, reminded_at = null;

  -- Nothing charged to a saved card again (the app also removes the card at Paystack).
  update public.trainer_cards set autopay = false where trainer_id = me.id;

  ends := public.cancel_end_date(me.id, public.sa_today());

  for owner_id in select t.id from public.trainers t where t.is_owner loop
    perform public.push_to_user(
      owner_id,
      'A trainer cancelled',
      coalesce(me.business_name, me.name, 'A trainer') || ' cancelled their subscription'
        || coalesce('. Reason: ' || nullif(trim(p_reason), ''), '')
        || '. Access ends ' || to_char(ends, 'FMDD FMMonth YYYY') || '.',
      jsonb_build_object('type', 'trainer_cancelled', 'trainerId', me.id)
    );
  end loop;
  return ends;
end;
$$;
revoke execute on function public.cancel_my_subscription(text) from public, anon;
grant execute on function public.cancel_my_subscription(text) to authenticated;

create or replace function public.undo_my_cancellation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.trainers;
  owner_id uuid;
begin
  select * into me from public.trainers where id = (select auth.uid());
  update public.trainer_cancellations set status = 'undone'
  where trainer_id = me.id and status = 'pending';
  if not found then
    return;
  end if;
  for owner_id in select t.id from public.trainers t where t.is_owner loop
    perform public.push_to_user(
      owner_id,
      'Cancellation undone',
      coalesce(me.business_name, me.name, 'A trainer') || ' changed their mind and is staying.',
      jsonb_build_object('type', 'trainer_cancelled', 'trainerId', me.id)
    );
  end loop;
end;
$$;
revoke execute on function public.undo_my_cancellation() from public, anon;
grant execute on function public.undo_my_cancellation() to authenticated;

-- Daily: a week before the end, remind the trainer to tell their clients; once
-- the end date has passed, pause the account (same as the owner's pause, so
-- billing, reminders and the trainer's clients all stop) and use up the
-- referral credits that became free months.
create or replace function public.finish_trainer_cancellations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  owner_id uuid;
  today date := public.sa_today();
begin
  for r in
    select c.trainer_id, public.cancel_end_date(c.trainer_id, c.requested_on) as ends, t.name, t.business_name, c.reminded_at
    from public.trainer_cancellations c join public.trainers t on t.id = c.trainer_id
    where c.status = 'pending'
  loop
    if r.ends < today then
      update public.trainers
      set approved = false,
          referral_credits_used = referral_credits_used + public.unused_referral_credits(id)
      where id = r.trainer_id;
      update public.trainer_cancellations
      set status = 'ended', ended_at = now(), ended_on = r.ends + 1
      where trainer_id = r.trainer_id;
      perform public.push_to_user(
        r.trainer_id,
        'Your subscription has ended',
        'Your Daily Evolution subscription has ended and your account is paused. Your clients and their data are kept for 90 days if you want to come back.',
        jsonb_build_object('type', 'trainer_cancel_ended')
      );
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          'Subscription ended',
          coalesce(r.business_name, r.name, 'A trainer') || '''s subscription has ended. Their account is paused.',
          jsonb_build_object('type', 'trainer_cancelled', 'trainerId', r.trainer_id)
        );
      end loop;
    elsif r.ends - today <= 7 and r.reminded_at is null then
      update public.trainer_cancellations set reminded_at = now() where trainer_id = r.trainer_id;
      perform public.push_to_user(
        r.trainer_id,
        'Let your clients know',
        'Your subscription ends ' || to_char(r.ends, 'FMDD FMMonth') || '. After that your clients can''t open the app, so tell them before then. Changed your mind? Undo it on your Profile.',
        jsonb_build_object('type', 'trainer_cancel_reminder')
      );
    end if;
  end loop;
end;
$$;
revoke execute on function public.finish_trainer_cancellations() from public, anon, authenticated;

select cron.unschedule('trainer-cancellations-daily')
where exists (select 1 from cron.job where jobname = 'trainer-cancellations-daily');
select cron.schedule('trainer-cancellations-daily', '20 22 * * *', $$select public.finish_trainer_cancellations()$$);

-- When the owner switches an ended trainer back on, they're active again.
create or replace function public.reactivate_cancelled_trainer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved and not coalesce(old.approved, false) then
    update public.trainer_cancellations set status = 'reactivated'
    where trainer_id = new.id and status = 'ended';
  end if;
  return new;
end;
$$;
revoke execute on function public.reactivate_cancelled_trainer() from public, anon, authenticated;

create or replace trigger trainers_reactivate_cancelled
  after update of approved on public.trainers
  for each row execute function public.reactivate_cancelled_trainer();

-- A trainer whose subscription ended is paused for their clients too.
create or replace function public.trainer_locked(p_trainer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select b.locked from public.billing_status_for(p_trainer) b), false)
    or exists (select 1 from public.trainer_cancellations c where c.trainer_id = p_trainer and c.status = 'ended')
$$;
revoke execute on function public.trainer_locked(uuid) from public, anon, authenticated;

-- Owner's Billing page: every cancellation that isn't undone.
create or replace function public.owner_cancellations()
returns table (trainer_id uuid, name text, status text, reason text, requested_on date, ends_on date, ended_on date, ready_to_clear boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'only the app owner can see cancellations';
  end if;
  return query
  select c.trainer_id, coalesce(t.business_name, t.name), c.status, c.reason, c.requested_on,
    case when c.status = 'pending' then public.cancel_end_date(c.trainer_id, c.requested_on) else c.ended_on - 1 end,
    c.ended_on,
    c.status = 'ended' and c.ended_on + 90 <= public.sa_today()
  from public.trainer_cancellations c join public.trainers t on t.id = c.trainer_id
  where c.status in ('pending', 'ended')
  order by c.status desc, c.requested_at desc;
end;
$$;
revoke execute on function public.owner_cancellations() from public, anon;
grant execute on function public.owner_cancellations() to authenticated;
