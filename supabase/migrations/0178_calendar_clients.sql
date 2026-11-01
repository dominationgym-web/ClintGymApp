-- 1 on 1 Clients from the calendar (GRIZZ, 2026-11-01: "Can the app not
-- extrapolate their training times and days from the downloaded screenshot
-- and calendar?").
--
-- 1. A price for people who are only names in the diary (0174), so each one
--    can be charged differently: diary_name_fees, set_diary_fee() (also
--    updates their booked sessions), and weekly repeats use it.
-- 2. Regular times filled in from the calendar: a client's
-- sessions are often already booked from a calendar import (weekly repeats).
-- Saving their plan with those same days and times must not book them twice,
-- so filling regular times skips any time that client already has booked.

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
    for d in
      select g::date from generate_series(
        (now() at time zone tz)::date::timestamp,
        (date_trunc('month', now() at time zone tz) + interval '2 months' - interval '1 day')::date::timestamp,
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

revoke execute on function public.fill_regular_sessions(uuid) from public, anon, authenticated;

create table if not exists public.diary_name_fees (
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  name_key text not null check (char_length(name_key) between 1 and 60),
  fee numeric(10, 2) not null check (fee >= 0 and fee <= 100000),
  updated_at timestamptz not null default now(),
  primary key (trainer_id, name_key)
);
alter table public.diary_name_fees enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'diary_name_fees' and policyname = 'diary_name_fees_read') then
    create policy diary_name_fees_read on public.diary_name_fees
      for select to authenticated using (trainer_id = (select auth.uid()));
  end if;
end $$;

-- The coach sets what a diary-only person pays per session. Their sessions
-- from now on (booked, not yet invoiced) take the new price.
create or replace function public.set_diary_fee(p_name text, p_fee numeric)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  k text := public.diary_name_key(p_name);
  n integer;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can set a price';
  end if;
  if k is null then
    raise exception 'Who is this for?';
  end if;
  if p_fee is null or p_fee < 0 or p_fee > 100000 then
    raise exception 'Type a price per session';
  end if;
  insert into public.diary_name_fees (trainer_id, name_key, fee, updated_at)
  values (me, k, p_fee, now())
  on conflict (trainer_id, name_key) do update set fee = excluded.fee, updated_at = now();
  update public.live_sessions
  set fee = p_fee, updated_at = now()
  where trainer_id = me and client_id is null and public.diary_name_key(guest_name) = k
    and status = 'booked' and invoice_id is null and starts_at > now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
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
        (date_trunc('month', now() at time zone tz) + interval '2 months' - interval '1 day')::date::timestamp,
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

revoke execute on function public.set_diary_fee(text, numeric) from public, anon;
grant execute on function public.set_diary_fee(text, numeric) to authenticated;
revoke execute on function public.fill_live_repeats(uuid) from public, anon, authenticated;
