-- One file with all of a trainer's clients (GRIZZ, 2026-11-03: "one big file
-- with all his clients ... it'll save a lot of admin for the trainers").
--
-- The trainer sends a whole export (CSV, PDF or screenshots) from Menu ›
-- Client history from a file. The import-history edge function works out the
-- columns, reads every row, splits it by person and matches each name to one
-- of the trainer's clients. people holds one entry per person:
--   { name, client_id (matched or picked, or null), result (same shape as
--     client_imports.result), added_import_id, added_counts }
-- The trainer checks the names and taps Add: each matched person gets a
-- normal client_imports row (status added), so their history goes in exactly
-- like a single-client import. People not in the app yet stay here until the
-- trainer links them to a client later.
--
-- Written only by the edge function (service role); the trainer can read theirs.

create table public.trainer_bulk_imports (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  file_names text[] not null default '{}',
  status text not null default 'reading' check (status in ('reading', 'ready', 'failed', 'dismissed')),
  people jsonb not null default '[]',
  note text,
  error text,
  created_at timestamptz not null default now()
);

create index trainer_bulk_imports_trainer_idx on public.trainer_bulk_imports (trainer_id, created_at desc);

alter table public.trainer_bulk_imports enable row level security;

create policy trainer_bulk_imports_read on public.trainer_bulk_imports
  for select using (trainer_id = auth.uid());
