-- Every 1 on 1 person gets invoiced and tracked, in the app or not (GRIZZ,
-- 2026-11-18: "I need every person training in the 1 on 1 to be invoiced
-- and tracked. Whether they're on the app or not. Being on the app for 1 on
-- 1 is a choice." ... "They just lose options."). Before, people known only
-- by their calendar name (live_sessions.guest_name) got no invoice; their
-- money only showed as a line under the month.
--
-- * diary_name_fees becomes their plan: price, billing (upfront or after),
--   and for a pair the alone price (group_size / group_total / solo_fee),
--   like session_plans for app clients.
-- * session_invoices can be for a name (guest_key / guest_name) instead of
--   a client. Same lines, credits, extras, Paid switch and 14th hold.
-- * One invoice builder for both (build_invoice_core). Sending one marks it
--   sent; the trainer shares the text by WhatsApp or email (no app to push).
-- * session_due reads the pair prices from either plan, so Jade & Camilla
--   are priced the same on both sides.

alter table public.diary_name_fees
  add column if not exists billing text check (billing in ('advance', 'arrears')),
  add column if not exists group_size integer not null default 1 check (group_size between 1 and 6),
  add column if not exists group_total numeric(10, 2) check (group_total >= 0 and group_total <= 100000),
  add column if not exists solo_fee numeric(10, 2) check (solo_fee >= 0 and solo_fee <= 100000);

alter table public.session_invoices alter column client_id drop not null;
alter table public.session_invoices
  add column if not exists guest_key text,
  add column if not exists guest_name text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'session_invoices_for_someone') then
    alter table public.session_invoices
      add constraint session_invoices_for_someone check ((client_id is null) <> (guest_key is null));
  end if;
end $$;
create unique index if not exists session_invoices_guest_month
  on public.session_invoices (trainer_id, guest_key, month) where guest_key is not null;

-- The trainer sets a diary person's plan: price per session, how they pay,
-- and (training with someone) the price when they train alone. Their
-- sessions from now on take the new price.
create or replace function public.set_diary_plan(p_name text, p_fee numeric, p_billing text, p_solo_fee numeric)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  k text := public.diary_name_key(p_name);
  n integer;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can set a price';
  end if;
  if k is null then
    raise exception 'Who is this for?';
  end if;
  if p_fee is null or p_fee < 0 or p_fee > 100000 then
    raise exception 'Type a price per session';
  end if;
  if p_billing is not null and p_billing not in ('advance', 'arrears') then
    raise exception 'Pick upfront or after';
  end if;
  if p_solo_fee is not null and (p_solo_fee < 0 or p_solo_fee > 100000) then
    raise exception 'Type the price when they train alone';
  end if;
  insert into public.diary_name_fees (trainer_id, name_key, fee, billing, group_size, group_total, solo_fee, updated_at)
  values (me, k, p_fee, p_billing, case when p_solo_fee is null then 1 else 2 end, null, p_solo_fee, now())
  on conflict (trainer_id, name_key) do update
  set fee = excluded.fee, billing = excluded.billing, group_size = excluded.group_size,
      group_total = excluded.group_total, solo_fee = excluded.solo_fee, updated_at = now();
  update public.live_sessions
  set fee = p_fee, updated_at = now()
  where trainer_id = me and client_id is null and public.diary_name_key(guest_name) = k
    and status = 'booked' and invoice_id is null and starts_at > now() - interval '1 day'
    and makeup_for is null;
  get diagnostics n = row_count;
  -- Pair prices changed: the amounts on their time slots too.
  perform public.refresh_slot_due(x.trainer_id, x.starts_at)
  from (select distinct trainer_id, starts_at from public.live_sessions
        where trainer_id = me and client_id is null and public.diary_name_key(guest_name) = k
          and starts_at >= date_trunc('month', now()) - interval '1 month') x;
  return n;
end;
$$;
revoke execute on function public.set_diary_plan(text, numeric, text, numeric) from public, anon;
grant execute on function public.set_diary_plan(text, numeric, text, numeric) to authenticated;

