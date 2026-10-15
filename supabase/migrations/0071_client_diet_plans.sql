-- Trainer's diet planner (GRIZZ, 2026-10-12): one week of meals per client,
-- built by their trainer, plus the details for the client's calorie target
-- (BMR from weight, height, age and sex, times activity, plus or minus the
-- trainer's adjustment). Foods are referenced by name from the app's food
-- list (src/lib/foods.ts); days holds 7 days of meals.

create table if not exists public.client_diet_plans (
  client_id uuid primary key references public.clients (id) on delete cascade,
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 25 and 400),
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 100 and 250),
  age smallint check (age is null or age between 12 and 100),
  sex text check (sex is null or sex in ('male', 'female')),
  activity numeric(4, 3) not null default 1.375 check (activity between 1 and 2.5),
  adjust_kcal integer not null default 0 check (adjust_kcal between -2000 and 2000),
  days jsonb not null default '[]'::jsonb check (jsonb_typeof(days) = 'array' and pg_column_size(days) < 200000),
  updated_at timestamptz not null default now()
);

alter table public.client_diet_plans enable row level security;

create policy "diet plan select own or trainer" on public.client_diet_plans
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "diet plan trainer writes" on public.client_diet_plans
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
create policy "approved trainers only (insert)" on public.client_diet_plans
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_diet_plans
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));
create policy "approved trainers only (delete)" on public.client_diet_plans
  as restrictive for delete to authenticated using ((select public.not_unapproved_trainer()));
