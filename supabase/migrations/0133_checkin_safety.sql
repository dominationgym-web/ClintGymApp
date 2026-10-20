-- Check-in safety (GRIZZ, 2026-10-20: "Add the missing dizziness, balance
-- and serious-symptom questions using our existing check-in and alert
-- system. Serious symptoms must show clear stop-exercise and appropriate
-- medical referral guidance. Any safety hold must have a documented,
-- appropriate resolution before training resumes" and "the trainer must
-- confirm appropriate medical assessment or resolution before clearing the
-- workout hold. Simply typing a note shouldn't be sufficient").
--
-- Two more Body and mind answers on the check-in. Dizziness or balance
-- worries raise an amber 'balance' problem like pain and fatigue do.
-- Serious symptoms raise a red 'medical' problem, which holds the client's
-- workouts until their trainer clears it with clear_medical_hold: who
-- assessed them and when, and either a medical all-clear or that the client
-- confirmed they tapped it by mistake. Busy fixing and Fixed can't close it.

alter table public.checkins
  add column if not exists balance_status text check (balance_status in ('ok', 'reported')),
  add column if not exists balance_notes text check (balance_notes is null or char_length(balance_notes) <= 1000),
  add column if not exists symptoms_status text check (symptoms_status in ('ok', 'reported')),
  add column if not exists symptoms text check (symptoms is null or char_length(symptoms) <= 300);

alter table public.client_problems drop constraint client_problems_topic_check,
  add constraint client_problems_topic_check check (topic in ('pain', 'fatigue', 'mental', 'flag', 'balance', 'medical'));

alter table public.client_problems
  add column if not exists clearance text check (clearance is null or clearance in ('medical_cleared', 'reported_in_error')),
  add column if not exists cleared_by text check (cleared_by is null or char_length(cleared_by) between 1 and 200),
  add column if not exists cleared_on date,
  add column if not exists clearance_note text check (clearance_note is null or char_length(clearance_note) <= 1000);

-- Whether the client's workouts are on hold.
create or replace function public.has_medical_hold(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.client_problems where client_id = p_client and topic = 'medical' and status <> 'fixed')
    and (p_client = auth.uid() or exists (select 1 from public.clients c where c.id = p_client and c.trainer_id = auth.uid()));
$$;
revoke all on function public.has_medical_hold(uuid) from public, anon;
grant execute on function public.has_medical_hold(uuid) to authenticated;

create or replace function public.client_problems_from_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pain_status = 'reported' and (tg_op = 'INSERT' or old.pain_status is distinct from 'reported') then
    perform public.raise_client_problem(new.client_id, 'pain',
      concat_ws(': ', nullif(new.pain_area, ''), nullif(new.pain_notes, '')));
  end if;
  if new.fatigue_status = 'reported' and (tg_op = 'INSERT' or old.fatigue_status is distinct from 'reported') then
    perform public.raise_client_problem(new.client_id, 'fatigue',
      concat_ws(': ', nullif(new.fatigue_cause, ''), nullif(new.fatigue_notes, '')));
  end if;
  if new.mental_status = 'reported' and (tg_op = 'INSERT' or old.mental_status is distinct from 'reported') then
    perform public.raise_client_problem(new.client_id, 'mental',
      concat_ws(': ', nullif(new.mental_cause, ''), nullif(new.mental_notes, '')));
  end if;
  if new.balance_status = 'reported' and (tg_op = 'INSERT' or old.balance_status is distinct from 'reported') then
    perform public.raise_client_problem(new.client_id, 'balance', coalesce(new.balance_notes, ''));
  end if;
  if new.symptoms_status = 'reported' and (tg_op = 'INSERT' or old.symptoms_status is distinct from 'reported') then
    perform public.raise_client_problem(new.client_id, 'medical', coalesce(new.symptoms, ''));
  end if;
  return new;
exception when others then
  raise warning 'client problem from check-in failed: %', sqlerrm;
  return new;
end;
$$;

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
  messages jsonb;
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

  select jsonb_agg(jsonb_build_object(
    'to', p.expo_push_token,
    'title', case when serious
      then '🚨 ' || coalesce(who, 'A client') || ' reported serious symptoms. Workouts are on hold.'
      else coalesce(who, 'A client') || ' reported ' || array_to_string(parts, ', ') end,
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
  raise warning 'check-in wellbeing notification failed: %', sqlerrm;
  return new;
end;
$$;

-- Fixed never closes a serious-symptoms hold: that takes clear_medical_hold.
create or replace function public.set_client_problem_status(p_client uuid, p_status text, p_problem uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('fixing', 'fixed') then
    raise exception 'Unknown status %', p_status;
  end if;
  if not exists (select 1 from public.clients c where c.id = p_client and c.trainer_id = auth.uid())
     or not public.not_unapproved_trainer() then
    raise exception 'Not your client';
  end if;
  if p_status = 'fixed' and p_problem is not null
     and exists (select 1 from public.client_problems where id = p_problem and topic = 'medical') then
    raise exception 'Confirm the medical check first';
  end if;

  if p_status = 'fixing' then
    update public.client_problems
    set status = 'fixing', fixing_on = public.sa_today(), followup_sent_at = null
    where client_id = p_client and status = 'open' and (p_problem is null or id = p_problem);
  else
    update public.client_problems
    set status = 'fixed', fixed_at = now()
    where client_id = p_client and status <> 'fixed' and topic <> 'medical' and (p_problem is null or id = p_problem);

    if not exists (select 1 from public.client_problems where client_id = p_client and topic = 'flag' and status <> 'fixed') then
      update public.clients
      set status_flag = 'green', status_flag_note = null
      where id = p_client and status_flag <> 'green';
    end if;
  end if;
end;
$$;

create or replace function public.clear_medical_hold(
  p_problem uuid,
  p_clearance text,
  p_cleared_by text,
  p_cleared_on date,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pr public.client_problems;
  by_whom text := nullif(left(btrim(coalesce(p_cleared_by, '')), 200), '');
begin
  select * into pr from public.client_problems where id = p_problem and topic = 'medical' and status <> 'fixed';
  if pr.id is null then
    raise exception 'That hold is already cleared';
  end if;
  if not exists (select 1 from public.clients c where c.id = pr.client_id and c.trainer_id = auth.uid())
     or not public.not_unapproved_trainer() then
    raise exception 'Not your client';
  end if;
  if p_clearance is null or p_clearance not in ('medical_cleared', 'reported_in_error') then
    raise exception 'Pick how it was resolved';
  end if;
  if by_whom is null then
    raise exception 'Say who assessed or confirmed it';
  end if;
  if p_cleared_on is null or p_cleared_on > public.sa_today() or p_cleared_on < pr.reported_on then
    raise exception 'The date must be between the report and today';
  end if;

  update public.client_problems
  set status = 'fixed', fixed_at = now(), clearance = p_clearance, cleared_by = by_whom,
      cleared_on = p_cleared_on, clearance_note = nullif(left(btrim(coalesce(p_note, '')), 1000), '')
  where id = pr.id;
end;
$$;
revoke all on function public.clear_medical_hold(uuid, text, text, date, text) from public, anon;
grant execute on function public.clear_medical_hold(uuid, text, text, date, text) to authenticated;

create or replace function public.reply_to_client_problem(p_problem uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pr public.client_problems;
  who text;
  label text;
  reply text := left(btrim(coalesce(p_reply, '')), 1000);
begin
  if reply = '' then
    raise exception 'Write a reply first';
  end if;
  select * into pr from public.client_problems where id = p_problem and client_id = auth.uid();
  if pr.id is null then
    raise exception 'Problem not found';
  end if;

  update public.client_problems set client_reply = reply, client_replied_at = now() where id = pr.id;

  select c.name into who from public.clients c where c.id = pr.client_id;
  label := case pr.topic when 'pain' then 'pain or injury' when 'fatigue' then 'fatigue'
    when 'mental' then 'mental exhaustion' when 'balance' then 'dizziness or balance'
    when 'medical' then 'serious symptoms' else 'request for help' end;
  if pr.trainer_id is not null then
    perform public.push_to_user(
      pr.trainer_id,
      coalesce(who, 'A client') || ' replied about their ' || label,
      reply,
      jsonb_build_object('type', 'problem_reply', 'clientId', pr.client_id)
    );
  end if;
end;
$$;

-- The next-day "how is it going since we made changes?" message isn't right
-- for serious symptoms, which wait for the trainer's medical check instead.
create or replace function public.problem_followups()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pr record;
  label text;
begin
  for pr in
    select p.id, p.client_id, p.trainer_id, p.topic, p.detail, c.name
    from public.client_problems p
    join public.clients c on c.id = p.client_id
    where p.status = 'fixing'
      and p.topic <> 'medical'
      and p.fixing_on < public.sa_today()
      and p.followup_sent_at is null
      and p.trainer_id is not null
      and c.trainer_id = p.trainer_id
      and c.access_status <> 'expired'
  loop
    label := case pr.topic when 'pain' then 'pain or injury' when 'fatigue' then 'fatigue'
      when 'mental' then 'mental exhaustion' when 'balance' then 'dizziness or balance'
      else 'request for help' end;
    insert into public.coach_messages (client_id, trainer_id, body, problem_id)
    values (
      pr.client_id,
      pr.trainer_id,
      'Hi ' || split_part(coalesce(pr.name, ''), ' ', 1) || ', checking in on your ' || label
        || case when pr.detail <> '' then ' (' || left(pr.detail, 80) || ')' else '' end
        || '. How is it going since we made changes? Tap Reply and let me know if anything needs adjusting.',
      pr.id
    );
    update public.client_problems set followup_sent_at = now() where id = pr.id;
  end loop;
end;
$$;
