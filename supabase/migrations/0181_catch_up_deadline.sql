-- Catch-ups are done by the end of the month (GRIZZ, 2026-11-02: "If the
-- trainer doesn't do the catch-up by the end of the month he needs to credit
-- them or try do the catch-up the following month. This needs to be decided
-- before invoicing.").
--
-- A catch-up owed (charge 'makeup', none booked yet) is due by the end of the
-- month of the missed session, or by live_sessions.catchup_until when the
-- coach moved it to a later month. Once that day has passed the coach decides:
-- credit it, or give it one more month. Invoices for that month can't be sent
-- until it's decided, and the coach is reminded on the 1st (and three days
-- before the month ends).

alter table public.live_sessions add column if not exists catchup_until date;

-- The last day a catch-up can be booked, in the coach's time zone.
create or replace function public.catchup_deadline(p_starts_at timestamptz, p_until date, p_tz text)
returns date
language sql
immutable
as $$
  select coalesce(p_until, (date_trunc('month', p_starts_at at time zone p_tz) + interval '1 month' - interval '1 day')::date)
$$;

-- The coach's choice for a catch-up not done in time: 'credit' (the client
-- isn't charged for it, credited if already invoiced) or 'next' (one more
-- month to book it).
create or replace function public.decide_catch_up(p_id uuid, p_choice text)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_sessions;
  tz text;
  due date;
begin
  select * into s from public.live_sessions where id = p_id and trainer_id = auth.uid();
  if not found then
    raise exception 'Session not found';
  end if;
  if s.charge is distinct from 'makeup' or s.makeup_session_id is not null then
    raise exception 'There''s no catch-up owed for this session';
  end if;
  tz := public.session_tz(s.trainer_id);
  due := public.catchup_deadline(s.starts_at, s.catchup_until, tz);
  if p_choice = 'credit' then
    update public.live_sessions set charge = 'credit', updated_at = now() where id = p_id returning * into s;
  elsif p_choice = 'next' then
    update public.live_sessions
    -- The end of the month after the deadline, and never before the end of
    -- this month (when it's decided late).
    set catchup_until = greatest(
          (date_trunc('month', due) + interval '2 months' - interval '1 day')::date,
          (date_trunc('month', now() at time zone tz) + interval '1 month' - interval '1 day')::date
        ),
        updated_at = now()
    where id = p_id
    returning * into s;
  else
    raise exception 'Pick credit or next month';
  end if;
  return s;
end;
$$;
revoke execute on function public.decide_catch_up(uuid, text) from public, anon;
grant execute on function public.decide_catch_up(uuid, text) to authenticated;

-- Sending an invoice waits until every catch-up due by the end of its month
-- is decided.
create or replace function public.send_session_invoice(p_id uuid)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
  coach text;
  tz text;
  n integer;
begin
  select * into inv from public.session_invoices where id = p_id and trainer_id = auth.uid();
  if not found then
    raise exception 'Invoice not found';
  end if;
  perform public.session_require_trainer(inv.client_id);
  tz := public.session_tz(inv.trainer_id);
  select count(*) into n
  from public.live_sessions ls
  where ls.trainer_id = inv.trainer_id
    and (ls.client_id = inv.client_id or ls.client_id in (select sp.client_id from public.session_plans sp where sp.paid_by = inv.client_id))
    and ls.charge = 'makeup' and ls.makeup_session_id is null and ls.status in ('cancelled', 'no_show')
    and public.catchup_deadline(ls.starts_at, ls.catchup_until, tz) < (inv.month + interval '1 month')::date
    and public.catchup_deadline(ls.starts_at, ls.catchup_until, tz) < (now() at time zone tz)::date;
  if n > 0 then
    raise exception '% catch-up% not done in time: credit % or move % to next month first (Today › Catch-ups)',
      n, case when n = 1 then '' else 's' end, case when n = 1 then 'it' else 'them' end, case when n = 1 then 'it' else 'them' end;
  end if;
  if inv.status = 'draft' then
    inv := public.build_session_invoice_for(inv.client_id, inv.month);
  end if;
  update public.session_invoices set status = case when status = 'paid' then 'paid' else 'sent' end, sent_at = now(), updated_at = now()
  where id = inv.id
  returning * into inv;
  select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = inv.trainer_id;
  perform public.push_to_user(
    inv.client_id,
    '🧾 Your session invoice for ' || trim(to_char(inv.month, 'FMMonth')),
    'From ' || coalesce(coach, 'your coach') || ': ' || case when inv.currency = 'USD' then '$' else 'R' end
      || replace(case when inv.total = trunc(inv.total) then to_char(inv.total, 'FM999,999,990') else to_char(inv.total, 'FM999,999,990.00') end, ',', ' ')
      || '. Tap to see every session.',
    jsonb_build_object('type', 'session_invoice', 'invoiceId', inv.id)
  );
  return inv;
end;
$$;

-- Reminders: three days before the month ends (catch-ups still to book this
-- month) and on the 1st (not done: decide before invoicing). Runs from the
-- daily session-month-end job.
create or replace function public.catch_up_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  tz text;
  today date;
  month_end date;
begin
  for t in
    select ls.trainer_id, public.session_tz(ls.trainer_id) as tz,
           array_agg(ls.starts_at) as starts, array_agg(ls.catchup_until) as untils,
           array_agg(split_part(c.name, ' ', 1)) as names
    from public.live_sessions ls
    join public.clients c on c.id = ls.client_id and c.trainer_id = ls.trainer_id and c.archived_at is null
    where ls.charge = 'makeup' and ls.makeup_session_id is null and ls.status in ('cancelled', 'no_show')
      and ls.starts_at > now() - interval '120 days'
    group by ls.trainer_id
  loop
    tz := t.tz;
    today := (now() at time zone tz)::date;
    month_end := (date_trunc('month', today) + interval '1 month' - interval '1 day')::date;
    declare
      overdue integer := 0;
      soon integer := 0;
      who text[] := '{}';
      i integer;
      due date;
    begin
      for i in 1 .. coalesce(array_length(t.starts, 1), 0) loop
        due := public.catchup_deadline(t.starts[i], t.untils[i], tz);
        if due < today then
          overdue := overdue + 1;
          who := who || t.names[i];
        elsif due = month_end then
          soon := soon + 1;
        end if;
      end loop;
      if extract(day from today) = 1 and overdue > 0 then
        perform public.push_to_user(
          t.trainer_id,
          '🔁 ' || overdue || case when overdue = 1 then ' catch-up wasn''t done' else ' catch-ups weren''t done' end || ' last month',
          'For ' || array_to_string(array(select distinct x from unnest(who) x), ', ') || '. Credit them or move them to this month before you send invoices.',
          jsonb_build_object('type', 'live_session')
        );
      elsif today = month_end - 3 and soon > 0 then
        perform public.push_to_user(
          t.trainer_id,
          '🔁 ' || soon || case when soon = 1 then ' catch-up' else ' catch-ups' end || ' to book by the end of the month',
          'Book them in, or you''ll be asked to credit them or move them to next month.',
          jsonb_build_object('type', 'live_session')
        );
      end if;
    end;
  end loop;
end;
$$;
revoke execute on function public.catch_up_deadline_reminders() from public, anon, authenticated;

select cron.schedule('catch-up-deadlines', '0 6 * * *', $$select public.catch_up_deadline_reminders();$$);
