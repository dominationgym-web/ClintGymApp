-- Start a Longevity program at block 1, 2 or 3 (GRIZZ, 2026-10-20: "Allow
-- trainers to choose when a client progresses or repeats a block"). A plan
-- started at a later block uses the program's sessions from this slot on
-- ((week - 1) * 7 + day), so each week the trainer adds carries on in order.
alter table public.client_program_plans
  add column if not exists first_slot smallint check (first_slot between 1 and 364);
