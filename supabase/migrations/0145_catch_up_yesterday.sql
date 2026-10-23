-- Catch up yesterday (GRIZZ, 2026-10-23): on any day a client can choose to do
-- yesterday's missed calendar workout instead of today's (the app offers only
-- yesterday's on weekdays and the whole week's at the weekend). Missed
-- workouts still start from Monday, except that on a Monday Sunday's counts
-- too, so it can be caught up.
create or replace function public.missed_calendar_workouts(p_client uuid, p_today date)
returns table (workout_date date, program_id uuid, program_name text, program_trainer_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select w.workout_date, w.program_id, p.name, p.trainer_id
  from public.client_calendar_workouts w
  join public.programs p on p.id = w.program_id
  where w.client_id = p_client
    and w.workout_date >= least(date_trunc('week', p_today)::date, p_today - 1)
    and w.workout_date < p_today
    and not exists (
      select 1 from public.workout_sessions s
      where s.client_id = p_client and s.session_date = w.workout_date and s.status in ('complete', 'partial')
    )
    and not exists (
      select 1 from public.workout_sessions s
      where s.client_id = p_client and s.makeup_for = w.workout_date
    )
  order by w.workout_date;
$$;

revoke execute on function public.missed_calendar_workouts(uuid, date) from public, anon, authenticated;
