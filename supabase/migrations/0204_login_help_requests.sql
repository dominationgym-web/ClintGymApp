-- "Forgot your password?" alerts (GRIZZ, 2026-11-09): a client who can't log
-- in types their email and taps one button. Their trainer gets a push straight
-- away and opens the client's page, where 🔑 Log-in help makes a new password.
-- A trainer's request goes to the owner. An email the app doesn't know (most
-- likely mistyped at sign-up) also goes to the owner, with the email they typed.
--
-- Anyone can call it (they're logged out), so it never says whether the email
-- exists, and it sends at most one alert per email every 10 minutes and 30
-- alerts an hour in total.

create table public.login_help_requests (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);
create index login_help_requests_email_idx on public.login_help_requests (email, created_at desc);
alter table public.login_help_requests enable row level security;
-- No policies: only the function below reads or writes it.

create or replace function public.request_login_help(p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  typed text := left(lower(trim(coalesce(p_email, ''))), 200);
  uid uuid;
  who text;
  coach uuid;
  is_trainer boolean := false;
  owner_id uuid;
  messages jsonb;
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
  delete from public.login_help_requests where created_at < now() - interval '30 days';

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
    push_body := left('They typed ' || typed || ', which isn''t in the app. It may be spelt differently from sign-up. Find them in the app and fix it under Log-in help.', 180);
    push_data := jsonb_build_object('type', 'login_help');
  end if;

  if coach is null then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', p.expo_push_token,
    'title', push_title,
    'body', push_body,
    'sound', 'default',
    'channelId', 'messages',
    'data', push_data
  ))
  into messages
  from public.push_tokens p
  where p.user_id = coach;

  if messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := messages
    );
  end if;
exception when others then
  raise warning 'login help alert failed: %', sqlerrm;
end;
$function$;

revoke all on function public.request_login_help(text) from public;
grant execute on function public.request_login_help(text) to anon, authenticated;
