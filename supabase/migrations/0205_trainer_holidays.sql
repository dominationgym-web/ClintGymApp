-- Coach holidays on the clients' apps (GRIZZ, 2026-11-09: "give the trainer a
-- holiday button where he or she can load the dates they gonna be away so
-- that clients don't forget, as it will show up on their app").
--
-- A holiday is blocked-out time (0177) for whole days, with the first and
-- last day kept as dates. Saving it does what Block out time does (cancels
-- booked 1 on 1 sessions free, tells those clients, every session goes on
-- the coach's catch-up list) and also tells every other client of the coach. Clients can
-- read their coach's holidays, so the app shows them on Today, My sessions
-- and the training calendar. The day before it starts, everyone gets a
-- reminder.

alter table public.trainer_time_off
  add column if not exists holiday_from date,
  add column if not exists holiday_until date,
  add column if not exists reminded_at timestamptz;

-- A client reads their own coach's holidays (not other blocked-out time).
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'trainer_time_off' and policyname = 'trainer_time_off_client_read') then
    create policy trainer_time_off_client_read on public.trainer_time_off
      for select to authenticated using (
        holiday_from is not null
        and removed_at is null
        and exists (select 1 from public.clients c where c.id = (select auth.uid()) and c.trainer_id = trainer_time_off.trainer_id)
      );
  end if;
end $$;

/** "Mon 14 Dec" */
create or replace function public.holiday_day_label(p_day date)
returns text
language sql
immutable
as $$
  select to_char(p_day, 'Dy') || ' ' || extract(day from p_day)::int || ' ' || to_char(p_day, 'Mon')
$$;

/** "on Mon 14 Dec" or "from Mon 14 Dec to Sun 20 Dec" */
create or replace function public.holiday_span(p_from date, p_until date)
returns text
language sql
immutable
as $$
  select case when p_from = p_until then 'on ' || public.holiday_day_label(p_from)
    else 'from ' || public.holiday_day_label(p_from) || ' to ' || public.holiday_day_label(p_until) end
$$;

