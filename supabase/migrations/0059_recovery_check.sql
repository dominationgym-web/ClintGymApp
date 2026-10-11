-- Recovery check (2026-10-11): when a client's session today works muscles
-- they trained hard yesterday, the trainer can leave it, move the session to
-- tomorrow, or give a lighter session for today. The trainer writes these
-- through the existing "client programs trainer writes" policy; the client
-- reads them with their own program row.
alter table public.client_programs
  add column if not exists recovery_ignored_on date,
  add column if not exists recovery_adjustment jsonb;

comment on column public.client_programs.recovery_ignored_on is
  'Date the trainer chose to leave a recovery clash as it is.';
comment on column public.client_programs.recovery_adjustment is
  'A lighter session for one date: {"date": "YYYY-MM-DD", "sets": {program_exercise_id: sets}}.';
