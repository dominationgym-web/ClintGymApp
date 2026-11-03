-- History import fixes (GRIZZ, 2026-11-03). A trainer sent screenshots of a
-- spreadsheet log ("WEEK - 1") with no dates and no kg/lb, and nothing saved.
--
-- 1. Each trainer picks Metric (kg, cm) or Imperial (lb, inches) at signup and
--    can change it in Settings. When a screenshot or file doesn't say which, the
--    import reads the numbers in the trainer's units. Everything is still stored
--    in kg and cm. Existing trainers start on metric, except ones who signed up
--    from the US, Liberia or Myanmar.
-- 2. Workouts with no date are kept as "before the app" history: sessions in
--    the order the files show them (e.g. "Week 1"), with no made-up dates.
--    Dated logs start once the client trains in the app. The app uses the last
--    of these sessions as the starting weights until the client has logged that
--    exercise in the app.

alter table public.trainers
  add column if not exists units text not null default 'metric'
  check (units in ('metric', 'imperial'));

update public.trainers set units = 'imperial'
where signup_country in ('US', 'LR', 'MM') and units = 'metric';

create table public.client_undated_sets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  import_id uuid references public.client_imports (id) on delete cascade,
  -- Where it sat in the files: the label ("Week 1", "Day A") and its place.
  session_label text,
  session_order int not null default 0,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  set_number int not null,
  weight_kg numeric,
  reps int not null,
  created_at timestamptz not null default now()
);

create index client_undated_sets_client_idx on public.client_undated_sets (client_id, created_at, session_order);

alter table public.client_undated_sets enable row level security;

-- Written only by the import-history edge function (service role).
create policy client_undated_sets_read on public.client_undated_sets
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_undated_sets.client_id and c.trainer_id = auth.uid())
  );
