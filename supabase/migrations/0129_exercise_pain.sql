-- "This hurts" (GRIZZ, 2026-10-20: "need to allow the client to identify
-- which exercise hurts. So if it's an incline press or above the head press
-- then he says it hurts and gets to try a flat press"). One row each time a
-- client says an exercise hurts during a workout: where, and what they tried
-- instead (null if they left it out today). The client adds rows, the trainer
-- reads them and gets a push. Rows are never changed or deleted by the app.
create table if not exists public.client_exercise_pain (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.clients (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null check (length(exercise_name) between 1 and 200),
  area text not null check (area in ('shoulder', 'wrist', 'core', 'hip', 'knee', 'ankle', 'neck')),
  tried_exercise_id uuid references public.exercises (id) on delete set null,
  tried_name text check (tried_name is null or length(tried_name) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists client_exercise_pain_client on public.client_exercise_pain (client_id, created_at desc);

alter table public.client_exercise_pain enable row level security;

create policy "exercise pain client adds" on public.client_exercise_pain
  for insert to authenticated
  with check (client_id = (select auth.uid()));

create policy "exercise pain client reads" on public.client_exercise_pain
  for select to authenticated
  using (client_id = (select auth.uid()));

create policy "exercise pain trainer reads" on public.client_exercise_pain
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

-- Push to the trainer, like the check-in pain reports (0055).
create or replace function public.notify_exercise_pain()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  who text;
  coach uuid;
  messages jsonb;
  place text;
begin
  select c.name, c.trainer_id into who, coach from public.clients c where c.id = new.client_id;
  if coach is null then
    return new;
  end if;
  place := case new.area when 'core' then 'lower back' when 'wrist' then 'wrist or elbow' when 'ankle' then 'ankle or foot' else new.area end;

  select jsonb_agg(jsonb_build_object(
    'to', p.expo_push_token,
    'title', coalesce(who, 'A client') || ': ' || new.exercise_name || ' hurts',
    'body', left('Their ' || place || ' hurt during ' || new.exercise_name || coalesce(', so they tried ' || new.tried_name || ' instead.', ', so they left it out today.'), 180),
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
  raise warning 'exercise pain notification failed: %', sqlerrm;
  return new;
end;
$function$;

create trigger client_exercise_pain_notify
  after insert on public.client_exercise_pain
  for each row execute function public.notify_exercise_pain();
