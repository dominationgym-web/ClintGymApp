-- New trainer prices (GRIZZ, 2026-11-06). Both sides now top out at R300 / $30 a month.
-- 1 on 1: R100 / $10 a month plus R10 / $1 a client, for the first 20 clients
--   only (was: every client, no cap, 0192). Most: R300 / $30.
-- Evolution: R200 / $20 a month, first 5 clients free, then R10 / $1 each for
--   clients 6-15 (was R20 / $2 for clients 6-20). Clients 16+ are free. Most: R300 / $30.
update public.billing_settings
set one_on_one_tiers = '[{"upto": 20, "ZAR": 10, "USD": 1}]'::jsonb,
  client_tiers = '[{"upto": 15, "ZAR": 10, "USD": 1}]'::jsonb,
  updated_at = now()
where id = 1;

alter table public.billing_settings
  alter column one_on_one_tiers set default '[{"upto": 20, "ZAR": 10, "USD": 1}]'::jsonb,
  alter column client_tiers set default '[{"upto": 15, "ZAR": 10, "USD": 1}]'::jsonb;
