-- The same session every week (GRIZZ, 2026-11-01: "give them the option to
-- add that schedule indefinitely as trainers normally train the same
-- schedule over long periods. Then they can swap, delete and change as they
-- go forward. So a change just for today or going forward long term.").
--
-- live_repeats holds one weekly time for one person: an app client or a
-- name-only diary person (0174). fill_live_repeats() keeps the calendar
-- filled from today to the end of next month (on import, on a change and
-- every night). A change to one session asks "just this one" (the session
-- alone, as before) or "this and every week after" (the repeat ends at that
-- session and, for a move, a new one starts at the new day and time).
-- Nothing is deleted: a repeat gets ended_at, sessions get status 'removed'.

create table if not exists public.live_repeats (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  guest_name text check (guest_name is null or char_length(guest_name) between 1 and 60),
  -- 0 Sunday ... 6 Saturday, in the trainer's time zone.
  weekday smallint not null check (weekday between 0 and 6),
  at_time time not null,
  minutes integer not null check (minutes between 15 and 180),
  -- First day it applies.
  starts_on date not null,
  -- No sessions at or after this moment.
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_repeats_who check (client_id is not null or guest_name is not null)
);
create index if not exists live_repeats_trainer_idx on public.live_repeats (trainer_id) where ended_at is null;

alter table public.live_repeats enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'live_repeats' and policyname = 'live_repeats_read') then
    create policy live_repeats_read on public.live_repeats
      for select to authenticated using (trainer_id = (select auth.uid()));
  end if;
end $$;

alter table public.live_sessions
  add column if not exists repeat_id uuid references public.live_repeats (id) on delete set null;
-- The week's time the repeat made it for. It stays when the session is
-- moved or taken off, so that week isn't made again. (Not regular_at: that
-- belongs to a plan's regular times, which saving the plan tidies up.)
alter table public.live_sessions add column if not exists repeat_at timestamptz;
create unique index if not exists live_sessions_repeat_once on public.live_sessions (repeat_id, repeat_at)
  where repeat_id is not null and repeat_at is not null;

