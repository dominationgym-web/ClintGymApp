-- Very simple set-by-set training log: weight, reps, and how hard the set
-- was, attached to an exercise from the reference library.
create type public.set_effort as enum ('comfortable', 'close_to_failure', 'failure');

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- Keep the exercise name at logging time so history still reads fine even
  -- if the trainer later renames or removes that exercise from the library.
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  log_date date not null default current_date,
  set_number smallint not null default 1,
  weight_kg numeric(6, 2),
  reps smallint not null,
  effort public.set_effort not null,
  created_at timestamptz not null default now()
);

create index workout_logs_client_date_idx on public.workout_logs (client_id, log_date desc);

alter table public.workout_logs enable row level security;

create policy "workout logs select own or trainer" on public.workout_logs
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = workout_logs.client_id and c.trainer_id = auth.uid())
  );
create policy "workout logs insert own" on public.workout_logs
  for insert with check (client_id = auth.uid());
create policy "workout logs update own" on public.workout_logs
  for update using (client_id = auth.uid());
create policy "workout logs delete own" on public.workout_logs
  for delete using (client_id = auth.uid());
