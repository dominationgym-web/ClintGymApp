-- Logged but never finished (GRIZZ, 2026-11-22): Melanie logged 14 sets on
-- Thursday 19 Nov but closed the app without tapping Complete workout, so no
-- workout_sessions row was saved. Her calendar showed no dot, the day stayed
-- on her missed list and her trainer couldn't see she had trained.
--
-- Safety net: shortly after midnight (South Africa) every client who logged
-- working sets yesterday without a green/orange/red session gets one saved
-- for them. Green when every planned set of that day's calendar workout was
-- logged (or there was no calendar workout), else orange with a plain note
-- for the coach. No push goes out: the trainer would only see a confusing
-- "partly finished" alert at midnight.

create or replace function public.auto_finish_logged_workouts(p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  made integer;
begin
  with logged as (
    select l.client_id, count(*)::int as sets_done
    from public.workout_logs l
    where l.log_date = p_day and l.import_id is null and not coalesce(l.warm_up, false)
    group by l.client_id
  ),
  planned as (
    select w.client_id, p.name,
      (select coalesce(sum(e.sets), 0)::int
       from public.program_exercises e
       where e.program_id = w.program_id
         and e.kind = 'exercise'
         and e.day_number = coalesce(((w.day_slot - 1) % 7) + 1, 1)
         and coalesce(e.week_number, 1) = coalesce(((w.day_slot - 1) / 7) + 1, 1)) as sets_planned
    from public.client_calendar_workouts w
    join public.programs p on p.id = w.program_id
    where w.workout_date = p_day
  ),
  per_client as (
    select l.client_id, l.sets_done,
      coalesce(string_agg(pl.name, ' + '), 'Workout') as title,
      coalesce(sum(pl.sets_planned), 0)::int as sets_planned
    from logged l
    left join planned pl on pl.client_id = l.client_id
    group by l.client_id, l.sets_done
  ),
  ins as (
    insert into public.workout_sessions (client_id, session_date, title, status, sets_done, sets_planned, reason, improvements)
    select c.client_id, p_day, left(c.title, 120),
      case when c.sets_planned = 0 or c.sets_done >= c.sets_planned then 'complete' else 'partial' end,
      least(c.sets_done, 1000),
      least(greatest(c.sets_planned, c.sets_done), 1000),
      case when c.sets_planned = 0 or c.sets_done >= c.sets_planned then null
        else 'Sets were logged, but Complete workout wasn''t tapped, so the app saved it the next night.' end,
      '[]'::jsonb
    from per_client c
    join public.clients cl on cl.id = c.client_id
    on conflict (client_id, session_date) do nothing
    returning 1
  )
  select count(*) into made from ins;
  return made;
end;
$$;

revoke execute on function public.auto_finish_logged_workouts(date) from public, anon, authenticated;

-- 00:30 in South Africa, for the day that just ended.
select cron.unschedule('auto-finish-logged-workouts')
where exists (select 1 from cron.job where jobname = 'auto-finish-logged-workouts');
select cron.schedule('auto-finish-logged-workouts', '30 22 * * *', $$select public.auto_finish_logged_workouts(public.sa_today() - 1);$$);

-- Catch up the days already missed this month (Melanie 19 Nov and a few others).
select public.auto_finish_logged_workouts(d::date)
from generate_series(date '2026-11-01', public.sa_today() - 1, interval '1 day') d;
