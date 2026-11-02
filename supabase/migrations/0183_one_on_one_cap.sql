-- 1 on 1 only pricing changed (GRIZZ, 2026-11-02 11:44): R100 / $10 a month
-- plus R10 / $1 per client, capped at 10 clients, so the most is R200 / $20.
-- 1 on 1 clients don't need the app: on 1 on 1 only pricing, clients are
-- counted from the calendar (everyone with a session that month, app client
-- or diary name). Evolution pricing counts as in 0179.

update public.billing_settings
set one_on_one_tiers = '[{"upto": 10, "ZAR": 10, "USD": 1}]'::jsonb,
  updated_at = now()
where id = 1;

alter table public.billing_settings
  alter column one_on_one_tiers set default '[{"upto": 10, "ZAR": 10, "USD": 1}]'::jsonb;

-- Different people on the calendar in the month of p_month (not removed).
create or replace function public.calendar_clients(p_trainer uuid, p_month date)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(distinct coalesce(ls.client_id::text, 'name:' || public.diary_name_key(ls.guest_name)))::integer
  from public.live_sessions ls
  where ls.trainer_id = p_trainer
    and ls.status <> 'removed'
    and (ls.client_id is not null or ls.guest_name is not null)
    and (ls.starts_at at time zone 'Africa/Johannesburg')::date
      between date_trunc('month', p_month)::date and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
$function$;
revoke execute on function public.calendar_clients(uuid, date) from public, anon, authenticated;

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
    case
      when counts.fees_from is null or counts.fees_from > month_start then 0::numeric
      when counts.side = 'one_on_one' then
        public.tier_fee_total(counts.cal_active, 0, coalesce(counts.billing_currency, 'USD'), s.one_on_one_tiers)
      -- Free-use trainers pay for every active client; plan trainers get their first few free.
      else public.tier_fee_total(counts.evo_active, case when counts.free_use then 0 else s.free_clients end, coalesce(counts.billing_currency, 'USD'), s.client_tiers)
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
        + public.diary_only_clients(t.id, today) as evo_active,
      public.calendar_clients(t.id, today) as cal_active
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
    case when b.side = 'one_on_one' then b.cal_active else b.evo_active end,
    coalesce(nf.client_fee, 0),
    case when b.is_owner then 0::numeric
      when b.side = 'one_on_one' then public.tier_fee_total(b.cal_active, 0, coalesce(b.cur, 'USD'), s.one_on_one_tiers)
      else public.tier_fee_total(b.evo_active, case when b.free_use_from is not null then 0 else s.free_clients end, coalesce(b.cur, 'USD'), s.client_tiers)
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
  order by b.is_owner desc, b.evo_active desc, coalesce(b.business_name, b.name);
end;
$function$;

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
    case when public.price_side_for(t.id) = 'one_on_one' then public.calendar_clients(t.id, today)
      else (select count(*)::integer from public.clients c
        where c.trainer_id = t.id and c.id <> c.trainer_id and c.archived_at is null and c.access_status <> 'expired')
        + public.diary_only_clients(t.id, today)
    end,
    public.diary_only_clients(t.id, today)
  from public.trainers t
  where (public.is_app_owner() or t.id = auth.uid());
end;
$function$;
