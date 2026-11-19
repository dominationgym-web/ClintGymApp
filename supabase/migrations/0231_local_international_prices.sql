-- Local and international client prices (GRIZZ 2026-11-19).
--
-- Online (Evolution) trainers charge a cheaper Local price in their own
-- currency and an International price in dollars for clients abroad.
--
--   * clients.residence_country: the country the client lives in (ISO code),
--     picked by tapping at sign-up. Compulsory in the app from this version.
--   * clients.client_rate: the trainer's own Local / International pick. Null
--     means it follows the country: International when the client lives in
--     another country than the trainer (trainers.signup_country, South Africa
--     if unknown). Only the trainer sets it.
--   * trainers.client_prices gains "international": {online, extra, flat} in
--     dollars, same mode as the Local prices. A blank International price
--     falls back to the Local one. The currency can now be any code (GBP...).
--   * trainers.intl_payment_details: how clients abroad pay (PayPal, Wise...),
--     shown only to international clients.
-- owner_client_income keeps its signature and now returns one row per
-- trainer and currency.

alter table public.clients
  add column if not exists residence_country text,
  add column if not exists client_rate text;

alter table public.trainers add column if not exists intl_payment_details text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_residence_country_check') then
    alter table public.clients add constraint clients_residence_country_check
      check (residence_country is null or residence_country ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clients_client_rate_check') then
    alter table public.clients add constraint clients_client_rate_check
      check (client_rate is null or client_rate in ('local', 'international'));
  end if;
end $$;

-- A client can't pick their own price list, on sign-up or later.
create or replace function public.guard_client_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = new.id and auth.uid() is distinct from new.trainer_id then
    if tg_op = 'INSERT' then
      new.client_rate := null;
    elsif new.client_rate is distinct from old.client_rate then
      raise exception 'clients cannot change their own price list';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'guard_client_rate' and tgrelid = 'public.clients'::regclass) then
    create trigger guard_client_rate
      before insert or update on public.clients
      for each row execute function public.guard_client_rate();
  end if;
end $$;

-- Is this client on the International prices? Mirrors clientRate() in src/lib/clientPricing.ts.
create or replace function public.client_is_international(p_rate text, p_residence text, p_trainer_country text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    p_rate = 'international',
    p_residence is not null and upper(p_residence) <> upper(coalesce(nullif(p_trainer_country, ''), 'ZA'))
  )
$$;

-- The dollar price for an international client, or null when that price is
-- blank (then the Local price applies). Mirrors ratePrice().
create or replace function public.client_international_price(p_prices jsonb, p_package text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_prices is null or jsonb_typeof(p_prices -> 'international') <> 'object' then null
    else public.client_monthly_price(
      (p_prices -> 'international') || jsonb_build_object('mode', coalesce(p_prices ->> 'mode', 'table')),
      p_package
    )
  end
$$;

-- The owner's Tracker: what each trainer's active clients pay them a month,
-- one row per trainer and currency (Local, and dollars for international clients).
create or replace function public.owner_client_income()
returns table(trainer_id uuid, currency text, income numeric, priced integer, unpriced integer)
language plpgsql
stable security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_app_owner() then
    raise exception 'only the app owner can see the tracker';
  end if;
  return query
  select
    t.id,
    p.cur,
    coalesce(sum(p.amount), 0),
    count(p.amount)::integer,
    (count(c.id) - count(p.amount))::integer
  from public.trainers t
  left join public.clients c
    on c.trainer_id = t.id and c.id <> c.trainer_id and c.archived_at is null and c.access_status <> 'expired'
  cross join lateral (
    select
      case when usd.amount is not null then 'USD' else coalesce(nullif(t.client_prices ->> 'currency', ''), 'ZAR') end as cur,
      coalesce(usd.amount, public.client_monthly_price(t.client_prices, c.price_package)) as amount
    from (
      select case
        when c.id is not null and public.client_is_international(c.client_rate, c.residence_country, t.signup_country)
          then public.client_international_price(t.client_prices, c.price_package)
      end as amount
    ) usd
  ) p
  where t.approved or t.is_owner
  group by t.id, p.cur;
end;
$$;
