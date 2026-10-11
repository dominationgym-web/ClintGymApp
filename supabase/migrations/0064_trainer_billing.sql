-- Trainer billing (2026-10-11), GRIZZ's pricing:
--
--   * Trainers pay a plan: monthly, 6 months or a year upfront, in US dollars
--     (international) or rand (South Africa). Prices live in billing_settings.
--   * After a trainer's first 2 months on a plan (to build their base), they
--     also pay a fee for every active client above their first 5, every month:
--     $10, or the rand amount in billing_settings for South African trainers.
--   * Referral rewards (0060: 25% of a month's plan per approved referral)
--     come off the trainer's next plan payment; if they cancel, the owner pays
--     out what's left (referral_payouts).
--   * Each month's client count and fee is logged in trainer_billing_months on
--     the 1st (the current month is worked out live), so the owner sees
--     monthly and 6-monthly totals. Every client activation is logged too.
--   * The owner records the EFT payments he receives (trainer_payments). A plan
--     payment moves the trainer's paid_until on; a client-fee payment pays off
--     what they owe.
--   * Reminders: trainers before and when their plan is due, and when the
--     monthly client fees are worked out; the owner when someone is overdue,
--     plus a Monday summary of everything outstanding.
--   * Lockout: when the owner switches billing_settings.lockout_enabled on, a
--     trainer whose plan has run out, or whose client fees are past due, is
--     locked out (and their clients see a "paused" screen) until he records the
--     payment. It's off until he launches pricing.

-- Settings ------------------------------------------------------------------

create table if not exists public.billing_settings (
  id integer primary key default 1 check (id = 1),
  prices jsonb not null default '{
    "USD": {"monthly": 50, "six_months": 250, "yearly": 400, "client": 10},
    "ZAR": {"monthly": 500, "six_months": 2500, "yearly": 4000, "client": 180}
  }'::jsonb,
  free_client_months integer not null default 2 check (free_client_months >= 0),
  -- Clients a trainer has before the per-client fee applies.
  free_clients integer not null default 5 check (free_clients >= 0),
  -- Client fees for a month are due by this day of the next month.
  client_fees_due_day integer not null default 7 check (client_fees_due_day between 1 and 28),
  lockout_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.billing_settings (id) values (1) on conflict (id) do nothing;

alter table public.billing_settings enable row level security;

create policy "trainers read billing settings" on public.billing_settings
  for select to authenticated
  using (exists (select 1 from public.trainers t where t.id = (select auth.uid())));

create policy "owner updates billing settings" on public.billing_settings
  for update to authenticated
  using ((select public.is_app_owner()))
  with check ((select public.is_app_owner()));

-- Each trainer's plan ------------------------------------------------------

alter table public.trainers
  add column if not exists approved_at timestamptz,
  add column if not exists billing_plan text,
  add column if not exists billing_currency text,
  add column if not exists billing_started_on date,
  add column if not exists paid_until date;

do $$ begin
  alter table public.trainers add constraint trainers_billing_plan_check
    check (billing_plan is null or billing_plan in ('monthly', 'six_months', 'yearly'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.trainers add constraint trainers_billing_currency_check
    check (billing_currency is null or billing_currency in ('USD', 'ZAR'));
exception when duplicate_object then null;
end $$;

-- Approval date, for referral totals. Older approvals: the trial started then.
update public.trainers
set approved_at = coalesce((trial_ends_at - 14)::timestamptz, created_at)
where approved and approved_at is null;

-- Column guard (0029, 0060), extended: the owner may also set another
-- trainer's plan, currency, billing start and paid-until date; trainers can't
-- change their own. First approval also stamps approved_at.
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
  then
    raise exception 'these trainer fields can''t be changed from the app';
  end if;

  if (new.approved is distinct from old.approved
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.referral_credits_used is distinct from old.referral_credits_used
      or new.billing_plan is distinct from old.billing_plan
      or new.billing_currency is distinct from old.billing_currency
      or new.billing_started_on is distinct from old.billing_started_on
      or new.paid_until is distinct from old.paid_until)
    and (not public.is_app_owner() or old.is_owner)
  then
    raise exception 'only the app owner can change approval, trials, referral credits and plans';
  end if;

  -- The owner may change another trainer's approval, trial, credits and plan, and nothing else.
  if auth.uid() <> old.id
    and (to_jsonb(new) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until')
      is distinct from (to_jsonb(old) - 'approved' - 'trial_ends_at' - 'referral_credits_used'
          - 'billing_plan' - 'billing_currency' - 'billing_started_on' - 'paid_until')
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

-- Client activations ---------------------------------------------------------

create table if not exists public.client_activations (
  id bigint generated always as identity primary key,
  -- Kept (with the name) if the client later deletes their account, so the
  -- month's log still adds up.
  client_id uuid references public.clients (id) on delete set null,
  client_name text,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  activated_on date not null default public.sa_today(),
  created_at timestamptz not null default now()
);

create index if not exists client_activations_trainer_idx on public.client_activations (trainer_id, activated_on);
create index if not exists client_activations_client_idx on public.client_activations (client_id);

alter table public.client_activations enable row level security;

create policy "owner and trainer read activations" on public.client_activations
  for select to authenticated
  using (trainer_id = (select auth.uid()) or (select public.is_app_owner()));

create or replace function public.log_client_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.access_status <> 'expired')
    or (tg_op = 'UPDATE' and old.access_status = 'expired' and new.access_status <> 'expired')
  then
    insert into public.client_activations (client_id, client_name, trainer_id)
    values (new.id, new.name, new.trainer_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.log_client_activation() from public, anon, authenticated;

create or replace trigger clients_log_activation
  after insert or update of access_status on public.clients
  for each row execute function public.log_client_activation();

-- The clients active today, as a starting point for the log.
insert into public.client_activations (client_id, client_name, trainer_id, activated_on)
select c.id, c.name, c.trainer_id, coalesce(c.plan_started_at, c.created_at::date)
from public.clients c
where c.access_status <> 'expired'
  and not exists (select 1 from public.client_activations a where a.client_id = c.id);

-- Monthly log and payments -------------------------------------------------

create table if not exists public.trainer_billing_months (
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  active_clients integer not null default 0,
  new_activations integer not null default 0,
  currency text,
  -- Inside the trainer's free months: logged, but no fee.
  free boolean not null default false,
  client_fee numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (trainer_id, month)
);

alter table public.trainer_billing_months enable row level security;

create policy "owner and trainer read billing months" on public.trainer_billing_months
  for select to authenticated
  using (trainer_id = (select auth.uid()) or (select public.is_app_owner()));

create table if not exists public.trainer_payments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  kind text not null check (kind in ('subscription', 'client_fees')),
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null check (currency in ('USD', 'ZAR')),
  -- Plan payments: how many months it pays for.
  months integer check (months is null or months in (1, 6, 12)),
  paid_on date not null default public.sa_today(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists trainer_payments_trainer_idx on public.trainer_payments (trainer_id, paid_on);

alter table public.trainer_payments enable row level security;

create policy "owner and trainer read payments" on public.trainer_payments
  for select to authenticated
  using (trainer_id = (select auth.uid()) or (select public.is_app_owner()));

create policy "owner records payments" on public.trainer_payments
  for insert to authenticated
  with check ((select public.is_app_owner()));

-- A plan payment carries paid_until on from where it was (so a late payer
-- doesn't get the gap free), or from the billing start for a first payment.
create or replace function public.apply_trainer_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base date;
begin
  if new.kind = 'subscription' and new.months is not null then
    select coalesce(t.paid_until, t.billing_started_on - 1, public.sa_today() - 1) into base
    from public.trainers t where t.id = new.trainer_id;
    update public.trainers
    set paid_until = (base + make_interval(months => new.months))::date
    where id = new.trainer_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.apply_trainer_payment() from public, anon, authenticated;

create or replace trigger trainer_payments_apply
  after insert on public.trainer_payments
  for each row execute function public.apply_trainer_payment();

-- Working out the bill -----------------------------------------------------

-- The date a trainer's per-client fees start, or null with no plan yet.
create or replace function public.client_fees_start(p_trainer uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (t.billing_started_on + make_interval(months => s.free_client_months))::date
  from public.trainers t, public.billing_settings s
  where t.id = p_trainer and t.billing_started_on is not null and not t.is_owner
$$;

-- One row per trainer on a plan for the month starting p_month: clients that
-- were active (still active now, or activated during the month), new
-- activations, and the fee. Worked out live; the 1st's snapshot stores it.
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
    where not t.is_owner and t.billing_started_on is not null and t.billing_started_on <= month_end
  )
  select
    counts.id,
    counts.active,
    counts.activations,
    counts.billing_currency,
    (counts.fees_from is null or counts.fees_from > month_start) as is_free,
    case
      when counts.fees_from is null or counts.fees_from > month_start then 0::numeric
      else greatest(0, counts.active - s.free_clients) * coalesce((s.prices -> coalesce(counts.billing_currency, 'USD') ->> 'client')::numeric, 0)
    end
  from counts, public.billing_settings s;
end;
$$;

revoke execute on function public.billing_month_rows(date) from public, anon;
grant execute on function public.billing_month_rows(date) to authenticated;

create or replace function public.snapshot_billing_month(p_month date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.trainer_billing_months (trainer_id, month, active_clients, new_activations, currency, free, client_fee)
  select r.trainer_id, date_trunc('month', p_month)::date, r.active_clients, r.new_activations, r.currency, r.free, r.client_fee
  from public.billing_month_rows(p_month) r
  on conflict (trainer_id, month) do nothing
$$;

revoke execute on function public.snapshot_billing_month(date) from public, anon, authenticated;

-- Where a trainer stands (no permission check: for the functions below).
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
  plan_overdue := not t.is_owner and t.billing_started_on is not null and t.billing_started_on <= today
    and coalesce(t.paid_until, t.billing_started_on - 1) < today;
  locked := s.lockout_enabled and t.approved and (plan_overdue or client_fees_overdue > 0);
  return next;
end;
$$;

revoke execute on function public.billing_status_for(uuid) from public, anon, authenticated;

-- The same for the app: a trainer about themselves, the owner about anyone.
create or replace function public.trainer_billing_status(p_trainer uuid)
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
begin
  if auth.uid() is not null and auth.uid() <> p_trainer and not public.is_app_owner() then
    raise exception 'not allowed';
  end if;
  return query select * from public.billing_status_for(p_trainer);
end;
$$;

revoke execute on function public.trainer_billing_status(uuid) from public, anon;
grant execute on function public.trainer_billing_status(uuid) to authenticated;

create or replace function public.trainer_locked(p_trainer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select b.locked from public.billing_status_for(p_trainer) b), false)
$$;

revoke execute on function public.trainer_locked(uuid) from public, anon, authenticated;

-- For the app: is this trainer, or this client's trainer, locked out?
create or replace function public.am_i_locked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.trainers t where t.id = (select auth.uid()))
      then public.trainer_locked((select auth.uid()))
    else coalesce((select public.trainer_locked(c.trainer_id) from public.clients c where c.id = (select auth.uid())), false)
  end
$$;

revoke execute on function public.am_i_locked() from public, anon;
grant execute on function public.am_i_locked() to authenticated;

-- The owner's bank details, for a trainer's payment screen (trainers can't
-- read the owner's row).
create or replace function public.owner_payment_details()
returns table (display_name text, eft_details jsonb, pop_whatsapp text)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t.business_name, t.name), t.eft_details, t.pop_whatsapp
  from public.trainers t
  where t.is_owner and exists (select 1 from public.trainers me where me.id = (select auth.uid()))
  limit 1
$$;

revoke execute on function public.owner_payment_details() from public, anon;
grant execute on function public.owner_payment_details() to authenticated;

-- A locked trainer can't change client, program, habit or message data,
-- like an unapproved one (0061).
create or replace function public.not_unapproved_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.trainers t
    where t.id = (select auth.uid()) and (not t.approved or public.trainer_locked(t.id))
  )
$$;

-- Referral payouts: when a trainer cancels, the owner pays out the referral
-- credit they haven't used, and records it here (it also counts the credits
-- as used).
create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  credits integer not null check (credits > 0),
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null check (currency in ('USD', 'ZAR')),
  paid_on date not null default public.sa_today(),
  created_at timestamptz not null default now()
);

alter table public.referral_payouts enable row level security;

create policy "owner and trainer read referral payouts" on public.referral_payouts
  for select to authenticated
  using (trainer_id = (select auth.uid()) or (select public.is_app_owner()));

create policy "owner records referral payouts" on public.referral_payouts
  for insert to authenticated
  with check ((select public.is_app_owner()));

create or replace function public.apply_referral_payout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trainers
  set referral_credits_used = referral_credits_used + new.credits
  where id = new.trainer_id;
  return new;
end;
$$;

revoke execute on function public.apply_referral_payout() from public, anon, authenticated;

create or replace trigger referral_payouts_apply
  after insert on public.referral_payouts
  for each row execute function public.apply_referral_payout();

-- Reminders ------------------------------------------------------------------

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
      select m.*, coalesce(t.business_name, t.name) as display
      from public.trainer_billing_months m join public.trainers t on t.id = m.trainer_id
      where m.month = last_month and m.client_fee > 0
    loop
      symbol := case when r.currency = 'ZAR' then 'R' else '$' end;
      perform public.push_to_user(
        r.trainer_id,
        'Client fees for ' || to_char(last_month, 'FMMonth'),
        r.active_clients || ' active client' || case when r.active_clients = 1 then '' else 's' end
          || ' (first ' || s.free_clients || ' free) = ' || symbol || r.client_fee::text || '. Please pay by ' || s.client_fees_due_day || ' '
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
    where t.approved and not t.is_owner and t.billing_started_on is not null
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

revoke execute on function public.billing_reminders() from public, anon, authenticated;

select cron.unschedule('trainer-billing-reminders-daily')
where exists (select 1 from cron.job where jobname = 'trainer-billing-reminders-daily');
select cron.schedule('trainer-billing-reminders-daily', '5 6 * * *', $$select public.billing_reminders();$$);
