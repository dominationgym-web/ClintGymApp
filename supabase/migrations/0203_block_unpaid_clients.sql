-- Block a client who hasn't paid (GRIZZ, 2026-11-08/09: "a block option for
-- those that don't pay"; picked "Hold their sessions (like Away)").
--
-- A block is a client_away row with unpaid = true and no end date (ten years
-- out). Like Away, every upcoming session of theirs stays on the calendar
-- with their name, marked "On hold: not paid" and free to book, and weekly
-- times that fill in later are held too. They aren't charged for held
-- sessions (charge 'credit'), and no catch-ups are owed. Unblock (tap the
-- button, or flip the invoice to Paid) books their sessions again, except
-- slots already given to someone else. No message is sent when holding:
-- the coach talks to the client.

alter table public.client_away add column if not exists unpaid boolean not null default false;

-- Puts one person on hold for a trainer (used by the button and the 14th).
create or replace function public.hold_client_for(p_trainer uuid, p_client uuid, p_guest text)
returns public.client_away
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
  gkey text := public.diary_name_key(p_guest);
  today date;
  b public.client_away;
begin
  select * into b from public.client_away
  where trainer_id = p_trainer and ended_at is null and unpaid
    and (case when p_client is not null then client_id = p_client else client_id is null and guest_key = gkey end)
  limit 1;
  if b.id is not null then
    return b;
  end if;
  tz := public.session_tz(p_trainer);
  today := (now() at time zone tz)::date;

  insert into public.client_away (trainer_id, client_id, guest_name, guest_key, from_on, from_at, until_on, until_at, unpaid)
  values (p_trainer, p_client, case when p_client is null then btrim(p_guest) end, case when p_client is null then gkey end,
          today, now(), today + 3650, ((today + 3651)::timestamp) at time zone tz, true)
  returning * into b;

  update public.live_sessions
  set status = 'cancelled', cancelled_by = 'client', cancelled_at = now(), logged_by = 'trainer',
      charge = 'credit', note = 'On hold: not paid',
      away_id = b.id, trainer_confirmed_at = null, asked_trainer = false, updated_at = now()
  where trainer_id = p_trainer and status = 'booked' and starts_at > now()
    and (case when p_client is not null then client_id = p_client else client_id is null and public.diary_name_key(guest_name) = gkey end);

  return b;
end;
$$;

-- The 🚫 Block button.
create or replace function public.block_client(p_client uuid, p_guest text)
returns public.client_away
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can put a client on hold';
  end if;
  if p_client is not null then
    perform public.session_require_trainer(p_client);
  elsif public.diary_name_key(p_guest) is null then
    raise exception 'Pick who to put on hold';
  end if;
  return public.hold_client_for(me, p_client, p_guest);
end;
$$;

