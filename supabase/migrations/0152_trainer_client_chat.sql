-- Trainer-client chat with photos and voice notes, and a nudge to the trainer
-- to check in on clients he hasn't spoken to (GRIZZ, 2026-10-25: "an inter
-- client chat box with voice note options" and "remind the trainer to check in
-- on Nancy because you haven't spoken to her in a few days ... instead of
-- random messages").
--
--   * chat_messages: a two-way conversation between a client and their trainer.
--     Text, a photo (with an optional caption) or a voice note. Files live in
--     the private chat-media bucket under the client's id. Arrives live
--     (realtime) and as a phone notification to the other side.
--   * clients.trainer_contact_at: the trainer tapped "Spoke in person" on a
--     check-in nudge, which counts as speaking to them.
--   * quiet_clients(): active clients the trainer hasn't messaged in 4+ days,
--     for the Dashboard card and a 09:00 phone reminder. Nothing is ever sent
--     to the client on the trainer's behalf.
--
-- coach_messages (0034) stays as it is: alert replies, form video feedback and
-- habit win messages still go there, and count as speaking to the client.

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  from_trainer boolean not null,
  kind text not null default 'text' check (kind in ('text', 'photo', 'voice')),
  body text check (body is null or char_length(btrim(body)) between 1 and 2000),
  -- In the chat-media bucket, under the client's id.
  media_path text check (media_path is null or char_length(media_path) <= 300),
  -- Voice notes only: how long it is, shown before it's played.
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 600000),
  created_at timestamptz not null default now(),
  -- When the other side opened the chat after it arrived.
  read_at timestamptz,
  check (
    (kind = 'text' and body is not null and media_path is null)
    or (kind = 'photo' and media_path is not null)
    or (kind = 'voice' and media_path is not null and body is null)
  )
);

create index if not exists chat_messages_client_idx on public.chat_messages (client_id, created_at desc);
create index if not exists chat_messages_trainer_idx on public.chat_messages (trainer_id, created_at desc);

alter table public.chat_messages enable row level security;

-- The client sees their own chat; a trainer sees the chats they are part of
-- (so a client who moves trainer doesn't take the old chat to the new one).
create policy "chat client or trainer reads" on public.chat_messages
  for select to authenticated
  using (client_id = (select auth.uid()) or trainer_id = (select auth.uid()));

create policy "chat client sends to own trainer" on public.chat_messages
  for insert to authenticated
  with check (
    not from_trainer
    and read_at is null
    and client_id = (select auth.uid())
    and trainer_id = (select c.trainer_id from public.clients c where c.id = (select auth.uid()))
    and client_id <> trainer_id
    and (media_path is null or (storage.foldername(media_path))[1] = client_id::text)
  );

create policy "chat trainer sends to own client" on public.chat_messages
  for insert to authenticated
  with check (
    from_trainer
    and read_at is null
    and trainer_id = (select auth.uid())
    and client_id <> trainer_id
    and exists (
      select 1 from public.clients c
      where c.id = chat_messages.client_id and c.trainer_id = (select auth.uid())
    )
    and (media_path is null or (storage.foldername(media_path))[1] = client_id::text)
  );

-- No update or delete policies: a sent message can't be changed. Each side
-- marks the other side's messages read through this, which only sets read_at.
create or replace function public.mark_chat_read(p_client uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_messages
  set read_at = now()
  where read_at is null
    and (
      (from_trainer and client_id = auth.uid())
      or (not from_trainer and client_id = p_client and trainer_id = auth.uid())
    );
$$;

revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- Live delivery to an open chat. Realtime applies the select policy above.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
    )
  then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Photos and voice notes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media', 'chat-media', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic',
        'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/3gpp']
)
on conflict (id) do nothing;

create policy "chat media client or trainer uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[1] and c.trainer_id = (select auth.uid())
      )
    )
  );

create policy "chat media client or trainer reads" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[1] and c.trainer_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Phone notification to the other side
-- ---------------------------------------------------------------------------
create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender text;
  preview text;
begin
  preview := case new.kind
    when 'voice' then '🎤 Voice note'
    when 'photo' then '📷 Photo' || coalesce(': ' || new.body, '')
    else new.body
  end;
  if new.from_trainer then
    select coalesce(nullif(trim(t.business_name), ''), nullif(trim(t.name), ''), 'Your coach') into sender
    from public.trainers t where t.id = new.trainer_id;
    perform public.push_to_user(
      new.client_id,
      '💬 ' || coalesce(sender, 'Your coach'),
      preview,
      jsonb_build_object('type', 'chat_message', 'clientId', new.client_id)
    );
  else
    select trim(c.name) into sender from public.clients c where c.id = new.client_id;
    perform public.push_to_user(
      new.trainer_id,
      '💬 ' || coalesce(sender, 'Your client'),
      preview,
      jsonb_build_object('type', 'chat_message', 'clientId', new.client_id)
    );
  end if;
  return new;
exception when others then
  raise warning 'chat notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_chat_message() from public, anon, authenticated;

drop trigger if exists chat_messages_notify on public.chat_messages;
create trigger chat_messages_notify after insert on public.chat_messages
  for each row execute function public.notify_chat_message();

