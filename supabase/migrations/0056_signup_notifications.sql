-- Phone notifications around signing up (2026-10-11), for every trainer:
--  * a trainer hears straight away when a new client signs up with them;
--  * the client hears as soon as their trainer activates their account;
--  * the app owner hears when a new trainer applies, and the trainer hears
--    when they're approved.
-- Only in the installed app, where phones register push tokens (0034).

-- Sends one notification to every phone the user is signed in on.
create or replace function public.push_to_user(p_user uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
begin
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

create or replace function public.notify_client_signup_and_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.push_to_user(
      new.trainer_id,
      'New client signed up',
      coalesce(new.name, 'Someone') || ' just signed up. Activate them on the Clients tab once they''ve paid.',
      jsonb_build_object('type', 'client_signup', 'clientId', new.id)
    );
  elsif old.access_status = 'expired' and new.access_status in ('active', 'expiring_soon') then
    perform public.push_to_user(
      new.id,
      'You''re in! 🎉',
      'Your trainer has activated your account. Open the app to get started.',
      jsonb_build_object('type', 'client_activated')
    );
  end if;
  return new;
exception when others then
  raise warning 'client signup notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_client_signup_and_activation() from public, anon, authenticated;

create or replace trigger clients_signup_notify
  after insert or update of access_status on public.clients
  for each row execute function public.notify_client_signup_and_activation();

create or replace function public.notify_trainer_signup_and_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if tg_op = 'INSERT' and not coalesce(new.approved, false) then
    for owner_id in select t.id from public.trainers t where t.is_owner loop
      perform public.push_to_user(
        owner_id,
        'New trainer application',
        coalesce(new.name, 'A trainer') || ' wants to join. Approve them on the Trainers tab.',
        jsonb_build_object('type', 'trainer_signup', 'trainerId', new.id)
      );
    end loop;
  elsif tg_op = 'UPDATE' and new.approved and not coalesce(old.approved, false) then
    perform public.push_to_user(
      new.id,
      'You''re approved! 🎉',
      'Your trainer account is ready. Open the app to set up your profile and invite clients.',
      jsonb_build_object('type', 'trainer_approved')
    );
  end if;
  return new;
exception when others then
  raise warning 'trainer signup notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_trainer_signup_and_approval() from public, anon, authenticated;

create or replace trigger trainers_signup_notify
  after insert or update of approved on public.trainers
  for each row execute function public.notify_trainer_signup_and_approval();
