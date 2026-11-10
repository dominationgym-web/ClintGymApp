-- Weekly injury check (GRIZZ, 2026-11-10: "Once a week we need to check on
-- the clients injuries. Ask them if their injury has improved or is better
-- and remind them to remove the injury once it is better. This way the
-- client can remove the injury and the trainer can adjust the program
-- accordingly.").
--
-- Every open injury (0109) is asked about once a week on the client's Today
-- tab: All better / Improving / Same / Worse, tap buttons only. "All better"
-- offers to remove it there and then (healed_on, as ✓ Healed does). The
-- trainer sees the latest answer next to each injury and gets a push when
-- one is worse or the client removes one, so the program gets changed.
-- A push goes to the client on the day the question is due.

alter table public.client_injuries
  add column if not exists last_check text check (last_check is null or last_check in ('better', 'improving', 'same', 'worse')),
  add column if not exists last_check_on date,
  add column if not exists check_pushed_on date;

-- Every answer, so the trainer can see how it has gone week by week.
create table if not exists public.client_injury_checks (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.client_injuries (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  answer text not null check (answer in ('better', 'improving', 'same', 'worse')),
  checked_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists client_injury_checks_injury_idx on public.client_injury_checks (injury_id, created_at desc);

alter table public.client_injury_checks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'client_injury_checks' and policyname = 'injury_checks_client_read') then
    create policy injury_checks_client_read on public.client_injury_checks
      for select to authenticated using (client_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'client_injury_checks' and policyname = 'injury_checks_trainer_read') then
    create policy injury_checks_trainer_read on public.client_injury_checks
      for select to authenticated using (
        exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
      );
  end if;
end $$;

-- The client answers for one of their own open injuries. Writes go only
-- through here.
create or replace function public.answer_injury_check(p_injury uuid, p_answer text)
returns public.client_injuries
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inj public.client_injuries;
  cl public.clients;
  today date;
begin
  if p_answer is null or p_answer not in ('better', 'improving', 'same', 'worse') then
    raise exception 'Pick how it is';
  end if;
  select * into inj from public.client_injuries where id = p_injury;
  if inj.id is null or inj.client_id <> me then
    raise exception 'That injury isn''t on your list';
  end if;
  select * into cl from public.clients where id = me;
  today := (now() at time zone public.session_tz(cl.trainer_id))::date;

  insert into public.client_injury_checks (injury_id, client_id, answer, checked_on)
  values (inj.id, me, p_answer, today);

  update public.client_injuries
  set last_check = p_answer, last_check_on = today
  where id = inj.id
  returning * into inj;

  if p_answer = 'worse' and cl.trainer_id is not null then
    perform public.push_to_user(
      cl.trainer_id,
      '🩹 ' || coalesce(nullif(btrim(cl.name), ''), 'A client') || '''s ' || lower(inj.area) || ' is worse',
      'From this week''s injury check. Have a look at the program and check in with them.',
      jsonb_build_object('type', 'injury_check', 'clientId', me)
    );
  end if;

  return inj;
end;
$$;

revoke execute on function public.answer_injury_check(uuid, text) from public, anon;
grant execute on function public.answer_injury_check(uuid, text) to authenticated;

-- When the client removes an injury (ticks it healed), the trainer is told
-- so the program can go back to normal. The trainer doing it themselves
-- needs no push.
create or replace function public.notify_injury_healed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cl public.clients;
begin
  if old.healed_on is null and new.healed_on is not null and (select auth.uid()) = new.client_id then
    select * into cl from public.clients where id = new.client_id;
    if cl.trainer_id is not null then
      perform public.push_to_user(
        cl.trainer_id,
        '✅ ' || coalesce(nullif(btrim(cl.name), ''), 'A client') || '''s ' || lower(new.area) || ' is all better',
        'They took it off their injury list. Time to adjust the program.',
        jsonb_build_object('type', 'injury_check', 'clientId', new.client_id)
      );
    end if;
  end if;
  return new;
exception when others then
  raise warning 'notify_injury_healed failed: %', sqlerrm;
  return new;
end;
$$;

create or replace trigger client_injuries_healed_notify
  after update of healed_on on public.client_injuries
  for each row execute function public.notify_injury_healed();

-- Due: open, at least 7 days since it was added or last answered.
create or replace function public.injury_check_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  sent integer := 0;
begin
  for c in
    select cl.id, public.session_tz(cl.trainer_id) as tz, min(i.area) as area, count(*) as n, array_agg(i.id) as ids
    from public.client_injuries i
    join public.clients cl on cl.id = i.client_id
    where i.healed_on is null
      and cl.access_status <> 'expired' and cl.archived_at is null
      and coalesce(i.last_check_on, (i.created_at at time zone public.session_tz(cl.trainer_id))::date)
          <= (now() at time zone public.session_tz(cl.trainer_id))::date - 7
      and (i.check_pushed_on is null or i.check_pushed_on <= (now() at time zone public.session_tz(cl.trainer_id))::date - 7)
    group by cl.id, cl.trainer_id
  loop
    perform public.push_to_user(
      c.id,
      case when c.n = 1 then '🩹 How''s your ' || lower(c.area) || ' this week?' else '🩹 How are your injuries this week?' end,
      'Tap to tell your coach: all better, improving, the same or worse. Once it''s better, remove it so your program can change.',
      jsonb_build_object('type', 'injury_check')
    );
    update public.client_injuries set check_pushed_on = (now() at time zone c.tz)::date where id = any (c.ids);
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.injury_check_reminders() from public, anon, authenticated;

select cron.unschedule('injury-check-reminders')
where exists (select 1 from cron.job where jobname = 'injury-check-reminders');

-- 09:00 in South Africa.
select cron.schedule('injury-check-reminders', '0 7 * * *', $$select public.injury_check_reminders();$$);
