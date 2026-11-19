-- A client put back into a session they were marked out of (GRIZZ
-- 2026-11-19: "Sharde wasn't supposed to train today but then she decided to
-- train ... it doesn't give me an option to remove that catchup. Would be
-- better if the app automatically checks").
--
-- When a missed session (cancelled / no-show / away) comes back to booked or
-- done, the catch-up list already drops it (its charge goes back to null).
-- What stayed behind was a catch-up session already booked for it. Now:
--   1. If they still owe another catch-up, the booked catch-up counts for
--      that one instead (oldest first).
--   2. Otherwise a catch-up still to come comes off the calendar (the slot
--      turns green), and one that already happened stays as a normal extra
--      session (no Catch-up tag).
--
-- Also: a catch-up session taken off the calendar puts the missed session
-- back on the catch-up list (it used to stay "catch-up booked" for a session
-- that no longer existed).

create or replace function public.live_sessions_catch_up_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.live_sessions;
  other uuid;
begin
  -- The catch-up itself came off the calendar: the missed session is owed again.
  if new.status = 'removed' and old.status <> 'removed' and new.makeup_for is not null then
    update public.live_sessions
    set makeup_session_id = null, updated_at = now()
    where id = new.makeup_for and makeup_session_id = new.id;
    return null;
  end if;

  -- A missed session came back (they trained after all).
  if old.status in ('cancelled', 'no_show') and new.status in ('booked', 'done')
     and new.makeup_session_id is not null then
    select * into c from public.live_sessions where id = new.makeup_session_id;
    update public.live_sessions set makeup_session_id = null, updated_at = now() where id = new.id;
    if c.id is null or c.makeup_for is distinct from new.id or c.status in ('removed', 'cancelled', 'no_show') then
      return null;
    end if;

    -- Another catch-up they still owe, oldest first.
    select o.id into other
    from public.live_sessions o
    where o.trainer_id = new.trainer_id
      and o.id <> new.id
      and o.charge = 'makeup'
      and o.makeup_session_id is null
      and o.status in ('cancelled', 'no_show')
      and (
        (new.client_id is not null and o.client_id = new.client_id)
        or (new.client_id is null and o.client_id is null
            and lower(trim(coalesce(o.guest_name, ''))) = lower(trim(coalesce(new.guest_name, '')))
            and coalesce(new.guest_name, '') <> '')
      )
    order by o.starts_at
    limit 1;

    if other is not null then
      update public.live_sessions set makeup_for = other, updated_at = now() where id = c.id;
      update public.live_sessions set makeup_session_id = c.id, updated_at = now() where id = other;
    elsif c.status = 'booked' and c.starts_at > now() then
      update public.live_sessions set status = 'removed', makeup_for = null, updated_at = now() where id = c.id;
    else
      update public.live_sessions set makeup_for = null, updated_at = now() where id = c.id;
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function public.live_sessions_catch_up_follow() from public, anon, authenticated;

create trigger live_sessions_catch_up_follow
after update of status on public.live_sessions
for each row
when (old.status is distinct from new.status)
execute function public.live_sessions_catch_up_follow();