-- Fills one trainer's (or every trainer's) weekly repeats from today to the
-- end of next month. A week already taken off or moved isn't added back.
create or replace function public.fill_live_repeats(p_trainer uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.live_repeats;
  tz text;
  d date;
  v_at timestamptz;
  v_fee numeric;
  added integer := 0;
  n integer;
begin
  for r in
    select * from public.live_repeats
    where (ended_at is null or ended_at > now())
      and (p_trainer is null or trainer_id = p_trainer)
  loop
    tz := public.session_tz(r.trainer_id);
    select coalesce(p.fee, s.fee, 0) into v_fee
    from public.session_settings s
    left join public.session_plans p on p.client_id = r.client_id
    where s.trainer_id = r.trainer_id;
    for d in
      select g::date from generate_series(
        greatest((now() at time zone tz)::date, r.starts_on)::timestamp,
        (date_trunc('month', now() at time zone tz) + interval '2 months' - interval '1 day')::date::timestamp,
        interval '1 day'
      ) g
    loop
      continue when extract(dow from d) <> r.weekday;
      v_at := (d + r.at_time) at time zone tz;
      continue when v_at <= now();
      continue when r.ended_at is not null and v_at >= r.ended_at;
      -- Already booked at that time for that person (an import, by hand).
      continue when exists (
        select 1 from public.live_sessions ls
        where ls.trainer_id = r.trainer_id and ls.starts_at = v_at and ls.status <> 'removed'
          and (ls.client_id = r.client_id
               or (r.client_id is null and ls.client_id is null and public.diary_name_key(ls.guest_name) = public.diary_name_key(r.guest_name)))
      );
      insert into public.live_sessions (trainer_id, client_id, guest_name, starts_at, minutes, fee, repeat_at, repeat_id)
      values (r.trainer_id, r.client_id, case when r.client_id is null then r.guest_name end, v_at, r.minutes, coalesce(v_fee, 0), v_at, r.id)
      on conflict do nothing;
      get diagnostics n = row_count;
      added := added + n;
    end loop;
  end loop;
  return added;
end;
$$;

-- A weekly repeat for this session's person, day and time, starting with
-- this session (reused when one already exists).
create or replace function public.live_repeat_for(p_session uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ls public.live_sessions;
  tz text;
  local timestamp;
  v_id uuid;
begin
  select * into ls from public.live_sessions where id = p_session;
  if ls.id is null then
    return null;
  end if;
  if ls.repeat_id is not null then
    return ls.repeat_id;
  end if;
  tz := public.session_tz(ls.trainer_id);
  local := ls.starts_at at time zone tz;
  select id into v_id from public.live_repeats r
  where r.trainer_id = ls.trainer_id and r.ended_at is null
    and r.weekday = extract(dow from local) and r.at_time = local::time
    and (r.client_id = ls.client_id
         or (ls.client_id is null and r.client_id is null and public.diary_name_key(r.guest_name) = public.diary_name_key(ls.guest_name)))
  limit 1;
  if v_id is null then
    insert into public.live_repeats (trainer_id, client_id, guest_name, weekday, at_time, minutes, starts_on)
    values (ls.trainer_id, ls.client_id, case when ls.client_id is null then ls.guest_name end,
            extract(dow from local), local::time, ls.minutes, local::date)
    returning id into v_id;
  end if;
  update public.live_sessions
  set repeat_id = v_id, repeat_at = starts_at, updated_at = now()
  where id = ls.id;
  return v_id;
end;
$$;

-- The trainer turns one booked session into the same time every week.
create or replace function public.repeat_live_session(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_repeat uuid;
  v_added integer;
begin
  if not exists (select 1 from public.live_sessions where id = p_id and trainer_id = auth.uid() and status <> 'removed') then
    raise exception 'Session not found';
  end if;
  v_repeat := public.live_repeat_for(p_id);
  v_added := public.fill_live_repeats(auth.uid());
  return jsonb_build_object('repeat_id', v_repeat, 'added', v_added);
end;
$$;

-- "This and every week after": the repeat moves to the new day and time from
-- this session on. Later weeks at the old time come off the calendar.
create or replace function public.move_live_repeat(p_id uuid, p_starts_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ls public.live_sessions;
  r public.live_repeats;
  tz text := public.session_tz(auth.uid());
  local timestamp := p_starts_at at time zone tz;
  v_new uuid;
  v_removed integer;
  coach text;
begin
  select * into ls from public.live_sessions where id = p_id and trainer_id = auth.uid() and status = 'booked';
  if ls.id is null or ls.repeat_id is null then
    raise exception 'Only a booked weekly session can be moved for every week';
  end if;
  select * into r from public.live_repeats where id = ls.repeat_id;

  update public.live_repeats set ended_at = ls.starts_at, updated_at = now() where id = r.id;
  update public.live_sessions
  set status = 'removed', updated_at = now()
  where repeat_id = r.id and status = 'booked' and starts_at > ls.starts_at and id <> ls.id;
  get diagnostics v_removed = row_count;

  insert into public.live_repeats (trainer_id, client_id, guest_name, weekday, at_time, minutes, starts_on)
  values (r.trainer_id, ls.client_id, case when ls.client_id is null then ls.guest_name end,
          extract(dow from local), local::time, ls.minutes, local::date)
  returning id into v_new;
  update public.live_sessions
  set starts_at = p_starts_at, repeat_at = p_starts_at, repeat_id = v_new, asked_trainer = false, updated_at = now()
  where id = ls.id;
  perform public.fill_live_repeats(auth.uid());

  if ls.client_id is not null then
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = auth.uid();
    perform public.push_to_user(
      ls.client_id,
      '🤝 Your weekly session moved',
      'From ' || public.video_checkin_when(p_starts_at, tz) || ', every ' || trim(to_char(local, 'Day')) || ' at ' || to_char(local, 'HH24:MI') || '.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return jsonb_build_object('repeat_id', v_new, 'removed', v_removed);
end;
$$;

-- "This and every week after" for taking off: the repeat ends at this
-- session, and this and later weeks come off the calendar.
create or replace function public.stop_live_repeat(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ls public.live_sessions;
  v_removed integer;
begin
  select * into ls from public.live_sessions where id = p_id and trainer_id = auth.uid() and status = 'booked';
  if ls.id is null or ls.repeat_id is null then
    raise exception 'Only a booked weekly session can be stopped for every week';
  end if;
  update public.live_repeats set ended_at = ls.starts_at, updated_at = now() where id = ls.repeat_id;
  update public.live_sessions
  set status = 'removed', updated_at = now()
  where repeat_id = ls.repeat_id and status = 'booked' and starts_at >= ls.starts_at;
  get diagnostics v_removed = row_count;
  return jsonb_build_object('removed', v_removed);
end;
$$;

-- Import with "same every week from now on": rows carry "repeat": true.
-- Otherwise as 0174.
create or replace function public.import_live_sessions(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_client uuid;
  v_name text;
  v_seen text;
  v_at timestamptz;
  p public.session_plans;
  s public.session_settings;
  v_added integer := 0;
  v_skipped integer := 0;
  v_future jsonb := '{}'::jsonb;
  v_count jsonb := '{}'::jsonb;
  v_weeks integer;
  v_id uuid;
  v_repeats integer := 0;
  k text;
  coach text;
begin
  if not public.not_unapproved_trainer() then
    raise exception 'Trainers only';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 400 then
    raise exception 'Send up to 400 sessions at a time';
  end if;
  select * into s from public.session_settings where trainer_id = auth.uid();
  if s.fee is null then
    raise exception 'Set a session fee first (Live sessions › Setup)';
  end if;

  -- Sessions a week for a new plan: each app client's sessions in this
  -- import over the weeks it covers.
  select greatest(1, count(distinct date_trunc('week', (e ->> 'starts_at')::timestamptz))) into v_weeks
  from jsonb_array_elements(p_rows) e;
  for r in select * from jsonb_array_elements(p_rows) loop
    if nullif(r ->> 'client_id', '') is not null then
      v_count := jsonb_set(v_count, array[r ->> 'client_id'], to_jsonb(coalesce((v_count ->> (r ->> 'client_id'))::int, 0) + 1));
    end if;
  end loop;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_client := nullif(r ->> 'client_id', '')::uuid;
    v_seen := left(btrim(coalesce(r ->> 'name', r ->> 'seen_name', '')), 60);
    v_name := null;
    v_at := (r ->> 'starts_at')::timestamptz;
    v_id := null;
    if v_client is null then
      select l.client_id into v_client from public.diary_name_links l
      where l.trainer_id = auth.uid() and l.name_key = public.diary_name_key(v_seen);
    end if;
    if v_client is not null then
      perform public.session_require_trainer(v_client);
      perform public.session_ensure_plan(v_client, ceil(coalesce((v_count ->> v_client::text)::numeric, 1) / v_weeks)::int);
      if public.diary_name_real(v_seen) then
        insert into public.diary_name_links (trainer_id, name_key, client_id)
        values (auth.uid(), public.diary_name_key(v_seen), v_client)
        on conflict (trainer_id, name_key) do update set client_id = excluded.client_id, updated_at = now();
      end if;
    else
      v_name := nullif(v_seen, '');
      if v_name is null then
        raise exception 'Every session needs a client or a name';
      end if;
    end if;
    select * into p from public.session_plans where client_id = v_client;
    select ls.id into v_id from public.live_sessions ls
    where ls.trainer_id = auth.uid() and ls.starts_at = v_at and ls.status <> 'removed'
      and (ls.client_id = v_client or (v_client is null and public.diary_name_key(ls.guest_name) = public.diary_name_key(v_name)))
    limit 1;
    if v_id is not null then
      v_skipped := v_skipped + 1;
    else
      insert into public.live_sessions (trainer_id, client_id, guest_name, starts_at, minutes, fee)
      values (auth.uid(), v_client, v_name, v_at,
              coalesce(nullif(r ->> 'minutes', '')::int, p.minutes, s.minutes, 60),
              coalesce(p.fee, s.fee))
      returning id into v_id;
      v_added := v_added + 1;
      if v_client is not null and v_at > now() then
        v_future := jsonb_set(v_future, array[v_client::text], to_jsonb(coalesce((v_future ->> v_client::text)::int, 0) + 1));
      end if;
    end if;
    if coalesce((r ->> 'repeat')::boolean, false) then
      perform public.live_repeat_for(v_id);
      v_repeats := v_repeats + 1;
    end if;
  end loop;
  if v_repeats > 0 then
    perform public.fill_live_repeats(auth.uid());
  end if;

  select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = auth.uid();
  for k in select jsonb_object_keys(v_future) loop
    perform public.push_to_user(
      k::uuid,
      '🤝 ' || (v_future ->> k) || case when (v_future ->> k)::int = 1 then ' session' else ' sessions' end || ' booked',
      coalesce(coach, 'Your coach') || ' added them to your calendar'
        || case when v_repeats > 0 then ', the same time every week' else '' end || '. Open My sessions to see them.',
      jsonb_build_object('type', 'live_session')
    );
  end loop;
  return jsonb_build_object('added', v_added, 'skipped', v_skipped, 'weekly', v_repeats);
end;
$$;

-- Linking a name to an app client takes the name's weekly repeats with it.
create or replace function public.live_repeats_follow_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.client_id is null and new.client_id is not null and old.repeat_id is not null then
    update public.live_repeats
    set client_id = new.client_id, guest_name = null, updated_at = now()
    where id = old.repeat_id and client_id is null;
  end if;
  return new;
end;
$$;
create or replace trigger live_repeats_follow_link
  after update of client_id on public.live_sessions
  for each row execute function public.live_repeats_follow_link();

revoke execute on function public.fill_live_repeats(uuid) from public, anon, authenticated;
revoke execute on function public.live_repeat_for(uuid) from public, anon, authenticated;
revoke execute on function public.live_repeats_follow_link() from public, anon, authenticated;
revoke execute on function public.repeat_live_session(uuid) from public, anon;
revoke execute on function public.move_live_repeat(uuid, timestamptz) from public, anon;
revoke execute on function public.stop_live_repeat(uuid) from public, anon;
revoke execute on function public.import_live_sessions(jsonb) from public, anon;
grant execute on function public.repeat_live_session(uuid) to authenticated;
grant execute on function public.move_live_repeat(uuid, timestamptz) to authenticated;
grant execute on function public.stop_live_repeat(uuid) to authenticated;
grant execute on function public.import_live_sessions(jsonb) to authenticated;

-- Every night, keep weekly sessions filled to the end of next month.
select cron.schedule('live-repeats-fill', '20 3 * * *', $$select public.fill_live_repeats();$$);
