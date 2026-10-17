-- Owner tracker (GRIZZ 2026-10-17): one row per approved trainer (and the
-- owner) with their clients, what their monthly client fees come to, their
-- plan, and what they paid this month. South Africa vs International comes
-- from the trainer's billing currency, or the country they applied from when
-- that isn't set yet. Totals are added up in the app (src/lib/tracker.ts).
create or replace function public.owner_tracker()
returns table (
  trainer_id uuid,
  name text,
  is_owner boolean,
  region text,
  currency text,
  billing_plan text,
  trial_ends_at date,
  paid_until date,
  free_use boolean,
  clients_total integer,
  clients_active integer,
  client_fee_now numeric,
  client_fee_full numeric,
  plan_price numeric,
  paid_subs_month numeric,
  paid_fees_month numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
      else greatest(0, b.active - case when b.free_use_from is not null then 0 else s.free_clients end)
        * coalesce((s.prices -> coalesce(b.cur, 'USD') ->> 'client')::numeric, 0)
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
$$;

revoke all on function public.owner_tracker() from public, anon;
grant execute on function public.owner_tracker() to authenticated;
