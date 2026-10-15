-- Warm-up sets (GRIZZ, 2026-10-12): the one warm-up set per body part is
-- logged and marked as a warm-up, at about half the starting weight, and
-- doesn't count as a working set. Warm-ups use set_number 0 so they sort
-- first. Older app versions don't send it, so their sets stay working sets.
alter table public.workout_logs add column if not exists warm_up boolean not null default false;
