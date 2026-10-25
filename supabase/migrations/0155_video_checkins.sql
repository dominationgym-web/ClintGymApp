-- Weekly video check-ins (GRIZZ, 2026-10-25: "a weekly video check in
-- through the app? Where the client can book a slot to chat. Trainer needs
-- to confirm his availability. Then the app memories this and reminds both
-- parties about the video catch up").
--
-- GRIZZ, 2026-10-25: "Dont worry about the video calls. Can do that via
-- WhatsApp easier. But the reminders and booking. And maybe a constant pop up
-- on the day to remind both." So the call itself happens on WhatsApp.
--
-- The trainer sets the times in the week they're free (video_checkin_slots)
-- and their WhatsApp number. A
-- client books one of those times for a day in the next two weeks, at most
-- one per week; the trainer confirms or declines it. Both get a reminder the
-- day before and 15 minutes before, and a client can keep the same time
-- every week (the next one is booked once a call is over).
--
-- Times are the trainer's wall-clock time in their own time zone (saved from
-- the trainer's phone); each phone shows a booking in its own time.
-- Nothing here is ever deleted: slots are switched off, bookings cancelled.

create table public.video_checkin_settings (
  trainer_id uuid primary key default auth.uid() references public.trainers (id) on delete cascade,
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 30),
  minutes integer not null default 20 check (minutes between 10 and 90),
  time_zone text not null default 'Africa/Johannesburg',
  -- Not taking bookings for now (on leave): clients see no open times.
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.video_checkin_slots (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references public.trainers (id) on delete cascade,
  -- 0 Sunday to 6 Saturday, as extract(dow) and JavaScript's getDay().
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trainer_id, weekday, start_time)
);

create table public.video_checkins (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  slot_id uuid references public.video_checkin_slots (id) on delete set null,
  starts_at timestamptz not null,
  minutes integer not null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  -- Book the same time again next week once this one is over.
  repeat_weekly boolean not null default false,
  -- What the client wants to talk about, when they book.
  topic text check (topic is null or char_length(topic) <= 300),
  -- Why it was declined or cancelled, and by whom.
  reason text check (reason is null or char_length(reason) <= 300),
  cancelled_by text check (cancelled_by is null or cancelled_by in ('client', 'trainer')),
  reminded_day boolean not null default false,
  reminded_soon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open booking per trainer per time.
create unique index video_checkins_time_taken on public.video_checkins (trainer_id, starts_at)
  where status in ('requested', 'confirmed');
create index video_checkins_client_idx on public.video_checkins (client_id, starts_at desc);
create index video_checkins_due_idx on public.video_checkins (starts_at) where status in ('requested', 'confirmed');

alter table public.video_checkin_settings enable row level security;
alter table public.video_checkin_slots enable row level security;
alter table public.video_checkins enable row level security;

-- The trainer's own setup; their clients can read it (for the WhatsApp number).
create policy video_settings_read on public.video_checkin_settings
  for select to authenticated using (
    trainer_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = (select auth.uid()) and c.trainer_id = video_checkin_settings.trainer_id)
  );
create policy video_settings_insert on public.video_checkin_settings
  for insert to authenticated with check (trainer_id = (select auth.uid()) and (select public.not_unapproved_trainer()));
create policy video_settings_update on public.video_checkin_settings
  for update to authenticated
  using (trainer_id = (select auth.uid()) and (select public.not_unapproved_trainer()))
  with check (trainer_id = (select auth.uid()));

create policy video_slots_read on public.video_checkin_slots
  for select to authenticated using (
    trainer_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = (select auth.uid()) and c.trainer_id = video_checkin_slots.trainer_id)
  );
create policy video_slots_insert on public.video_checkin_slots
  for insert to authenticated with check (trainer_id = (select auth.uid()) and (select public.not_unapproved_trainer()));
create policy video_slots_update on public.video_checkin_slots
  for update to authenticated
  using (trainer_id = (select auth.uid()) and (select public.not_unapproved_trainer()))
  with check (trainer_id = (select auth.uid()));

-- Bookings are read here and changed only through the functions below.
create policy video_checkins_read on public.video_checkins
  for select to authenticated using (client_id = (select auth.uid()) or trainer_id = (select auth.uid()));

