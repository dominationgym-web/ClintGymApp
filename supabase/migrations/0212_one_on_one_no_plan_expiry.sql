-- 1 on 1 clients' app never closes because a plan date ran out (GRIZZ,
-- 2026-11-13: "Only if the trainer blocks them. Or deletes them of his
-- calendar. That would count as a block. Once a client is removed of a
-- calendar permanently its like being blocked.").
--
-- 1 on 1 clients pay per session on the trainer's invoices, so:
--  * auto_expire_plans skips them (one_on_one or live_only).
--  * Their app closes (access_status 'expired') when they're blocked for not
--    paying (an open client_away row with unpaid = true: the Block button or
--    the 14th-of-the-month hold), or when they've stopped training with the
--    coach (an open client_stops row whose first day has come).
--  * Unblocking / Undo on the stop opens it again, unless another block or
--    stop still stands.
-- These pauses send no "Your plan has ended" push: the coach talks to the
-- client (as with holds, 0203).

-- Is this client on the trainer's 1 on 1 side?
create or replace function public.client_is_one_on_one(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select c.one_on_one or coalesce(c.live_only, false) from public.clients c where c.id = p_client), false);
$$;
revoke execute on function public.client_is_one_on_one(uuid) from public, anon;

-- Should this 1 on 1 client's app be closed right now?
create or replace function public.one_on_one_paused(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.client_away a
      where a.client_id = p_client and a.unpaid and a.ended_at is null
    )
    or exists (
      select 1 from public.client_stops st
      where st.client_id = p_client and st.undone_at is null
        and st.from_on <= (now() at time zone public.session_tz(st.trainer_id))::date
    );
$$;
revoke execute on function public.one_on_one_paused(uuid) from public, anon, authenticated;

-- Opens or closes a 1 on 1 client's app to match their blocks and stops.
-- Only touches clients who have been switched on before (plan_started_at),
-- so a new sign-up still waits for the trainer to activate them.
create or replace function public.sync_one_on_one_access(p_client uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.clients;
  paused boolean;
begin
  select * into c from public.clients where id = p_client;
  if c.id is null or c.plan_started_at is null or c.archived_at is not null
     or not (c.one_on_one or coalesce(c.live_only, false)) then
    return;
  end if;
  paused := public.one_on_one_paused(p_client);
  perform set_config('app.quiet_access', '1', true);
  if paused and c.access_status <> 'expired' then
    update public.clients set access_status = 'expired' where id = p_client;
  elsif not paused and c.access_status = 'expired' then
    update public.clients set access_status = 'active' where id = p_client;
  end if;
  perform set_config('app.quiet_access', '', true);
end;
$$;
revoke execute on function public.sync_one_on_one_access(uuid) from public, anon, authenticated;

create or replace function public.sync_one_on_one_access_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null then
    perform public.sync_one_on_one_access(new.client_id);
  end if;
  return new;
exception when others then
  raise warning 'sync_one_on_one_access failed: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function public.sync_one_on_one_access_trigger() from public, anon, authenticated;

drop trigger if exists client_away_one_on_one_access on public.client_away;
create trigger client_away_one_on_one_access
after insert or update of ended_at, unpaid, client_id on public.client_away
for each row execute function public.sync_one_on_one_access_trigger();

drop trigger if exists client_stops_one_on_one_access on public.client_stops;
create trigger client_stops_one_on_one_access
after insert or update of undone_at, client_id on public.client_stops
for each row execute function public.sync_one_on_one_access_trigger();

-- Daily plan job: 1 on 1 clients have no plan expiry; a stop that starts on a
-- later day closes their app on that day.
create or replace function public.auto_expire_plans()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  update public.clients
  set access_status = 'expiring_soon'
  where access_status = 'active'
    and not (one_on_one or coalesce(live_only, false))
    and plan_expires_at is not null
    and plan_expires_at <= (current_date + interval '7 days')
    and plan_expires_at > current_date;

  update public.clients
  set access_status = 'expired'
  where access_status = 'expiring_soon'
    and not (one_on_one or coalesce(live_only, false))
    and plan_expires_at is not null
    and plan_expires_at <= current_date;

  for r in
    select distinct st.client_id from public.client_stops st
    join public.clients c on c.id = st.client_id
    where st.undone_at is null and c.access_status <> 'expired'
  loop
    perform public.sync_one_on_one_access(r.client_id);
  end loop;
end;
$$;
revoke execute on function public.auto_expire_plans() from public, anon, authenticated;

-- No "Your plan has ended" / "You're in" pushes for a block or stop.
create or replace function public.notify_client_signup_and_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ends text := coalesce(to_char(new.plan_expires_at, 'FMDD FMMonth'), 'soon');
  has_names boolean;
begin
  if new.id = new.trainer_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(current_setting('app.quiet_access', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select exists (
      select 1 from public.live_sessions ls
      where ls.trainer_id = new.trainer_id and ls.client_id is null and ls.invoice_id is null
        and public.diary_name_real(ls.guest_name) and ls.starts_at > now() - interval '90 days'
    ) into has_names;
    perform public.push_to_user(
      new.trainer_id,
      'New client signed up',
      coalesce(new.name, 'Someone') || ' just signed up. ' ||
        case when has_names
          then 'Open the app to link them to their name on your 1 on 1 calendar.'
          else 'Activate them on the Clients tab once they''ve paid.' end,
      jsonb_build_object('type', 'client_signup', 'clientId', new.id)
    );
  elsif old.access_status = 'expired' and new.access_status in ('active', 'expiring_soon') then
    perform public.push_to_user(
      new.id,
      'You''re in! 🎉',
      'Your trainer has activated your account. Open the app to get started.',
      jsonb_build_object('type', 'client_activated')
    );
  elsif old.access_status = 'active' and new.access_status = 'expiring_soon' then
    perform public.push_to_user(
      new.id,
      'Your plan ends ' || ends,
      'Renew with your trainer before then to keep your access and your streaks going.',
      jsonb_build_object('type', 'plan_expiring')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan ends ' || ends,
      'They''ve been reminded to renew.',
      jsonb_build_object('type', 'client_plan_expiring', 'clientId', new.id)
    );
  elsif old.access_status in ('active', 'expiring_soon') and new.access_status = 'expired' then
    perform public.push_to_user(
      new.id,
      'Your plan has ended',
      'Renew with your trainer to get your access back. Open the app for the payment details.',
      jsonb_build_object('type', 'plan_expired')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan has ended',
      'Their access is paused until you activate them again.',
      jsonb_build_object('type', 'client_plan_expired', 'clientId', new.id)
    );
  end if;
  return new;
exception when others then
  raise warning 'client membership notification failed: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function public.notify_client_signup_and_activation() from public, anon, authenticated;

-- 1 on 1 clients already counting down to a plan end go back to plain active
-- (no push: expiring_soon -> active sends none), then everyone is matched to
-- their current blocks and stops.
update public.clients set access_status = 'active'
where access_status = 'expiring_soon' and (one_on_one or coalesce(live_only, false));

do $$
declare
  r record;
begin
  for r in
    select id from public.clients
    where (one_on_one or coalesce(live_only, false)) and plan_started_at is not null and archived_at is null
  loop
    perform public.sync_one_on_one_access(r.id);
  end loop;
end $$;

-- A block or stop is a pause, not the end of a plan: keep their form videos.
create or replace function public.expire_videos_when_plan_expires()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.quiet_access', true), '') = '1' then
    return new;
  end if;
  update public.videos
  set expires_at = now()
  where client_id = new.id
    and deleted_at is null
    and expires_at > now();
  return new;
end;
$$;
