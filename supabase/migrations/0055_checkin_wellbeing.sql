-- Body and mind on the daily check-in (2026-10-11). The client answers three
-- questions every day: pain or injury (training or not), fatigue (poor sleep,
-- a heavy weekend...) and mental exhaustion (kids, family...). Each is "ok"
-- or "reported"; a report needs what it is (area or cause) and a note.
-- distress_flag stays set whenever anything is reported, so the dashboard's
-- existing alerts and sorting pick it up. The trainer sees the reports in
-- three sections on the client's Notes tab, and gets a phone notification.

alter table public.checkins
  add column if not exists pain_status text check (pain_status in ('ok', 'reported')),
  add column if not exists pain_area text,
  add column if not exists pain_notes text check (pain_notes is null or length(pain_notes) <= 1000),
  add column if not exists fatigue_status text check (fatigue_status in ('ok', 'reported')),
  add column if not exists fatigue_cause text,
  add column if not exists fatigue_notes text check (fatigue_notes is null or length(fatigue_notes) <= 1000),
  add column if not exists mental_status text check (mental_status in ('ok', 'reported')),
  add column if not exists mental_cause text,
  add column if not exists mental_notes text check (mental_notes is null or length(mental_notes) <= 1000);

-- Tells the trainer's phone when a client newly reports pain, fatigue or
-- mental exhaustion (only in the installed app, where push tokens exist).
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
  messages jsonb;
begin
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
  if array_length(parts, 1) is null then
    return new;
  end if;

  select c.name, c.trainer_id into who, coach from public.clients c where c.id = new.client_id;
  if coach is null then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', p.expo_push_token,
    'title', coalesce(who, 'A client') || ' reported ' || array_to_string(parts, ', '),
    'body', left(array_to_string(details, ' · '), 180),
    'sound', 'default',
    'channelId', 'messages',
    'data', jsonb_build_object('type', 'checkin_wellbeing', 'clientId', new.client_id)
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
  return new;
exception when others then
  -- The check-in is what matters; a notification that fails to queue must not
  -- stop it from saving.
  raise warning 'check-in wellbeing notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_checkin_wellbeing() from public, anon, authenticated;

create or replace trigger checkins_wellbeing_notify
  after insert or update on public.checkins
  for each row execute function public.notify_checkin_wellbeing();