-- "Tue 28 Oct, 17:00" in the trainer's time zone, for notifications.
create or replace function public.video_checkin_when(p_at timestamptz, p_tz text)
returns text
language sql
stable
as $$
  select to_char(p_at at time zone coalesce(p_tz, 'Africa/Johannesburg'), 'Dy DD Mon, HH24:MI')
$$;

-- The open times a client can book: their trainer's active slots on each day
-- of the next 14 days, from an hour from now, not already taken.
create or replace function public.open_video_slots()
returns table (slot_id uuid, starts_at timestamptz, minutes integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  coach uuid;
  s public.video_checkin_settings;
begin
  select c.trainer_id into coach from public.clients c where c.id = auth.uid();
  if coach is null then
    return;
  end if;
  select * into s from public.video_checkin_settings where trainer_id = coach;
  if not found or s.paused then
    return;
  end if;
  return query
    select sl.id, ((d.day + sl.start_time) at time zone s.time_zone) as at, s.minutes
    from public.video_checkin_slots sl
    cross join lateral (
      select (now() at time zone s.time_zone)::date + g as day from generate_series(0, 13) g
    ) d
    where sl.trainer_id = coach
      and sl.active
      and extract(dow from d.day) = sl.weekday
      and ((d.day + sl.start_time) at time zone s.time_zone) > now() + interval '1 hour'
      and not exists (
        select 1 from public.video_checkins v
        where v.trainer_id = coach and v.status in ('requested', 'confirmed')
          and v.starts_at = ((d.day + sl.start_time) at time zone s.time_zone)
      )
    order by 2;
end;
$$;

revoke execute on function public.open_video_slots() from public, anon;
grant execute on function public.open_video_slots() to authenticated;

-- A client books one of the open times. One booking per week.
create or replace function public.book_video_checkin(p_slot uuid, p_starts_at timestamptz, p_repeat boolean default false, p_topic text default null)
returns public.video_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  who text;
  coach uuid;
  s public.video_checkin_settings;
  saved public.video_checkins;
  topic text := nullif(left(btrim(coalesce(p_topic, '')), 300), '');
begin
  select c.name, c.trainer_id into who, coach
  from public.clients c
  where c.id = me and c.archived_at is null and c.access_status <> 'expired';
  if coach is null then
    raise exception 'Only clients with a coach can book a video check-in';
  end if;
  if not exists (select 1 from public.open_video_slots() o where o.slot_id = p_slot and o.starts_at = p_starts_at) then
    raise exception 'That time has just been taken or is no longer open. Please pick another.';
  end if;
  select * into s from public.video_checkin_settings where trainer_id = coach;
  if exists (
    select 1 from public.video_checkins v
    where v.client_id = me and v.status in ('requested', 'confirmed')
      and date_trunc('week', v.starts_at at time zone s.time_zone) = date_trunc('week', p_starts_at at time zone s.time_zone)
  ) then
    raise exception 'You already have a video check-in that week. Cancel it first to pick another time.';
  end if;

  begin
    insert into public.video_checkins (trainer_id, client_id, slot_id, starts_at, minutes, repeat_weekly, topic)
    values (coach, me, p_slot, p_starts_at, s.minutes, coalesce(p_repeat, false), topic)
    returning * into saved;
  exception when unique_violation then
    raise exception 'That time has just been taken. Please pick another.';
  end;

  perform public.push_to_user(
    coach,
    '📹 ' || coalesce(who, 'A client') || ' booked a video check-in',
    public.video_checkin_when(saved.starts_at, s.time_zone) || '. Tap to confirm or decline.'
      || coalesce(' Topic: ' || topic, ''),
    jsonb_build_object('type', 'video_checkin', 'checkinId', saved.id)
  );
  return saved;
end;
$$;

revoke execute on function public.book_video_checkin(uuid, timestamptz, boolean, text) from public, anon;
grant execute on function public.book_video_checkin(uuid, timestamptz, boolean, text) to authenticated;

-- The trainer confirms or declines a booking.
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
      || case when p_confirm then '. We''ll remind you the day before and 15 minutes before.'
         else coalesce('. ' || why, '') || '. Open the app to pick another time.' end,
    jsonb_build_object('type', 'video_checkin', 'checkinId', saved.id)
  );
  return saved;
end;
$$;

revoke execute on function public.respond_video_checkin(uuid, boolean, text) from public, anon;
grant execute on function public.respond_video_checkin(uuid, boolean, text) to authenticated;

