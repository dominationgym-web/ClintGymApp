-- Upfront (in advance) invoices: the month's invoice is what the client paid
-- on the 1st, so a session cancelled during the month stays on it and is
-- credited on next month's invoice (GRIZZ, 2026-11-08: "any credits will be
-- deducted off their sessions for next month"). Before this, a draft that was
-- rebuilt after a cancellation simply dropped the session, so nothing came
-- off next month even though the client had paid for it.
--
-- Also: a session charged on an earlier month's invoice is credited even if
-- that invoice was never sent or marked paid in the app (many trainers send
-- the WhatsApp text and never tap Send).

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
    role := null;
    amt := 0;
    if r.invoice_id is null then
      -- Not on any invoice yet: charge it if it's billable now.
      if kind in ('done', 'unconfirmed', 'late', 'no_show', 'makeup') and (r.in_month or r.starts_at < m_start)
         and (bill = 'advance' or r.starts_at < m_end) then
        role := 'charge';
      elsif kind = 'booked' and bill = 'advance' and r.in_month then
        role := 'charge';
      elsif kind in ('notice', 'excused', 'trainer') and bill = 'advance' and r.in_month
            and (r.cancelled_at is null or r.cancelled_at >= m_start) then
        -- Paid upfront and cancelled during the month: still on this month,
        -- credited on the next one.
        role := 'charge';
      elsif r.in_month then
        role := 'diary';
      end if;
    elsif r.credit_invoice_id is null and kind in ('notice', 'excused', 'trainer', 'removed')
          and exists (select 1 from public.session_invoices i where i.id = r.invoice_id and (i.status <> 'draft' or i.month < m)) then
      role := 'credit';
    elsif r.in_month and kind <> 'removed' then
      role := 'diary';
    end if;
    continue when role is null or (role = 'diary' and kind = 'removed');

    if role = 'charge' then
      amt := r.fee;
      v_charged := v_charged + r.fee;
      update public.live_sessions set invoice_id = inv.id where id = r.id;
      if kind = 'unconfirmed' then v_unconfirmed := v_unconfirmed + 1; end if;
    elsif role = 'credit' then
      amt := -r.fee;
      v_credited := v_credited + r.fee;
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
      'fee', r.fee,
      'by', r.cancelled_by,
      'cancelled_at', r.cancelled_at,
      'notice_hours', case when r.cancelled_at is null then null
                           else round((extract(epoch from r.starts_at - r.cancelled_at) / 3600)::numeric, 1) end,
      'proof', r.proof_path,
      'note', r.note,
      'client_ok', r.client_confirmed_at is not null,
      'disputed', r.client_disputed_at is not null,
      'catch_up', r.makeup_for is not null,
      'catch_up_booked', r.makeup_session_id is not null
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
