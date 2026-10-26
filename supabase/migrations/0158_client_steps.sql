-- Daily step goal (GRIZZ, 2026-10-26: "the clients sets a stepper goal. And
-- needs to achieve it. Then a reminder at 4pm if he hasn't achieved his
-- stepper goals. Then at 7pm a banner saying where he is with his steps for
-- the day"). The client sets their own goal on the Check-in tab. Steps come
-- from the linked watch (src/lib/healthLink.ts) each time the app opens, or
-- the client types them in. One row per day keeps that day's goal too, so the
-- trainer's summary still makes sense after the goal changes.
create table if not exists public.client_step_goals (
  client_id uuid primary key references public.clients (id) on delete cascade,
  goal integer not null check (goal between 1000 and 50000),
  reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.client_steps (
  client_id uuid not null references public.clients (id) on delete cascade,
  step_date date not null,
  steps integer not null check (steps between 0 and 200000),
  goal integer check (goal between 1000 and 50000),
  source text not null check (source in ('manual', 'apple_health', 'health_connect')),
  updated_at timestamptz not null default now(),
  primary key (client_id, step_date)
);

alter table public.client_step_goals enable row level security;
alter table public.client_steps enable row level security;

create policy "step goal client manages own" on public.client_step_goals
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create policy "step goal trainer reads" on public.client_step_goals
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

create policy "steps client manages own" on public.client_steps
  for all to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create policy "steps trainer reads" on public.client_steps
  for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

-- Steps in South African style: 10 000.
create or replace function public.steps_text(n integer)
returns text
language sql
immutable
as $$ select btrim(replace(to_char(n, 'FM999,999,999'), ',', ' ')) $$;

-- 'afternoon' runs at 16:00 SA time: only clients who haven't hit their goal
-- yet. 'evening' runs at 19:00: everyone with a goal hears where they are.
-- The count is the last one the app saved, so a client whose watch has more
-- since is asked to open the app to bring it in.
create or replace function public.step_goal_reminders(p_when text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  today date := (now() at time zone 'Africa/Johannesburg')::date;
  done integer;
  left_ integer;
  walk integer;
  stale boolean;
  title text;
  body text;
begin
  for v in
    select g.client_id, g.goal, s.steps, s.source, s.updated_at
    from public.client_step_goals g
    join public.clients c on c.id = g.client_id
    left join public.client_steps s on s.client_id = g.client_id and s.step_date = today
    where g.reminders and c.access_status <> 'expired' and c.archived_at is null
  loop
    done := coalesce(v.steps, 0);
    if p_when = 'afternoon' and done >= v.goal then
      continue;
    end if;
    left_ := greatest(v.goal - done, 0);
    -- About 100 steps a minute walking, rounded up to 5 minutes.
    walk := greatest(5, ceil(left_ / 100.0 / 5) * 5)::int;
    stale := v.source is not null and v.source <> 'manual' and v.updated_at < now() - interval '30 minutes';

    if v.steps is null then
      title := case when p_when = 'afternoon' then '👟 How are your steps today?' else '👟 Your steps today' end;
      body := 'Your goal is ' || public.steps_text(v.goal) || '. Open the app to bring in your watch steps or add them yourself.';
    elsif done >= v.goal then
      title := '🎉 Step goal hit: ' || public.steps_text(done) || ' steps today';
      body := 'You beat your ' || public.steps_text(v.goal) || ' goal. Well done!';
    else
      title := case when p_when = 'afternoon'
        then '👟 ' || public.steps_text(left_) || ' steps to go today'
        else '👟 Steps today: ' || public.steps_text(done) || ' of ' || public.steps_text(v.goal) end;
      body := case when p_when = 'afternoon'
        then 'You''re on ' || public.steps_text(done) || ' of ' || public.steps_text(v.goal) || '. A ' || walk || '-minute walk will get you there.'
        else public.steps_text(left_) || ' to go before bed: about ' || walk || ' minutes of walking.' end;
      if stale then
        body := body || ' Last updated ' || to_char(v.updated_at at time zone 'Africa/Johannesburg', 'HH24:MI') || ': open the app for your latest steps.';
      end if;
    end if;

    perform public.push_to_user(v.client_id, title, body, jsonb_build_object('type', 'steps'));
  end loop;
end;
$$;

revoke execute on function public.step_goal_reminders(text) from public, anon, authenticated;

select cron.unschedule('step-goal-afternoon') where exists (select 1 from cron.job where jobname = 'step-goal-afternoon');
select cron.unschedule('step-goal-evening') where exists (select 1 from cron.job where jobname = 'step-goal-evening');
-- South Africa is UTC+2 all year: 14:00 UTC is 16:00 and 17:00 UTC is 19:00.
select cron.schedule('step-goal-afternoon', '0 14 * * *', $$select public.step_goal_reminders('afternoon');$$);
select cron.schedule('step-goal-evening', '0 17 * * *', $$select public.step_goal_reminders('evening');$$);
