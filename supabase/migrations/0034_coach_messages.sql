-- Let a trainer answer a client straight from an alert.
--
-- A client raising a red or orange flag (0008) showed up on the trainer's
-- dashboard, but there was nowhere in the app to answer them. This adds:
--
--   * coach_messages: a message from a trainer to one of their own clients.
--     The client sees it in the app (live, via realtime) and marks it read.
--   * Saving the phone's push token (push_tokens, from 0001), so a new message
--     also arrives as a phone notification in the installed app. Expo Go can't
--     receive these, so there the in-app card is the whole message.
--   * A trigger that sends that notification through Expo's push service with
--     pg_net (already enabled by 0032). It never blocks the message itself.

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  -- The flag the client had up when the trainer replied, if any, so the
  -- answer can be read against the flag event log (0023).
  reply_to_flag public.client_status_flag,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index coach_messages_client_idx on public.coach_messages (client_id, created_at desc);
create index coach_messages_trainer_idx on public.coach_messages (trainer_id);

alter table public.coach_messages enable row level security;

-- The client it was sent to, and that client's trainer.
create policy "coach messages select own or trainer" on public.coach_messages
  for select using (
    client_id = (select auth.uid())
    or exists (
      select 1 from public.clients c
      where c.id = coach_messages.client_id
        and c.trainer_id = (select auth.uid())
    )
  );

-- Only a trainer, only as themselves, and only to a client of their own.
create policy "trainer messages own clients" on public.coach_messages
  for insert to authenticated
  with check (
    trainer_id = (select auth.uid())
    and read_at is null
    and exists (
      select 1 from public.clients c
      where c.id = coach_messages.client_id
        and c.trainer_id = (select auth.uid())
    )
  );

-- No update or delete policies: a sent message can't be edited by either side.
-- The client marks theirs read through this function, which touches read_at
-- and nothing else.
create or replace function public.mark_coach_messages_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.coach_messages
  set read_at = now()
  where client_id = auth.uid() and read_at is null;
$$;

revoke execute on function public.mark_coach_messages_read() from public, anon;
grant execute on function public.mark_coach_messages_read() to authenticated;

-- Live delivery to an open app. Realtime applies the select policy above to
-- each subscriber, so a client only ever receives their own messages.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'coach_messages'
    )
  then
    alter publication supabase_realtime add table public.coach_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Push tokens
-- ---------------------------------------------------------------------------
-- public.push_tokens has existed since 0001 but nothing wrote to it until now.
-- A phone should only get the messages of whoever last signed in on it, so a
-- token belongs to one account at a time, and registering it moves it over to
-- the account now signed in. Moving it means touching another user's row,
-- which the "push tokens owned by user" policy rightly hides, hence a
-- function. Sign-out removes the user's own row directly through that policy.
alter table public.push_tokens
  add constraint push_tokens_expo_push_token_key unique (expo_push_token);

create or replace function public.register_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_tokens (user_id, expo_push_token)
  select auth.uid(), p_token
  where auth.uid() is not null and p_token like 'ExponentPushToken[%]'
  on conflict (expo_push_token) do update set user_id = excluded.user_id, created_at = now();
$$;

revoke execute on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Phone notification for each new message
-- ---------------------------------------------------------------------------
create or replace function public.notify_coach_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender text;
  messages jsonb;
begin
  select coalesce(nullif(t.business_name, ''), t.name) into sender
  from public.trainers t where t.id = new.trainer_id;

  select jsonb_agg(jsonb_build_object(
    'to', p.expo_push_token,
    'title', 'Message from ' || coalesce(sender, 'your coach'),
    'body', left(new.body, 180),
    'sound', 'default',
    'channelId', 'messages',
    'data', jsonb_build_object('type', 'coach_message', 'messageId', new.id)
  ))
  into messages
  from public.push_tokens p
  where p.user_id = new.client_id;

  if messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := messages
    );
  end if;
  return new;
exception when others then
  -- The message is what matters; a notification that fails to queue must not
  -- stop it from being sent.
  raise warning 'coach message notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_coach_message() from public, anon, authenticated;

create trigger coach_messages_notify
  after insert on public.coach_messages
  for each row execute function public.notify_coach_message();
