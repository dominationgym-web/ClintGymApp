-- Meal ticking (GRIZZ, 2026-10-27: the client's laptop view "with meal
-- ticking"). The client ticks each meal off their plan as they eat it, on the
-- phone or the website. One row per meal eaten per day. The meal's calories
-- and macros are kept on the row, so the day still adds up after the plan
-- changes. source is which plan day it came from: the coach's plan ('coach'),
-- or the client's own plan's training or rest day.
create table if not exists public.client_meal_ticks (
  client_id uuid not null references public.clients (id) on delete cascade,
  ate_on date not null,
  meal_key text not null check (char_length(meal_key) between 1 and 160),
  source text not null check (source in ('coach', 'training', 'rest')),
  meal_name text not null check (char_length(meal_name) between 1 and 120),
  kcal integer not null check (kcal between 0 and 10000),
  protein numeric(6, 1) not null default 0 check (protein between 0 and 1000),
  carbs numeric(6, 1) not null default 0 check (carbs between 0 and 1000),
  fat numeric(6, 1) not null default 0 check (fat between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (client_id, ate_on, meal_key)
);

alter table public.client_meal_ticks enable row level security;

create policy "meal ticks client manages own" on public.client_meal_ticks
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create policy "meal ticks trainer reads" on public.client_meal_ticks
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