-- Ends a hold: their sessions from now on are booked again.
create or replace function public.end_hold(p_hold uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.client_away;
  res jsonb;
begin
  select * into h from public.client_away where id = p_hold and ended_at is null and unpaid;
  if h.id is null then
    return jsonb_build_object('back', 0, 'taken', '[]'::jsonb);
  end if;
  res := public.client_away_restore(h.id);
  update public.client_away set ended_at = now() where id = h.id;
  if h.client_id is not null and (res ->> 'back')::int > 0 then
    perform public.push_to_user(
      h.client_id,
      '✅ Your sessions are booked again',
      'Thanks! Your coach has booked your sessions again.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return res;
end;
$$;

-- Unpaid invoices from December 2026 on (tracking started part-way through
-- November, GRIZZ 2026-11-08): a client, and anyone they pay for, whose
-- invoice for this month or before is still not paid on the 14th is put on
-- hold automatically (GRIZZ, 2026-11-09: "a 14th of the month cut off where
-- the app automatically blocks them. Then it's out of the trainer's hands").
-- Until then they keep training. The coach gets a heads-up on the 11th and a
-- list on the 14th. Diary names have no invoices, so only the button holds
-- them.
create or replace function public.unpaid_invoice_clients(p_trainer uuid, p_today date)
returns table (client_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.id, c.name
  from public.session_invoices i
  join public.clients c on c.id = i.client_id and c.archived_at is null
  where i.trainer_id = p_trainer and i.status <> 'paid' and i.total > 0
    and i.month >= date '2026-12-01' and i.month <= date_trunc('month', p_today)::date
$$;

create or replace function public.hold_unpaid_on_the_14th()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  tz text;
  today date;
  u record;
  names text[];
  p uuid;
begin
  for t in select distinct i.trainer_id from public.session_invoices i where i.status <> 'paid' and i.total > 0 and i.month >= date '2026-12-01'
  loop
    tz := public.session_tz(t.trainer_id);
    today := (now() at time zone tz)::date;
    if extract(day from today) not in (11, 14) then
      continue;
    end if;
    names := '{}';
    for u in select * from public.unpaid_invoice_clients(t.trainer_id, today) loop
      names := names || split_part(u.name, ' ', 1);
      if extract(day from today) = 14 then
        perform public.hold_client_for(t.trainer_id, u.client_id, null);
        for p in select sp.client_id from public.session_plans sp where sp.paid_by = u.client_id and sp.trainer_id = t.trainer_id loop
          perform public.hold_client_for(t.trainer_id, p, null);
        end loop;
      end if;
    end loop;
    if coalesce(array_length(names, 1), 0) = 0 then
      continue;
    end if;
    if extract(day from today) = 11 then
      perform public.push_to_user(
        t.trainer_id,
        '🧾 ' || array_length(names, 1) || case when array_length(names, 1) = 1 then ' client hasn''t paid yet' else ' clients haven''t paid yet' end,
        array_to_string(names, ', ') || '. On the 14th their sessions go on hold. Flip Paid in 1 on 1 › Invoices when the money comes in.',
        jsonb_build_object('type', 'live_session')
      );
    else
      perform public.push_to_user(
        t.trainer_id,
        '🚫 On hold today: not paid',
        array_to_string(names, ', ') || '. Their sessions are free to book. Flip Paid in Invoices and they''re booked again.',
        jsonb_build_object('type', 'live_session')
      );
    end if;
  end loop;
end;
$$;

-- Paid: once nothing is left unpaid, a hold ends by itself.
create or replace function public.set_session_invoice_paid(p_id uuid, p_paid boolean)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
  h public.client_away;
begin
  update public.session_invoices
  set status = case when p_paid then 'paid' when sent_at is not null then 'sent' else 'draft' end,
      paid_at = case when p_paid then now() else null end,
      updated_at = now()
  where id = p_id and trainer_id = auth.uid() and (select public.not_unapproved_trainer())
  returning * into inv;
  if inv.id is null then
    raise exception 'Invoice not found';
  end if;
  if p_paid and not exists (
    select 1 from public.session_invoices i
    where i.client_id = inv.client_id and i.status <> 'paid' and i.total > 0 and i.month >= date '2026-12-01'
  ) then
    for h in
      select a.* from public.client_away a
      where a.trainer_id = inv.trainer_id and a.ended_at is null and a.unpaid
        and (a.client_id = inv.client_id
             or a.client_id in (select sp.client_id from public.session_plans sp where sp.paid_by = inv.client_id))
    loop
      perform public.end_hold(h.id);
    end loop;
  end if;
  return inv;
end;
$$;

-- Unblock and Back early: a different message once they've paid.
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
    raise exception 'That''s already ended';
  end if;
  res := public.client_away_restore(away.id);
  update public.client_away set ended_at = now() where id = away.id;
  if away.client_id is not null and (res ->> 'back')::int > 0 then
    perform public.push_to_user(
      away.client_id,
      case when away.unpaid then '✅ Your sessions are booked again' else '🤝 Welcome back' end,
      case when away.unpaid then 'Thanks! Your coach has booked your sessions again.' else 'Your coach has booked your sessions again.' end,
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return res;
end;
$$;

-- An Away never replaces (and so never undoes) a block.
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
      and not unpaid
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

-- Weekly times filling in while they're on hold are held too.
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
  order by a.unpaid desc, a.created_at desc
  limit 1;
  if away.id is not null then
    new.status := 'cancelled';
    new.cancelled_by := 'client';
    new.cancelled_at := now();
    new.logged_by := 'trainer';
    if away.unpaid then
      new.charge := 'credit';
      new.note := 'On hold: not paid';
    else
      new.charge := 'makeup';
      new.note := 'Away from ' || to_char(coalesce(away.from_on, away.created_at::date), 'FMDD FMMonth')
        || ' until ' || to_char(away.until_on, 'FMDD FMMonth');
    end if;
    new.away_id := away.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.live_session_mark_away() from public, anon, authenticated;
revoke execute on function public.hold_client_for(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.end_hold(uuid) from public, anon, authenticated;
revoke execute on function public.unpaid_invoice_clients(uuid, date) from public, anon, authenticated;
revoke execute on function public.hold_unpaid_on_the_14th() from public, anon, authenticated;
revoke execute on function public.block_client(uuid, text) from public, anon;
grant execute on function public.block_client(uuid, text) to authenticated;
revoke execute on function public.set_client_away(uuid, text, date, date, uuid) from public, anon;
grant execute on function public.set_client_away(uuid, text, date, date, uuid) to authenticated;
revoke execute on function public.end_client_away(uuid) from public, anon;
grant execute on function public.end_client_away(uuid) to authenticated;

select cron.schedule('hold-unpaid-14th', '0 7 * * *', $$select public.hold_unpaid_on_the_14th();$$);
