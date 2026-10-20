-- Trainers pay Daily Evolution by card on the website (GRIZZ, 2026-10-19:
-- website-first billing). The phone apps sell nothing: trainers pay in the
-- laptop/web version, through Paystack's secure page, and the card-billing
-- Edge Function records each successful charge as a trainer_payments row, so
-- paid_until and client fees move on exactly as when the owner records an EFT.
--
-- * billing_settings.card_billing_enabled is the owner's switch: off until
--   the store launch (no trainer charges before then, 0111). While it's off
--   only the owner can try a card payment (to test with a test key).
-- * Paystack South Africa charges in rand. Dollar bills are charged in rand
--   at usd_zar_rate unless 'USD' is in card_currencies (if Paystack enables
--   dollars on the account); the payment is still recorded in dollars.
-- * trainer_cards holds the saved card Paystack returns, for the automatic
--   charge of anything owed. Only the Edge Function reads or writes it.
-- * card_charges logs every card charge, so a payment is only ever recorded
--   once (webhook and the return to the website can both report it).

alter table public.billing_settings
  add column if not exists card_billing_enabled boolean not null default false,
  add column if not exists card_currencies text[] not null default '{ZAR}',
  add column if not exists usd_zar_rate numeric(8, 2) not null default 18.00 check (usd_zar_rate > 0);

create table if not exists public.trainer_cards (
  trainer_id uuid primary key references public.trainers (id) on delete cascade,
  authorization_code text not null,
  customer_code text,
  email text,
  card_type text,
  last4 text,
  exp_month text,
  exp_year text,
  bank text,
  -- Charge anything owed automatically. Cancelling turns this off and
  -- removes the card.
  autopay boolean not null default true,
  updated_at timestamptz not null default now()
);

-- No policies: only the service role (the Edge Function) reads or writes it.
alter table public.trainer_cards enable row level security;

create table if not exists public.card_charges (
  reference text primary key,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  -- checkout: the trainer paid on the website; auto: the saved card was
  -- charged; card_check: a small charge to save a new card, refunded.
  kind text not null check (kind in ('checkout', 'auto', 'card_check')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  -- What it pays, in the trainer's billing currency.
  currency text not null check (currency in ('USD', 'ZAR')),
  plan_amount numeric(10, 2) not null default 0,
  plan_months integer check (plan_months is null or plan_months in (1, 6, 12)),
  fees_amount numeric(10, 2) not null default 0,
  -- What Paystack charged, in cents.
  charged_currency text not null,
  charged_cents integer not null check (charged_cents > 0),
  message text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists card_charges_trainer_idx on public.card_charges (trainer_id, created_at desc);

alter table public.card_charges enable row level security;

create policy "owner and trainer read card charges" on public.card_charges
  for select to authenticated
  using (trainer_id = (select auth.uid()) or (select public.is_app_owner()));

-- The daily automatic charge: pg_cron calls the Edge Function with a secret
-- kept in Vault (as 0032 does for the video clean-up). The function does
-- nothing while card_billing_enabled is off.
create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'card_billing_cron_secret')
where not exists (select 1 from vault.secrets where name = 'card_billing_cron_secret');

create or replace function public.card_billing_secret_ok(p_secret text)
returns boolean as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'card_billing_cron_secret' and decrypted_secret = p_secret
  );
$$ language sql security definer set search_path = public;

revoke execute on function public.card_billing_secret_ok(text) from public, anon, authenticated;
grant execute on function public.card_billing_secret_ok(text) to service_role;

-- 08:30 SA time, after billing_reminders (06:05 UTC) logs the month's client fees.
select cron.schedule(
  'card-billing-daily',
  '30 6 * * *',
  $$
  select net.http_post(
    url := 'https://vrasgqqubyurzoknsbgm.supabase.co/functions/v1/card-billing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'card_billing_cron_secret')
    ),
    body := '{"action": "daily"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
