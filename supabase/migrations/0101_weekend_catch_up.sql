-- Weekend catch-up (GRIZZ, 2026-10-17): a client who missed a calendar
-- workout during the week can do it on Saturday or Sunday. The app opens on
-- the missed workout at the weekend, the client can also pick it from their
-- calendar, and a 6am push on Saturday and Sunday (0102) reminds them.
--
-- A missed workout is a training calendar workout from Monday of this week up
-- to yesterday with no green or orange session that day, that hasn't already
-- been caught up. The session done at the weekend keeps its own date and
-- notes which day it made up in makeup_for.

alter table public.workout_sessions add column if not exists makeup_for date;

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
    and w.workout_date >= date_trunc('week', p_today)::date
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

-- The signed-in client's missed workouts this week.
create or replace function public.my_missed_workouts()
returns table (workout_date date, program_id uuid, program_name text, program_trainer_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.missed_calendar_workouts(auth.uid(), public.sa_today());
$$;

revoke execute on function public.my_missed_workouts() from public, anon;
grant execute on function public.my_missed_workouts() to authenticated;

-- Called straight after record_workout_session when today's workout was a
-- missed one: marks today's session as making up p_date and tells the trainer.
create or replace function public.mark_workout_makeup(p_date date)
returns public.workout_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  saved public.workout_sessions;
  who text;
  coach uuid;
begin
  if not exists (select 1 from public.missed_calendar_workouts(me, public.sa_today()) m where m.workout_date = p_date) then
    raise exception 'That workout isn''t waiting to be caught up';
  end if;
  update public.workout_sessions
  set makeup_for = p_date, updated_at = now()
  where client_id = me and session_date = public.sa_today() and status in ('complete', 'partial')
  returning * into saved;
  if saved.id is null then
    raise exception 'Finish the workout first';
  end if;
  select c.name, c.trainer_id into who, coach from public.clients c where c.id = me;
  if coach is not null then
    perform public.push_to_user(
      coach,
      coalesce(who, 'A client') || ' caught up ' || trim(to_char(p_date, 'Day')) || '''s workout',
      coalesce(nullif(saved.title, ''), 'Their missed workout') || ', done today.',
      jsonb_build_object('type', 'workout_session', 'clientId', me)
    );
  end if;
  return saved;
end;
$$;

revoke execute on function public.mark_workout_makeup(date) from public, anon;
grant execute on function public.mark_workout_makeup(date) to authenticated;

-- Saturday and Sunday mornings: remind clients with a missed workout who
-- haven't trained yet today.
create or replace function public.weekend_catch_up_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  today date := public.sa_today();
  first_missed date;
  missed_count integer;
begin
  if extract(isodow from today) < 6 then
    return;
  end if;
  for c in
    select cl.id from public.clients cl
    where cl.access_status <> 'expired' and cl.archived_at is null
      and not exists (select 1 from public.workout_sessions s where s.client_id = cl.id and s.session_date = today)
  loop
    select min(m.workout_date), count(*) into first_missed, missed_count
    from public.missed_calendar_workouts(c.id, today) m;
    if missed_count > 0 then
      perform public.push_to_user(
        c.id,
        'Catch up your missed workout 💪',
        case when missed_count = 1
          then 'You missed ' || trim(to_char(first_missed, 'Day')) || '''s workout. Open Training and it''s ready for you to do today.'
          else 'You missed ' || missed_count || ' workouts this week. Open Training to catch up ' || trim(to_char(first_missed, 'Day')) || '''s today.' end,
        jsonb_build_object('type', 'catch_up')
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.weekend_catch_up_reminders() from public, anon, authenticated;

select cron.unschedule('weekend-catch-up-reminders')
where exists (select 1 from cron.job where jobname = 'weekend-catch-up-reminders');
-- 6 = Saturday, 0 = Sunday. Moved to 04:00 UTC (06:00 SA) in 0102.
select cron.schedule('weekend-catch-up-reminders', '0 7 * * 6,0', $$select public.weekend_catch_up_reminders();$$);
