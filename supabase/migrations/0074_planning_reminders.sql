-- Planning reminders (GRIZZ, 2026-10-12): 2 days and 1 day before a client's
-- last planned calendar workout (0069), remind their trainer to plan the next
-- week. One notification per trainer a day, naming the clients. Trainers can
-- switch it off on their Profile.

alter table public.trainers
  add column if not exists planning_reminders boolean not null default true;

create or replace function public.planning_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  for t in
    select c.trainer_id,
      count(*) as n,
      min(last_day - public.sa_today()) as soonest,
      string_agg(c.name || ' (' || to_char(last_day, 'FMDay') || ')', ', ' order by last_day, c.name) as names
    from public.clients c
    join public.trainers tr on tr.id = c.trainer_id and tr.planning_reminders
    join lateral (
      select max(w.workout_date) as last_day
      from public.client_calendar_workouts w
      where w.client_id = c.id
    ) planned on true
    where c.access_status <> 'expired'
      and planned.last_day in (public.sa_today() + 1, public.sa_today() + 2)
    group by c.trainer_id
  loop
    perform public.push_to_user(
      t.trainer_id,
      'Plan next week''s workouts',
      case
        when t.n = 1 then
          'Last planned workout for ' || t.names || ' is ' || case when t.soonest = 1 then 'tomorrow' else 'in 2 days' end
          || '. Plan their next week on their Training tab, then tap Save.'
        else
          t.n || ' clients run out of planned workouts soon: ' || t.names || '. Plan their next week on their Training tabs.'
      end,
      jsonb_build_object('type', 'planning_reminder')
    );
  end loop;
end;
$$;

revoke execute on function public.planning_reminders() from public, anon, authenticated;

select cron.unschedule('planning-reminders-daily')
where exists (select 1 from cron.job where jobname = 'planning-reminders-daily');
-- 06:10 UTC is 08:10 in South Africa.
select cron.schedule('planning-reminders-daily', '10 6 * * *', $$select public.planning_reminders();$$);
