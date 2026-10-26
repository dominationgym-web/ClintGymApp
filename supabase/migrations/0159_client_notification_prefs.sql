-- Client notification settings (GRIZZ, 2026-10-26: "I want the clients to
-- have access to the ability to activate or deactivate specific notifications
-- ... some people just get annoyed by too many notifications").
--
-- One switch per group, all on by default. Messages from the coach, account
-- and plan notices, and video check-in bookings (confirmed, declined,
-- cancelled) stay on: clients can't miss those.
--
--   checkin_reminders  video check-in reminders (day before, morning, 1 hour,
--                      15 minutes) and "pick a time for next week"
--   training           weekend catch-up, new timer workout, new challenge
--   habits             habit reminders, the 6pm sleep tip, step goal reminders
--   progress           weigh-in day, the 6-weekly progress photo
--   womens_health      Reset daily reminder, cycle phase tip, supplement
--                      check, cycle tracker nudge
--
-- Server pushes are filtered in push_to_user(); reminders the phone schedules
-- itself are filtered in the app (src/lib/notificationPrefs.ts). The weekly
-- "Get the latest Daily Evolution" push no longer goes to clients: the app
-- shows a banner instead when an update is ready.
create table if not exists public.client_notification_prefs (
  client_id uuid primary key references public.clients (id) on delete cascade,
  checkin_reminders boolean not null default true,
  training boolean not null default true,
  habits boolean not null default true,
  progress boolean not null default true,
  womens_health boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.client_notification_prefs enable row level security;

create policy "notification prefs client manages own" on public.client_notification_prefs
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()) and public.client_has_access(client_id));

create policy "notification prefs trainer reads" on public.client_notification_prefs
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

-- Which switch a push belongs to: its data's 'category', else its 'type'.
-- Null means it always goes (coach messages, plan notices, bookings, and
-- everything sent to trainers).
create or replace function public.push_category(p_data jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(p_data ->> 'category', ''),
    case p_data ->> 'type'
      when 'catch_up' then 'training'
      when 'timer_workout' then 'training'
      when 'challenge_started' then 'training'
      when 'weigh_in' then 'progress'
      when 'steps' then 'habits'
    end
  )
$$;

-- True unless the user is a client who switched that group off.
create or replace function public.push_wanted(p_user uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_category is null or coalesce((
    select case p_category
      when 'checkin_reminders' then n.checkin_reminders
      when 'training' then n.training
      when 'habits' then n.habits
      when 'progress' then n.progress
      when 'womens_health' then n.womens_health
      else true
    end
    from public.client_notification_prefs n
    where n.client_id = p_user
  ), true)
$$;

revoke execute on function public.push_wanted(uuid, text) from public, anon, authenticated;

create or replace function public.push_to_user(p_user uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
begin
  if not public.push_wanted(p_user, public.push_category(p_data)) then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', p.expo_push_token,
    'title', p_title,
    'body', left(p_body, 180),
    'sound', 'default',
    'channelId', 'messages',
    'data', p_data
  ))
  into messages
  from public.push_tokens p
  where p.user_id = p_user;

  if messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := messages
    );
  end if;
exception when others then
  -- A notification that fails to queue must never stop the change it's about.
  raise warning 'push_to_user failed: %', sqlerrm;
end;
$$;

revoke execute on function public.push_to_user(uuid, text, text, jsonb) from public, anon, authenticated;

-- Trainers only now; clients see a banner in the app when an update is ready.
create or replace function public.weekly_update_reminder()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  for u in
    select distinct p.user_id from public.push_tokens p
    where p.user_id is not null
      -- A trainer's own training row (0146) has id = trainer_id: still a trainer.
      and not exists (select 1 from public.clients c where c.id = p.user_id and c.trainer_id is distinct from c.id)
  loop
    perform public.push_to_user(
      u,
      'Get the latest Daily Evolution',
      'Fully close the app, open it, wait 10 seconds, then close and open it again to load this week''s updates.',
      '{}'::jsonb
    );
  end loop;
end;
$$;

revoke execute on function public.weekly_update_reminder() from public, anon, authenticated;

-- Same as 0157, with each push to the client tagged 'checkin_reminders' so
-- they can switch them off. The trainer's always go.
create or replace function public.video_checkin_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  nxt timestamptz;
  ok boolean;
