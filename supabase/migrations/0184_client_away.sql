-- A 1 on 1 client going away (GRIZZ, 2026-11-02: "they're going away for 2
-- weeks ... you click away and it brings up a calendar ... every session up
-- until that date must switch to green. The name stays there ... meaning
-- it's available to book").
--
-- The coach picks the last day they're away. Every booked session of theirs
-- from now until the end of that day is cancelled in time (credited, never
-- charged, no catch-up owed) and remembers the away it belongs to, so the
-- calendar keeps their name on the slot and shows it green: free to book.
-- Weekly repeats and regular times that fill in later during the away are
-- marked away the same way. "Back early" books their sessions again from
-- now, except where the coach has already given the slot to someone else.

create table if not exists public.client_away (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  -- An app client, or a diary-only name (0174) when client_id is null.
  client_id uuid references public.clients (id) on delete cascade,
  guest_name text,
  guest_key text,
  -- The last day they're away, and the end of it in the coach's time zone.
  until_on date not null,
  until_at timestamptz not null,
  -- Ended early with "Back early", or replaced by a new date.
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (client_id is not null or guest_key is not null)
);
create index if not exists client_away_trainer_idx on public.client_away (trainer_id, until_at);

alter table public.client_away enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'client_away' and policyname = 'client_away_read') then
    create policy client_away_read on public.client_away
      for select to authenticated using (trainer_id = (select auth.uid()) or client_id = (select auth.uid()));
  end if;
end $$;

alter table public.live_sessions add column if not exists away_id uuid references public.client_away (id) on delete set null;

