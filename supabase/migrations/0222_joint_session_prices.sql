-- Joint sessions priced by who actually trained (GRIZZ, 2026-11-18: "When
-- they train together its 500 each. If one trains its R750 and the other gets
-- a R250 credit if they dont catch up").
--
-- Before: every line used the fee saved on the session, which came from each
-- person's own plan. A partner set up as a solo client (Sharde, R750) or at
-- R0 (Camilla) was billed that, and nobody's alone price ever kicked in
-- unless the trainer used the group check by hand.
--
-- Now, for a client whose plan says they train with others and has an alone
-- price (session_plans.group_size > 1 and solo_fee), each session is priced
-- from the people booked at that same time (public.session_due):
--   * trained together (or both booked)          -> their together fee
--   * trained, and nobody else trained            -> their alone price
--     (a partner the coach cancelled doesn't count: that's not on them)
--   * missed it, late or in time, while exactly
--     one other person trained alone             -> the balance: together total
--     less the alone price (R1000 - R750 = R250; GRIZZ: "If one is 750 she
--     pays 250 cancellation fee"), so upfront the R500 comes back as R250
--     (also when they're owed a catch-up)
--   * missed it while nobody trained             -> late or catch-up owed:
--     together fee; in time: free
--   * the catch-up itself                         -> alone price (with someone
--     else in the slot: together fee). "A single session on a double will
--     always be R750."
--
-- Upfront invoices are built at the start of the month with everyone
-- booked, so when someone later trains alone or a partner cancels, the
-- difference goes on the next invoice: an extra (alone price - what was
-- billed) or a credit (what was billed - what they owe). live_sessions.billed
-- remembers what each session was billed; credit_invoice_id marks the
-- invoice that settled the difference, as it already did for credits.

alter table public.live_sessions add column if not exists billed numeric(10,2);

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
  p public.session_plans;
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
  select * into p from public.session_plans where client_id = r.client_id;

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
  ) q;
  joint := case when n_partners > 0 then 'together' end;

  -- Their plan says they train with someone and has an alone price.
  pair := p.client_id is not null and coalesce(p.group_size, 1) > 1 and p.solo_fee is not null;
  if not pair then
    due := case when k in ('done', 'unconfirmed', 'booked', 'late', 'no_show', 'makeup') then r.fee else 0 end;
    return next;
    return;
  end if;

  -- The group check could have saved the alone price on a session: when they
  -- trained together after all, they pay the together fee.
  base := case when r.fee = p.solo_fee and p.solo_fee <> p.fee then p.fee else r.fee end;
  -- What the one who missed pays when the other trains alone: the together
  -- total less the alone price (R1000 - R750 = R250; R900 - R750 = R150).
  balance := greatest(0, round((coalesce(p.group_total, p.fee * p.group_size) - p.solo_fee) / (p.group_size - 1), 2));
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
      due := case when n_partners = 0 then p.solo_fee else p.fee end;
    end if;
    joint := case when n_partners > 0 then 'together' else 'catch_up' end;
  elsif k in ('done', 'unconfirmed', 'booked') then
    if alone then
      due := p.solo_fee;
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

create or replace function public.build_session_invoice_for(p_client uuid, p_month date)
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
begin
  select * into p from public.session_plans where client_id = p_client;
  if not found then
    raise exception 'This client has no session plan';
  end if;

  -- Someone else pays for this client: their sessions go on the payer's
  -- invoice. A draft made before that is emptied so nothing is billed twice.
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
  -- This client and everyone they pay for, each person's sessions listed
  -- and costed separately.
  v_people := array[p_client] || coalesce((
    select array_agg(sp.client_id) from public.session_plans sp
    where sp.paid_by = p_client and sp.trainer_id = p.trainer_id
  ), '{}');
  select * into st from public.session_settings where trainer_id = p.trainer_id;
  tz := coalesce(st.time_zone, 'Africa/Johannesburg');
  bill := p.billing;
  m_start := m::timestamp at time zone tz;
  m_end := (m + interval '1 month')::timestamp at time zone tz;

  select * into inv from public.session_invoices where client_id = p_client and month = m;
  if found and inv.status <> 'draft' then
    return inv;
  end if;
  if not found then
    insert into public.session_invoices (trainer_id, client_id, month, billing, currency)
    values (p.trainer_id, p_client, m, bill, coalesce(st.currency, 'ZAR'))
    returning * into inv;
  else
    update public.live_sessions set invoice_id = null where invoice_id = inv.id;
    update public.live_sessions set credit_invoice_id = null where credit_invoice_id = inv.id;
  end if;

  for r in
    select ls.*, (ls.starts_at >= m_start and ls.starts_at < m_end) as in_month, c.name as who
    from public.live_sessions ls
    join public.clients c on c.id = ls.client_id
    where ls.client_id = any (v_people) and ls.trainer_id = p.trainer_id
      and (
        (ls.starts_at >= m_start and ls.starts_at < m_end)
        or (ls.starts_at < m_start and ls.invoice_id is null and ls.status <> 'removed')
        or (ls.invoice_id is not null and ls.credit_invoice_id is null and ls.starts_at < m_end)
      )
    order by c.name, ls.starts_at
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
      charged = v_charged, credited = v_credited, total = v_charged - v_credited,
      undecided = v_undecided, unconfirmed = v_unconfirmed,
      updated_at = now()
  where id = inv.id
  returning * into inv;
  return inv;
end;
$$;

-- What each session is worth after the joint rules, kept on the session so
-- the 1 on 1 money screens (made today, this week, losses) add up the same
-- as the invoices. Refreshed for the whole time slot whenever anyone in it
-- changes, and for a client's sessions when their plan changes.
alter table public.live_sessions add column if not exists due numeric(10,2);

create or replace function public.refresh_slot_due(p_trainer uuid, p_at timestamptz)
returns void
language sql
security definer
set search_path = public
as $$
  update public.live_sessions x
  set due = (select d.due from public.session_due(x.id) d)
  where x.trainer_id = p_trainer and x.starts_at = p_at
    and x.due is distinct from (select d.due from public.session_due(x.id) d);
$$;
revoke execute on function public.refresh_slot_due(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.live_sessions_refresh_due()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 2 then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_slot_due(old.trainer_id, old.starts_at);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.starts_at <> old.starts_at or new.trainer_id <> old.trainer_id) then
    perform public.refresh_slot_due(new.trainer_id, new.starts_at);
  end if;
  return null;
end;
$$;
revoke execute on function public.live_sessions_refresh_due() from public, anon, authenticated;

create or replace trigger live_sessions_refresh_due
  after insert or delete or update of status, charge, cancelled_by, starts_at, fee, client_id, makeup_for, trainer_id
  on public.live_sessions
  for each row
  execute function public.live_sessions_refresh_due();

create or replace function public.session_plans_refresh_due()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  for s in
    select distinct trainer_id, starts_at from public.live_sessions
    where client_id = new.client_id and starts_at >= date_trunc('month', now()) - interval '1 month'
  loop
    perform public.refresh_slot_due(s.trainer_id, s.starts_at);
  end loop;
  return null;
end;
$$;
revoke execute on function public.session_plans_refresh_due() from public, anon, authenticated;

create or replace trigger session_plans_refresh_due
  after insert or update of fee, group_size, group_total, solo_fee on public.session_plans
  for each row
  execute function public.session_plans_refresh_due();

-- Fill it in for this month and last month.
update public.live_sessions x
set due = (select d.due from public.session_due(x.id) d)
where x.starts_at >= date '2026-10-01';
