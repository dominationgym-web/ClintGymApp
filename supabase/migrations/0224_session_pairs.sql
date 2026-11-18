-- Pairs set up once, one invoice per couple (GRIZZ, 2026-11-18).
--
-- "Set up a pair once": the trainer picks both people (in the app or not),
-- what they pay together and the price when one trains alone, on one screen.
-- Both people's plans get the same prices, so Sharde and Camilla can't end
-- up priced differently from their partner again.
--
-- "Then the invoicing on doubles send as 1 amount. Give the trainer the
-- option to select splitting invoice before sending for those that need it.
-- Most couples don't split invoicing. Few do." So a pair gets one invoice by
-- default, paid by one of them, each person's sessions still listed and
-- priced separately. Split turns it into two invoices.
--
-- Works for app clients and calendar names alike (Jade is a name, Camilla
-- is in the app). The older "who pays" (session_plans.paid_by, app clients
-- only) keeps working; invoice_people() covers both.

create table if not exists public.session_pairs (
  id uuid primary key default gen_random_uuid(),
  -- No foreign keys: closing an account must never be held up by a pair row.
  trainer_id uuid not null,
  a_client uuid,
  a_key text,
  a_name text not null,
  b_client uuid,
  b_key text,
  b_name text not null,
  together numeric(10, 2) not null check (together > 0 and together <= 100000),
  alone numeric(10, 2) not null check (alone >= 0 and alone <= 100000),
  one_invoice boolean not null default true,
  payer text not null default 'a' check (payer in ('a', 'b')),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((a_client is null) <> (a_key is null)),
  check ((b_client is null) <> (b_key is null))
);
create index if not exists session_pairs_trainer on public.session_pairs (trainer_id) where ended_at is null;
alter table public.session_pairs enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'session_pairs' and policyname = 'session_pairs_read') then
    create policy session_pairs_read on public.session_pairs
      for select to authenticated using (trainer_id = (select auth.uid()));
  end if;
end $$;

-- Which side of a pair someone is on ('a', 'b' or null). An app client by
-- id, a calendar name by its key.
create or replace function public.pair_side(pr public.session_pairs, p_client uuid, p_key text)
returns text
language sql
immutable
as $$
  select case
    when (p_client is not null and pr.a_client = p_client) or (p_client is null and pr.a_client is null and pr.a_key = p_key) then 'a'
    when (p_client is not null and pr.b_client = p_client) or (p_client is null and pr.b_client is null and pr.b_key = p_key) then 'b'
  end
$$;

-- Everyone on this person's invoice: themselves, anyone they pay for
-- (session_plans.paid_by), and their partner when the pair has one invoice
-- and they're the one who pays.
create or replace function public.invoice_people(p_trainer uuid, p_client uuid, p_key text)
returns table (client_id uuid, guest_key text)
language sql
stable
security definer
set search_path = public
as $$
  select p_client, case when p_client is null then p_key end
  union
  select sp.client_id, null::text from public.session_plans sp
  where p_client is not null and sp.paid_by = p_client and sp.trainer_id = p_trainer
  union
  select case when pr.payer = 'a' then pr.b_client else pr.a_client end,
         case when pr.payer = 'a' then pr.b_key else pr.a_key end
  from public.session_pairs pr
  where pr.trainer_id = p_trainer and pr.ended_at is null and pr.one_invoice
    and public.pair_side(pr, p_client, p_key) = pr.payer
$$;
revoke execute on function public.invoice_people(uuid, uuid, text) from public, anon, authenticated;

