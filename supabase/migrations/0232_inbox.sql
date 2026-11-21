-- 0232: the 🔔 inbox (GRIZZ, 2026-11-21: "messages get lost and can't be found").
--
-- Every phone notification the server sends is now also kept in
-- public.inbox_items, so clients and trainers can find it again under the bell
-- at the top of the app, even after swiping the notification away, on a phone
-- with notifications off, or on the laptop. The bell shows how many are unread.
--
--   * push_to_user() writes the inbox row first, then sends the push with the
--     row's id in its data ('inboxId'), so tapping the notification marks it read.
--   * The four functions that still sent pushes on their own (coach messages,
--     check-in wellbeing, exercise pain, log-in help) now go through
--     push_to_user(), so they land in the inbox too.
--   * A coach message keeps its full text in the inbox (the push is cut at 180).
--   * Reading a coach message in the inbox marks it read on the Today card, and
--     "Got it" on the Today card marks it read in the inbox.
--   * The weekly "Get the latest Daily Evolution" push is not kept.
--   * The last 60 days of coach messages are copied in, so nothing old is lost.

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists inbox_items_user_created on public.inbox_items (user_id, created_at desc);
create index if not exists inbox_items_user_unread on public.inbox_items (user_id) where read_at is null;

alter table public.inbox_items enable row level security;

create policy "inbox owner reads" on public.inbox_items
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Rows are written by push_to_user() and marked read by mark_inbox_read().
revoke insert, update, delete on public.inbox_items from anon, authenticated;

-- So the bell's count goes up the moment something arrives.
do $$
begin
  alter publication supabase_realtime add table public.inbox_items;
exception when others then
  null;
end;
$$;