-- Either side cancels a booking that hasn't happened yet; the other hears.
create or replace function public.cancel_video_checkin(p_id uuid, p_reason text default null)
returns public.video_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.video_checkins;
  by_trainer boolean;
  who text;
  tz text;
  why text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
begin
  update public.video_checkins
  set status = 'cancelled',
      repeat_weekly = false,
      reason = why,
      cancelled_by = case when trainer_id = auth.uid() then 'trainer' else 'client' end,
      updated_at = now()
  where id = p_id
    and (client_id = auth.uid() or trainer_id = auth.uid())
    and status in ('requested', 'confirmed')
    and starts_at > now()
  returning * into saved;
  if saved.id is null then
    raise exception 'That booking is already cancelled or has passed';
  end if;
  by_trainer := saved.cancelled_by = 'trainer';
  select time_zone into tz from public.video_checkin_settings where trainer_id = saved.trainer_id;
  if by_trainer then
    perform public.push_to_user(
      saved.client_id,
      'Your coach cancelled your video check-in',
      public.video_checkin_when(saved.starts_at, tz) || coalesce('. ' || why, '') || '. Open the app to pick another time.',
      jsonb_build_object('type', 'video_checkin', 'checkinId', saved.id)
    );
  else
    select c.name into who from public.clients c where c.id = saved.client_id;
    perform public.push_to_user(
      saved.trainer_id,
      coalesce(who, 'A client') || ' cancelled their video check-in',
      public.video_checkin_when(saved.starts_at, tz) || coalesce('. ' || why, ''),
      jsonb_build_object('type', 'video_checkin', 'checkinId', saved.id)
    );
  end if;
  return saved;
end;
$$;

revoke execute on function public.cancel_video_checkin(uuid, text) from public, anon;
grant execute on function public.cancel_video_checkin(uuid, text) to authenticated;

-- The client switches "same time every week" on or off.
create or replace function public.set_video_checkin_repeat(p_id uuid, p_repeat boolean)
returns public.video_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.video_checkins;
begin
  update public.video_checkins
  set repeat_weekly = coalesce(p_repeat, false), updated_at = now()
  where id = p_id and client_id = auth.uid() and status in ('requested', 'confirmed') and starts_at > now()
  returning * into saved;
  if saved.id is null then
    raise exception 'That booking is cancelled or has passed';
  end if;
  return saved;
end;
$$;

revoke execute on function public.set_video_checkin_repeat(uuid, boolean) from public, anon;
grant execute on function public.set_video_checkin_repeat(uuid, boolean) to authenticated;

-- Every 5 minutes: the day-before and 15-minute reminders to both sides, a
-- nudge to a trainer who hasn't confirmed a booking for tomorrow, and next
-- week's booking for a client who keeps the same time every week.
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
    update public.video_checkins set reminded_soon = true, reminded_day = true where id = v.id;
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

  -- The day before (or on booking, when it's already less than a day away).
  for v in
    select vc.*, c.name as client_name, s.time_zone,
           coalesce(nullif(btrim(t.business_name), ''), t.name) as coach_name
    from public.video_checkins vc
    join public.clients c on c.id = vc.client_id
    join public.trainers t on t.id = vc.trainer_id
    left join public.video_checkin_settings s on s.trainer_id = vc.trainer_id
    where vc.status in ('requested', 'confirmed') and not vc.reminded_day
      and vc.starts_at > now() + interval '16 minutes' and vc.starts_at <= now() + interval '24 hours'
      -- Not straight after booking or confirming: those already sent a notification.
      and vc.updated_at < now() - interval '30 minutes'
  loop
    update public.video_checkins set reminded_day = true where id = v.id;
    if v.status = 'confirmed' then
      perform public.push_to_user(
        v.client_id,
        '📹 Video check-in coming up',
        public.video_checkin_when(v.starts_at, v.time_zone) || ' with ' || coalesce(v.coach_name, 'your coach') || '.',
        jsonb_build_object('type', 'video_checkin', 'checkinId', v.id)
      );
      perform public.push_to_user(
        v.trainer_id,
        '📹 Video check-in with ' || coalesce(v.client_name, 'a client') || ' coming up',
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

select cron.schedule('video-checkin-reminders', '*/5 * * * *', $$select public.video_checkin_reminders();$$);
