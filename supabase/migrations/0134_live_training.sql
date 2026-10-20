-- Live 1-on-1 training (GRIZZ, 2026-10-20: "Allow the client's assigned
-- trainer to open and operate the existing workout screen during
-- face-to-face training ... Each client has only one assigned trainer. Keep
-- that access restriction enforced securely. Handle duplicate records,
-- saving and data permissions behind the scenes").
--
-- The trainer runs the client's own workout screen. Their requests carry an
-- x-live-client header naming the client; acting_client() returns that
-- client only when the caller is that client's own approved trainer, and
-- the caller otherwise. The workout functions use it in place of auth.uid(),
-- so one set of records serves online and face-to-face training. Table
-- writes get trainer policies of their own, limited to their own clients.
-- Trainers can't delete a client's logs. Every set records who logged it.

create or replace function public.acting_client()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  live uuid;
begin
  begin
    live := nullif(current_setting('request.headers', true)::json ->> 'x-live-client', '')::uuid;
  exception when others then
    live := null;
  end;
  if live is not null
     and exists (select 1 from public.clients c where c.id = live and c.trainer_id = auth.uid())
     and public.not_unapproved_trainer() then
    return live;
  end if;
  return auth.uid();
end;
$$;
revoke all on function public.acting_client() from public, anon;
grant execute on function public.acting_client() to authenticated;

-- Who logged each set: the client, or their trainer in a live session.
alter table public.workout_logs add column if not exists logged_by uuid default auth.uid();

alter policy "workout logs insert own" on public.workout_logs
  with check (
    client_id = (select auth.uid())
    and client_has_access(client_id)
    and coalesce(logged_by, client_id) = (select auth.uid())
    and not public.has_medical_hold(client_id)
  );

create policy "workout logs trainer adds live" on public.workout_logs
  for insert to authenticated
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and (select public.not_unapproved_trainer())
    and client_has_access(client_id)
    and logged_by = (select auth.uid())
    and not public.has_medical_hold(client_id)
  );

create policy "workout logs trainer corrects live" on public.workout_logs
  for update to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and (select public.not_unapproved_trainer())
  );

create policy "drop set rounds trainer adds live" on public.drop_set_rounds
  for insert to authenticated
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and (select public.not_unapproved_trainer())
    and client_has_access(client_id)
  );

create policy "achievements trainer records live" on public.client_achievements
  for insert to authenticated
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and (select public.not_unapproved_trainer())
    and weight >= from_weight * 1.1
    and reps >= from_reps
  );

create policy "exercise pain trainer adds live" on public.client_exercise_pain
  for insert to authenticated
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and (select public.not_unapproved_trainer())
  );

-- Two phones logging the same set (client and trainer at once) both keep
-- their set, numbered one after the other.
create or replace function public.workout_logs_next_set_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(new.warm_up, false) and new.set_number is not null and exists (
    select 1 from public.workout_logs w
    where w.client_id = new.client_id and w.log_date = new.log_date and w.exercise_name = new.exercise_name
      and not coalesce(w.warm_up, false) and w.set_number = new.set_number
  ) then
    select coalesce(max(w.set_number), 0) + 1 into new.set_number
    from public.workout_logs w
    where w.client_id = new.client_id and w.log_date = new.log_date and w.exercise_name = new.exercise_name
      and not coalesce(w.warm_up, false);
  end if;
  return new;
end;
$$;

create trigger workout_logs_next_set_number
  before insert on public.workout_logs
  for each row execute function public.workout_logs_next_set_number();

