-- Flexible per-client habits, separate from the fixed daily check-in.
-- Trainer sets these up per client - e.g. "Take supplements" 3x/day every
-- day, or "Go to gym" 1x on Mon/Wed/Fri only, optionally with a reminder
-- time and a start/end date (or open-ended).
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  -- Days this habit applies: 0 = Sunday .. 6 = Saturday.
  active_days smallint[] not null default '{0,1,2,3,4,5,6}',
  reps_target smallint not null default 1,
  start_date date not null default current_date,
  end_date date,
  reminder_enabled boolean not null default false,
  reminder_time time,
  created_at timestamptz not null default now()
);

create index habits_client_id_idx on public.habits (client_id);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  log_date date not null default current_date,
  reps_completed smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index habit_logs_habit_id_date_idx on public.habit_logs (habit_id, log_date desc);

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

-- Habits: client can see their own; only the trainer can create/edit/delete
-- them (matches how the intake form and exercise library work - the trainer
-- designs the structure, the client just follows it).
create policy "habits select own or trainer" on public.habits
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = habits.client_id and c.trainer_id = auth.uid())
  );
create policy "habits managed by trainer" on public.habits
  for all using (
    exists (select 1 from public.clients c where c.id = habits.client_id and c.trainer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c where c.id = habits.client_id and c.trainer_id = auth.uid())
  );

-- Habit logs: the client logs their own daily progress; trainer can view
-- (not edit) their clients' logs.
create policy "habit logs select own or trainer" on public.habit_logs
  for select using (
    exists (select 1 from public.habits h where h.id = habit_logs.habit_id and h.client_id = auth.uid())
    or exists (
      select 1 from public.habits h
      join public.clients c on c.id = h.client_id
      where h.id = habit_logs.habit_id and c.trainer_id = auth.uid()
    )
  );
create policy "habit logs insert own" on public.habit_logs
  for insert with check (
    exists (select 1 from public.habits h where h.id = habit_logs.habit_id and h.client_id = auth.uid())
  );
create policy "habit logs update own" on public.habit_logs
  for update using (
    exists (select 1 from public.habits h where h.id = habit_logs.habit_id and h.client_id = auth.uid())
  );
