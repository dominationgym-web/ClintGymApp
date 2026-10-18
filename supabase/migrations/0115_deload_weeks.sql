-- Deload weeks (GRIZZ, 2026-10-18): "I'd like the trainer to be notified when
-- its time for a deload week for there client to recover ... I would like the
-- app to activate a deload week for the client. Based on there training. This
-- can then just be added by the trainer into the middle of there program with
-- minimal disruption. Then they straight back onto there program after."
--
-- deload_check(client) reads the client's training: weeks in a row with 2+
-- workouts since their last deload, and the last 14 days for signs of fatigue
-- (sets to failure, tiredness reports, missed or unfinished workouts, poor
-- sleep, no improvements). add_deload_week(client, start) slots a week in:
-- every main workout and extra block from that day moves back 7 days, and the
-- week that was there is copied into the gap marked deload (the app halves the
-- sets and lightens the weights). Running weekly plans move back a week too.
-- deload_reminders() pushes the trainer once when a deload is due.

alter table public.client_calendar_workouts add column if not exists deload boolean not null default false;
alter table public.clients add column if not exists deload_alerted_on date;

-- The plan's workouts still to do: placed days from today on with no workout
-- recorded. No longer floored at the plan's start day, which a deload moves.
create or replace function public.plan_workouts_left_count(p_plan_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct d)::int
  from public.client_program_plans p_plan
  cross join lateral (
    select w.workout_date as d from public.client_calendar_workouts w
    where w.client_id = p_plan.client_id and w.program_id = p_plan.program_id
    union
    select b.workout_date from public.client_calendar_blocks b
    where b.client_id = p_plan.client_id and b.program_id = p_plan.program_id and b.removed_at is null
  ) days
  where p_plan.id = p_plan_id
    and d between public.sa_today() and p_plan.placed_until
    and not exists (
      select 1 from public.workout_sessions s
      where s.client_id = p_plan.client_id and s.session_date = days.d and s.status in ('complete', 'partial')
    );
$$;

