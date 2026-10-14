-- Trainer location and free use (GRIZZ, 2026-10-14).
--
--   * A trainer must allow location when they apply. The app sends the
--     country their phone is in (signup_country, ISO code like 'ZA'); South
--     African trainers are set to rand prices, everyone else to dollars. The
--     owner sees the country on Billing and can still change the currency.
--     Trainers can't change it later.
--   * Free use: only the owner can give a trainer free use (free_use_from).
--     They pay no plan. Six months after it starts, they pay the per-client
--     fee (R100 / $10 in billing_settings) for every active client each
--     month. Fees are worked out per calendar month, so they start on the
--     1st on or after the 6 months are up (free_use_fees_start). Ending
--     free use (null) puts them back on a normal plan.
--   * Notices: the trainer is told when free use starts or ends, and both
--     the trainer and the owner 30 days and 7 days before, and on the day,
--     the per-client fee begins.

alter table public.trainers
  add column if not exists signup_country text,
  add column if not exists signup_location_checked_at timestamptz,
  add column if not exists free_use_from date;


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
    -- The country the trainer's phone was in when they applied (0096):
    -- South Africa pays rand prices, everyone else dollars.
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

  -- The owner may change another trainer's approval, trial, credits and plan, and nothing else.
  if auth.uid() <> old.id
    and (to_jsonb(new) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until' - 'free_use_from')
      is distinct from (to_jsonb(old) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until' - 'free_use_from')
  then
    raise exception 'only a trainer can edit their own profile';
  end if;

  -- First approval starts the 14-day free trial.
  if new.approved and not coalesce(old.approved, false) then
    new.approved_at := coalesce(old.approved_at, now());
    if new.trial_ends_at is null and not new.is_owner then
      new.trial_ends_at := public.sa_today() + 14;
    end if;
  end if;

  return new;
end;
$$;


-- The day a free-use trainer's per-client fees begin: the 1st of the month
-- on or after 6 months from the start (14 Oct -> 1 May, 1 Oct -> 1 Apr).
create or replace function public.free_use_fees_start(p_from date)
returns date
language sql
immutable
set search_path = public
as $$
  select (date_trunc('month', (p_from + interval '6 months')::date - 1) + interval '1 month')::date
$$;

create or replace function public.client_fees_start(p_trainer uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Free use: no plan, and per-client fees on every active client from 6 months after it began.
    when t.free_use_from is not null then public.free_use_fees_start(t.free_use_from)
    else (t.billing_started_on + make_interval(months => s.free_client_months))::date
  end
  from public.trainers t, public.billing_settings s
  where t.id = p_trainer and (t.billing_started_on is not null or t.free_use_from is not null) and not t.is_owner
$$;


create or replace function public.billing_month_rows(p_month date)
returns table (
  trainer_id uuid,
  active_clients integer,
  new_activations integer,
  currency text,
  free boolean,
  client_fee numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
      (
        select count(distinct x.cid)::integer from (
          select c.id as cid from public.clients c
          where c.trainer_id = t.id and c.access_status <> 'expired' and c.created_at::date <= month_end
          union
          select a.client_id from public.client_activations a
          where a.trainer_id = t.id and a.activated_on between month_start and month_end and a.client_id is not null
        ) x
      ) as active,
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
    counts.active,
    counts.activations,
    counts.billing_currency,
    (counts.fees_from is null or counts.fees_from > month_start) as is_free,
    case
      when counts.fees_from is null or counts.fees_from > month_start then 0::numeric
      -- Free-use trainers pay for every active client; plan trainers get their first few free.
      else greatest(0, counts.active - case when counts.free_use then 0 else s.free_clients end) * coalesce((s.prices -> coalesce(counts.billing_currency, 'USD') ->> 'client')::numeric, 0)
    end
  from counts, public.billing_settings s;
end;
$$;


create or replace function public.billing_status_for(p_trainer uuid)
returns table (
  trainer_id uuid,
  billing_plan text,
  billing_currency text,
  billing_started_on date,
  paid_until date,
  client_fees_from date,
  client_fees_billed numeric,
  client_fees_paid numeric,
  client_fees_owed numeric,
  client_fees_overdue numeric,
  plan_overdue boolean,
  locked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.billing_settings;
  t public.trainers;
  today date := public.sa_today();
  billed numeric;
  billed_due numeric;
  paid numeric;
begin
  select * into s from public.billing_settings where id = 1;
  select * into t from public.trainers where id = p_trainer;
  if t.id is null then
    return;
  end if;

  select coalesce(sum(m.client_fee), 0),
         coalesce(sum(m.client_fee) filter (
           where (m.month + interval '1 month' + make_interval(days => s.client_fees_due_day - 1))::date < today
         ), 0)
  into billed, billed_due
  from public.trainer_billing_months m where m.trainer_id = p_trainer;

  select coalesce(sum(p.amount), 0) into paid
  from public.trainer_payments p where p.trainer_id = p_trainer and p.kind = 'client_fees';

  trainer_id := t.id;
  billing_plan := t.billing_plan;
  billing_currency := t.billing_currency;
  billing_started_on := t.billing_started_on;
  paid_until := t.paid_until;
  client_fees_from := public.client_fees_start(t.id);
  client_fees_billed := billed;
  client_fees_paid := paid;
  client_fees_owed := greatest(0, billed - paid);
  client_fees_overdue := greatest(0, billed_due - paid);
  -- Free use (0096) has no plan to pay.
  plan_overdue := not t.is_owner and t.free_use_from is null and t.billing_started_on is not null and t.billing_started_on <= today
    and coalesce(t.paid_until, t.billing_started_on - 1) < today;
  locked := s.lockout_enabled and t.approved and (plan_overdue or client_fees_overdue > 0);
  return next;
end;
$$;


create or replace function public.billing_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.billing_settings;
  today date := public.sa_today();
  last_month date := (date_trunc('month', public.sa_today()) - interval '1 month')::date;
  r record;
  owner_id uuid;
  symbol text;
  summary text;
  total_lines integer;
begin
  select * into s from public.billing_settings where id = 1;

  -- 1st of the month: log last month and tell each trainer their client fees.
  if extract(day from today) = 1 then
    perform public.snapshot_billing_month(last_month);
    summary := '';
    total_lines := 0;
    for r in
      select m.*, coalesce(t.business_name, t.name) as display, t.free_use_from
      from public.trainer_billing_months m join public.trainers t on t.id = m.trainer_id
      where m.month = last_month and m.client_fee > 0
    loop
      symbol := case when r.currency = 'ZAR' then 'R' else '$' end;
      perform public.push_to_user(
        r.trainer_id,
        'Client fees for ' || to_char(last_month, 'FMMonth'),
        r.active_clients || ' active client' || case when r.active_clients = 1 then '' else 's' end
          || case when r.free_use_from is not null then '' else ' (first ' || s.free_clients || ' free)' end || ' = ' || symbol || r.client_fee::text || '. Please pay by ' || s.client_fees_due_day || ' '
          || to_char(today, 'FMMonth') || '.',
        jsonb_build_object('type', 'client_fees')
      );
      summary := summary || case when total_lines > 0 then ', ' else '' end || r.display || ' ' || symbol || r.client_fee::text;
      total_lines := total_lines + 1;
    end loop;
    if total_lines > 0 then
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          to_char(last_month, 'FMMonth') || ' client fees',
          summary || '. See Billing on the Trainers tab.',
          jsonb_build_object('type', 'client_fees_summary')
        );
      end loop;
    end if;
  end if;

  -- Plans: 3 days before, on the day, and the day after (overdue).
  for r in
    select t.id, coalesce(t.business_name, t.name) as display, t.paid_until
    from public.trainers t
    where t.approved and not t.is_owner and t.billing_started_on is not null and t.free_use_from is null
      and coalesce(t.paid_until, t.billing_started_on - 1) in (today + 3, today, today - 1)
  loop
    if coalesce(r.paid_until, today - 1) = today - 1 then
      perform public.push_to_user(
        r.id,
        'Your Daily Evolution plan is overdue',
        case when s.lockout_enabled
          then 'Your coach access is paused until payment is received. Open the app for the payment details.'
          else 'Please pay your plan to keep your coach access. Open the app for the payment details.' end,
        jsonb_build_object('type', 'plan_overdue')
      );
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          r.display || '''s plan is overdue',
          'Record their payment on Billing (Trainers tab) once it comes in.',
          jsonb_build_object('type', 'trainer_plan_overdue', 'trainerId', r.id)
        );
      end loop;
    else
      perform public.push_to_user(
        r.id,
        case when r.paid_until = today then 'Your plan is due today' else 'Your plan is due in 3 days' end,
        'Pay by EFT to keep your coach access. Open the app for the payment details.',
        jsonb_build_object('type', 'plan_due')
      );
    end if;
  end loop;

  -- Client fees: the day after they were due, if still unpaid.
  if extract(day from today) = s.client_fees_due_day + 1 then
    for r in
      select t.id, coalesce(t.business_name, t.name) as display, t.billing_currency, b.client_fees_overdue
      from public.trainers t, public.billing_status_for(t.id) b
      where t.approved and not t.is_owner and b.client_fees_overdue > 0
    loop
      symbol := case when r.billing_currency = 'ZAR' then 'R' else '$' end;
      perform public.push_to_user(
        r.id,
        'Client fees overdue',
        symbol || r.client_fees_overdue::text || ' in client fees is overdue. Open the app for the payment details.',
        jsonb_build_object('type', 'client_fees_overdue')
      );
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          r.display || ' owes client fees',
          symbol || r.client_fees_overdue::text || ' is overdue.',
          jsonb_build_object('type', 'trainer_fees_overdue', 'trainerId', r.id)
        );
      end loop;
    end loop;
  end if;

  -- Mondays: the owner's summary of everything outstanding.
  if extract(isodow from today) = 1 then
    summary := '';
    total_lines := 0;
    for r in
      select coalesce(t.business_name, t.name) as display, t.billing_currency, b.plan_overdue, b.client_fees_owed
      from public.trainers t, public.billing_status_for(t.id) b
      where t.approved and not t.is_owner and (b.plan_overdue or b.client_fees_owed > 0)
    loop
      symbol := case when r.billing_currency = 'ZAR' then 'R' else '$' end;
      summary := summary || case when total_lines > 0 then '; ' else '' end || r.display || ': '
        || concat_ws(' + ',
             case when r.plan_overdue then 'plan overdue' end,
             case when r.client_fees_owed > 0 then symbol || r.client_fees_owed::text || ' client fees' end);
      total_lines := total_lines + 1;
    end loop;
    if total_lines > 0 then
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          total_lines || ' trainer' || case when total_lines = 1 then ' owes' else 's owe' end || ' you',
          summary,
          jsonb_build_object('type', 'billing_summary')
        );
      end loop;
    end if;
  end if;
end;
$$;


-- Tell the trainer when the owner starts or ends their free use.
create or replace function public.notify_free_use_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fee text;
  fees_from date;
begin
  if new.free_use_from is not distinct from old.free_use_from then
    return new;
  end if;
  if new.free_use_from is not null and old.free_use_from is null then
    select case when coalesce(new.billing_currency, 'USD') = 'ZAR' then 'R' else '$' end
           || (s.prices -> coalesce(new.billing_currency, 'USD') ->> 'client')
    into fee from public.billing_settings s where s.id = 1;
    fees_from := public.free_use_fees_start(new.free_use_from);
    perform public.push_to_user(
      new.id,
      'You''re on free use 🎁',
      'No monthly subscription. From ' || to_char(fees_from, 'FMDD FMMonth YYYY') || ' you''ll pay ' || coalesce(fee, 'a fee')
        || ' a month for each active client.',
      jsonb_build_object('type', 'free_use_started')
    );
  elsif new.free_use_from is null then
    perform public.push_to_user(
      new.id,
      'Your free use has ended',
      'Your normal Daily Evolution plan applies from now. Open the app to see the details.',
      jsonb_build_object('type', 'free_use_ended')
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_free_use_change() from public, anon, authenticated;

create or replace trigger trainers_free_use_notify
  after update of free_use_from on public.trainers
  for each row execute function public.notify_free_use_change();

-- Daily: warn free-use trainers (and the owner) that the per-client fee is coming.
create or replace function public.free_use_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := public.sa_today();
  r record;
  owner_id uuid;
  fee text;
  when_text text;
begin
  for r in
    select t.id, coalesce(t.business_name, t.name) as display, t.billing_currency,
           public.free_use_fees_start(t.free_use_from) as fees_from
    from public.trainers t
    where t.approved and not t.is_owner and t.free_use_from is not null
      and public.free_use_fees_start(t.free_use_from) in (today + 30, today + 7, today)
  loop
    select case when coalesce(r.billing_currency, 'USD') = 'ZAR' then 'R' else '$' end
           || (s.prices -> coalesce(r.billing_currency, 'USD') ->> 'client')
    into fee from public.billing_settings s where s.id = 1;
    when_text := case when r.fees_from = today then 'from today' else 'from ' || to_char(r.fees_from, 'FMDD FMMonth') end;
    perform public.push_to_user(
      r.id,
      case when r.fees_from = today then 'Your free use period is over' else 'Your free use ends soon' end,
      'You''ll pay ' || coalesce(fee, 'the client fee') || ' a month for each active client ' || when_text
        || '. Fees are worked out on the 1st of each month.',
      jsonb_build_object('type', 'free_use_ending')
    );
    for owner_id in select t.id from public.trainers t where t.is_owner loop
      perform public.push_to_user(
        owner_id,
        r.display || '''s free use ' || case when r.fees_from = today then 'is over' else 'ends soon' end,
        'They start paying ' || coalesce(fee, 'the client fee') || ' per active client ' || when_text || '.',
        jsonb_build_object('type', 'trainer_free_use_ending', 'trainerId', r.id)
      );
    end loop;
  end loop;
end;
$$;

revoke execute on function public.free_use_reminders() from public, anon, authenticated;

select cron.unschedule('trainer-free-use-reminders-daily')
where exists (select 1 from cron.job where jobname = 'trainer-free-use-reminders-daily');
select cron.schedule('trainer-free-use-reminders-daily', '15 6 * * *', $$select public.free_use_reminders();$$);
