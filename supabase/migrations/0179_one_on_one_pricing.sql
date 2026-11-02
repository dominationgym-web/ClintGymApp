-- Trainer pricing by side (GRIZZ, 2026-11-02).
--
-- Evolution: one price gets the trainer both sides (Evolution and 1 on 1).
--   R200 / $20 a month, first 5 clients included, then R20 / $2 each for
--   clients 6-35, R10 / $1 each for clients 36-65, free from client 66.
--   Most it can come to: R1 100 / $110 a month.
-- 1 on 1 only: R100 / $10 a month plus R10 / $1 for every client, no free
--   clients, stopping at 70 clients (most R800 / $80 a month).
--
-- A trainer is on 1 on 1 only pricing while none of their active clients is
-- an Evolution client (every client is live_only, 0169/0176). As soon as one
-- Evolution or Both client is active, Evolution pricing applies.
--
-- Clients counted: active app clients (as before) plus people who are only in
-- the 1 on 1 diary by name (live_sessions.guest_name, 0174) and had a session
-- that month. Both sides count them.
--
-- 6 and 12 month plans keep the old discount: 6 months = 5 months' price,
-- 12 months = 9 months' price. Referral credit stays 25% of the trainer's own
-- monthly price.

alter table public.billing_settings
  add column if not exists one_on_one_prices jsonb not null default '{
    "ZAR": {"monthly": 100, "six_months": 500, "yearly": 900},
    "USD": {"monthly": 10, "six_months": 50, "yearly": 90}
  }'::jsonb,
  add column if not exists one_on_one_tiers jsonb not null default '[
    {"upto": 70, "ZAR": 10, "USD": 1}
  ]'::jsonb;

alter table public.billing_settings
  alter column client_tiers set default '[
    {"upto": 35, "ZAR": 20, "USD": 2},
    {"upto": 65, "ZAR": 10, "USD": 1}
  ]'::jsonb;

update public.billing_settings
set client_tiers = '[
    {"upto": 35, "ZAR": 20, "USD": 2},
    {"upto": 65, "ZAR": 10, "USD": 1}
  ]'::jsonb,
  updated_at = now()
where id = 1;

-- Fees for p_active clients over any tier list, first p_included free.
create or replace function public.tier_fee_total(p_active integer, p_included integer, p_currency text, p_tiers jsonb)
returns numeric
language sql
immutable
set search_path to 'public'
as $function$
  select coalesce(sum(
    greatest(0, least(p_active, (t.tier ->> 'upto')::integer) - greatest(p_included, t.prev_upto))
      * coalesce((t.tier ->> coalesce(p_currency, 'USD'))::numeric, 0)
  ), 0)
  from (
    select e.tier,
      coalesce(lag((e.tier ->> 'upto')::integer) over (order by e.ord), 0) as prev_upto
    from jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb)) with ordinality as e(tier, ord)
  ) t
$function$;

-- Evolution fees (kept for anything that still calls it).
create or replace function public.client_fee_total(p_active integer, p_included integer, p_currency text)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.tier_fee_total(p_active, p_included, p_currency, s.client_tiers)
  from public.billing_settings s where s.id = 1
$function$;

-- 'evolution' or 'one_on_one' (1 on 1 only).
create or replace function public.price_side_for(p_trainer uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case when exists (
    select 1 from public.clients c
    where c.trainer_id = p_trainer and c.id <> c.trainer_id
      and c.archived_at is null and c.access_status <> 'expired' and not c.live_only
  ) then 'evolution' else 'one_on_one' end
$function$;

-- People only in the diary by name who had a session in the month of p_month.
create or replace function public.diary_only_clients(p_trainer uuid, p_month date)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(distinct public.diary_name_key(ls.guest_name))::integer
  from public.live_sessions ls
  where ls.trainer_id = p_trainer
    and ls.client_id is null
    and ls.guest_name is not null
    and ls.status <> 'removed'
    and (ls.starts_at at time zone 'Africa/Johannesburg')::date
      between date_trunc('month', p_month)::date and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
$function$;

-- A plan's price for this trainer's side.
create or replace function public.trainer_plan_price(p_trainer uuid, p_plan text, p_currency text)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    case when public.price_side_for(p_trainer) = 'one_on_one' then s.one_on_one_prices else s.prices end
      -> coalesce(p_currency, 'USD') ->> p_plan
  )::numeric, 0)
  from public.billing_settings s where s.id = 1
$function$;

revoke execute on function public.price_side_for(uuid) from public, anon, authenticated;
revoke execute on function public.diary_only_clients(uuid, date) from public, anon, authenticated;
revoke execute on function public.trainer_plan_price(uuid, text, text) from public, anon, authenticated;
grant execute on function public.price_side_for(uuid) to service_role;

