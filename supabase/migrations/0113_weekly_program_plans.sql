-- Programs go on the calendar one week at a time (GRIZZ, 2026-10-18): "Only
-- put 1 week at a time onto the calendar. Then when the client has 2 workouts
-- left. Confirm with the trainer if he wants to add the following weeks
-- program or needs to make adjustments."
--
-- client_program_plans keeps what the trainer chose in the planner (program,
-- start day, training days, how many weeks) and how far it has been put on the
-- calendar (placed_until). The app works out each next week from that. When
-- 2 or fewer of the placed workouts are left (days from today with no workout
-- recorded), the trainer gets one push for that week (asked_until) and a Go
-- ahead card on the client's Training tab. Plain ids, no foreign keys, as with
-- the other calendar tables (0098); stopping a plan sets ended_at.

create table if not exists public.client_program_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  trainer_id uuid not null,
  program_id uuid not null,
  start_date date not null,
  split_days smallint[] not null check (cardinality(split_days) between 1 and 6),
  weeks smallint not null check (weeks between 1 and 52),
  placed_until date not null,
  asked_until date,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_program_plans_client_idx on public.client_program_plans (client_id) where ended_at is null;

alter table public.client_program_plans enable row level security;

create policy "program plans trainer reads" on public.client_program_plans
  for select to authenticated using (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "program plans trainer inserts" on public.client_program_plans
  for insert to authenticated with check (
    trainer_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "program plans trainer updates" on public.client_program_plans
  for update to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
create policy "approved trainers only (insert)" on public.client_program_plans
  as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()));
create policy "approved trainers only (update)" on public.client_program_plans
  as restrictive for update to authenticated using ((select public.not_unapproved_trainer()));

-- The plan's workouts still to do this week: placed days from today on with
-- no workout recorded.
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
    and d between greatest(public.sa_today(), p_plan.start_date) and p_plan.placed_until
    and not exists (
      select 1 from public.workout_sessions s
      where s.client_id = p_plan.client_id and s.session_date = days.d and s.status in ('complete', 'partial')
    );
$$;

revoke execute on function public.plan_workouts_left_count(uuid) from public, anon, authenticated;

-- The same, for the client's trainer (the Go ahead card).
create or replace function public.plan_workouts_left(p_plan_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.plan_workouts_left_count(p.id)
  from public.client_program_plans p
  join public.clients c on c.id = p.client_id
  where p.id = p_plan_id and c.trainer_id = auth.uid();
$$;

revoke execute on function public.plan_workouts_left(uuid) from public, anon;
grant execute on function public.plan_workouts_left(uuid) to authenticated;

-- Push the trainer once per placed week when 2 or fewer of its workouts are
-- left, for running plans that still have weeks to add.
create or replace function public.plan_next_week_reminders(p_client uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  left_n int;
begin
  for p in
    select pl.*, trim(c.name) as client_name, pr.name as program_name
    from public.client_program_plans pl
    join public.clients c on c.id = pl.client_id
    join public.programs pr on pr.id = pl.program_id
    where pl.ended_at is null
      and (p_client is null or pl.client_id = p_client)
      and pl.placed_until < pl.start_date + pl.weeks * 7 - 1
      and pl.asked_until is distinct from pl.placed_until
      and c.access_status <> 'expired'
  loop
    left_n := public.plan_workouts_left_count(p.id);
    if left_n <= 2 then
      update public.client_program_plans set asked_until = p.placed_until where id = p.id;
      perform public.push_to_user(
        p.trainer_id,
        'Add ' || p.client_name || '''s next week?',
        p.client_name || ' has ' || case left_n when 0 then 'no' else left_n::text end
          || ' workout' || case when left_n = 1 then '' else 's' end || ' left this week of ' || p.program_name
          || '. Open their Training tab to go ahead with next week, or make changes first.',
        jsonb_build_object('type', 'plan_next_week', 'client_id', p.client_id)
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.plan_next_week_reminders(uuid) from public, anon, authenticated;

-- Checked as soon as the client records a workout, and each morning for days
-- that pass without one.
create or replace function public.workout_sessions_plan_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.plan_next_week_reminders(new.client_id);
  return new;
end;
$$;

create or replace trigger workout_sessions_plan_check
  after insert or update of status on public.workout_sessions
  for each row execute function public.workout_sessions_plan_check();

select cron.unschedule('plan-next-week-reminders-daily')
where exists (select 1 from cron.job where jobname = 'plan-next-week-reminders-daily');
-- 06:20 UTC is 08:20 in South Africa.
select cron.schedule('plan-next-week-reminders-daily', '20 6 * * *', $$select public.plan_next_week_reminders();$$);

-- The older "plan next week" reminder (0074) skips clients on a weekly plan,
-- who get the reminder above instead.
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
      and not exists (
        select 1 from public.client_program_plans pl
        where pl.client_id = c.id and pl.ended_at is null and pl.placed_until < pl.start_date + pl.weeks * 7 - 1
      )
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
