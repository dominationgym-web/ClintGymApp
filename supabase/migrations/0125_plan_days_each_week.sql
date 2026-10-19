-- Trainer picks the training days, and can pick different days each week
-- (GRIZZ, 2026-10-19: "if a client trains with a trainer twice a week. But
-- its random days. The trainer can choose the days individually and select
-- repeat weekly"). days_vary plans ask for next week's days at Go ahead;
-- split_days then holds the latest week's days and sessions_placed counts the
-- program sessions already on the calendar, so the program carries on in order.

alter table public.client_program_plans add column if not exists days_vary boolean not null default false;
alter table public.client_program_plans add column if not exists sessions_placed integer;
