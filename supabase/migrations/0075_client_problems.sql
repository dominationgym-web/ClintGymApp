-- Client problems: Busy fixing and Fixed buttons, and a next-day check-in.
--
-- Every problem a client raises becomes a row here: a pain/injury, fatigue or
-- mental exhaustion report on a check-in (0055), or a red/orange flag the
-- client set on their profile (0023). The trainer sees a red dot while a
-- problem is open, taps "Busy fixing" to turn it orange, and "Fixed" to make
-- the dot go away.
--
-- The day after the trainer taps Busy fixing, the app sends the client a
-- message on the trainer's behalf asking how it is going (a coach_messages row,
-- so it arrives as "Message from {business}" like any other message). The
-- client can answer it from that message, and the trainer gets the answer as a
-- phone notification and on the problem's card.
--
-- All writes go through the security-definer functions below; the table only
-- has a select policy.

create table if not exists public.client_problems (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  topic text not null check (topic in ('pain', 'fatigue', 'mental', 'flag')),
  detail text not null default '',
  reported_on date not null default public.sa_today(),
  last_reported_on date not null default public.sa_today(),
  status text not null default 'open' check (status in ('open', 'fixing', 'fixed')),
  fixing_on date,
  fixed_at timestamptz,
  followup_sent_at timestamptz,
  client_reply text check (client_reply is null or char_length(client_reply) <= 1000),
  client_replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_problems_client_status on public.client_problems (client_id, status);
create index if not exists client_problems_followup on public.client_problems (status, fixing_on) where status = 'fixing';

alter table public.client_problems enable row level security;

create policy "client problems select own or trainer" on public.client_problems
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );

-- The next-day check-in message points at its problem, so the client's reply
-- box knows what it is answering.
alter table public.coach_messages add column if not exists problem_id uuid references public.client_problems(id) on delete set null;

