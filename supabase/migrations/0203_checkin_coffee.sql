-- Coffee on the daily check-in (GRIZZ, 2026-11-08: "coffee intake and time of
-- last cup. To help track sleep problems and fatigue").
--
-- The check-in is filled in in the morning about the day before, like alcohol
-- and meals: cups of coffee yesterday and the time of the last cup. Both stay
-- null when the client didn't answer (and on older check-ins), so 0 cups is a
-- real answer.

alter table public.checkins
  add column if not exists coffee_cups smallint check (coffee_cups between 0 and 30),
  add column if not exists coffee_last_time time;
