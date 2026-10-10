-- Cardio a trainer adds to one client's program (GRIZZ, 2026-10-10), so the
-- ready-made programs, which are shared and can't be edited, can have cardio
-- too. A list of {after, name, reps}: after = how many exercises come before
-- the block (null = at the end of the session); name and reps work like a
-- cardio row in program_exercises (0048). Only the trainer writes it, through
-- the existing "client programs trainer writes" policy.
alter table public.client_programs
  add column if not exists extra_cardio jsonb not null default '[]'::jsonb;
