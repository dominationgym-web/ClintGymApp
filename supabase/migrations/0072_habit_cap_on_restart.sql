-- The 15-habit cap (0067) only ran on insert, so a client could stop a habit,
-- add another, then restart the stopped one and go past 15. Run the same
-- check when a stopped habit is started again.
create or replace trigger habits_guard_client_restart
  before update of end_date on public.habits
  for each row
  when (
    old.end_date is not null
    and old.end_date < public.sa_today()
    and (new.end_date is null or new.end_date >= public.sa_today())
  )
  execute function public.guard_client_habit_count();
