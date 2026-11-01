-- Trainer time off (GRIZZ, 2026-11-01: "if the trainer is away or misses
-- sessions he can block it out on his calendar with an explanation that goes
-- to the clients. This automatically calculates missed sessions and cost").
-- Blocking a time cancels every booked session in it as cancelled by the
-- coach (never charged, credited on an invoice already sent), tells each
-- client once with the coach's reason, and keeps weekly repeats from booking
-- into it later. GRIZZ: "always try and slot in clients for catch-ups in
-- that situation", so each app client's session goes on the coach's
-- catch-up list, and the catch-up is charged at the normal fee (the missed
-- session wasn't).

create table if not exists public.trainer_time_off (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  missed integer not null default 0,
  missed_fees numeric(10, 2) not null default 0,
  -- Taken off the calendar by the coach (kept for the record).
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists trainer_time_off_trainer_idx on public.trainer_time_off (trainer_id, starts_at);

alter table public.trainer_time_off enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'trainer_time_off' and policyname = 'trainer_time_off_read') then
    create policy trainer_time_off_read on public.trainer_time_off
      for select to authenticated using (trainer_id = (select auth.uid()));
  end if;
end $$;

create or replace function public.block_trainer_time(p_from timestamptz, p_to timestamptz, p_reason text)
returns public.trainer_time_off
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  tz text;
  why text := left(btrim(coalesce(p_reason, '')), 300);
  block public.trainer_time_off;
  c record;
  v_missed integer := 0;
  v_fees numeric := 0;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can block out time';
  end if;
  if p_to <= p_from then
    raise exception 'The end has to be after the start';
  end if;
  if p_to - p_from > interval '92 days' then
    raise exception 'Block out at most three months at a time';
  end if;
  if why = '' then
    raise exception 'Add a short reason for your clients';
  end if;
  tz := public.session_tz(me);

  select count(*), coalesce(sum(fee), 0) into v_missed, v_fees
  from public.live_sessions
  where trainer_id = me and status = 'booked' and starts_at >= p_from and starts_at < p_to;

  insert into public.trainer_time_off (trainer_id, starts_at, ends_at, reason, missed, missed_fees)
  values (me, p_from, p_to, why, v_missed, v_fees)
  returning * into block;

  -- One message per client, listing how many of their sessions are off.
  for c in
    select client_id, count(*) as n, min(starts_at) as first_at
    from public.live_sessions
    where trainer_id = me and status = 'booked' and starts_at >= p_from and starts_at < p_to and client_id is not null
    group by client_id
  loop
    perform public.push_to_user(
      c.client_id,
      case when c.n = 1
        then 'Your coach cancelled ' || public.video_checkin_when(c.first_at, tz)
        else 'Your coach cancelled ' || c.n || ' sessions'
      end,
      why || ' You won''t be charged for ' || case when c.n = 1 then 'it' else 'them' end || ', and your coach will find you a catch-up time.',
      jsonb_build_object('type', 'live_session')
    );
  end loop;

  update public.live_sessions
  set status = 'cancelled', cancelled_by = 'trainer', cancelled_at = now(), logged_by = 'trainer',
      charge = case when client_id is null then 'credit' else 'makeup' end, note = left('Coach away: ' || why, 500),
      trainer_confirmed_at = null, asked_trainer = false, updated_at = now()
  where trainer_id = me and status = 'booked' and starts_at >= p_from and starts_at < p_to;

  return block;
end;
$$;

-- Takes the block off the calendar. Sessions it cancelled stay cancelled:
-- book them again by hand. Weekly repeats fill that time again from tonight.
create or replace function public.remove_trainer_time_off(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.trainer_time_off set removed_at = now() where id = p_id and trainer_id = auth.uid();
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

revoke execute on function public.block_trainer_time(timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.remove_trainer_time_off(uuid) from public, anon;
grant execute on function public.block_trainer_time(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.remove_trainer_time_off(uuid) to authenticated;
revoke execute on function public.fill_live_repeats(uuid) from public, anon, authenticated;

-- A catch-up for a session the coach missed is paid at that session's fee
-- (the missed one wasn't charged). A catch-up for a client's in-time
-- cancellation stays free, as before (0168).
create or replace function public.add_live_session(p_client uuid, p_starts_at timestamptz, p_minutes integer default null, p_makeup_for uuid default null)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.session_plans;
  s public.session_settings;
  o public.live_sessions;
  saved public.live_sessions;
begin
  perform public.session_require_trainer(p_client);
  select * into p from public.session_plans where client_id = p_client;
  select * into s from public.session_settings where trainer_id = auth.uid();
  if p.client_id is null and s.fee is null then
    raise exception 'Set this client''s session fee first';
  end if;
  if p_makeup_for is not null then
    select * into o from public.live_sessions
    where id = p_makeup_for and client_id = p_client and charge = 'makeup' and makeup_session_id is null;
    if o.id is null then
      raise exception 'That catch-up has already been booked';
    end if;
  end if;
  insert into public.live_sessions (trainer_id, client_id, starts_at, minutes, fee, makeup_for)
  values (auth.uid(), p_client, p_starts_at, coalesce(p_minutes, p.minutes, s.minutes, 60),
          case when p_makeup_for is null then coalesce(p.fee, s.fee)
               when o.cancelled_by = 'trainer' then o.fee
               else 0 end, p_makeup_for)
  returning * into saved;
  if p_makeup_for is not null then
    update public.live_sessions set makeup_session_id = saved.id, updated_at = now() where id = p_makeup_for;
  end if;
  if p_starts_at > now() then
    perform public.push_to_user(
      p_client,
      case when p_makeup_for is null then '🤝 Session booked' else '🤝 Catch-up session booked' end,
      public.video_checkin_when(p_starts_at, public.session_tz(auth.uid())) || ' with your coach.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return saved;
end;
$$;
