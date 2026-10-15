-- The client's own meal plan (GRIZZ, 2026-10-12): made by the app from the
-- client's meal times and training time (src/lib/mealPlanMaker.ts), with a
-- training-day and a rest-day version, and any food swapped for one they
-- like. The client writes it; their trainer can read it. A diet plan from the
-- trainer (0071) still comes first.

create table if not exists public.client_meal_plans (
  client_id uuid primary key references public.clients(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 5000),
  targets jsonb not null default '{}'::jsonb check (jsonb_typeof(targets) = 'object' and pg_column_size(targets) < 2000),
  training_day jsonb not null default '{}'::jsonb check (jsonb_typeof(training_day) = 'object' and pg_column_size(training_day) < 50000),
  rest_day jsonb not null default '{}'::jsonb check (jsonb_typeof(rest_day) = 'object' and pg_column_size(rest_day) < 50000),
  variety integer not null default 0 check (variety between 0 and 100000),
  updated_at timestamptz not null default now()
);

alter table public.client_meal_plans enable row level security;

create policy "meal plan select own or trainer" on public.client_meal_plans
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "meal plan client inserts own" on public.client_meal_plans
  for insert to authenticated with check (client_id = (select auth.uid()));
create policy "meal plan client updates own" on public.client_meal_plans
  for update to authenticated using (client_id = (select auth.uid())) with check (client_id = (select auth.uid()));
