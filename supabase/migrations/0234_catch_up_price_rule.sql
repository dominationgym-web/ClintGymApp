-- Catch-up price rule, same as the app (src/lib/catchUpPrice.ts): the client
-- pays once for each session (GRIZZ 2026-11-22: Jordan's catch-up came up as
-- R750, the trainer's default price, when his rate is R650, because another
-- client trained at the time of the catch-up he missed).
-- - The trainer cancelled the missed session: it isn't charged, so the
--   catch-up keeps its price.
-- - A pair with an alone price (app plan or diary plan): the alone price.
-- - Otherwise free: the missed session stays on the invoice.
-- Someone else in the same slot no longer counts as a joint session, and a
-- free catch-up that was itself missed follows back to the session it was for.

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
  r public.live_sessions;
  nxt public.live_sessions;
  hops integer := 0;
  v_size integer;
  v_solo numeric;
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

  -- The session the money hangs on.
  r := o;
  while r.makeup_for is not null and coalesce(r.fee, 0) = 0 and hops < 10 loop
    select * into nxt from public.live_sessions where id = r.makeup_for and trainer_id = me;
    exit when nxt.id is null;
    r := nxt;
    hops := hops + 1;
  end loop;

  if o.client_id is not null then
    select sp.group_size, sp.solo_fee into v_size, v_solo from public.session_plans sp where sp.client_id = o.client_id;
  else
    select f.group_size, f.solo_fee into v_size, v_solo from public.diary_name_fees f
    where f.trainer_id = me and f.name_key = public.diary_name_key(o.guest_name);
  end if;

  if r.cancelled_by = 'trainer' then
    price := coalesce(r.fee, 0);
  elsif coalesce(v_size, 1) > 1 and v_solo is not null then
    price := v_solo;
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
