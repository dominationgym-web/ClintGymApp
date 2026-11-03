-- Catch-ups for people who aren't in the app (GRIZZ, 2026-11-03: "Trying to
-- book Sharde catchup session. Not allowing me to complete the booking.").
-- Cancellations work for diary names since 0180, so they can owe a catch-up,
-- but add_live_session books app clients only. This books the catch-up by
-- the cancelled session's name and links the two, with the same price rule:
-- free for the client's own in-time cancellation, the normal fee when the
-- coach cancelled.

create or replace function public.add_diary_catch_up(p_makeup_for uuid, p_starts_at timestamptz, p_minutes integer)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  o public.live_sessions;
  saved public.live_sessions;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can book a catch-up';
  end if;
  select * into o from public.live_sessions
  where id = p_makeup_for and trainer_id = me and client_id is null and charge = 'makeup' and makeup_session_id is null;
  if o.id is null then
    raise exception 'That catch-up has already been booked';
  end if;
  insert into public.live_sessions (trainer_id, client_id, guest_name, starts_at, minutes, fee, makeup_for)
  values (me, null, o.guest_name, p_starts_at, coalesce(o.minutes, p_minutes, 60),
          case when o.cancelled_by = 'trainer' then o.fee else 0 end, o.id)
  returning * into saved;
  update public.live_sessions set makeup_session_id = saved.id, updated_at = now() where id = o.id;
  return saved;
end;
$$;

revoke execute on function public.add_diary_catch_up(uuid, timestamptz, integer) from public, anon;
grant execute on function public.add_diary_catch_up(uuid, timestamptz, integer) to authenticated;
