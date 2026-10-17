-- Gauge test (GRIZZ, 2026-10-17): the first working set of an exercise a
-- client has never done is taken to failure at a weight they pick, and the app
-- works out their working weight from it (src/lib/gauge.ts). Marked so the
-- trainer sees it in the training log and "try this weight next" skips it.
alter table public.workout_logs add column if not exists gauge boolean not null default false;
