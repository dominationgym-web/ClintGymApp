-- New trainer prices (GRIZZ, 2026-11-06).
-- 1 on 1 only: R100 / $10 a month plus R10 / $1 a client for the first 20
--   clients (was: every client, no cap, 0192). Most: R300 / $30.
-- Evolution (covers both sides): R200 / $20 a month.
--   App clients: first 5 free, then R10 / $1 each for clients 6-15, free after 15.
--   People only in the 1 on 1 diary (not on the app): R10 / $1 each for up to 10.
--   A client on both sides counts once, as an app client. Most: R400 / $40.
alter table public.billing_settings
  add column if not exists diary_client_tiers jsonb not null default '[{"upto": 10, "ZAR": 10, "USD": 1}]'::jsonb;

update public.billing_settings
set one_on_one_tiers = '[{"upto": 20, "ZAR": 10, "USD": 1}]'::jsonb,
  client_tiers = '[{"upto": 15, "ZAR": 10, "USD": 1}]'::jsonb,
  diary_client_tiers = '[{"upto": 10, "ZAR": 10, "USD": 1}]'::jsonb,
  updated_at = now()
where id = 1;

alter table public.billing_settings
  alter column one_on_one_tiers set default '[{"upto": 20, "ZAR": 10, "USD": 1}]'::jsonb,
  alter column client_tiers set default '[{"upto": 15, "ZAR": 10, "USD": 1}]'::jsonb;


-- Client fees per month (0183), less the owner's discount. On Evolution (0193)
-- app clients and people only in the 1 on 1 diary are billed separately.
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
      ) as app_active,
      public.diary_only_clients(t.id, month_start) as diary_active,
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
    case when counts.side = 'one_on_one' then counts.cal_active else counts.app_active + counts.diary_active end,
    counts.activations,
    counts.billing_currency,
    (counts.fees_from is null or counts.fees_from > month_start) as is_free,
    -- Less any discount the owner gave for that month (0192).
    round((1 - public.trainer_discount_on(counts.id, month_start)) * case
      when counts.fees_from is null or counts.fees_from > month_start then 0::numeric
      when counts.side = 'one_on_one' then
        public.tier_fee_total(counts.cal_active, 0, coalesce(counts.billing_currency, 'USD'), s.one_on_one_tiers)
      -- Free-use trainers pay for every active client; plan trainers get their first few free.
      else public.tier_fee_total(counts.app_active, case when counts.free_use then 0 else s.free_clients end, coalesce(counts.billing_currency, 'USD'), s.client_tiers)
        -- People only in the 1 on 1 diary: their own fee, up to its own limit (0193).
        + public.tier_fee_total(counts.diary_active, 0, coalesce(counts.billing_currency, 'USD'), s.diary_client_tiers)
    end, 2)
  from counts, public.billing_settings s
  where s.id = 1;
end;
$function$;