-- ---------------------------------------------------------------------------
-- The trainer's chat list
-- ---------------------------------------------------------------------------
-- Every client still training, plus anyone else with a chat, newest first.
create or replace function public.trainer_chat_list()
returns table (
  client_id uuid,
  name text,
  avatar_path text,
  last_at timestamptz,
  last_kind text,
  last_body text,
  last_from_trainer boolean,
  unread integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.avatar_path, m.created_at, m.kind, m.body, m.from_trainer,
    (select count(*)::int from public.chat_messages u
     where u.client_id = c.id and u.trainer_id = c.trainer_id and not u.from_trainer and u.read_at is null)
  from public.clients c
  left join lateral (
    select l.created_at, l.kind, l.body, l.from_trainer
    from public.chat_messages l
    where l.client_id = c.id and l.trainer_id = c.trainer_id
    order by l.created_at desc
    limit 1
  ) m on true
  where c.trainer_id = auth.uid()
    and c.id <> c.trainer_id
    and c.archived_at is null
    and (c.access_status <> 'expired' or m.created_at is not null)
  order by m.created_at desc nulls last, c.name;
$$;

revoke execute on function public.trainer_chat_list() from public, anon;
grant execute on function public.trainer_chat_list() to authenticated;

-- ---------------------------------------------------------------------------
-- Check-in nudges
-- ---------------------------------------------------------------------------
alter table public.clients add column if not exists trainer_contact_at timestamptz;

-- Active clients whose trainer last messaged them (chat or coach message), or
-- spoke to them in person, p_days or more days ago. A client never messaged
-- counts from when they started (or came back), so a new client shows up too.
create or replace function public.quiet_clients_for(p_trainer uuid, p_days integer default 4)
returns table (client_id uuid, name text, last_spoke_at timestamptz, days_quiet integer)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.name, q.spoke, public.sa_today() - (q.since at time zone 'Africa/Johannesburg')::date
  from (
    select c.id, c.name,
      greatest(chat.last_at, coach.last_at, c.trainer_contact_at) as spoke,
      coalesce(
        greatest(chat.last_at, coach.last_at, c.trainer_contact_at),
        greatest(c.returned_at, c.plan_started_at::timestamptz, c.created_at)
      ) as since
    from public.clients c
    left join lateral (
      select max(m.created_at) as last_at from public.chat_messages m
      where m.client_id = c.id and m.trainer_id = c.trainer_id and m.from_trainer
    ) chat on true
    left join lateral (
      select max(cm.created_at) as last_at from public.coach_messages cm
      where cm.client_id = c.id and cm.trainer_id = c.trainer_id
    ) coach on true
    where c.trainer_id = p_trainer
      and c.id <> c.trainer_id
      and c.archived_at is null
      and c.access_status <> 'expired'
  ) q
  where public.sa_today() - (q.since at time zone 'Africa/Johannesburg')::date >= p_days
  order by q.since, q.name;
$$;

revoke execute on function public.quiet_clients_for(uuid, integer) from public, anon, authenticated;

-- The signed-in trainer's own quiet clients, for the Dashboard card.
create or replace function public.quiet_clients()
returns table (client_id uuid, name text, last_spoke_at timestamptz, days_quiet integer)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.quiet_clients_for(auth.uid());
$$;

revoke execute on function public.quiet_clients() from public, anon;
grant execute on function public.quiet_clients() to authenticated;

-- "Spoke in person": the trainer saw them at the gym, so no nudge for a while.
create or replace function public.mark_spoke_to_client(p_client uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clients set trainer_contact_at = now()
  where id = p_client and trainer_id = auth.uid();
$$;

revoke execute on function public.mark_spoke_to_client(uuid) from public, anon;
grant execute on function public.mark_spoke_to_client(uuid) to authenticated;

-- 09:00 each morning: one notification per trainer naming who to check in on.
create or replace function public.checkin_nudges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  first_name text;
  n integer;
  days integer;
begin
  for t in select tr.id from public.trainers tr where tr.approved loop
    select count(*) into n from public.quiet_clients_for(t.id) q;
    if n = 0 then
      continue;
    end if;
    -- The quietest client by name; the others are counted.
    select split_part(trim(q.name), ' ', 1), q.days_quiet into first_name, days
    from public.quiet_clients_for(t.id) q
    order by q.days_quiet desc, q.name
    limit 1;
    perform public.push_to_user(
      t.id,
      '💬 Check in on ' || first_name || case when n > 1 then ' and ' || (n - 1) || ' more' else '' end,
      'You haven''t spoken to ' || first_name || ' in ' || days || ' days. A quick personal message makes them feel looked after.',
      jsonb_build_object('type', 'checkin_nudge')
    );
  end loop;
end;
$$;

revoke execute on function public.checkin_nudges() from public, anon, authenticated;

select cron.unschedule('checkin-nudges-daily')
where exists (select 1 from cron.job where jobname = 'checkin-nudges-daily');
-- 07:00 UTC is 09:00 in South Africa.
select cron.schedule('checkin-nudges-daily', '0 7 * * *', $$select public.checkin_nudges();$$);