create or replace function public.deload_check_internal(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := public.sa_today();
  this_monday date := today - ((extract(isodow from today)::int) - 1);
  last_deload date;
  planned_deload date;
  weeks int := 0;
  wk date;
  n int;
  reasons text[] := '{}';
  sets_total int;
  sets_failure int;
  tired int;
  missed int;
  quality numeric;
  done14 int;
  improved int;
  due boolean;
begin
  select max(workout_date) filter (where workout_date <= today), min(workout_date) filter (where workout_date > today)
    into last_deload, planned_deload
  from public.client_calendar_workouts where client_id = p_client and deload;

  -- Weeks in a row (Monday to Sunday) with 2+ workouts, counting back from
  -- last week (this week once it has 2), stopping at the last deload.
  wk := this_monday;
  select count(*) into n from public.workout_sessions
    where client_id = p_client and session_date between wk and wk + 6 and status in ('complete', 'partial');
  if n < 2 then wk := wk - 7; end if;
  loop
    exit when weeks >= 20 or (last_deload is not null and wk + 6 >= last_deload);
    select count(*) into n from public.workout_sessions
      where client_id = p_client and session_date between wk and wk + 6 and status in ('complete', 'partial');
    exit when n < 2;
    weeks := weeks + 1;
    wk := wk - 7;
  end loop;

  -- Signs of fatigue in the last 14 days.
  select count(*) filter (where not coalesce(gauge, false)), count(*) filter (where effort = 'failure' and not coalesce(gauge, false))
    into sets_total, sets_failure
  from public.workout_logs where client_id = p_client and log_date between today - 13 and today and not coalesce(warm_up, false);
  if sets_total >= 20 and sets_failure::numeric / sets_total >= 0.4 then
    reasons := reasons || (round(100.0 * sets_failure / sets_total) || '% of sets went to failure');
  end if;

  select count(*) into tired
  from public.checkins where client_id = p_client and checkin_date between today - 13 and today and fatigue_status = 'reported';
  if tired >= 3 then reasons := reasons || ('tired on ' || tired || ' days'); end if;
  select avg(sleep_quality) into quality
  from public.checkins where client_id = p_client and checkin_date between today - 13 and today and sleep_quality is not null;
  if quality is not null and quality <= 2.5 then reasons := reasons || 'poor sleep'; end if;

  select count(*) into missed from public.workout_sessions
  where client_id = p_client and session_date between today - 13 and today and status in ('missed', 'partial');
  if missed >= 2 then reasons := reasons || (missed || ' workouts missed or not finished'); end if;

  select count(*), count(*) filter (where star or jsonb_array_length(coalesce(improvements, '[]'::jsonb)) > 0)
    into done14, improved
  from public.workout_sessions where client_id = p_client and session_date between today - 13 and today and status in ('complete', 'partial');
  if done14 >= 4 and improved = 0 then reasons := reasons || 'no improvements in 2 weeks'; end if;

  due := planned_deload is null
    and (last_deload is null or last_deload < today - 21)
    and (weeks >= 6 or (weeks >= 4 and cardinality(reasons) >= 2) or (weeks >= 3 and cardinality(reasons) >= 3));

  return jsonb_build_object(
    'weeks', weeks,
    'reasons', to_jsonb(reasons),
    'due', due,
    'last_deload', last_deload,
    'planned_deload', planned_deload
  );
end;
$$;

revoke execute on function public.deload_check_internal(uuid) from public, anon, authenticated;

-- The same, for the client's trainer.
create or replace function public.deload_check(p_client uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.deload_check_internal(c.id) from public.clients c where c.id = p_client and c.trainer_id = auth.uid();
$$;

revoke execute on function public.deload_check(uuid) from public, anon;
grant execute on function public.deload_check(uuid) to authenticated;

create or replace function public.add_deload_week(p_client uuid, p_start date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
  added int := 0;
begin
  if not exists (select 1 from public.clients c where c.id = p_client and c.trainer_id = auth.uid()) then
    raise exception 'Not your client';
  end if;
  if not public.not_unapproved_trainer() then
    raise exception 'Your trainer account is waiting for approval';
  end if;
  if p_start <= public.sa_today() then
    raise exception 'A deload week can start tomorrow at the earliest';
  end if;
  if exists (select 1 from public.client_calendar_workouts where client_id = p_client and deload and workout_date >= public.sa_today()) then
    raise exception 'A deload week is already on the calendar';
  end if;
  if exists (select 1 from public.client_calendar_workouts where client_id = p_client and deload and workout_date between p_start - 6 and p_start + 6) then
    raise exception 'That overlaps their last deload week';
  end if;

  -- Move every main workout from that day back a week, latest first so no
  -- two land on the same day.
  for w in
    select id from public.client_calendar_workouts
    where client_id = p_client and workout_date >= p_start
    order by workout_date desc
  loop
    update public.client_calendar_workouts set workout_date = workout_date + 7 where id = w.id;
  end loop;
  update public.client_calendar_blocks set workout_date = workout_date + 7
    where client_id = p_client and workout_date >= p_start and removed_at is null;

  -- The week that was there goes back into the gap as the deload week.
  insert into public.client_calendar_workouts (client_id, workout_date, program_id, day_slot, deload)
  select client_id, workout_date - 7, program_id, day_slot, true
  from public.client_calendar_workouts
  where client_id = p_client and workout_date between p_start + 7 and p_start + 13;
  get diagnostics added = row_count;
  insert into public.client_calendar_blocks (client_id, workout_date, program_id, day_slot, position)
  select client_id, workout_date - 7, program_id, day_slot, position
  from public.client_calendar_blocks
  where client_id = p_client and workout_date between p_start + 7 and p_start + 13 and removed_at is null;

  -- Running weekly plans carry on a week later.
  update public.client_program_plans
  set start_date = start_date + 7,
      placed_until = placed_until + 7,
      asked_until = asked_until + 7
  where client_id = p_client and ended_at is null and placed_until >= p_start;

  update public.clients set deload_alerted_on = public.sa_today() where id = p_client;
  return added;
end;
$$;

revoke execute on function public.add_deload_week(uuid, date) from public, anon;
grant execute on function public.add_deload_week(uuid, date) to authenticated;

-- Push the trainer when a client's deload is due, at most once every 3 weeks.
create or replace function public.deload_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  chk jsonb;
  why text;
begin
  for c in
    select cl.id, cl.trainer_id, trim(cl.name) as name
    from public.clients cl
    where cl.access_status <> 'expired'
      and cl.archived_at is null
      and cl.trainer_id is not null
      and (cl.deload_alerted_on is null or cl.deload_alerted_on < public.sa_today() - 21)
      and exists (select 1 from public.client_calendar_workouts w where w.client_id = cl.id and w.workout_date > public.sa_today())
  loop
    chk := public.deload_check_internal(c.id);
    continue when not (chk ->> 'due')::boolean;
    update public.clients set deload_alerted_on = public.sa_today() where id = c.id;
    select string_agg(r, ', ') into why from jsonb_array_elements_text(chk -> 'reasons') r;
    perform public.push_to_user(
      c.trainer_id,
      'Deload week for ' || c.name || '?',
      c.name || ' has trained ' || (chk ->> 'weeks') || ' weeks in a row'
        || coalesce(' (' || why || ')', '')
        || '. Open their Training tab to add a deload week, then let them know.',
      jsonb_build_object('type', 'deload_due', 'client_id', c.id)
    );
  end loop;
end;
$$;

revoke execute on function public.deload_reminders() from public, anon, authenticated;

select cron.unschedule('deload-reminders-daily')
where exists (select 1 from cron.job where jobname = 'deload-reminders-daily');
-- 06:40 UTC is 08:40 in South Africa.
select cron.schedule('deload-reminders-daily', '40 6 * * *', $$select public.deload_reminders();$$);
