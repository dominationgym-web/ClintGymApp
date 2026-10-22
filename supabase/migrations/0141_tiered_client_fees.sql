-- New trainer pricing (GRIZZ 2026-10-22): R200 / $20 a month with the first
-- 5 active clients included, then tiered client fees that get cheaper as a
-- trainer grows, free from client 61. Cap: R1 450 / $145 a month in total.
-- The 6 and 12 month plans keep their old discounts: 6 months = 5 months'
-- price, 12 months = 9 months' price (3 months free).
-- client_tiers: each tier covers client numbers up to "upto" (inclusive),
-- starting after the previous tier. Clients past the last tier are free.

alter table public.billing_settings
  add column if not exists client_tiers jsonb not null default '[
    {"upto": 10, "ZAR": 50, "USD": 5},
    {"upto": 20, "ZAR": 40, "USD": 4},
    {"upto": 30, "ZAR": 30, "USD": 3},
    {"upto": 60, "ZAR": 10, "USD": 1}
  ]'::jsonb;

update public.billing_settings
set prices = '{
  "ZAR": {"monthly": 200, "six_months": 1000, "yearly": 1800, "client": 50},
  "USD": {"monthly": 20, "six_months": 100, "yearly": 180, "client": 5}
}'::jsonb,
  updated_at = now()
where id = 1;

-- What a trainer pays for p_active clients when the first p_included are free.
-- Free-use trainers (no subscription) pass 0, so clients 1-5 cost the first tier.
create or replace function public.client_fee_total(p_active integer, p_included integer, p_currency text)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(sum(
    greatest(0, least(p_active, (t.tier ->> 'upto')::integer) - greatest(p_included, t.prev_upto))
      * coalesce((t.tier ->> coalesce(p_currency, 'USD'))::numeric, 0)
  ), 0)
  from (
    select e.tier,
      coalesce(lag((e.tier ->> 'upto')::integer) over (order by e.ord), 0) as prev_upto
    from public.billing_settings s,
      jsonb_array_elements(s.client_tiers) with ordinality as e(tier, ord)
    where s.id = 1
  ) t
$function$;

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
      else public.client_fee_total(counts.active, case when counts.free_use then 0 else s.free_clients end, coalesce(counts.billing_currency, 'USD'))
    end
  from counts, public.billing_settings s;
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
      (select count(*)::integer from public.clients c where c.trainer_id = t.id) as total,
      (select count(*)::integer from public.clients c
        where c.trainer_id = t.id and c.archived_at is null and c.access_status <> 'expired') as active
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
      else public.client_fee_total(b.active, case when b.free_use_from is not null then 0 else s.free_clients end, coalesce(b.cur, 'USD'))
    end,
    case when b.is_owner or b.billing_plan is null or b.free_use_from is not null then 0::numeric
      else coalesce((s.prices -> coalesce(b.cur, 'USD') ->> b.billing_plan::text)::numeric, 0)
    end,
    coalesce((select sum(p.amount) from public.trainer_payments p
      where p.trainer_id = b.id and p.kind = 'subscription' and p.paid_on >= month_start), 0),
    coalesce((select sum(p.amount) from public.trainer_payments p
      where p.trainer_id = b.id and p.kind = 'client_fees' and p.paid_on >= month_start), 0)
  from base b
  cross join public.billing_settings s
  left join now_fees nf on nf.trainer_id = b.id
  order by b.is_owner desc, b.active desc, coalesce(b.business_name, b.name);
end;
$function$;