-- For the app: each trainer's pricing side and how many clients count this
-- month. The owner sees every trainer; a trainer sees only themselves.
create or replace function public.trainer_price_sides()
returns table(trainer_id uuid, side text, counted_clients integer, diary_clients integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  today date := public.sa_today();
begin
  return query
  select
    t.id,
    public.price_side_for(t.id),
    (select count(*)::integer from public.clients c
      where c.trainer_id = t.id and c.id <> c.trainer_id and c.archived_at is null and c.access_status <> 'expired')
      + public.diary_only_clients(t.id, today),
    public.diary_only_clients(t.id, today)
  from public.trainers t
  where (public.is_app_owner() or t.id = auth.uid());
end;
$function$;
revoke execute on function public.trainer_price_sides() from public, anon;
grant execute on function public.trainer_price_sides() to authenticated;

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
      ) + public.diary_only_clients(t.id, month_start) as active,
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
      when counts.side = 'one_on_one' then
        public.tier_fee_total(counts.active, 0, coalesce(counts.billing_currency, 'USD'), s.one_on_one_tiers)
      -- Free-use trainers pay for every active client; plan trainers get their first few free.
      else public.tier_fee_total(counts.active, case when counts.free_use then 0 else s.free_clients end, coalesce(counts.billing_currency, 'USD'), s.client_tiers)
    end
  from counts, public.billing_settings s
  where s.id = 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.owner_tracker()
 RETURNS TABLE(trainer_id uuid, name text, is_owner boolean, region text, currency text, billing_plan text, trial_ends_at date, paid_until date, free_use boolean, clients_total integer, clients_active integer, client_fee_now numeric, client_fee_full numeric, plan_price numeric, paid_subs_month numeric, paid_fees_month numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  today date := public.sa_today();
  month_start date := date_trunc('month', public.sa_today())::date;
begin
  if not public.is_app_owner() then
    raise exception 'only the app owner can see the tracker';
  end if;
  return query
  with base as (
    select
      t.*,
      case
        when t.billing_currency is not null then t.billing_currency
        when t.signup_country = 'ZA' then 'ZAR'
        when t.signup_country is not null then 'USD'
        when t.is_owner then 'ZAR'
      end as cur,
      public.price_side_for(t.id) as side,
      (select count(*)::integer from public.clients c where c.trainer_id = t.id and c.id <> c.trainer_id) as total,
      (select count(*)::integer from public.clients c
        where c.trainer_id = t.id and c.id <> c.trainer_id and c.archived_at is null and c.access_status <> 'expired')
        + public.diary_only_clients(t.id, today) as active
    from public.trainers t
    where t.approved or t.is_owner
  ),
  now_fees as (
    select r.trainer_id, r.client_fee from public.billing_month_rows(today) r
  )
  select
    b.id,
    coalesce(b.business_name, b.name),
    b.is_owner,
    case b.cur when 'ZAR' then 'SA' when 'USD' then 'International' end,
    b.cur,
    b.billing_plan::text,
    b.trial_ends_at,
    b.paid_until,
    b.free_use_from is not null,
    b.total,
    b.active,
    coalesce(nf.client_fee, 0),
    case when b.is_owner then 0::numeric
      when b.side = 'one_on_one' then public.tier_fee_total(b.active, 0, coalesce(b.cur, 'USD'), s.one_on_one_tiers)
      else public.tier_fee_total(b.active, case when b.free_use_from is not null then 0 else s.free_clients end, coalesce(b.cur, 'USD'), s.client_tiers)
    end,
    case when b.is_owner or b.billing_plan is null or b.free_use_from is not null then 0::numeric
      else public.trainer_plan_price(b.id, b.billing_plan::text, b.cur)
    end,
    coalesce((select sum(p.amount) from public.trainer_payments p
      where p.trainer_id = b.id and p.kind = 'subscription' and p.paid_on >= month_start), 0),
    coalesce((select sum(p.amount) from public.trainer_payments p
      where p.trainer_id = b.id and p.kind = 'client_fees' and p.paid_on >= month_start), 0)
  from base b
  cross join public.billing_settings s
  left join now_fees nf on nf.trainer_id = b.id
  where s.id = 1
  order by b.is_owner desc, b.active desc, coalesce(b.business_name, b.name);
end;
$function$;

-- Monthly fee push: "(first 5 free)" only for Evolution pricing.
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
          || case when r.free_use_from is not null or public.price_side_for(r.trainer_id) = 'one_on_one' then '' else ' (first ' || s.free_clients || ' free)' end || ' = ' || symbol || r.client_fee::text || '. Please pay by ' || s.client_fees_due_day || ' '
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

