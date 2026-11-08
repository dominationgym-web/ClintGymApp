-- Away goes on the catch-up list (GRIZZ, 2026-11-08: "If clients travel I
-- think always put them on the catchup list. Then before the end of the month
-- the trainer can decide who carries catchups over or gets credited.").
--
-- Sessions taken off for an away are now charge 'makeup' (a catch-up owed)
-- instead of 'credit'. The month-end rules from 0181 then ask the coach to
-- pick Credit or Next month for any not caught up, before invoicing.
-- Aways already set keep what they had.

create or replace function public.set_client_away(p_client uuid, p_guest text, p_from date, p_until date, p_replace uuid)
returns public.client_away
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  tz text;
  gkey text := public.diary_name_key(p_guest);
  today date;
  v_from date;
  v_from_at timestamptz;
  v_until_at timestamptz;
  away public.client_away;
  old public.client_away;
  n integer := 0;
  span_text text;
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
  today := (now() at time zone tz)::date;
  v_from := greatest(coalesce(p_from, today), today);
  if p_until < today then
    raise exception 'Pick today or a day after today';
  end if;
  if p_until < v_from then
    raise exception 'The last day has to be on or after the first day';
  end if;
  if p_until > today + 365 then
    raise exception 'Pick a day within a year';
  end if;
  v_from_at := (v_from::timestamp) at time zone tz;
  v_until_at := ((p_until + 1)::timestamp) at time zone tz;

  -- The away being changed, and any of theirs this one overlaps: their
  -- sessions come back first.
  for old in
    select * from public.client_away
    where trainer_id = me and ended_at is null and until_at > now()
      and (case when p_client is not null then client_id = p_client else client_id is null and guest_key = gkey end)
      and (id = p_replace or (coalesce(from_at, created_at) < v_until_at and until_at > v_from_at))
  loop
    perform public.client_away_restore(old.id);
    update public.client_away set ended_at = now() where id = old.id;
  end loop;

  insert into public.client_away (trainer_id, client_id, guest_name, guest_key, from_on, from_at, until_on, until_at)
  values (me, p_client, case when p_client is null then btrim(p_guest) end, case when p_client is null then gkey end,
          v_from, v_from_at, p_until, v_until_at)
  returning * into away;

  -- "Away until 13 November" keeps the app's "Away till 13 Nov" label.
  span_text := case when v_from = p_until then to_char(p_until, 'FMDD FMMonth')
                    else to_char(v_from, 'FMDD FMMonth') || ' until ' || to_char(p_until, 'FMDD FMMonth') end;

  select count(*) into n
  from public.live_sessions
  where trainer_id = me and status = 'booked' and starts_at > now() and starts_at >= v_from_at and starts_at < v_until_at
    and (case when p_client is not null then client_id = p_client else client_id is null and public.diary_name_key(guest_name) = gkey end);

  update public.live_sessions
  set status = 'cancelled', cancelled_by = 'client', cancelled_at = now(), logged_by = 'trainer',
      charge = 'makeup', note = 'Away from ' || to_char(v_from, 'FMDD FMMonth') || ' until ' || to_char(p_until, 'FMDD FMMonth'),
      away_id = away.id, trainer_confirmed_at = null, asked_trainer = false, updated_at = now()
  where trainer_id = me and status = 'booked' and starts_at > now() and starts_at >= v_from_at and starts_at < v_until_at
    and (case when p_client is not null then client_id = p_client else client_id is null and public.diary_name_key(guest_name) = gkey end);

  if p_client is not null and n > 0 then
    perform public.push_to_user(
      p_client,
      '✈️ Enjoy your time away',
      'Your coach has taken off your ' || case when n = 1 then 'session' else n || ' sessions' end
        || case when v_from = p_until then ' on ' else ' from ' end || span_text
        || '. Your coach will sort out catch-up' || case when n = 1 then '' else 's' end || ' with you.',
      jsonb_build_object('type', 'live_session')
    );
  end if;

  return away;
end;
$$;

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
    and new.starts_at >= coalesce(a.from_at, a.created_at) and new.starts_at < a.until_at
    and (case when new.client_id is not null then a.client_id = new.client_id
              else a.client_id is null and a.guest_key = public.diary_name_key(new.guest_name) end)
  order by a.created_at desc
  limit 1;
  if away.id is not null then
    new.status := 'cancelled';
    new.cancelled_by := 'client';
    new.cancelled_at := now();
    new.logged_by := 'trainer';
    new.charge := 'makeup';
    new.note := 'Away from ' || to_char(coalesce(away.from_on, away.created_at::date), 'FMDD FMMonth')
      || ' until ' || to_char(away.until_on, 'FMDD FMMonth');
    new.away_id := away.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.live_session_mark_away() from public, anon, authenticated;
revoke execute on function public.set_client_away(uuid, text, date, date, uuid) from public, anon;
grant execute on function public.set_client_away(uuid, text, date, date, uuid) to authenticated;
