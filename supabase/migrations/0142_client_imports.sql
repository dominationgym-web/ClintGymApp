-- Bring in a client's history from another app (GRIZZ, 2026-10-22).
-- The client or their trainer uploads screenshots or files (CSV, Excel saved
-- as CSV, PDF). The import-history edge function asks Claude to read them and
-- keeps what it found in client_imports.result for the trainer to check. Only
-- when the trainer taps "Add to Daily Evolution" does it go into workout_logs
-- and client_body_stats, marked with the import it came from.
--
-- Everything is written by the edge function (service role). The app can only
-- read: the client their own rows, the trainer their own clients' rows.

create table public.client_imports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  uploaded_by uuid not null,
  uploaded_role text not null check (uploaded_role in ('client', 'trainer')),
  file_names text[] not null default '{}',
  status text not null default 'reading' check (status in ('reading', 'ready', 'failed', 'added', 'dismissed')),
  result jsonb,
  error text,
  added_at timestamptz,
  added_by uuid,
  added_counts jsonb,
  created_at timestamptz not null default now()
);

create index client_imports_client_idx on public.client_imports (client_id, created_at desc);

alter table public.client_imports enable row level security;

create policy client_imports_read on public.client_imports
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_imports.client_id and c.trainer_id = auth.uid())
  );

create table public.client_body_stats (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  waist_cm numeric,
  hips_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  note text,
  import_id uuid references public.client_imports (id) on delete set null,
  created_at timestamptz not null default now()
);

create index client_body_stats_client_idx on public.client_body_stats (client_id, measured_on desc);

alter table public.client_body_stats enable row level security;

create policy client_body_stats_read on public.client_body_stats
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_body_stats.client_id and c.trainer_id = auth.uid())
  );

alter table public.workout_logs
  add column if not exists import_id uuid references public.client_imports (id) on delete set null;
