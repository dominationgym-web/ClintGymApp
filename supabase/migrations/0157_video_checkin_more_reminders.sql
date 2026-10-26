-- More video check-in reminders (GRIZZ, 2026-10-25: "Can we make reminders
-- day before, morning of, then 1 hour before. Then 15 mins."). Each run sends
-- only the latest reminder that's due, so a call booked late doesn't get
-- several at once. All go to both the client and the trainer.

alter table public.video_checkins
  add column if not exists reminded_morning boolean not null default false,
  add column if not exists reminded_hour boolean not null default false;

-- Every 5 minutes: 15 minutes before, an hour before, the morning of (from
-- 07:00) and the day before, to both sides; a nudge to a trainer who hasn't
-- confirmed a booking for the next day; and next week's booking for a client
-- who keeps the same time every week.
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
      jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
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
      jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
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
      jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
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
        jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
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
        jsonb_build_object('type', 'video_checkin')
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.video_checkin_reminders() from public, anon, authenticated;

-- The confirmation now lists all four reminders.
create or replace function public.respond_video_checkin(p_id uuid, p_confirm boolean, p_reason text default null)
returns public.video_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.video_checkins;
  tz text;
  why text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
begin
  if not public.not_unapproved_trainer() then
    raise exception 'Your trainer account is not active';
  end if;
  update public.video_checkins
  set status = case when p_confirm then 'confirmed' else 'declined' end,
      reason = case when p_confirm then null else why end,
      repeat_weekly = case when p_confirm then repeat_weekly else false end,
      updated_at = now()
  where id = p_id and trainer_id = auth.uid() and status = 'requested' and starts_at > now()
  returning * into saved;
  if saved.id is null then
    raise exception 'That booking has already been answered, cancelled or has passed';
  end if;
  select time_zone into tz from public.video_checkin_settings where trainer_id = saved.trainer_id;
  perform public.push_to_user(
    saved.client_id,
    case when p_confirm then '📹 Video check-in confirmed' else 'Your coach can''t make that time' end,
    public.video_checkin_when(saved.starts_at, tz)
      || case when p_confirm then '. We''ll remind you the day before, that morning, an hour before and 15 minutes before.'
         else coalesce('. ' || why, '') || '. Open the app to pick another time.' end,
    jsonb_build_object('type', 'video_checkin', 'checkinId', saved.id)
  );
  return saved;
end;
$$;

revoke execute on function public.respond_video_checkin(uuid, boolean, text) from public, anon;
grant execute on function public.respond_video_checkin(uuid, boolean, text) to authenticated;