-- Puts back the sessions an away cancelled from now on, unless the slot has
-- been given to someone else. Returns how many came back and the times that
-- didn't.
create or replace function public.client_away_restore(p_away uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_sessions;
  back integer := 0;
  taken jsonb := '[]'::jsonb;
  a public.client_away;
begin
  select * into a from public.client_away where id = p_away;
  for s in
    select * from public.live_sessions
    where away_id = p_away and status = 'cancelled' and starts_at > now()
    order by starts_at
  loop
    if exists (
      select 1 from public.live_sessions o
      where o.trainer_id = s.trainer_id and o.id <> s.id and o.status = 'booked'
        and o.starts_at < s.starts_at + make_interval(mins => s.minutes)
        and o.starts_at + make_interval(mins => o.minutes) > s.starts_at
        -- Booked by the coach after they went away: someone took the slot.
        -- (A weekly time of someone they train with doesn't count.)
        and o.created_at > a.created_at
        and not (o.starts_at = s.starts_at and (o.repeat_id is not null or o.regular_at is not null))
    ) then
      taken := taken || to_jsonb(s.starts_at);
      continue;
    end if;
    update public.live_sessions
    set status = 'booked', cancelled_by = null, cancelled_at = null, logged_by = null, charge = null,
        note = null, away_id = null, updated_at = now()
    where id = s.id;
    back := back + 1;
  end loop;
  return jsonb_build_object('back', back, 'taken', taken);
end;
$$;

create or replace function public.set_client_away(p_client uuid, p_guest text, p_until date)
returns public.client_away
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  tz text;
  gkey text := public.diary_name_key(p_guest);
  away public.client_away;
  old public.client_away;
  n integer := 0;
  first_at timestamptz;
  until_text text;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can mark a client away';
  end if;
  if p_client is not null then
    perform public.session_require_trainer(p_client);
  elsif gkey is null then
    raise exception 'Pick who is away';
  end if;
  tz := public.session_tz(me);
  if p_until < (now() at time zone tz)::date then
    raise exception 'Pick today or a day after today';
  end if;
  if p_until > (now() at time zone tz)::date + 365 then
    raise exception 'Pick a day within a year';
  end if;

  -- A new date replaces the old one: their sessions come back first.
  for old in
    select * from public.client_away
    where trainer_id = me and ended_at is null and until_at > now()
      and (case when p_client is not null then client_id = p_client else client_id is null and guest_key = gkey end)
  loop
    perform public.client_away_restore(old.id);
    update public.client_away set ended_at = now() where id = old.id;
  end loop;

  insert into public.client_away (trainer_id, client_id, guest_name, guest_key, until_on, until_at)
  values (me, p_client, case when p_client is null then btrim(p_guest) end, case when p_client is null then gkey end,
          p_until, ((p_until + 1)::timestamp) at time zone tz)
  returning * into away;

  until_text := to_char(p_until, 'FMDD FMMonth');

  select count(*), min(starts_at) into n, first_at
  from public.live_sessions
  where trainer_id = me and status = 'booked' and starts_at > now() and starts_at < away.until_at
    and (case when p_client is not null then client_id = p_client else client_id is null and public.diary_name_key(guest_name) = gkey end);

  update public.live_sessions
  set status = 'cancelled', cancelled_by = 'client', cancelled_at = now(), logged_by = 'trainer',
      charge = 'credit', note = 'Away until ' || until_text, away_id = away.id,
      trainer_confirmed_at = null, asked_trainer = false, updated_at = now()
  where trainer_id = me and status = 'booked' and starts_at > now() and starts_at < away.until_at
    and (case when p_client is not null then client_id = p_client else client_id is null and public.diary_name_key(guest_name) = gkey end);

  if p_client is not null and n > 0 then
    perform public.push_to_user(
      p_client,
      '✈️ Enjoy your time away',
      'Your coach has taken off your ' || case when n = 1 then 'session' else n || ' sessions' end
        || ' until ' || until_text || '. You won''t be charged for ' || case when n = 1 then 'it' else 'them' end || '.',
      jsonb_build_object('type', 'live_session')
    );
  end if;

  return away;
end;
$$;

-- "Back early": ends the away now and books their sessions again.
create or replace function public.end_client_away(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  away public.client_away;
  res jsonb;
begin
  select * into away from public.client_away where id = p_id and trainer_id = auth.uid() and ended_at is null;
  if away.id is null then
    raise exception 'They''re not marked away any more';
  end if;
  res := public.client_away_restore(away.id);
  update public.client_away set ended_at = now() where id = away.id;
  if away.client_id is not null and (res ->> 'back')::int > 0 then
    perform public.push_to_user(
      away.client_id,
      '🤝 Welcome back',
      'Your coach has booked your sessions again.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return res;
end;
$$;

-- Weekly repeats (0175) and regular times (0168/0178) filling in a time while
-- the person is away: keep their name on it, marked away and free to book.
create or replace function public.live_session_mark_away()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  away public.client_away;
begin
  if new.status <> 'booked' or (new.repeat_id is null and new.regular_at is null and new.repeat_at is null) then
    return new;
  end if;
  select * into away from public.client_away a
  where a.trainer_id = new.trainer_id and a.ended_at is null
    and new.starts_at >= a.created_at and new.starts_at < a.until_at
    and (case when new.client_id is not null then a.client_id = new.client_id
              else a.client_id is null and a.guest_key = public.diary_name_key(new.guest_name) end)
  order by a.created_at desc
  limit 1;
  if away.id is not null then
    new.status := 'cancelled';
    new.cancelled_by := 'client';
    new.cancelled_at := now();
    new.logged_by := 'trainer';
    new.charge := 'credit';
    new.note := 'Away until ' || to_char(away.until_on, 'FMDD FMMonth');
    new.away_id := away.id;
  end if;
  return new;
end;
$$;

create or replace trigger live_session_mark_away
  before insert on public.live_sessions
  for each row execute function public.live_session_mark_away();

revoke execute on function public.client_away_restore(uuid) from public, anon, authenticated;
revoke execute on function public.live_session_mark_away() from public, anon, authenticated;
revoke execute on function public.set_client_away(uuid, text, date) from public, anon;
revoke execute on function public.end_client_away(uuid) from public, anon;
grant execute on function public.set_client_away(uuid, text, date) to authenticated;
grant execute on function public.end_client_away(uuid) to authenticated;