-- Everyone into the catch-up wallet (GRIZZ, 2026-11-09: "If the trainer
-- loads a period that he is going away all the clients go into a catchup
-- wallet. Then the trainer can decide who he can catch up and who gets
-- credited"). Diary-only names used to be credited straight away; now their
-- sessions are a catch-up owed too, like app clients' (0177) and aways (0202).
-- The coach books one (Book the catch-up, 0187) or taps Can't do one: Credit.

create or replace function public.block_trainer_time(p_from timestamptz, p_to timestamptz, p_reason text)
returns public.trainer_time_off
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  tz text;
  why text := left(btrim(coalesce(p_reason, '')), 300);
  block public.trainer_time_off;
  c record;
  v_missed integer := 0;
  v_fees numeric := 0;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can block out time';
  end if;
  if p_to <= p_from then
    raise exception 'The end has to be after the start';
  end if;
  if p_to - p_from > interval '92 days' then
    raise exception 'Block out at most three months at a time';
  end if;
  if why = '' then
    raise exception 'Add a short reason for your clients';
  end if;
  tz := public.session_tz(me);

  select count(*), coalesce(sum(fee), 0) into v_missed, v_fees
  from public.live_sessions
  where trainer_id = me and status = 'booked' and starts_at >= p_from and starts_at < p_to;

  insert into public.trainer_time_off (trainer_id, starts_at, ends_at, reason, missed, missed_fees)
  values (me, p_from, p_to, why, v_missed, v_fees)
  returning * into block;

  -- One message per client, listing how many of their sessions are off.
  for c in
    select client_id, count(*) as n, min(starts_at) as first_at
    from public.live_sessions
    where trainer_id = me and status = 'booked' and starts_at >= p_from and starts_at < p_to and client_id is not null
    group by client_id
  loop
    perform public.push_to_user(
      c.client_id,
      case when c.n = 1
        then 'Your coach cancelled ' || public.video_checkin_when(c.first_at, tz)
        else 'Your coach cancelled ' || c.n || ' sessions'
      end,
      why || ' You won''t be charged for ' || case when c.n = 1 then 'it' else 'them' end || ', and your coach will find you a catch-up time.',
      jsonb_build_object('type', 'live_session')
    );
  end loop;

  update public.live_sessions
  set status = 'cancelled', cancelled_by = 'trainer', cancelled_at = now(), logged_by = 'trainer',
      charge = 'makeup', note = left('Coach away: ' || why, 500),
      trainer_confirmed_at = null, asked_trainer = false, updated_at = now()
  where trainer_id = me and status = 'booked' and starts_at >= p_from and starts_at < p_to;

  return block;
end;
$$;

create or replace function public.add_trainer_holiday(p_first date, p_last date, p_reason text)
returns public.trainer_time_off
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  tz text;
  why text := left(btrim(coalesce(p_reason, '')), 300);
  block public.trainer_time_off;
  told uuid[];
  c record;
  v_from timestamptz;
  v_to timestamptz;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can add a holiday';
  end if;
  if p_first is null or p_last is null or p_last < p_first then
    raise exception 'Pick the first day, then the last day';
  end if;
  tz := public.session_tz(me);
  if p_last < (now() at time zone tz)::date then
    raise exception 'That holiday is already over';
  end if;
  if why = '' then
    why := 'I''m away on holiday.';
  end if;
  v_from := p_first::timestamp at time zone tz;
  v_to := (p_last + 1)::timestamp at time zone tz;

  -- Clients with a 1 on 1 session in it hear about it from block_trainer_time.
  select coalesce(array_agg(distinct client_id), '{}') into told
  from public.live_sessions
  where trainer_id = me and status = 'booked' and starts_at >= v_from and starts_at < v_to and client_id is not null;

  block := public.block_trainer_time(v_from, v_to, why);

  update public.trainer_time_off
  set holiday_from = p_first, holiday_until = p_last,
      -- Starts tomorrow or sooner: today's message is the reminder.
      reminded_at = case when p_first <= (now() at time zone tz)::date + 1 then now() end
  where id = block.id
  returning * into block;

  for c in
    select id from public.clients
    where trainer_id = me and access_status <> 'expired' and archived_at is null and not (id = any (told))
  loop
    perform public.push_to_user(
      c.id,
      '🌴 Your coach is away ' || public.holiday_span(p_first, p_last),
      why || ' It''s on your app so you don''t forget.',
      jsonb_build_object('type', 'coach_holiday')
    );
  end loop;

  return block;
end;
$$;

revoke execute on function public.add_trainer_holiday(date, date, text) from public, anon;
grant execute on function public.add_trainer_holiday(date, date, text) to authenticated;

-- The day before a holiday starts, every client of that coach is reminded.
create or replace function public.holiday_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.trainer_time_off;
  c record;
  sent integer := 0;
begin
  for h in
    select * from public.trainer_time_off
    where holiday_from is not null and removed_at is null and reminded_at is null
      and holiday_from = (now() at time zone public.session_tz(trainer_id))::date + 1
  loop
    for c in
      select id from public.clients
      where trainer_id = h.trainer_id and access_status <> 'expired' and archived_at is null
    loop
      perform public.push_to_user(
        c.id,
        '🌴 Reminder: your coach is away from tomorrow',
        'Away ' || public.holiday_span(h.holiday_from, h.holiday_until) || '. ' || h.reason,
        jsonb_build_object('type', 'coach_holiday')
      );
      sent := sent + 1;
    end loop;
    update public.trainer_time_off set reminded_at = now() where id = h.id;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.holiday_reminders() from public, anon, authenticated;

select cron.unschedule('coach-holiday-reminders')
where exists (select 1 from cron.job where jobname = 'coach-holiday-reminders');

-- 08:00 in South Africa.
select cron.schedule('coach-holiday-reminders', '0 6 * * *', $$select public.holiday_reminders();$$);