-- ---------------------------------------------------------------------------
-- push_to_user: keep it in the inbox, then send it
-- ---------------------------------------------------------------------------
create or replace function public.push_to_user(p_user uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
  item uuid;
  payload jsonb := coalesce(p_data, '{}'::jsonb);
begin
  -- The inbox keeps everything except the weekly "get the latest" nudge, even
  -- when the client switched that kind of phone notification off.
  if p_user is not null and payload ? 'type' then
    begin
      insert into public.inbox_items (user_id, title, body, data)
      values (p_user, left(coalesce(p_title, ''), 300), left(coalesce(p_body, ''), 4000), payload)
      returning id into item;
      payload := payload || jsonb_build_object('inboxId', item);
    exception when others then
      raise warning 'inbox insert failed: %', sqlerrm;
    end;
  end if;

  if not public.push_wanted(p_user, public.push_category(p_data)) then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', p.expo_push_token,
    'title', p_title,
    'body', left(p_body, 180),
    'sound', 'default',
    'channelId', 'messages',
    'data', payload
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

-- ---------------------------------------------------------------------------
-- The four pushes that skipped push_to_user
-- ---------------------------------------------------------------------------
create or replace function public.notify_coach_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender text;
begin
  select coalesce(nullif(t.business_name, ''), t.name) into sender
  from public.trainers t where t.id = new.trainer_id;
  perform public.push_to_user(
    new.client_id,
    'Message from ' || coalesce(sender, 'your coach'),
    new.body,
    jsonb_build_object('type', 'coach_message', 'messageId', new.id)
  );
  return new;
exception when others then
  raise warning 'coach message notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_coach_message() from public, anon, authenticated;

create or replace function public.notify_checkin_wellbeing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  coach uuid;
  parts text[] := '{}';
  details text[] := '{}';
  serious boolean := false;
begin
  if new.symptoms_status = 'reported' and (tg_op = 'INSERT' or old.symptoms_status is distinct from 'reported') then
    serious := true;
    details := details || ('Serious symptoms: ' || coalesce(new.symptoms, '?'));
  end if;
  if new.pain_status = 'reported' and (tg_op = 'INSERT' or old.pain_status is distinct from 'reported') then
    parts := parts || 'pain or injury'::text;
    details := details || ('Pain (' || coalesce(new.pain_area, '?') || '): ' || coalesce(new.pain_notes, ''));
  end if;
  if new.fatigue_status = 'reported' and (tg_op = 'INSERT' or old.fatigue_status is distinct from 'reported') then
    parts := parts || 'fatigue'::text;
    details := details || ('Fatigue (' || coalesce(new.fatigue_cause, '?') || '): ' || coalesce(new.fatigue_notes, ''));
  end if;
  if new.mental_status = 'reported' and (tg_op = 'INSERT' or old.mental_status is distinct from 'reported') then
    parts := parts || 'mental exhaustion'::text;
    details := details || ('Mental (' || coalesce(new.mental_cause, '?') || '): ' || coalesce(new.mental_notes, ''));
  end if;
  if new.balance_status = 'reported' and (tg_op = 'INSERT' or old.balance_status is distinct from 'reported') then
    parts := parts || 'dizziness or balance worries'::text;
    details := details || ('Dizziness or balance: ' || coalesce(new.balance_notes, ''));
  end if;
  if array_length(details, 1) is null then
    return new;
  end if;

  select c.name, c.trainer_id into who, coach from public.clients c where c.id = new.client_id;
  if coach is null then
    return new;
  end if;

  perform public.push_to_user(
    coach,
    case when serious
      then '🚨 ' || coalesce(who, 'A client') || ' reported serious symptoms. Workouts are on hold.'
      else coalesce(who, 'A client') || ' reported ' || array_to_string(parts, ', ') end,
    array_to_string(details, ' · '),
    jsonb_build_object('type', 'checkin_wellbeing', 'clientId', new.client_id)
  );
  return new;
exception when others then
  raise warning 'check-in wellbeing notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_checkin_wellbeing() from public, anon, authenticated;

create or replace function public.notify_exercise_pain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  coach uuid;
  place text;
begin
  select c.name, c.trainer_id into who, coach from public.clients c where c.id = new.client_id;
  if coach is null then
    return new;
  end if;
  place := case new.area when 'core' then 'lower back' when 'wrist' then 'wrist or elbow' when 'ankle' then 'ankle or foot' else new.area end;

  perform public.push_to_user(
    coach,
    coalesce(who, 'A client') || ': ' || new.exercise_name || ' hurts',
    'Their ' || place || ' hurt during ' || new.exercise_name || coalesce(', so they tried ' || new.tried_name || ' instead.', ', so they left it out today.'),
    jsonb_build_object('type', 'checkin_wellbeing', 'clientId', new.client_id)
  );
  return new;
exception when others then
  raise warning 'exercise pain notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_exercise_pain() from public, anon, authenticated;

create or replace function public.request_login_help(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  typed text := left(lower(trim(coalesce(p_email, ''))), 200);
  uid uuid;
  who text;
  coach uuid;
  is_trainer boolean := false;
  owner_id uuid;
  push_title text;
  push_body text;
  push_data jsonb;
begin
  if typed = '' or position('@' in typed) = 0 then
    return;
  end if;
  if exists (select 1 from public.login_help_requests r where r.email = typed and r.created_at > now() - interval '10 minutes') then
    return;
  end if;
  if (select count(*) from public.login_help_requests r where r.created_at > now() - interval '1 hour') >= 30 then
    return;
  end if;
  insert into public.login_help_requests (email) values (typed);

  select t.id into owner_id from public.trainers t where t.is_owner order by t.created_at limit 1;
  select u.id into uid from auth.users u where lower(u.email) = typed limit 1;

  if uid is not null then
    select t.name into who from public.trainers t where t.id = uid;
    is_trainer := who is not null;
    if not is_trainer then
      select c.name, c.trainer_id into who, coach from public.clients c where c.id = uid;
    end if;
  end if;

  if uid is not null and not is_trainer and coach is not null then
    push_title := coalesce(who, 'A client') || ' can''t log in';
    push_body := 'They tapped Forgot password. Open their page, tap Log-in help, then Send on WhatsApp.';
    push_data := jsonb_build_object('type', 'login_help', 'clientId', uid);
  elsif is_trainer then
    coach := owner_id;
    push_title := coalesce(who, 'A trainer') || ' can''t log in';
    push_body := 'They tapped Forgot password. Open Trainers, tap them, then Log-in help.';
    push_data := jsonb_build_object('type', 'login_help', 'trainerId', uid);
  else
    coach := owner_id;
    push_title := 'Someone can''t log in';
    push_body := 'They typed ' || typed || ', which isn''t in the app. It may be spelt differently from sign-up. Find them in the app and fix it under Log-in help.';
    push_data := jsonb_build_object('type', 'login_help');
  end if;

  if coach is null then
    return;
  end if;

  perform public.push_to_user(coach, push_title, push_body, push_data);
exception when others then
  raise warning 'login help alert failed: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Marking things read
-- ---------------------------------------------------------------------------
-- One item (p_id), or everything (null). A coach message read here is read on
-- the Today card too.
create or replace function public.mark_inbox_read(p_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return;
  end if;
  update public.coach_messages m set read_at = now()
  where m.client_id = me and m.read_at is null
    and (
      p_id is null
      or m.id::text = (select i.data ->> 'messageId' from public.inbox_items i where i.id = p_id and i.user_id = me)
    );
  update public.inbox_items i set read_at = now()
  where i.user_id = me and i.read_at is null and (p_id is null or i.id = p_id);
end;
$$;

revoke execute on function public.mark_inbox_read(uuid) from public, anon;
grant execute on function public.mark_inbox_read(uuid) to authenticated;

-- "Got it" on the Today card clears the coach messages in the inbox too.
create or replace function public.mark_coach_messages_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.coach_messages set read_at = now() where client_id = auth.uid() and read_at is null;
  update public.inbox_items set read_at = now()
  where user_id = auth.uid() and read_at is null and data ->> 'type' = 'coach_message';
$$;

revoke execute on function public.mark_coach_messages_read() from public, anon;
grant execute on function public.mark_coach_messages_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Bring in the last 60 days of coach messages
-- ---------------------------------------------------------------------------
insert into public.inbox_items (user_id, title, body, data, created_at, read_at)
select
  m.client_id,
  'Message from ' || coalesce(nullif(t.business_name, ''), t.name, 'your coach'),
  m.body,
  jsonb_build_object('type', 'coach_message', 'messageId', m.id),
  m.created_at,
  m.read_at
from public.coach_messages m
join auth.users u on u.id = m.client_id
left join public.trainers t on t.id = m.trainer_id
where m.created_at > now() - interval '60 days'
  and not exists (
    select 1 from public.inbox_items i
    where i.user_id = m.client_id and i.data ->> 'messageId' = m.id::text
  );
