-- Weekly sessions show months ahead (GRIZZ, 2026-11-25: "populate the
-- calendar months ahead based on existing clients and then delete clients
-- ahead as we go forward"). Until now fill_live_repeats() only filled to the
-- end of next month, so January was empty in late November. It now fills
-- to the end of the 6th month after this one (late Nov -> end of May), and
-- the nightly cron keeps rolling it on. Taking a client off ahead is the
-- existing 🛑 Stopped training with you (0207) or "This and every week
-- after" (0175), which clear every future week, however far out.

create or replace function public.live_fill_until(tz text)
returns date
language sql
stable
set search_path = public
as $$
  select (date_trunc('month', now() at time zone tz) + interval '7 months' - interval '1 day')::date;
$$;

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
    select coalesce(p.fee, f.fee, s.fee, 0) into v_fee
    from public.session_settings s
    left join public.session_plans p on p.client_id = r.client_id
    left join public.diary_name_fees f
      on r.client_id is null and f.trainer_id = r.trainer_id and f.name_key = public.diary_name_key(r.guest_name)
    where s.trainer_id = r.trainer_id;
    for d in
      select g::date from generate_series(
        greatest((now() at time zone tz)::date, r.starts_on)::timestamp,
        public.live_fill_until(tz)::timestamp,
        interval '1 day'
      ) g
    loop
      continue when extract(dow from d) <> r.weekday;
      v_at := (d + r.at_time) at time zone tz;
      continue when v_at <= now();
      continue when r.ended_at is not null and v_at >= r.ended_at;
      -- The coach blocked that time out (0177).
      continue when exists (
        select 1 from public.trainer_time_off b
        where b.trainer_id = r.trainer_id and b.removed_at is null and v_at >= b.starts_at and v_at < b.ends_at
      );
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

-- A 1 on 1 plan's regular times (0168, 0178) fill to the same horizon.
create or replace function public.fill_regular_sessions(p_client uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.session_plans;
  tz text;
  slot jsonb;
  d date;
  v_at timestamptz;
  added integer := 0;
  n integer;
begin
  select * into p from public.session_plans where client_id = p_client;
  if not found or not p.active then
    return 0;
  end if;
  tz := public.session_tz(p.trainer_id);
  for slot in select * from jsonb_array_elements(p.regular) loop
    -- A weekly repeat at this day and time books it (0175). One the coach
    -- stopped or moved ("This and every week after") after the plan was
    -- saved must not be brought back by the plan's time, now that the
    -- calendar fills months ahead. Saving the plan again books it again.
    continue when exists (
      select 1 from public.live_repeats lr
      where lr.client_id = p.client_id and lr.weekday = (slot ->> 'weekday')::int
        and lr.at_time = (slot ->> 'time')::time
        and (lr.ended_at is null or lr.ended_at > now() or lr.ended_at > p.updated_at)
    );
    for d in
      select g::date from generate_series(
        (now() at time zone tz)::date::timestamp,
        public.live_fill_until(tz)::timestamp,
        interval '1 day'
      ) g
    loop
      continue when extract(dow from d) <> (slot ->> 'weekday')::int;
      v_at := (d + (slot ->> 'time')::time) at time zone tz;
      continue when v_at <= now();
      -- Already on the calendar at that time (weekly repeat, import, by hand).
      continue when exists (
        select 1 from public.live_sessions ls
        where ls.client_id = p.client_id and ls.starts_at = v_at and ls.status <> 'removed'
      );
      -- The coach blocked that time out (0177).
      continue when exists (
        select 1 from public.trainer_time_off b
        where b.trainer_id = p.trainer_id and b.removed_at is null and v_at >= b.starts_at and v_at < b.ends_at
      );
      insert into public.live_sessions (trainer_id, client_id, starts_at, minutes, fee, regular_at)
      values (p.trainer_id, p.client_id, v_at, p.minutes, p.fee, v_at)
      on conflict (client_id, regular_at) where regular_at is not null do nothing;
      get diagnostics n = row_count;
      added := added + n;
    end loop;
  end loop;
  return added;
end;
$$;

revoke execute on function public.fill_live_repeats(uuid) from public, anon, authenticated;
revoke execute on function public.fill_regular_sessions(uuid) from public, anon, authenticated;
grant execute on function public.live_fill_until(text) to authenticated;

-- Fill everyone's weekly sessions to the new horizon now.
select public.fill_live_repeats();
select public.fill_regular_sessions(sp.client_id) from public.session_plans sp where sp.active;
