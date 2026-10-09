-- Weekly programs the client works through in order (requested 2026-10-09).
--
-- A weekly program's sessions sit on training days (day_number 1 = Monday to
-- 7 = Sunday, from 0035). Each session now waits for the client: it shows
-- from its training day until they tap "Complete workout", and only then does
-- the next session unlock, on the next training day. If they can't train that
-- day they can move it to tomorrow. A missed session is never skipped.
--
-- client_programs keeps where the client is up to. Both columns stay null
-- until the client first completes or moves a session; until then the app
-- works the first session out from started_on.

alter table public.client_programs
  add column current_day smallint check (current_day between 1 and 7),
  add column due_on date,
  add column last_completed_at timestamptz;

-- The client can't write client_programs (only their trainer can, 0035), so
-- their progress goes through this function, which changes these three
-- columns on their own row and nothing else. The app works out the next
-- session and date (src/lib/programSchedule.ts, in the client's own time
-- zone); this checks they make sense.
create or replace function public.set_my_program_progress(
  p_current_day smallint,
  p_due_on date,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_program uuid;
begin
  if me is null or not exists (
    select 1 from public.clients c where c.id = me and c.access_status <> 'expired'
  ) then
    raise exception 'no access';
  end if;

  select program_id into my_program from public.client_programs where client_id = me;
  if my_program is null then
    raise exception 'not on a program';
  end if;

  if not exists (
    select 1 from public.program_exercises e
    where e.program_id = my_program and e.day_number = p_current_day
  ) then
    raise exception 'that day is not a training day in this program';
  end if;

  -- Generous either side of today for time zones, but no parking a session
  -- months away.
  if p_due_on < current_date - 2 or p_due_on > current_date + 8 then
    raise exception 'that date is out of range';
  end if;

  update public.client_programs
  set current_day = p_current_day,
      due_on = p_due_on,
      last_completed_at = case when p_completed then now() else last_completed_at end
  where client_id = me;
end;
$$;

revoke execute on function public.set_my_program_progress(smallint, date, boolean) from public, anon;
grant execute on function public.set_my_program_progress(smallint, date, boolean) to authenticated;