-- Who pays for this person, when it's someone else (no rows: they pay for
-- themselves).
create or replace function public.invoice_payer(p_trainer uuid, p_client uuid, p_key text)
returns table (client_id uuid, guest_key text)
language sql
stable
security definer
set search_path = public
as $$
  select sp.paid_by, null::text from public.session_plans sp
  where p_client is not null and sp.client_id = p_client and sp.paid_by is not null
  union
  select case when pr.payer = 'a' then pr.a_client else pr.b_client end,
         case when pr.payer = 'a' then pr.a_key else pr.b_key end
  from public.session_pairs pr
  where pr.trainer_id = p_trainer and pr.ended_at is null and pr.one_invoice
    and public.pair_side(pr, p_client, p_key) = case when pr.payer = 'a' then 'b' else 'a' end
$$;
revoke execute on function public.invoice_payer(uuid, uuid, text) from public, anon, authenticated;

-- A draft for someone who's now on another person's invoice: emptied, so
-- their sessions can go on the payer's.
create or replace function public.empty_draft_invoice(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.live_sessions set invoice_id = null where invoice_id = p_id
    and exists (select 1 from public.session_invoices i where i.id = p_id and i.status = 'draft');
  update public.live_sessions set credit_invoice_id = null where credit_invoice_id = p_id
    and exists (select 1 from public.session_invoices i where i.id = p_id and i.status = 'draft');
  update public.session_invoices
  set lines = '[]'::jsonb, charged = 0, credited = 0, total = 0, undecided = 0, unconfirmed = 0, updated_at = now()
  where id = p_id and status = 'draft';
$$;
revoke execute on function public.empty_draft_invoice(uuid) from public, anon, authenticated;

-- (Re)builds one person's draft for a month: an app client or a calendar
-- name. Someone paid for by someone else gets an empty draft (or none).
create or replace function public.rebuild_person_invoice(p_trainer uuid, p_client uuid, p_key text, p_month date)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
  m date := date_trunc('month', p_month)::date;
begin
  if p_client is not null then
    if not exists (select 1 from public.session_plans where client_id = p_client) then
      return null;
    end if;
    return public.build_session_invoice_for(p_client, m);
  end if;
  if exists (select 1 from public.invoice_payer(p_trainer, null, p_key)) then
    select * into inv from public.session_invoices where trainer_id = p_trainer and guest_key = p_key and month = m and status = 'draft';
    if found then
      perform public.empty_draft_invoice(inv.id);
    end if;
    return null;
  end if;
  if not exists (
    select 1 from public.live_sessions ls
    where ls.trainer_id = p_trainer and ls.client_id is null and public.diary_name_key(ls.guest_name) = p_key
  ) then
    return null;
  end if;
  return public.build_invoice_core(p_trainer, null, p_key, m);
end;
$$;
revoke execute on function public.rebuild_person_invoice(uuid, uuid, text, date) from public, anon, authenticated;

-- Every draft month for either person in the pair, brought up to date.
-- Both drafts let go of their sessions first, so whoever pays now picks
-- them all up (combining, splitting or ending the pair).
create or replace function public.rebuild_pair_drafts(p_pair uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pr public.session_pairs;
  m date;
  d uuid;
begin
  select * into pr from public.session_pairs where id = p_pair;
  if not found then
    return;
  end if;
  for m in
    select distinct i.month from public.session_invoices i
    where i.trainer_id = pr.trainer_id and i.status = 'draft'
      and public.pair_side(pr, i.client_id, i.guest_key) is not null
  loop
    for d in
      select i.id from public.session_invoices i
      where i.trainer_id = pr.trainer_id and i.status = 'draft' and i.month = m
        and public.pair_side(pr, i.client_id, i.guest_key) is not null
    loop
      perform public.empty_draft_invoice(d);
    end loop;
    perform public.rebuild_person_invoice(pr.trainer_id, pr.a_client, pr.a_key, m);
    perform public.rebuild_person_invoice(pr.trainer_id, pr.b_client, pr.b_key, m);
  end loop;
end;
$$;
revoke execute on function public.rebuild_pair_drafts(uuid) from public, anon, authenticated;

-- An app client paid for by their partner (both in the app) also gets
-- session_plans.paid_by, so their app says who pays. Kept in step with the
-- pair.
create or replace function public.sync_pair_payer(p_pair uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pr public.session_pairs;
  payer uuid;
  other uuid;
begin
  select * into pr from public.session_pairs where id = p_pair;
  if not found then
    return;
  end if;
  payer := case when pr.payer = 'a' then pr.a_client else pr.b_client end;
  other := case when pr.payer = 'a' then pr.b_client else pr.a_client end;
  if payer is not null then
    update public.session_plans set paid_by = null, updated_at = now() where client_id = payer and paid_by is not null;
  end if;
  if other is not null then
    update public.session_plans
    set paid_by = case when pr.ended_at is null and pr.one_invoice then payer end, updated_at = now()
    where client_id = other and paid_by is distinct from (case when pr.ended_at is null and pr.one_invoice then payer end);
  end if;
end;
$$;
revoke execute on function public.sync_pair_payer(uuid) from public, anon, authenticated;

-- The trainer sets up (or changes) a pair: both people, what they pay
-- together, the price when one trains alone, and one invoice or two.
-- p_a_client / p_b_client for app clients, otherwise p_a_name / p_b_name.
create or replace function public.set_session_pair(
  p_id uuid,
  p_a_client uuid,
  p_a_name text,
  p_b_client uuid,
  p_b_name text,
  p_together numeric,
  p_alone numeric,
  p_one_invoice boolean,
  p_payer text
)
returns public.session_pairs
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ak text;
  bk text;
  an text;
  bn text;
  share numeric;
  saved public.session_pairs;
  x record;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can set up a pair';
  end if;
  if p_a_client is not null then
    perform public.session_require_trainer(p_a_client);
    perform public.session_ensure_plan(p_a_client);
    select c.name into an from public.clients c where c.id = p_a_client;
  else
    ak := public.diary_name_key(p_a_name);
    an := btrim(p_a_name);
  end if;
  if p_b_client is not null then
    perform public.session_require_trainer(p_b_client);
    perform public.session_ensure_plan(p_b_client);
    select c.name into bn from public.clients c where c.id = p_b_client;
  else
    bk := public.diary_name_key(p_b_name);
    bn := btrim(p_b_name);
  end if;
  if (p_a_client is null and ak is null) or (p_b_client is null and bk is null) then
    raise exception 'Pick both people';
  end if;
  if (p_a_client is not null and p_a_client = p_b_client) or (p_a_client is null and p_b_client is null and ak = bk) then
    raise exception 'Pick two different people';
  end if;
  if p_together is null or p_together <= 0 or p_together > 100000 then
    raise exception 'Type what they pay together for one session, like 1000';
  end if;
  if p_alone is null or p_alone < 0 or p_alone > 100000 then
    raise exception 'Type the price when one of them trains alone, like 750';
  end if;
  share := round(p_together / 2, 2);

  if p_id is not null then
    update public.session_pairs
    set a_client = p_a_client, a_key = ak, a_name = an, b_client = p_b_client, b_key = bk, b_name = bn,
        together = p_together, alone = p_alone, one_invoice = coalesce(p_one_invoice, true),
        payer = case when p_payer = 'b' then 'b' else 'a' end, ended_at = null, updated_at = now()
    where id = p_id and trainer_id = me
    returning * into saved;
    if saved.id is null then
      raise exception 'Pair not found';
    end if;
  else
    insert into public.session_pairs (trainer_id, a_client, a_key, a_name, b_client, b_key, b_name, together, alone, one_invoice, payer)
    values (me, p_a_client, ak, an, p_b_client, bk, bn, p_together, p_alone, coalesce(p_one_invoice, true),
            case when p_payer = 'b' then 'b' else 'a' end)
    returning * into saved;
  end if;

  -- One pair per person: an older pair with either of them ends.
  update public.session_pairs sp
  set ended_at = now(), updated_at = now()
  where sp.trainer_id = me and sp.ended_at is null and sp.id <> saved.id
    and (public.pair_side(sp, p_a_client, ak) is not null or public.pair_side(sp, p_b_client, bk) is not null);

  -- Both people's plans: half the together price each, and the alone price.
  update public.session_plans
  set fee = share, group_size = 2, group_total = p_together, solo_fee = p_alone, updated_at = now()
  where client_id in (p_a_client, p_b_client);
  if ak is not null then
    insert into public.diary_name_fees (trainer_id, name_key, fee, group_size, group_total, solo_fee, updated_at)
    values (me, ak, share, 2, p_together, p_alone, now())
    on conflict (trainer_id, name_key) do update
    set fee = excluded.fee, group_size = 2, group_total = excluded.group_total, solo_fee = excluded.solo_fee, updated_at = now();
  end if;
  if bk is not null then
    insert into public.diary_name_fees (trainer_id, name_key, fee, group_size, group_total, solo_fee, updated_at)
    values (me, bk, share, 2, p_together, p_alone, now())
    on conflict (trainer_id, name_key) do update
    set fee = excluded.fee, group_size = 2, group_total = excluded.group_total, solo_fee = excluded.solo_fee, updated_at = now();
  end if;

  -- Their sessions take the together share: upcoming ones, and this and
  -- last month's that aren't on a sent invoice yet. Catch-ups keep their
  -- own price (alone it's the alone price anyway).
  update public.live_sessions ls
  set fee = share, updated_at = now()
  where ls.trainer_id = me and ls.makeup_for is null and ls.status <> 'removed' and ls.fee <> share
    and ls.starts_at >= date_trunc('month', now()) - interval '1 month'
    and (ls.invoice_id is null or exists (select 1 from public.session_invoices i where i.id = ls.invoice_id and i.status = 'draft'))
    and (ls.client_id in (p_a_client, p_b_client)
         or (ls.client_id is null and public.diary_name_key(ls.guest_name) in (ak, bk)));
  -- Every time slot of theirs gets its amounts worked out again.
  for x in
    select distinct ls.starts_at from public.live_sessions ls
    where ls.trainer_id = me and ls.starts_at >= date_trunc('month', now()) - interval '1 month'
      and (ls.client_id in (p_a_client, p_b_client)
           or (ls.client_id is null and public.diary_name_key(ls.guest_name) in (ak, bk)))
  loop
    perform public.refresh_slot_due(me, x.starts_at);
  end loop;

  perform public.sync_pair_payer(saved.id);
  perform public.rebuild_pair_drafts(saved.id);
  return saved;
end;
$$;
revoke execute on function public.set_session_pair(uuid, uuid, text, uuid, text, numeric, numeric, boolean, text) from public, anon;
grant execute on function public.set_session_pair(uuid, uuid, text, uuid, text, numeric, numeric, boolean, text) to authenticated;

-- One invoice or two, straight from the invoice before sending (GRIZZ:
-- "Give the trainer the option to select splitting invoice before sending
-- for those that need it"). Drafts are redone at once.
create or replace function public.set_pair_invoice(p_id uuid, p_one boolean, p_payer text)
returns public.session_pairs
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.session_pairs;
begin
  update public.session_pairs
  set one_invoice = p_one, payer = case when p_payer in ('a', 'b') then p_payer else payer end, updated_at = now()
  where id = p_id and trainer_id = auth.uid() and ended_at is null and (select public.not_unapproved_trainer())
  returning * into saved;
  if saved.id is null then
    raise exception 'Pair not found';
  end if;
  perform public.sync_pair_payer(saved.id);
  perform public.rebuild_pair_drafts(saved.id);
  return saved;
end;
$$;
revoke execute on function public.set_pair_invoice(uuid, boolean, text) from public, anon;
grant execute on function public.set_pair_invoice(uuid, boolean, text) to authenticated;

-- Not a pair any more: each pays for themselves again. Their prices stay
-- as they are (changed on each person's page).
create or replace function public.end_session_pair(p_id uuid)
returns public.session_pairs
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.session_pairs;
begin
  update public.session_pairs
  set ended_at = now(), updated_at = now()
  where id = p_id and trainer_id = auth.uid() and ended_at is null
  returning * into saved;
  if saved.id is null then
    raise exception 'Pair not found';
  end if;
  perform public.sync_pair_payer(saved.id);
  -- Both get their own draft again.
  perform public.rebuild_pair_drafts(saved.id);
  return saved;
end;
$$;
revoke execute on function public.end_session_pair(uuid) from public, anon;
grant execute on function public.end_session_pair(uuid) to authenticated;


-- The invoice builders and money jobs from 0223, now with invoice_people().

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
  v_keys text[];
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
  -- This person and everyone on their invoice: anyone they pay for, and
  -- their partner when the pair has one invoice (0224). Each person's
  -- sessions listed and costed separately.
  select coalesce(array_agg(ip.client_id) filter (where ip.client_id is not null), '{}'),
         coalesce(array_agg(ip.guest_key) filter (where ip.client_id is null), '{}')
  into v_people, v_keys
  from public.invoice_people(v_trainer, p_client, p_key) ip;
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
      and (ls.client_id = any (v_people)
           or (ls.client_id is null and public.diary_name_key(ls.guest_name) = any (v_keys)))
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
  if p.paid_by is not null or exists (select 1 from public.invoice_payer(p.trainer_id, p_client, null)) then
    select * into inv from public.session_invoices where client_id = p_client and month = m and status = 'draft';
    if found then
      perform public.empty_draft_invoice(inv.id);
    end if;
    return null;
  end if;
  return public.build_invoice_core(p.trainer_id, p_client, null, m);
end;
$$;
revoke execute on function public.build_session_invoice_for(uuid, date) from public, anon, authenticated;

-- The trainer (re)builds a diary person's invoice from the app. On their
-- partner's invoice: nothing of their own (0224).
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
  return public.rebuild_person_invoice(me, null, public.diary_name_key(p_name), p_month);
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
    and exists (
      select 1 from public.invoice_people(inv.trainer_id, inv.client_id, inv.guest_key) ip
      where ls.client_id = ip.client_id
         or (ip.client_id is null and ls.client_id is null and public.diary_name_key(ls.guest_name) = ip.guest_key)
    )
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
        and exists (
          select 1 from public.invoice_people(inv.trainer_id, inv.client_id, inv.guest_key) ip
          where a.client_id = ip.client_id
             or (ip.client_id is null and a.client_id is null and a.guest_key = ip.guest_key)
        )
    loop
      perform public.end_hold(h.id);
    end loop;
  end if;
  return inv;
end;
$$;

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
  ip record;
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
      if extract(day from today) = 14 then
        -- Everyone on the unpaid invoice (a couple on one invoice both).
        for ip in select * from public.invoice_people(t.trainer_id, u.client_id, public.diary_name_key(u.guest_name)) loop
          if ip.client_id is not null then
            perform public.hold_client_for(t.trainer_id, ip.client_id, null);
          else
            perform public.hold_client_for(t.trainer_id, null, coalesce((
              select ls.guest_name from public.live_sessions ls
              where ls.trainer_id = t.trainer_id and ls.client_id is null and public.diary_name_key(ls.guest_name) = ip.guest_key
              order by ls.starts_at desc limit 1), ip.guest_key));
          end if;
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
    -- On their partner's invoice (0224).
    continue when exists (select 1 from public.invoice_payer(g.trainer_id, null, g.k));
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
      'Check them in 1 on 1 › Invoices, then tap Send all. Nothing goes out until you do.',
      jsonb_build_object('type', 'session_invoices')
    );
  end loop;
end;
$$;