-- Opens a problem, or adds to the one already open for that topic (a client
-- reporting the same sore knee every day is one problem, not seven). A new
-- report does not undo Busy fixing.
create or replace function public.raise_client_problem(p_client uuid, p_topic text, p_detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
begin
  select id into existing from public.client_problems
  where client_id = p_client and topic = p_topic and status <> 'fixed'
  order by created_at desc limit 1;

  if existing is not null then
    update public.client_problems
    set detail = left(coalesce(p_detail, ''), 500), last_reported_on = public.sa_today()
    where id = existing;
  else
    insert into public.client_problems (client_id, trainer_id, topic, detail)
    select c.id, c.trainer_id, p_topic, left(coalesce(p_detail, ''), 500)
    from public.clients c where c.id = p_client;
  end if;
end;
$$;
revoke all on function public.raise_client_problem(uuid, text, text) from public, anon, authenticated;

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
  return new;
exception when others then
  raise warning 'client problem from check-in failed: %', sqlerrm;
  return new;
end;
$$;

create trigger checkins_raise_problems
  after insert or update on public.checkins
  for each row execute function public.client_problems_from_checkin();

-- A red or orange flag opens a problem; the flag going back to green (the
-- client changing it, or the trainer's Mark as resolved) fixes it.
create or replace function public.client_problems_from_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status_flag in ('red', 'orange')
     and (old.status_flag is distinct from new.status_flag or old.status_flag_note is distinct from new.status_flag_note) then
    perform public.raise_client_problem(new.id, 'flag',
      concat_ws(': ', case when new.status_flag = 'red' then 'Urgent - needs guidance' else 'Wants feedback' end,
        nullif(new.status_flag_note, '')));
  elsif new.status_flag = 'green' and old.status_flag is distinct from 'green' then
    update public.client_problems
    set status = 'fixed', fixed_at = now()
    where client_id = new.id and topic = 'flag' and status <> 'fixed';
  end if;
  return new;
exception when others then
  raise warning 'client problem from flag failed: %', sqlerrm;
  return new;
end;
$$;

create trigger clients_flag_raise_problems
  after update of status_flag, status_flag_note on public.clients
  for each row execute function public.client_problems_from_flag();

-- The trainer's buttons. With p_problem it changes that one problem; without
-- it, every problem of the client that can move (the dashboard's buttons).
-- 'fixing' only moves open problems; 'fixed' closes anything not yet fixed,
-- and a fixed flag turns the client's flag back to green.
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

  if p_status = 'fixing' then
    update public.client_problems
    set status = 'fixing', fixing_on = public.sa_today(), followup_sent_at = null
    where client_id = p_client and status = 'open' and (p_problem is null or id = p_problem);
  else
    update public.client_problems
    set status = 'fixed', fixed_at = now()
    where client_id = p_client and status <> 'fixed' and (p_problem is null or id = p_problem);

    if not exists (select 1 from public.client_problems where client_id = p_client and topic = 'flag' and status <> 'fixed') then
      update public.clients
      set status_flag = 'green', status_flag_note = null
      where id = p_client and status_flag <> 'green';
    end if;
  end if;
end;
$$;
revoke all on function public.set_client_problem_status(uuid, text, uuid) from public, anon;
grant execute on function public.set_client_problem_status(uuid, text, uuid) to authenticated;

-- The client answering the check-in. Their trainer gets it as a phone
-- notification.
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
    when 'mental' then 'mental exhaustion' else 'request for help' end;
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
revoke all on function public.reply_to_client_problem(uuid, text) from public, anon;
grant execute on function public.reply_to_client_problem(uuid, text) to authenticated;

-- Daily: the check-in message the day after Busy fixing, sent once.
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
      and p.fixing_on < public.sa_today()
      and p.followup_sent_at is null
      and p.trainer_id is not null
      and c.trainer_id = p.trainer_id
      and c.access_status <> 'expired'
  loop
    label := case pr.topic when 'pain' then 'pain or injury' when 'fatigue' then 'fatigue'
      when 'mental' then 'mental exhaustion' else 'request for help' end;
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
revoke all on function public.problem_followups() from public, anon, authenticated;

select cron.schedule('problem-followups-daily', '20 6 * * *', $$select public.problem_followups();$$);

-- Start with what is already showing a red dot: current red/orange flags and
-- body-and-mind reports from the last week.
insert into public.client_problems (client_id, trainer_id, topic, detail, reported_on, last_reported_on)
select c.id, c.trainer_id, 'flag',
  concat_ws(': ', case when c.status_flag = 'red' then 'Urgent - needs guidance' else 'Wants feedback' end, nullif(c.status_flag_note, '')),
  coalesce((c.status_flag_updated_at at time zone 'Africa/Johannesburg')::date, public.sa_today()),
  coalesce((c.status_flag_updated_at at time zone 'Africa/Johannesburg')::date, public.sa_today())
from public.clients c
where c.status_flag in ('red', 'orange')
  and not exists (select 1 from public.client_problems p where p.client_id = c.id and p.topic = 'flag' and p.status <> 'fixed');

insert into public.client_problems (client_id, trainer_id, topic, detail, reported_on, last_reported_on)
select r.client_id, c.trainer_id, r.topic, left(r.detail, 500), r.first_on, r.last_on
from (
  select k.client_id, x.topic,
    (array_agg(x.detail order by k.checkin_date desc))[1] as detail,
    min(k.checkin_date) as first_on, max(k.checkin_date) as last_on
  from public.checkins k
  cross join lateral (values
    ('pain', k.pain_status, concat_ws(': ', nullif(k.pain_area, ''), nullif(k.pain_notes, ''))),
    ('fatigue', k.fatigue_status, concat_ws(': ', nullif(k.fatigue_cause, ''), nullif(k.fatigue_notes, ''))),
    ('mental', k.mental_status, concat_ws(': ', nullif(k.mental_cause, ''), nullif(k.mental_notes, '')))
  ) as x(topic, status, detail)
  where x.status = 'reported' and k.checkin_date >= public.sa_today() - 7
  group by k.client_id, x.topic
) r
join public.clients c on c.id = r.client_id
where not exists (select 1 from public.client_problems p where p.client_id = r.client_id and p.topic = r.topic and p.status <> 'fixed');

-- Check-ins from before 0055 only have the old single distress switch; the
-- last week of those count as a pain problem so their red dot can be cleared
-- the same way.
insert into public.client_problems (client_id, trainer_id, topic, detail, reported_on, last_reported_on)
select k.client_id, c.trainer_id, 'pain',
  left((array_agg(coalesce(k.distress_notes, '') order by k.checkin_date desc))[1], 500),
  min(k.checkin_date), max(k.checkin_date)
from public.checkins k
join public.clients c on c.id = k.client_id
where k.distress_flag
  and k.pain_status is null and k.fatigue_status is null and k.mental_status is null
  and k.checkin_date >= public.sa_today() - 7
  and not exists (select 1 from public.client_problems p where p.client_id = k.client_id and p.topic = 'pain' and p.status <> 'fixed')
group by k.client_id, c.trainer_id;