create or replace function public.my_missed_workouts()
returns table(workout_date date, program_id uuid, program_name text, program_trainer_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.missed_calendar_workouts(public.acting_client(), public.sa_today());
$$;

create or replace function public.set_my_block_result(p_block uuid, p_result text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.acting_client();
  changed int;
begin
  if p_result is not null and p_result not in ('done', 'skipped') then
    raise exception 'Unknown result';
  end if;
  update public.client_calendar_blocks
  set result = p_result, result_at = case when p_result is null then null else now() end
  where id = p_block
    and client_id = me
    and removed_at is null
    and workout_date <= public.sa_today();
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.set_my_program_week_progress(p_current_week smallint, p_current_day smallint, p_due_on date, p_completed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.acting_client();
  cp public.client_programs;
  slots integer[];
  target integer := (p_current_week - 1) * 7 + p_current_day;
  cur integer;
  allowed integer[];
begin
  if me is null or not exists (
    select 1 from public.clients c where c.id = me and c.access_status <> 'expired'
  ) then
    raise exception 'no access';
  end if;

  select * into cp from public.client_programs where client_id = me;
  if cp.program_id is null then
    raise exception 'not on a program';
  end if;

  select array_agg(s order by s) into slots
  from (
    select distinct (e.week_number - 1) * 7 + e.day_number as s
    from public.program_exercises e
    where e.program_id = cp.program_id
  ) x;

  if slots is null or not (target = any (slots)) then
    raise exception 'that day is not a training day in this program';
  end if;

  if cp.current_day is not null then
    cur := (coalesce(cp.current_week, 1) - 1) * 7 + cp.current_day;
    allowed := array[cur];
  else
    select array_agg(s) into allowed from unnest(slots) s where s <= 7;
  end if;

  if p_completed then
    allowed := (
      select array_agg(coalesce(
        (select min(s2) from unnest(slots) s2 where s2 > a),
        slots[1]
      ))
      from unnest(allowed) a
    );
  end if;

  if not (target = any (allowed)) then
    raise exception 'that isn''t your next session';
  end if;

  if p_due_on < current_date - 2 or p_due_on > current_date + 8 then
    raise exception 'that date is out of range';
  end if;

  update public.client_programs
  set current_week = p_current_week,
      current_day = p_current_day,
      due_on = p_due_on,
      last_completed_at = case when p_completed then now() else last_completed_at end
  where client_id = me;
end;
$$;

create or replace function public.record_workout_session(p_title text, p_status text, p_sets_done integer, p_sets_planned integer, p_reason text default null, p_improvements jsonb default '[]'::jsonb)
returns public.workout_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.acting_client();
  before public.workout_sessions;
  saved public.workout_sessions;
  who text;
  coach uuid;
  why text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  ups text;
begin
  if p_status not in ('complete', 'partial', 'missed') then
    raise exception 'Unknown status %', p_status;
  end if;
  if p_status <> 'complete' and why is null then
    raise exception 'Tell your coach why first';
  end if;
  select c.name, c.trainer_id into who, coach from public.clients c where c.id = me;
  if not found then
    raise exception 'Only clients can record a workout';
  end if;

  select * into before from public.workout_sessions where client_id = me and session_date = public.sa_today();

  insert into public.workout_sessions (client_id, session_date, title, status, sets_done, sets_planned, reason, improvements)
  values (
    me, public.sa_today(), left(coalesce(p_title, ''), 120), p_status,
    greatest(0, least(coalesce(p_sets_done, 0), 1000)), greatest(0, least(coalesce(p_sets_planned, 0), 1000)),
    case when p_status = 'complete' then null else why end,
    coalesce(p_improvements, '[]'::jsonb)
  )
  on conflict (client_id, session_date) do update
  set title = excluded.title, status = excluded.status, sets_done = excluded.sets_done,
      sets_planned = excluded.sets_planned, reason = excluded.reason, improvements = excluded.improvements,
      updated_at = now()
  returning * into saved;

  -- No push when the trainer finished it with the client in a live session.
  if coach is not null and coach is distinct from auth.uid() then
    if saved.status <> 'complete' and (before.id is null or before.status is distinct from saved.status) then
      perform public.push_to_user(
        coach,
        case when saved.status = 'partial'
          then coalesce(who, 'A client') || ' only partly finished ' || coalesce(nullif(saved.title, ''), 'their workout')
          else coalesce(who, 'A client') || ' couldn''t train today' end,
        'Why: ' || saved.reason,
        jsonb_build_object('type', 'workout_session', 'clientId', me)
      );
    end if;
    if saved.star and not coalesce(before.star, false) then
      select string_agg(x->>'exercise' || ' ' || coalesce(x->>'before', '') || ' → ' || coalesce(x->>'after', ''), ', ')
      into ups from jsonb_array_elements(saved.improvements) x;
      perform public.push_to_user(
        coach,
        '⭐ ' || coalesce(who, 'A client') || ' pushed their weights up',
        coalesce(ups, ''),
        jsonb_build_object('type', 'workout_star', 'clientId', me)
      );
    end if;
  end if;
  return saved;
end;
$$;

create or replace function public.mark_workout_makeup(p_date date)
returns public.workout_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.acting_client();
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
  if coach is not null and coach is distinct from auth.uid() then
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
