-- South African trainers' prize follows the same ratio as their lower
-- subscription fees (GRIZZ, 2026-11-08): R100 where others pay $10, so R10
-- for every $1 of prize ($500 -> R5 000), not the bank exchange rate.
alter table public.award_settings
  add column if not exists prize_zar_per_usd numeric(8, 2) not null default 10 check (prize_zar_per_usd > 0);

create or replace function public.award_local_prize(p_amount numeric, p_zar boolean)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_amount is null then null
    when p_zar and s.prize_currency = 'USD' then round(p_amount * s.prize_zar_per_usd / 100) * 100
    else p_amount
  end
  from public.award_settings s where s.id = 1;
$$;
