-- Tidy catch-up slots (GRIZZ 2026-11-16). Steven was away at Mon 07:10, so
-- Daniel went in as a catch-up. The first try was a normal booking; it was
-- cancelled, then the catch-up booked properly, and the slot showed three
-- names: Daniel, Daniel, Steven.
--
-- 1. Booking someone at a time where they already have a free cancellation
--    (credit, nothing charged, not on an invoice) takes that cancellation off
--    the calendar: they're training then after all, so it's replaced.
-- 2. make_session_catch_up turns a normal booking into the catch-up a client
--    is owed, in place, so a booking made the wrong way never needs
--    cancelling and rebooking.

create or replace function public.live_sessions_replace_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_sessions o
  set status = 'removed', charge = null, cancelled_by = null, cancelled_at = null, updated_at = now()
  where o.trainer_id = new.trainer_id
    and o.starts_at = new.starts_at
    and o.id <> new.id
    and o.status = 'cancelled'
    and (o.charge is null or o.charge = 'credit')
    and o.invoice_id is null
    and o.credit_invoice_id is null
    and o.away_id is null
    and o.stop_id is null
    and o.makeup_session_id is null
    and (
      (new.client_id is not null and o.client_id = new.client_id)
      or (new.client_id is null and o.client_id is null
          and lower(trim(coalesce(o.guest_name, ''))) = lower(trim(coalesce(new.guest_name, '')))
          and coalesce(new.guest_name, '') <> '')
    );
  return new;
end;
$$;

create or replace trigger live_sessions_replace_cancelled
  after insert on public.live_sessions
  for each row
  when (new.status = 'booked')
  execute function public.live_sessions_replace_cancelled();

revoke execute on function public.live_sessions_replace_cancelled() from public, anon, authenticated;

create or replace function public.make_session_catch_up(p_id uuid, p_makeup_for uuid)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  s public.live_sessions;
  o public.live_sessions;
  p public.session_plans;
  st public.session_settings;
  joint boolean;
  price numeric;
  saved public.live_sessions;
begin
  select * into s from public.live_sessions
  where id = p_id and trainer_id = me and status = 'booked' and makeup_for is null;
  if s.id is null then
    raise exception 'Only a booked session that isn''t a catch-up already can be changed';
  end if;
  select * into o from public.live_sessions
  where id = p_makeup_for and trainer_id = me and charge = 'makeup' and makeup_session_id is null
    and status in ('cancelled', 'no_show')
    and ((s.client_id is not null and client_id = s.client_id)
      or (s.client_id is null and client_id is null
          and lower(trim(coalesce(guest_name, ''))) = lower(trim(coalesce(s.guest_name, '')))));
  if o.id is null then
    raise exception 'That catch-up has already been booked';
  end if;
  -- Same price rule as Book the catch-up (GRIZZ 2026-11-03): a joint
  -- session's catch-up is a full normal slot, the coach's own cancellation
  -- keeps the missed price, otherwise free.
  joint := exists (
    select 1 from public.live_sessions x
    where x.trainer_id = me and x.starts_at = o.starts_at and x.id <> o.id and x.status <> 'removed'
  );
  if joint then
    select * into p from public.session_plans where client_id = o.client_id;
    select * into st from public.session_settings where trainer_id = me;
    price := coalesce(p.solo_fee, case when coalesce(p.group_size, 1) > 1 then null else p.fee end, st.fee, o.fee, 0);
  elsif o.cancelled_by = 'trainer' then
    price := coalesce(o.fee, 0);
  else
    price := 0;
  end if;
  update public.live_sessions
  set makeup_for = o.id, fee = case when invoice_id is null then price else fee end, updated_at = now()
  where id = s.id
  returning * into saved;
  update public.live_sessions set makeup_session_id = s.id, updated_at = now() where id = o.id;
  return saved;
end;
$$;

revoke execute on function public.make_session_catch_up(uuid, uuid) from public, anon;
grant execute on function public.make_session_catch_up(uuid, uuid) to authenticated;
