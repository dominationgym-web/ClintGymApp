-- Client fee bands corrected (GRIZZ 2026-10-24): the first paid band is
-- clients 6-15, then bands of 10 up to 65, free from client 66. Same prices
-- per client as 0141. Cap: R1 700 / $170 a month in total.

alter table public.billing_settings
  alter column client_tiers set default '[
    {"upto": 15, "ZAR": 50, "USD": 5},
    {"upto": 25, "ZAR": 40, "USD": 4},
    {"upto": 35, "ZAR": 30, "USD": 3},
    {"upto": 65, "ZAR": 10, "USD": 1}
  ]'::jsonb;

update public.billing_settings
set client_tiers = '[
    {"upto": 15, "ZAR": 50, "USD": 5},
    {"upto": 25, "ZAR": 40, "USD": 4},
    {"upto": 35, "ZAR": 30, "USD": 3},
    {"upto": 65, "ZAR": 10, "USD": 1}
  ]'::jsonb,
  updated_at = now()
where id = 1;
