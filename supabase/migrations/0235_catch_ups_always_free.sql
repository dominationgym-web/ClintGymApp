-- One catch-up rule for everyone (GRIZZ 2026-11-22: "any client that goes to
-- catch-up keeps the session so will never be charged for the catch-up. Only
-- if I credit the slot due to no slots being available. Keep it standard
-- across the board. Variations will confuse the trainers."):
-- - On the catch-up list the missed session stays charged, whoever cancelled
--   (client, away, no-show, or the trainer / a holiday). A coach cancellation
--   with a catch-up now counts as 'makeup' for money, like the rest.
-- - The catch-up itself is free (R0), pairs included.
-- - Credit (decide_catch_up 'credit') takes it off the list: not charged, or
--   credited on the next invoice if it was already invoiced.
-- Replaces the price rule in 0234.

create or replace function public.live_session_kind(p_status text, p_starts_at timestamptz, p_minutes integer, p_charge text, p_by text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_status = 'done' then 'done'
    when p_status = 'booked' and p_starts_at + make_interval(mins => p_minutes) < now() then 'unconfirmed'
    when p_status = 'booked' then 'booked'
    when p_status = 'no_show' then case when p_charge = 'credit' then 'excused' when p_charge = 'makeup' then 'makeup' else 'no_show' end
    when p_status = 'removed' then 'removed'
    when p_charge = 'makeup' then 'makeup'
    when p_by = 'trainer' then 'trainer'
    when p_charge = 'charge' then 'late'
    when p_charge = 'credit' then 'notice'
    else 'decide'
  end
$$;
revoke execute on function public.live_session_kind(text, timestamptz, integer, text, text) from public, anon;

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
    -- Catch-ups are free (0235): its own price, which is R0 unless the
    -- trainer changed it on purpose.
    due := case when k in ('done', 'unconfirmed', 'booked', 'late', 'no_show', 'makeup') then r.fee else 0 end;
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
    -- On the catch-up list they keep the session: their share (0235).
    if k = 'makeup' then
      due := base;
    elsif n_trained = 1 and n_coach = 0 then
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

-- A new catch-up starts free, however it's booked (add_live_session,
-- add_diary_catch_up). The trainer can still change one session's price.
create or replace function public.live_sessions_catch_up_free()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.makeup_for is not null then
    new.fee := 0;
  end if;
  return new;
end;
$$;
revoke execute on function public.live_sessions_catch_up_free() from public, anon, authenticated;

create or replace trigger live_sessions_catch_up_free
  before insert on public.live_sessions
  for each row
  when (new.makeup_for is not null)
  execute function public.live_sessions_catch_up_free();

create or replace function public.make_session_catch_up(p_id uuid, p_makeup_for uuid)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  s public.live_sessions;
  o public.live_sessions;
  saved public.live_sessions;
begin
  select * into s from public.live_sessions
  where id = p_id and trainer_id = me and status = 'booked' and makeup_for is null;
  if s.id is null then
    raise exception 'Only a booked session that isn''t a catch-up already can be changed';
  end if;
  select * into o from public.live_sessions
  where id = p_makeup_for and trainer_id = me and charge = 'makeup' and makeup_session_id is null
    and status in ('cancelled', 'no_show')
    and ((s.client_id is not null and client_id = s.client_id)
      or (s.client_id is null and client_id is null
          and lower(trim(coalesce(guest_name, ''))) = lower(trim(coalesce(s.guest_name, '')))));
  if o.id is null then
    raise exception 'That catch-up has already been booked';
  end if;
  update public.live_sessions
  set makeup_for = o.id, fee = case when invoice_id is null then 0 else fee end, updated_at = now()
  where id = s.id
  returning * into saved;
  update public.live_sessions set makeup_session_id = s.id, updated_at = now() where id = o.id;
  return saved;
end;
$$;
revoke execute on function public.make_session_catch_up(uuid, uuid) from public, anon;
grant execute on function public.make_session_catch_up(uuid, uuid) to authenticated;

-- Existing data: catch-ups not on a sent invoice yet become free, and coach
-- cancellations on the catch-up list get their stored price worked out again.
update public.live_sessions ls set fee = 0, updated_at = now()
where ls.makeup_for is not null and ls.fee <> 0
  and (ls.invoice_id is null or exists (select 1 from public.session_invoices i where i.id = ls.invoice_id and i.status = 'draft'));
update public.live_sessions set fee = fee
where cancelled_by = 'trainer' and charge = 'makeup' and status <> 'removed';

-- What clients are told when the coach cancels with a catch-up: the session
-- still counts and the catch-up costs nothing extra (was "You won't be
-- charged for it"). Credited sessions keep "You won't be charged for it."
do $$
declare
  def text;
begin
  def := pg_get_functiondef('public.block_trainer_time(timestamptz, timestamptz, text)'::regprocedure);
  def := replace(def,
    $q$why || ' You won''t be charged for ' || case when c.n = 1 then 'it' else 'them' end || ', and your coach will find you a catch-up time.'$q$,
    $q$why || ' ' || case when c.n = 1 then 'It still counts' else 'They still count' end || ', and your coach will find you a free catch-up time.'$q$);
  execute def;
  def := pg_get_functiondef('public.log_session_cancellation(uuid, text, timestamptz, text, text, text)'::regprocedure);
  def := replace(def,
    $q$then 'You won''t be charged for it, and your coach will find you a catch-up time.'$q$,
    $q$then 'It still counts, and your coach will find you a free catch-up time.'$q$);
  execute def;
end;
$$;