create or replace function public.session_due(p_id uuid)
returns table (due numeric, joint text, partners text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.live_sessions;
  o public.live_sessions;
  v_has boolean := false;
  v_fee numeric;
  v_size integer;
  v_total numeric;
  v_solo numeric;
  k text;
  n_partners integer;
  n_trained integer;
  n_coach integer;
  pair boolean;
  base numeric;
  balance numeric;
  alone boolean;
begin
  select * into r from public.live_sessions where id = p_id;
  if not found then
    return;
  end if;
  k := public.live_session_kind(r.status, r.starts_at, r.minutes, r.charge, r.cancelled_by);
  -- Their plan: an app client's session plan, or a diary person's (0223).
  if r.client_id is not null then
    select true, sp.fee, sp.group_size, sp.group_total, sp.solo_fee into v_has, v_fee, v_size, v_total, v_solo
    from public.session_plans sp where sp.client_id = r.client_id;
  else
    select true, f.fee, f.group_size, f.group_total, f.solo_fee into v_has, v_fee, v_size, v_total, v_solo
    from public.diary_name_fees f where f.trainer_id = r.trainer_id and f.name_key = public.diary_name_key(r.guest_name);
  end if;

  -- Everyone else booked at the same time (not this client again).
  -- Counted by person, so a session booked twice by mistake is one person.
  select count(distinct q.person),
         count(distinct q.person) filter (where q.kind in ('done', 'unconfirmed', 'booked')),
         count(distinct q.person) filter (where q.kind = 'trainer'),
         string_agg(distinct q.name, ' & ')
  into n_partners, n_trained, n_coach, partners
  from (
    select public.live_session_kind(x.status, x.starts_at, x.minutes, x.charge, x.cancelled_by) as kind,
           coalesce(x.client_id::text, lower(trim(coalesce(x.guest_name, '')))) as person,
           trim(coalesce(c.name, x.guest_name, '')) as name
    from public.live_sessions x
    left join public.clients c on c.id = x.client_id
    where x.trainer_id = r.trainer_id and x.starts_at = r.starts_at and x.id <> r.id
      and x.status <> 'removed'
      and (x.client_id is distinct from r.client_id or x.client_id is null)
      and not (r.client_id is null and x.client_id is null
               and public.diary_name_key(x.guest_name) = public.diary_name_key(r.guest_name))
  ) q;
  joint := case when n_partners > 0 then 'together' end;

  -- Their plan says they train with someone and has an alone price.
  pair := coalesce(v_has, false) and coalesce(v_size, 1) > 1 and v_solo is not null;
  if not pair then
    due := case when k in ('done', 'unconfirmed', 'booked', 'late', 'no_show', 'makeup') then r.fee else 0 end;
    return next;
    return;
  end if;

  -- The group check could have saved the alone price on a session: when they
  -- trained together after all, they pay the together fee.
  base := case when r.fee = v_solo and v_solo <> v_fee then v_fee else r.fee end;
  -- What the one who missed pays when the other trains alone: the together
  -- total less the alone price (R1000 - R750 = R250; R900 - R750 = R150).
  balance := greatest(0, round((coalesce(v_total, v_fee * v_size) - v_solo) / (v_size - 1), 2));
  -- Nobody else trained (a partner the coach cancelled doesn't count: that's
  -- not on them).
  alone := n_trained = 0 and n_coach = 0;

  if r.makeup_for is not null then
    -- A catch-up: alone it's the alone price, with someone the together fee
    -- (GRIZZ 2026-11-18: "a single session on a double will always be
    -- R750"). If the coach cancelled the missed session it keeps the price
    -- it was booked at.
    select * into o from public.live_sessions where id = r.makeup_for;
    if o.cancelled_by = 'trainer' or k not in ('done', 'unconfirmed', 'booked', 'late', 'no_show') then
      due := case when k in ('done', 'unconfirmed', 'booked', 'late', 'no_show', 'makeup') then r.fee else 0 end;
    else
      due := case when n_partners = 0 then v_solo else v_fee end;
    end if;
    joint := case when n_partners > 0 then 'together' else 'catch_up' end;
  elsif k in ('done', 'unconfirmed', 'booked') then
    if alone then
      due := v_solo;
      joint := 'alone';
    else
      due := base;
    end if;
  elsif k in ('late', 'no_show', 'notice', 'excused', 'makeup') then
    -- Missed it (late, in time, or with a catch-up to come): if exactly one
    -- other person trained, they paid the alone price, so this one pays the
    -- balance (GRIZZ 2026-11-18: "If one is 750 she pays 250 cancellation
    -- fee"). Otherwise late and catch-up are the together fee, in time free.
    if n_trained = 1 and n_coach = 0 then
      due := balance;
      joint := 'partner_alone';
    else
      due := case when k in ('late', 'no_show', 'makeup') then base else 0 end;
    end if;
  else
    due := 0;
  end if;
  return next;
end;
$$;
revoke execute on function public.session_due(uuid) from public, anon, authenticated;

create or replace function public.build_invoice_core(p_trainer uuid, p_client uuid, p_key text, p_month date)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
  p public.session_plans;
  st public.session_settings;
  tz text;
  m date := date_trunc('month', p_month)::date;
  m_start timestamptz;
  m_end timestamptz;
  bill text;
  r record;
  v_lines jsonb := '[]'::jsonb;
  v_charged numeric := 0;
  v_credited numeric := 0;
  v_undecided integer := 0;
  v_unconfirmed integer := 0;
  kind text;
  amt numeric;
  role text;
  v_people uuid[];
  d record;
  v_billed numeric;
  dp public.diary_name_fees;
  v_trainer uuid;
  v_name text;
begin
  if p_client is not null then
    select * into p from public.session_plans where client_id = p_client;
    if not found then
      raise exception 'This client has no session plan';
    end if;
    -- This client and everyone they pay for, each person's sessions listed
    -- and costed separately.
    v_people := array[p_client] || coalesce((
      select array_agg(sp.client_id) from public.session_plans sp
      where sp.paid_by = p_client and sp.trainer_id = p.trainer_id
    ), '{}');
    v_trainer := p.trainer_id;
    bill := p.billing;
  else
    -- Someone not in the app (0223): their calendar name and diary plan.
    v_trainer := p_trainer;
    select * into dp from public.diary_name_fees where trainer_id = p_trainer and name_key = p_key;
    select ls.guest_name into v_name from public.live_sessions ls
    where ls.trainer_id = p_trainer and ls.client_id is null and public.diary_name_key(ls.guest_name) = p_key
    order by ls.starts_at desc limit 1;
    if v_name is null then
      raise exception 'No sessions for that name';
    end if;
  end if;
  select * into st from public.session_settings where trainer_id = v_trainer;
  tz := coalesce(st.time_zone, 'Africa/Johannesburg');
  bill := coalesce(bill, dp.billing, st.billing, 'arrears');
  m_start := m::timestamp at time zone tz;
  m_end := (m + interval '1 month')::timestamp at time zone tz;

  if p_client is not null then
    select * into inv from public.session_invoices where client_id = p_client and month = m;
  else
    select * into inv from public.session_invoices where trainer_id = v_trainer and guest_key = p_key and month = m;
  end if;
  if found and inv.status <> 'draft' then
    return inv;
  end if;
  if not found then
    insert into public.session_invoices (trainer_id, client_id, guest_key, guest_name, month, billing, currency)
    values (v_trainer, p_client, case when p_client is null then p_key end, v_name, m, bill, coalesce(st.currency, 'ZAR'))
    returning * into inv;
  else
    update public.live_sessions set invoice_id = null where invoice_id = inv.id;
    update public.live_sessions set credit_invoice_id = null where credit_invoice_id = inv.id;
  end if;

  for r in
    select ls.*, (ls.starts_at >= m_start and ls.starts_at < m_end) as in_month, coalesce(c.name, btrim(ls.guest_name)) as who
    from public.live_sessions ls
    left join public.clients c on c.id = ls.client_id
    where ls.trainer_id = v_trainer
      and (case when p_client is not null then ls.client_id = any (v_people)
                else ls.client_id is null and public.diary_name_key(ls.guest_name) = p_key end)
      and (
        (ls.starts_at >= m_start and ls.starts_at < m_end)
        or (ls.starts_at < m_start and ls.invoice_id is null and ls.status <> 'removed')
        or (ls.invoice_id is not null and ls.credit_invoice_id is null and ls.starts_at < m_end)
      )
    order by who, ls.starts_at
  loop
    kind := public.live_session_kind(r.status, r.starts_at, r.minutes, r.charge, r.cancelled_by);
    select * into d from public.session_due(r.id);
    v_billed := coalesce(r.billed, r.fee);
    role := null;
    amt := 0;
    if r.invoice_id is null then
      -- Not on any invoice yet: charge it if it's billable now.
      if kind in ('done', 'unconfirmed', 'late', 'no_show', 'makeup') and (r.in_month or r.starts_at < m_start)
         and (bill = 'advance' or r.starts_at < m_end) then
        role := 'charge';
      elsif kind = 'booked' and bill = 'advance' and r.in_month then
        role := 'charge';
      elsif kind in ('notice', 'excused', 'trainer') and bill = 'advance' and r.in_month and m >= date '2026-12-01'
            and (r.cancelled_at is null or r.cancelled_at >= m_start) then
        -- Paid upfront and cancelled during the month: still on this month,
        -- credited on the next one.
        role := 'charge';
      elsif kind in ('notice', 'excused') and d.due > 0 and (r.in_month or r.starts_at < m_start) then
        -- Cancelled in time while the partner trained alone: they still pay
        -- their part of the session (joint sessions, 2026-11-18).
        role := 'charge';
      elsif r.in_month then
        role := 'diary';
      end if;
    elsif r.credit_invoice_id is null
          and exists (select 1 from public.session_invoices i where i.id = r.invoice_id and (i.status <> 'draft' or i.month < m))
          and (kind in ('notice', 'excused', 'trainer', 'removed') or d.due <> v_billed) then
      -- Already billed on an earlier invoice: credit what's no longer owed,
      -- or add what's owed on top (trained alone after being billed the
      -- together fee upfront).
      if kind = 'removed' or d.due is null then
        role := 'credit';
        amt := -v_billed;
      elsif d.due < v_billed then
        role := 'credit';
        amt := d.due - v_billed;
      elsif d.due > v_billed then
        role := 'extra';
        amt := d.due - v_billed;
      end if;
    elsif r.in_month and kind <> 'removed' then
      role := 'diary';
    end if;
    continue when role is null or (role = 'diary' and kind = 'removed');

    if role = 'charge' then
      -- Upfront and cancelled during the month: charged what was paid on
      -- the 1st (credited next month); otherwise what they owe for it.
      amt := case when kind in ('notice', 'excused', 'trainer') and d.due = 0 then r.fee
                  when kind in ('notice', 'excused') and bill = 'advance' and m >= date '2026-12-01'
                       and (r.cancelled_at is null or r.cancelled_at >= m_start) and r.in_month then r.fee
                  else coalesce(d.due, r.fee) end;
      v_charged := v_charged + amt;
      update public.live_sessions set invoice_id = inv.id, billed = amt where id = r.id;
      if kind = 'unconfirmed' then v_unconfirmed := v_unconfirmed + 1; end if;
    elsif role = 'credit' then
      v_credited := v_credited - amt;
      update public.live_sessions set credit_invoice_id = inv.id where id = r.id;
    elsif role = 'extra' then
      v_charged := v_charged + amt;
      update public.live_sessions set credit_invoice_id = inv.id where id = r.id;
    end if;
    if kind = 'decide' then v_undecided := v_undecided + 1; end if;

    v_lines := v_lines || jsonb_build_object(
      'id', r.id,
      'client_id', r.client_id,
      'who', r.who,
      'at', r.starts_at,
      'kind', kind,
      'role', role,
      'amount', amt,
      'fee', coalesce(d.due, r.fee),
      'by', r.cancelled_by,
      'cancelled_at', r.cancelled_at,
      'notice_hours', case when r.cancelled_at is null then null
                           else round((extract(epoch from r.starts_at - r.cancelled_at) / 3600)::numeric, 1) end,
      'proof', r.proof_path,
      'note', r.note,
      'client_ok', r.client_confirmed_at is not null,
      'disputed', r.client_disputed_at is not null,
      'catch_up', r.makeup_for is not null,
      'catch_up_booked', r.makeup_session_id is not null,
      'joint', d.joint,
      'with', d.partners,
      'billed', case when role in ('credit', 'extra') then v_billed end
    );
  end loop;

  update public.session_invoices
  set billing = bill, currency = coalesce(st.currency, session_invoices.currency), lines = v_lines,
      guest_name = coalesce(v_name, session_invoices.guest_name),
      charged = v_charged, credited = v_credited, total = v_charged - v_credited,
      undecided = v_undecided, unconfirmed = v_unconfirmed,
      updated_at = now()
  where id = inv.id
  returning * into inv;
  return inv;
end;
$$;
revoke execute on function public.build_invoice_core(uuid, uuid, text, date) from public, anon, authenticated;

-- An app client's invoice: someone else paying for them empties it.
create or replace function public.build_session_invoice_for(p_client uuid, p_month date)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
  p public.session_plans;
  m date := date_trunc('month', p_month)::date;
begin
  select * into p from public.session_plans where client_id = p_client;
  if not found then
    raise exception 'This client has no session plan';
  end if;
  if p.paid_by is not null then
    select * into inv from public.session_invoices where client_id = p_client and month = m and status = 'draft';
    if found then
      update public.live_sessions set invoice_id = null where invoice_id = inv.id;
      update public.live_sessions set credit_invoice_id = null where credit_invoice_id = inv.id;
      update public.session_invoices
      set lines = '[]'::jsonb, charged = 0, credited = 0, total = 0, undecided = 0, unconfirmed = 0, updated_at = now()
      where id = inv.id;
    end if;
    return null;
  end if;
  return public.build_invoice_core(p.trainer_id, p_client, null, m);
end;
$$;
revoke execute on function public.build_session_invoice_for(uuid, date) from public, anon, authenticated;

-- The trainer (re)builds a diary person's invoice from the app.
create or replace function public.build_diary_invoice(p_name text, p_month date)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can make invoices';
  end if;
  if public.diary_name_key(p_name) is null then
    raise exception 'Who is this for?';
  end if;
  return public.build_invoice_core(me, null, public.diary_name_key(p_name), p_month);
end;
$$;
revoke execute on function public.build_diary_invoice(text, date) from public, anon;
grant execute on function public.build_diary_invoice(text, date) to authenticated;

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
  if inv.client_id is not null then
    perform public.session_require_trainer(inv.client_id);
  end if;
  tz := public.session_tz(inv.trainer_id);
  select count(*) into n
  from public.live_sessions ls
  where ls.trainer_id = inv.trainer_id
    and (case when inv.client_id is not null
              then ls.client_id = inv.client_id or ls.client_id in (select sp.client_id from public.session_plans sp where sp.paid_by = inv.client_id)
              else ls.client_id is null and public.diary_name_key(ls.guest_name) = inv.guest_key end)
    and ls.charge = 'makeup' and ls.makeup_session_id is null and ls.status in ('cancelled', 'no_show')
    and public.catchup_deadline(ls.starts_at, ls.catchup_until, tz) < (inv.month + interval '1 month')::date
    and public.catchup_deadline(ls.starts_at, ls.catchup_until, tz) < (now() at time zone tz)::date;
  if n > 0 then
    raise exception '% catch-up% not done in time: credit % or move % to next month first (Today › Catch-ups)',
      n, case when n = 1 then '' else 's' end, case when n = 1 then 'it' else 'them' end, case when n = 1 then 'it' else 'them' end;
  end if;
  if inv.status = 'draft' then
    inv := public.build_invoice_core(inv.trainer_id, inv.client_id, inv.guest_key, inv.month);
  end if;
  update public.session_invoices set status = case when status = 'paid' then 'paid' else 'sent' end, sent_at = now(), updated_at = now()
  where id = inv.id
  returning * into inv;
  -- Not in the app: the trainer shares the text themselves.
  if inv.client_id is null then
    return inv;
  end if;
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
create or replace function public.set_session_invoice_paid(p_id uuid, p_paid boolean)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
  h public.client_away;
begin
  update public.session_invoices
  set status = case when p_paid then 'paid' when sent_at is not null then 'sent' else 'draft' end,
      paid_at = case when p_paid then now() else null end,
      updated_at = now()
  where id = p_id and trainer_id = auth.uid() and (select public.not_unapproved_trainer())
  returning * into inv;
  if inv.id is null then
    raise exception 'Invoice not found';
  end if;
  if p_paid and not exists (
    select 1 from public.session_invoices i
    where i.trainer_id = inv.trainer_id
      and (case when inv.client_id is not null then i.client_id = inv.client_id else i.guest_key = inv.guest_key end)
      and i.status <> 'paid' and i.total > 0 and i.month >= date '2026-12-01'
  ) then
    for h in
      select a.* from public.client_away a
      where a.trainer_id = inv.trainer_id and a.ended_at is null and a.unpaid
        and (case when inv.client_id is not null
                  then a.client_id = inv.client_id
                       or a.client_id in (select sp.client_id from public.session_plans sp where sp.paid_by = inv.client_id)
                  else a.client_id is null and a.guest_key = inv.guest_key end)
    loop
      perform public.end_hold(h.id);
    end loop;
  end if;
  return inv;
end;
$$;
-- Who hasn't paid: app clients and people not in the app (0223).
create or replace function public.unpaid_invoice_people(p_trainer uuid, p_today date)
returns table (client_id uuid, name text, guest_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.id, c.name, null::text
  from public.session_invoices i
  join public.clients c on c.id = i.client_id and c.archived_at is null
  where i.trainer_id = p_trainer and i.status <> 'paid' and i.total > 0
    and i.month >= date '2026-12-01' and i.month <= date_trunc('month', p_today)::date
  union
  select distinct null::uuid, i.guest_name, i.guest_name
  from public.session_invoices i
  where i.trainer_id = p_trainer and i.client_id is null and i.status <> 'paid' and i.total > 0
    and i.month >= date '2026-12-01' and i.month <= date_trunc('month', p_today)::date
$$;
revoke execute on function public.unpaid_invoice_people(uuid, date) from public, anon, authenticated;

create or replace function public.hold_unpaid_on_the_14th()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  tz text;
  today date;
  u record;
  names text[];
  p uuid;
begin
  for t in select distinct i.trainer_id from public.session_invoices i where i.status <> 'paid' and i.total > 0 and i.month >= date '2026-12-01'
  loop
    tz := public.session_tz(t.trainer_id);
    today := (now() at time zone tz)::date;
    if extract(day from today) not in (11, 14) then
      continue;
    end if;
    names := '{}';
    for u in select * from public.unpaid_invoice_people(t.trainer_id, today) loop
      names := names || split_part(u.name, ' ', 1);
      if extract(day from today) = 14 and u.client_id is null then
        perform public.hold_client_for(t.trainer_id, null, u.guest_name);
      elsif extract(day from today) = 14 then
        perform public.hold_client_for(t.trainer_id, u.client_id, null);
        for p in select sp.client_id from public.session_plans sp where sp.paid_by = u.client_id and sp.trainer_id = t.trainer_id loop
          perform public.hold_client_for(t.trainer_id, p, null);
        end loop;
      end if;
    end loop;
    if coalesce(array_length(names, 1), 0) = 0 then
      continue;
    end if;
    if extract(day from today) = 11 then
      perform public.push_to_user(
        t.trainer_id,
        '🧾 ' || array_length(names, 1) || case when array_length(names, 1) = 1 then ' client hasn''t paid yet' else ' clients haven''t paid yet' end,
        array_to_string(names, ', ') || '. On the 14th their sessions go on hold. Flip Paid in 1 on 1 › Invoices when the money comes in.',
        jsonb_build_object('type', 'live_session')
      );
    else
      perform public.push_to_user(
        t.trainer_id,
        '🚫 On hold today: not paid',
        array_to_string(names, ', ') || '. Their sessions are free to book. Flip Paid in Invoices and they''re booked again.',
        jsonb_build_object('type', 'live_session')
      );
    end if;
  end loop;
end;
$$;
create or replace function public.session_month_end()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  t record;
  inv public.session_invoices;
  tz text;
  m date;
  g record;
begin
  for p in select sp.client_id from public.session_plans sp where sp.active loop
    perform public.fill_regular_sessions(p.client_id);
  end loop;

  for p in
    select sp.*, public.session_tz(sp.trainer_id) as tz
    from public.session_plans sp
    join public.clients c on c.id = sp.client_id and c.trainer_id = sp.trainer_id
  loop
    tz := p.tz;
    continue when extract(day from now() at time zone tz) <> 1;
    m := case when p.billing = 'advance' then date_trunc('month', now() at time zone tz)::date
              else (date_trunc('month', now() at time zone tz) - interval '1 month')::date end;
    continue when exists (select 1 from public.session_invoices i where i.client_id = p.client_id and i.month = m);
    -- Only when there's something to bill or list.
    continue when not p.active and not exists (
      select 1 from public.live_sessions ls
      where ls.client_id = p.client_id and ls.status <> 'removed'
        and (ls.invoice_id is null or ls.credit_invoice_id is null)
        and ls.starts_at < (m + interval '1 month')::timestamp at time zone tz
        and ls.starts_at >= (m - interval '1 month')::timestamp at time zone tz
    );
    inv := public.build_session_invoice_for(p.client_id, m);
  end loop;

  -- People not in the app (0223): one invoice per calendar name with
  -- sessions to bill or list, on their trainer's 1st.
  for g in
    select ls.trainer_id, public.diary_name_key(ls.guest_name) as k, public.session_tz(ls.trainer_id) as tz,
           coalesce(f.billing, st.billing, 'arrears') as billing
    from public.live_sessions ls
    left join public.diary_name_fees f on f.trainer_id = ls.trainer_id and f.name_key = public.diary_name_key(ls.guest_name)
    left join public.session_settings st on st.trainer_id = ls.trainer_id
    where ls.client_id is null and public.diary_name_real(ls.guest_name) and ls.status <> 'removed'
      and ls.starts_at >= now() - interval '2 months' and ls.starts_at < now() + interval '1 month'
    group by 1, 2, 3, 4
  loop
    continue when extract(day from now() at time zone g.tz) <> 1;
    m := case when g.billing = 'advance' then date_trunc('month', now() at time zone g.tz)::date
              else (date_trunc('month', now() at time zone g.tz) - interval '1 month')::date end;
    continue when exists (select 1 from public.session_invoices i where i.trainer_id = g.trainer_id and i.guest_key = g.k and i.month = m);
    continue when not exists (
      select 1 from public.live_sessions ls
      where ls.trainer_id = g.trainer_id and ls.client_id is null and public.diary_name_key(ls.guest_name) = g.k
        and ls.status <> 'removed'
        and ls.starts_at < (m + interval '1 month')::timestamp at time zone g.tz
        and ls.starts_at >= m::timestamp at time zone g.tz
    );
    inv := public.build_invoice_core(g.trainer_id, null, g.k, m);
  end loop;

  for t in
    select i.trainer_id, count(*) as n
    from public.session_invoices i
    where i.status = 'draft' and i.created_at > now() - interval '1 hour'
    group by i.trainer_id
  loop
    perform public.push_to_user(
      t.trainer_id,
      '🧾 ' || t.n || case when t.n = 1 then ' session invoice is' else ' session invoices are' end || ' ready',
      'Every session, cancellation and credit is on them. Check and tap Send.',
      jsonb_build_object('type', 'session_invoices')
    );
  end loop;
end;
$$;