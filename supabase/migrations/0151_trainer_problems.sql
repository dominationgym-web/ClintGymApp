-- Trainer problems (GRIZZ, 2026-10-24): trainers report a problem from inside
-- the app instead of by email. Each one goes to the app owner, linked to the
-- trainer who sent it, with a phone notification, and the two of them can
-- talk it through on the problem. Plus the owner's list of every trainer's
-- clients on the Trainers tab.

create table public.trainer_problems (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references public.trainers (id) on delete cascade,
  -- Filled in by the trigger below from the trainer's own row.
  trainer_name text not null default '',
  area text not null default 'app' check (area in ('app', 'clients', 'programs', 'billing', 'other')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'fixing', 'fixed')),
  created_at timestamptz not null default now(),
  -- The last message on it, so the lists sort by what's newest.
  updated_at timestamptz not null default now()
);

create index trainer_problems_trainer_idx on public.trainer_problems (trainer_id, created_at desc);
create index trainer_problems_status_idx on public.trainer_problems (status, updated_at desc);

-- The talk on a problem after the first message (which is the problem's body).
create table public.trainer_problem_messages (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.trainer_problems (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  from_owner boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index trainer_problem_messages_problem_idx on public.trainer_problem_messages (problem_id, created_at);

create or replace function public.fill_trainer_problem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  new.trainer_id := auth.uid();
  new.status := 'new';
  new.created_at := now();
  new.updated_at := now();
  select coalesce(nullif(btrim(t.business_name), ''), t.name) into v_name from public.trainers t where t.id = new.trainer_id;
  if not found then
    raise exception 'Only trainers can report a problem';
  end if;
  new.trainer_name := coalesce(v_name, '');
  return new;
end;
$$;

revoke execute on function public.fill_trainer_problem() from public, anon, authenticated;

create trigger trainer_problems_fill
  before insert on public.trainer_problems
  for each row execute function public.fill_trainer_problem();

-- Tells every owner's phone straight away.
create or replace function public.notify_owner_trainer_problem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
begin
  for o in select t.id from public.trainers t where t.is_owner and t.id <> new.trainer_id loop
    perform public.push_to_user(
      o.id,
      '🛠 Problem from ' || coalesce(nullif(new.trainer_name, ''), 'a trainer'),
      new.body,
      jsonb_build_object('type', 'trainer_problem', 'problemId', new.id)
    );
  end loop;
  return new;
exception when others then
  raise warning 'trainer problem notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_owner_trainer_problem() from public, anon, authenticated;

create trigger trainer_problems_notify
  after insert on public.trainer_problems
  for each row execute function public.notify_owner_trainer_problem();

alter table public.trainer_problems enable row level security;
alter table public.trainer_problem_messages enable row level security;

create policy "trainer problems insert own"
  on public.trainer_problems for insert to authenticated
  with check (trainer_id = (select auth.uid()));

create policy "trainer problems read own or owner"
  on public.trainer_problems for select to authenticated
  using (trainer_id = (select auth.uid()) or (select public.is_app_owner()));

create policy "trainer problem messages read own or owner"
  on public.trainer_problem_messages for select to authenticated
  using (
    (select public.is_app_owner())
    or exists (select 1 from public.trainer_problems p where p.id = problem_id and p.trainer_id = (select auth.uid()))
  );

-- Messages and status changes only go through the functions below, so the
-- other side is always notified.
revoke all on public.trainer_problems from anon, authenticated;
revoke all on public.trainer_problem_messages from anon, authenticated;
grant select, insert on public.trainer_problems to authenticated;
grant select on public.trainer_problem_messages to authenticated;

-- A message on a problem, from the owner or the trainer who sent it. The
-- owner's message tells the trainer; the trainer's tells the owner, and opens
-- the problem again if it was marked fixed.
create or replace function public.send_trainer_problem_message(p_problem uuid, p_body text)
returns public.trainer_problem_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_problem public.trainer_problems;
  v_owner boolean := public.is_app_owner();
  v_row public.trainer_problem_messages;
  v_owner_name text;
  o record;
begin
  select * into v_problem from public.trainer_problems where id = p_problem;
  if not found or not (v_owner or v_problem.trainer_id = auth.uid()) then
    raise exception 'Problem not found';
  end if;
  if p_body is null or char_length(btrim(p_body)) = 0 then
    raise exception 'Type a message first';
  end if;
  -- The owner answering their own report counts as the trainer side.
  v_owner := v_owner and v_problem.trainer_id <> auth.uid();

  insert into public.trainer_problem_messages (problem_id, author_id, from_owner, body)
  values (p_problem, auth.uid(), v_owner, btrim(p_body))
  returning * into v_row;

  update public.trainer_problems
  set updated_at = now(),
      status = case when not v_owner and status = 'fixed' then 'new' else status end
  where id = p_problem;

  if v_owner then
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into v_owner_name from public.trainers t where t.id = auth.uid();
    perform public.push_to_user(
      v_problem.trainer_id,
      coalesce(nullif(v_owner_name, ''), 'The app team') || ' replied about your problem',
      v_row.body,
      jsonb_build_object('type', 'trainer_problem_reply', 'problemId', p_problem)
    );
  else
    for o in select t.id from public.trainers t where t.is_owner and t.id <> v_problem.trainer_id loop
      perform public.push_to_user(
        o.id,
        '🛠 ' || coalesce(nullif(v_problem.trainer_name, ''), 'A trainer') || ' replied',
        v_row.body,
        jsonb_build_object('type', 'trainer_problem', 'problemId', p_problem)
      );
    end loop;
  end if;
  return v_row;
end;
$$;

revoke execute on function public.send_trainer_problem_message(uuid, text) from public, anon;
grant execute on function public.send_trainer_problem_message(uuid, text) to authenticated;

-- The owner marks a problem Busy fixing or Fixed; the trainer hears either way.
create or replace function public.set_trainer_problem_status(p_problem uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_problem public.trainer_problems;
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this';
  end if;
  if p_status not in ('new', 'fixing', 'fixed') then
    raise exception 'Unknown status %', p_status;
  end if;
  update public.trainer_problems set status = p_status where id = p_problem
  returning * into v_problem;
  if not found then
    raise exception 'Problem not found';
  end if;
  if p_status in ('fixing', 'fixed') and v_problem.trainer_id <> auth.uid() then
    perform public.push_to_user(
      v_problem.trainer_id,
      case p_status when 'fixing' then '🛠 We''re fixing your problem' else '✅ Your problem is fixed' end,
      left(v_problem.body, 120),
      jsonb_build_object('type', 'trainer_problem_reply', 'problemId', p_problem)
    );
  end if;
end;
$$;

revoke execute on function public.set_trainer_problem_status(uuid, text) from public, anon;
grant execute on function public.set_trainer_problem_status(uuid, text) to authenticated;

-- The owner's list of one trainer's clients (Trainers tab), with when each
-- last checked in and trained. Never the trainer's own training row (0146).
create or replace function public.owner_trainer_clients(p_trainer uuid)
returns table(id uuid, name text, access_status text, plan_expires_at date, archived boolean, joined date, last_checkin date, last_workout date)
language plpgsql
stable security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can see this';
  end if;
  return query
  select
    c.id,
    c.name,
    c.access_status::text,
    c.plan_expires_at::date,
    c.archived_at is not null,
    (c.created_at at time zone 'Africa/Johannesburg')::date,
    (select max(k.checkin_date) from public.checkins k where k.client_id = c.id),
    (select max(w.log_date) from public.workout_logs w where w.client_id = c.id)
  from public.clients c
  where c.trainer_id = p_trainer and c.id <> c.trainer_id
  order by (c.archived_at is not null), (c.access_status = 'expired'), c.name;
end;
$$;

revoke execute on function public.owner_trainer_clients(uuid) from public, anon;
grant execute on function public.owner_trainer_clients(uuid) to authenticated;