begin
  -- 15 minutes before (confirmed only).
  for v in
    select vc.*, c.name as client_name, s.time_zone,
           coalesce(nullif(btrim(t.business_name), ''), t.name) as coach_name
    from public.video_checkins vc
    join public.clients c on c.id = vc.client_id
    join public.trainers t on t.id = vc.trainer_id
    left join public.video_checkin_settings s on s.trainer_id = vc.trainer_id
    where vc.status = 'confirmed' and not vc.reminded_soon
      and vc.starts_at > now() and vc.starts_at <= now() + interval '16 minutes'
  loop
    update public.video_checkins set reminded_soon = true, reminded_hour = true, reminded_morning = true, reminded_day = true where id = v.id;
    perform public.push_to_user(
      v.client_id,
      '📹 Video check-in in ' || greatest(1, ceil(extract(epoch from v.starts_at - now()) / 60))::int || ' minutes',
      'With ' || coalesce(v.coach_name, 'your coach') || ' on WhatsApp. Keep your phone close.',
      jsonb_build_object('type', 'video_checkin', 'category', 'checkin_reminders', 'checkinId', v.id)
    );
    perform public.push_to_user(
      v.trainer_id,
      '📹 Video check-in with ' || coalesce(v.client_name, 'a client') || ' in '
        || greatest(1, ceil(extract(epoch from v.starts_at - now()) / 60))::int || ' minutes',
      coalesce('Topic: ' || v.topic || '. ', '') || 'Open the app and tap WhatsApp to call them.',
      jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
    );
  end loop;

  -- An hour before (confirmed only).
  for v in
    select vc.*, c.name as client_name, s.time_zone,
           coalesce(nullif(btrim(t.business_name), ''), t.name) as coach_name
    from public.video_checkins vc
    join public.clients c on c.id = vc.client_id
    join public.trainers t on t.id = vc.trainer_id
    left join public.video_checkin_settings s on s.trainer_id = vc.trainer_id
    where vc.status = 'confirmed' and not vc.reminded_hour
      and vc.starts_at > now() + interval '16 minutes' and vc.starts_at <= now() + interval '61 minutes'
      and vc.updated_at < now() - interval '15 minutes'
  loop
    update public.video_checkins set reminded_hour = true, reminded_morning = true, reminded_day = true where id = v.id;
    perform public.push_to_user(
      v.client_id,
      '📹 Video check-in in an hour',
      'At ' || to_char(v.starts_at at time zone coalesce(v.time_zone, 'Africa/Johannesburg'), 'HH24:MI') || ' with '
        || coalesce(v.coach_name, 'your coach') || ' on WhatsApp.',
      jsonb_build_object('type', 'video_checkin', 'category', 'checkin_reminders', 'checkinId', v.id)
    );
    perform public.push_to_user(
      v.trainer_id,
      '📹 Video check-in with ' || coalesce(v.client_name, 'a client') || ' in an hour',
      'At ' || to_char(v.starts_at at time zone coalesce(v.time_zone, 'Africa/Johannesburg'), 'HH24:MI')
        || coalesce('. Topic: ' || v.topic, '') || '.',
      jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
    );
  end loop;

  -- The morning of the call, from 07:00 in the trainer's time zone (confirmed only).
  for v in
    select vc.*, c.name as client_name, s.time_zone,
           coalesce(nullif(btrim(t.business_name), ''), t.name) as coach_name
    from public.video_checkins vc
    join public.clients c on c.id = vc.client_id
    join public.trainers t on t.id = vc.trainer_id
    left join public.video_checkin_settings s on s.trainer_id = vc.trainer_id
    where vc.status = 'confirmed' and not vc.reminded_morning
      and vc.starts_at > now() + interval '61 minutes'
      and (vc.starts_at at time zone coalesce(s.time_zone, 'Africa/Johannesburg'))::date
        = (now() at time zone coalesce(s.time_zone, 'Africa/Johannesburg'))::date
      and (now() at time zone coalesce(s.time_zone, 'Africa/Johannesburg'))::time >= time '07:00'
      and vc.updated_at < now() - interval '30 minutes'
  loop
    update public.video_checkins set reminded_morning = true, reminded_day = true where id = v.id;
    perform public.push_to_user(
      v.client_id,
      '📹 Video check-in today at ' || to_char(v.starts_at at time zone coalesce(v.time_zone, 'Africa/Johannesburg'), 'HH24:MI'),
      'With ' || coalesce(v.coach_name, 'your coach') || ' on WhatsApp.',
      jsonb_build_object('type', 'video_checkin', 'category', 'checkin_reminders', 'checkinId', v.id)
    );
    perform public.push_to_user(
      v.trainer_id,
      '📹 Video check-in with ' || coalesce(v.client_name, 'a client') || ' today at '
        || to_char(v.starts_at at time zone coalesce(v.time_zone, 'Africa/Johannesburg'), 'HH24:MI'),
      coalesce('Topic: ' || v.topic, 'Tap to see your check-ins.'),
      jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
    );
  end loop;

  -- The day before: within a day of the call but not yet its day. A trainer who
  -- hasn't confirmed is nudged instead.
  for v in
    select vc.*, c.name as client_name, s.time_zone,
           coalesce(nullif(btrim(t.business_name), ''), t.name) as coach_name
    from public.video_checkins vc
    join public.clients c on c.id = vc.client_id
    join public.trainers t on t.id = vc.trainer_id
    left join public.video_checkin_settings s on s.trainer_id = vc.trainer_id
    where vc.status in ('requested', 'confirmed') and not vc.reminded_day
      and vc.starts_at > now() + interval '16 minutes' and vc.starts_at <= now() + interval '24 hours'
      and (vc.status = 'requested'
        or (vc.starts_at at time zone coalesce(s.time_zone, 'Africa/Johannesburg'))::date
           > (now() at time zone coalesce(s.time_zone, 'Africa/Johannesburg'))::date)
      -- Not straight after booking or confirming: those already sent a notification.
      and vc.updated_at < now() - interval '30 minutes'
  loop
    update public.video_checkins set reminded_day = true where id = v.id;
    if v.status = 'confirmed' then
      perform public.push_to_user(
        v.client_id,
        '📹 Video check-in tomorrow',
        public.video_checkin_when(v.starts_at, v.time_zone) || ' with ' || coalesce(v.coach_name, 'your coach') || '.',
        jsonb_build_object('type', 'video_checkin', 'category', 'checkin_reminders', 'checkinId', v.id)
      );
      perform public.push_to_user(
        v.trainer_id,
        '📹 Video check-in with ' || coalesce(v.client_name, 'a client') || ' tomorrow',
        public.video_checkin_when(v.starts_at, v.time_zone) || coalesce('. Topic: ' || v.topic, '') || '.',
        jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
      );
    else
      perform public.push_to_user(
        v.trainer_id,
        coalesce(v.client_name, 'A client') || ' is waiting for you to confirm',
        'Their video check-in is ' || public.video_checkin_when(v.starts_at, v.time_zone) || '. Tap to confirm or decline.',
        jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
      );
    end if;
  end loop;

  -- Same time every week: once a confirmed call is over, book next week's.
  for v in
    select vc.*, s.time_zone, s.paused, sl.active as slot_active, c.trainer_id as current_coach,
           c.archived_at, c.access_status
    from public.video_checkins vc
    join public.clients c on c.id = vc.client_id
    left join public.video_checkin_settings s on s.trainer_id = vc.trainer_id
    left join public.video_checkin_slots sl on sl.id = vc.slot_id
    where vc.status = 'confirmed' and vc.repeat_weekly
      and vc.starts_at + make_interval(mins => vc.minutes) < now()
  loop
    update public.video_checkins set repeat_weekly = false, updated_at = now() where id = v.id;
    nxt := ((v.starts_at at time zone v.time_zone) + interval '7 days') at time zone v.time_zone;
    ok := coalesce(v.slot_active, false) and not coalesce(v.paused, true)
      and v.current_coach = v.trainer_id and v.archived_at is null and v.access_status <> 'expired'
      and nxt > now()
      and not exists (
        select 1 from public.video_checkins o
        where o.client_id = v.client_id and o.status in ('requested', 'confirmed')
          and date_trunc('week', o.starts_at at time zone v.time_zone) = date_trunc('week', nxt at time zone v.time_zone)
      );
    if ok then
      begin
        insert into public.video_checkins (trainer_id, client_id, slot_id, starts_at, minutes, status, repeat_weekly, topic)
        values (v.trainer_id, v.client_id, v.slot_id, nxt, v.minutes, 'confirmed', true, null);
      exception when unique_violation then
        ok := false;
      end;
    end if;
    if not ok then
      perform public.push_to_user(
        v.client_id,
        'Pick a time for next week''s video check-in',
        'Your usual time isn''t open next week. Open the app to book another.',
        jsonb_build_object('type', 'video_checkin', 'category', 'checkin_reminders')
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.video_checkin_reminders() from public, anon, authenticated;
