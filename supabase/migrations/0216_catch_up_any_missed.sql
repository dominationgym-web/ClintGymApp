-- Catch up any missed workout (GRIZZ, 2026-11-16): on any day a client can
-- do any calendar workout they missed this week instead of today's, not only
-- yesterday's. And when they do, the workout they skipped that day now goes
-- onto the missed list so it can be caught up later. Before, the catch-up
-- session counted as that day's own workout being done, so it quietly dropped.
--
-- A day's own workout counts as done only by a green or orange session on
-- that day that wasn't catching up another day.
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
      where s.client_id = p_client and s.session_date = w.workout_date
        and s.status in ('complete', 'partial') and s.makeup_for is null
    )
    and not exists (
      select 1 from public.workout_sessions s
      where s.client_id = p_client and s.makeup_for = w.workout_date
    )
  order by w.workout_date;
$$;

revoke execute on function public.missed_calendar_workouts(uuid, date) from public, anon, authenticated;
