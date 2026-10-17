-- Trainer client prices (GRIZZ 2026-10-17, test run so trainers can play
-- with it before launch). Each trainer sets what their clients pay a month:
-- either a table (Fully Online, or an existing 1-on-1 client using the app for
-- 1, 2, 3 or 4 extra days a week) or one monthly fee for everyone. The
-- trainer tags each client with their package, and the app adds up the
-- trainer's monthly income. The app doesn't show these prices to clients.
--
-- client_prices shape:
--   {"currency": "ZAR" | "USD", "mode": "table" | "flat",
--    "online": 1500, "extra": {"1": 300, "2": 500, "3": 700, "4": 900},
--    "flat": 1000}

alter table public.trainers add column if not exists client_prices jsonb;

alter table public.clients add column if not exists price_package text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_price_package_check') then
    alter table public.clients add constraint clients_price_package_check
      check (price_package is null or price_package in ('online', 'extra_1', 'extra_2', 'extra_3', 'extra_4'));
  end if;
end $$;

-- What one active client pays a month under a trainer's prices (null when
-- no price applies yet). Mirrors clientPrice() in src/lib/clientPricing.ts.
create or replace function public.client_monthly_price(p_prices jsonb, p_package text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_prices is null then null
    when p_prices ->> 'mode' = 'flat' then nullif(p_prices ->> 'flat', '')::numeric
    when p_package = 'online' then nullif(p_prices ->> 'online', '')::numeric
    when p_package like 'extra\_%' then nullif(p_prices -> 'extra' ->> substr(p_package, 7), '')::numeric
  end
$$;

-- The owner's Tracker: what each trainer's active clients pay them a month.
create or replace function public.owner_client_income()
returns table (trainer_id uuid, currency text, income numeric, priced integer, unpriced integer)
language plpgsql
stable
security definer
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
    coalesce(t.client_prices ->> 'currency', 'ZAR'),
    coalesce(sum(public.client_monthly_price(t.client_prices, c.price_package)), 0),
    count(c.id) filter (where public.client_monthly_price(t.client_prices, c.price_package) is not null)::integer,
    count(c.id) filter (where public.client_monthly_price(t.client_prices, c.price_package) is null)::integer
  from public.trainers t
  left join public.clients c
    on c.trainer_id = t.id and c.archived_at is null and c.access_status <> 'expired'
  where t.approved or t.is_owner
  group by t.id;
end;
$$;

revoke all on function public.owner_client_income() from public, anon;
grant execute on function public.owner_client_income() to authenticated;

-- Clients can't change their own price package (only their trainer can).
create or replace function public.prevent_client_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() = old.id and auth.uid() <> old.trainer_id then
    if new.access_status is distinct from old.access_status
      or new.trainer_id is distinct from old.trainer_id
      or new.plan_type is distinct from old.plan_type
      or new.plan_started_at is distinct from old.plan_started_at
      or new.plan_expires_at is distinct from old.plan_expires_at
      or new.package_type is distinct from old.package_type
      or new.lifestyle_reset_started_at is distinct from old.lifestyle_reset_started_at
      or new.library_access is distinct from old.library_access
      or new.created_at is distinct from old.created_at
      or (old.consent_accepted_at is not null and new.consent_accepted_at is distinct from old.consent_accepted_at)
      or new.abs_between_sets is distinct from old.abs_between_sets
      or new.foundation_status is distinct from old.foundation_status
      or (old.training_level is not null and new.training_level is distinct from old.training_level)
      or new.archived_at is distinct from old.archived_at
      or new.first_stint_ended_at is distinct from old.first_stint_ended_at
      or new.returned_at is distinct from old.returned_at
      or new.first_intake_responses is distinct from old.first_intake_responses
      or new.price_package is distinct from old.price_package
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$$;
