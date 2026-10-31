-- In-person session booking, cancellations and month-end invoices (GRIZZ,
-- 2026-10-31: "client buys 3 slots a week at whatever fee the trainer logs
-- for that client ... the app tracks their sessions and charges them in
-- advance or in arrears ... if a client cancels a session we need to track
-- its timing and log it accordingly ... at the end of the month all his
-- payment and session tracking is done without any need for extra work").
--
-- session_settings  the trainer's normal fee, billing, cancellation rule.
-- session_plans     per client: fee, sessions a week, rule, billing, regular times.
-- session_agreements  every agreement a client signed (kept as proof).
-- live_sessions     each booked session and what happened to it.
-- session_invoices  one per client per month, built by the app on the 1st.
--
-- Cancellation rule: '24h' / '12h' (notice of at least that many hours is
-- credited, less is charged) or 'trainer' (the trainer picks each time). A
-- no-show is charged; a session the trainer cancels is always credited.
--
-- Billing: an invoice for month M charges (a) in advance only: M's sessions
-- still booked, (b) every earlier session that was never on an invoice and
-- is billable (done, unanswered, or a charged cancellation), and credits
-- (c) any session already charged on a sent invoice that later turned out
-- free (cancelled in time, cancelled by the trainer, taken off the calendar).
-- So in advance and in arrears share one builder.
--
-- Nothing here is ever deleted: sessions are marked removed, plans inactive.

create table public.session_settings (
  trainer_id uuid primary key default auth.uid() references public.trainers (id) on delete cascade,
  fee numeric(10, 2) check (fee is null or fee >= 0),
  currency text not null default 'ZAR' check (currency in ('ZAR', 'USD')),
  billing text not null default 'arrears' check (billing in ('advance', 'arrears')),
  policy text not null default '24h' check (policy in ('24h', '12h', 'trainer')),
  minutes integer not null default 60 check (minutes between 15 and 180),
  -- The working day (GRIZZ, 2026-10-31: "if they start at 5.10am sessions are
  -- staggered at 5.50, 6.30 etc."): times offered step by the session length
  -- from day_start, and also start straight after any booked session.
  day_start time not null default '05:00',
  day_end time not null default '20:00' check (day_end > day_start),
  time_zone text not null default 'Africa/Johannesburg',
  -- The trainer's own wording of the agreement; null = the standard text in the app.
  agreement_text text check (agreement_text is null or char_length(agreement_text) <= 10000),
  updated_at timestamptz not null default now()
);

create table public.session_plans (
  client_id uuid primary key references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  fee numeric(10, 2) not null check (fee >= 0),
  per_week smallint not null default 3 check (per_week between 1 and 14),
  billing text not null check (billing in ('advance', 'arrears')),
  policy text not null check (policy in ('24h', '12h', 'trainer')),
  minutes integer not null default 60 check (minutes between 15 and 180),
  -- Regular weekly times: [{"weekday": 1, "time": "06:00"}], weekday 0 Sunday.
  regular jsonb not null default '[]'::jsonb check (jsonb_typeof(regular) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  signed_name text not null check (char_length(signed_name) between 2 and 120),
  -- The whole text as the client saw it, with the terms filled in.
  agreement text not null check (char_length(agreement) <= 20000),
  fee numeric(10, 2) not null,
  per_week smallint not null,
  billing text not null,
  policy text not null,
  regular jsonb not null default '[]'::jsonb,
  signed_at timestamptz not null default now()
);
create index session_agreements_client_idx on public.session_agreements (client_id, signed_at desc);

create table public.session_invoices (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  -- The first day of the month it is for.
  month date not null check (extract(day from month) = 1),
  billing text not null check (billing in ('advance', 'arrears')),
  currency text not null default 'ZAR',
  -- The diary: every session it charges, credits or just lists (see build_session_invoice).
  lines jsonb not null default '[]'::jsonb,
  charged numeric(10, 2) not null default 0,
  credited numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  -- Cancellations the trainer still has to decide (rule 'trainer'), not on it yet.
  undecided integer not null default 0,
  -- Past sessions nobody has marked done, charged as done.
  unconfirmed integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);
create index session_invoices_trainer_idx on public.session_invoices (trainer_id, month desc);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  starts_at timestamptz not null,
  minutes integer not null check (minutes between 15 and 180),
  fee numeric(10, 2) not null check (fee >= 0),
  -- The regular time it was made from; stays when the session is moved, so
  -- the calendar isn't filled in again at the old time.
  regular_at timestamptz,
  status text not null default 'booked' check (status in ('booked', 'done', 'cancelled', 'no_show', 'removed')),
  cancelled_by text check (cancelled_by is null or cancelled_by in ('client', 'trainer')),
  -- When notice was given (the WhatsApp message's time, or the tap in the app).
  cancelled_at timestamptz,
  -- Who put the cancellation into the app.
  logged_by text check (logged_by is null or logged_by in ('client', 'trainer')),
  -- For a cancellation or no-show: charged or credited. Null = trainer still to decide.
  charge text check (charge is null or charge in ('charge', 'credit')),
  proof_path text,
  note text check (note is null or char_length(note) <= 500),
  trainer_confirmed_at timestamptz,
  client_confirmed_at timestamptz,
  client_disputed_at timestamptz,
  asked_trainer boolean not null default false,
  invoice_id uuid references public.session_invoices (id) on delete set null,
  credit_invoice_id uuid references public.session_invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index live_sessions_regular_once on public.live_sessions (client_id, regular_at) where regular_at is not null;
create index live_sessions_trainer_idx on public.live_sessions (trainer_id, starts_at);
create index live_sessions_client_idx on public.live_sessions (client_id, starts_at);
create index live_sessions_ask_idx on public.live_sessions (starts_at) where status = 'booked' and not asked_trainer;

alter table public.session_settings enable row level security;
alter table public.session_plans enable row level security;
alter table public.session_agreements enable row level security;
alter table public.session_invoices enable row level security;
alter table public.live_sessions enable row level security;

-- The trainer's own settings; their clients can read them (fee, rule, agreement).
create policy session_settings_read on public.session_settings
  for select to authenticated using (
    trainer_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = (select auth.uid()) and c.trainer_id = session_settings.trainer_id)
  );
create policy session_settings_insert on public.session_settings
  for insert to authenticated with check (trainer_id = (select auth.uid()) and (select public.not_unapproved_trainer()));
create policy session_settings_update on public.session_settings
  for update to authenticated
  using (trainer_id = (select auth.uid()) and (select public.not_unapproved_trainer()))
  with check (trainer_id = (select auth.uid()));

-- Plans, sessions, agreements: both sides read; changes go through the functions below.
create policy session_plans_read on public.session_plans
  for select to authenticated using (client_id = (select auth.uid()) or trainer_id = (select auth.uid()));
create policy session_agreements_read on public.session_agreements
  for select to authenticated using (client_id = (select auth.uid()) or trainer_id = (select auth.uid()));
create policy live_sessions_read on public.live_sessions
  for select to authenticated using (client_id = (select auth.uid()) or trainer_id = (select auth.uid()));
-- A client sees an invoice once it's sent.
create policy session_invoices_read on public.session_invoices
  for select to authenticated using (
    trainer_id = (select auth.uid()) or (client_id = (select auth.uid()) and status <> 'draft')
  );

-- Cancellation screenshots: a private bucket, one folder per client. The
-- trainer adds them; the trainer and that client can open them.
insert into storage.buckets (id, name, public) values ('session-proofs', 'session-proofs', false)
on conflict (id) do nothing;

create policy "trainer adds session proofs" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'session-proofs'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(objects.name))[1] and c.trainer_id = (select auth.uid())
    )
  );
create policy "session proofs trainer and client read" on storage.objects
  for select to authenticated using (
    bucket_id = 'session-proofs'
    and (
      (storage.foldername(objects.name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(objects.name))[1] and c.trainer_id = (select auth.uid())
      )
    )
  );

-- The trainer's time zone (from their phone), South Africa until they save settings.
create or replace function public.session_tz(p_trainer uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select time_zone from public.session_settings where trainer_id = p_trainer), 'Africa/Johannesburg')
$$;

-- Raises unless the caller is this client's approved trainer.
create or replace function public.session_require_trainer(p_client uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.not_unapproved_trainer()
     or not exists (select 1 from public.clients c where c.id = p_client and c.trainer_id = auth.uid() and c.id <> auth.uid()) then
    raise exception 'Only this client''s trainer can do that';
  end if;
end;
$$;

-- Fills the calendar with a plan's regular times from now to the end of next
-- month. A regular time taken off the calendar by hand isn't added back.
create or replace function public.fill_regular_sessions(p_client uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.session_plans;
  tz text;
  slot jsonb;
  d date;
  v_at timestamptz;
  added integer := 0;
  n integer;
begin
  select * into p from public.session_plans where client_id = p_client;
  if not found or not p.active then
    return 0;
  end if;
  tz := public.session_tz(p.trainer_id);
  for slot in select * from jsonb_array_elements(p.regular) loop
    for d in
      select g::date from generate_series(
        (now() at time zone tz)::date::timestamp,
        (date_trunc('month', now() at time zone tz) + interval '2 months' - interval '1 day')::date::timestamp,
        interval '1 day'
      ) g
    loop
      continue when extract(dow from d) <> (slot ->> 'weekday')::int;
      v_at := (d + (slot ->> 'time')::time) at time zone tz;
      continue when v_at <= now();
      insert into public.live_sessions (trainer_id, client_id, starts_at, minutes, fee, regular_at)
      values (p.trainer_id, p.client_id, v_at, p.minutes, p.fee, v_at)
      on conflict (client_id, regular_at) where regular_at is not null do nothing;
      get diagnostics n = row_count;
      added := added + n;
    end loop;
  end loop;
  return added;
end;
$$;

-- The trainer saves a client's plan. Future sessions follow the new fee and
-- length; regular times that were dropped come off the calendar.
create or replace function public.save_session_plan(
  p_client uuid,
  p_fee numeric,
  p_per_week integer,
  p_billing text,
  p_policy text,
  p_minutes integer,
  p_regular jsonb,
  p_active boolean default true
)
returns public.session_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.session_plans;
  was public.session_plans;
  tz text;
  coach text;
begin
  perform public.session_require_trainer(p_client);
  tz := public.session_tz(auth.uid());
  select * into was from public.session_plans where client_id = p_client;

  insert into public.session_plans as sp (client_id, trainer_id, fee, per_week, billing, policy, minutes, regular, active, updated_at)
  values (p_client, auth.uid(), p_fee, p_per_week, p_billing, p_policy, p_minutes, coalesce(p_regular, '[]'::jsonb), coalesce(p_active, true), now())
  on conflict (client_id) do update
    set trainer_id = excluded.trainer_id, fee = excluded.fee, per_week = excluded.per_week, billing = excluded.billing,
        policy = excluded.policy, minutes = excluded.minutes, regular = excluded.regular, active = excluded.active,
        updated_at = now()
  returning * into saved;

  -- Future booked sessions not yet on an invoice take the new fee and length.
  update public.live_sessions
  set fee = saved.fee, minutes = saved.minutes, updated_at = now()
  where client_id = p_client and status = 'booked' and starts_at > now() and invoice_id is null
    and (fee <> saved.fee or minutes <> saved.minutes);

  -- Future regular sessions whose time was dropped (or the plan stopped) come
  -- off; they let go of regular_at so the time can be filled again later.
  update public.live_sessions ls
  set status = 'removed', regular_at = null, updated_at = now()
  where ls.client_id = p_client and ls.status = 'booked' and ls.starts_at > now() and ls.regular_at is not null
    and (
      not saved.active
      or not exists (
        select 1 from jsonb_array_elements(saved.regular) r
        where (r ->> 'weekday')::int = extract(dow from ls.regular_at at time zone tz)
          and (r ->> 'time')::time = (ls.regular_at at time zone tz)::time
      )
    );

  perform public.fill_regular_sessions(p_client);

  if was.client_id is null and saved.active then
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = auth.uid();
    perform public.push_to_user(
      p_client,
      '🤝 Your sessions with ' || coalesce(coach, 'your coach') || ' are set up',
      'Open the app to see your times and sign the session agreement.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return saved;
end;
$$;

-- The client signs the agreement for their current plan.
create or replace function public.sign_session_agreement(p_name text, p_agreement text)
returns public.session_agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.session_plans;
  saved public.session_agreements;
  who text;
begin
  select * into p from public.session_plans where client_id = auth.uid();
  if not found then
    raise exception 'Your coach hasn''t set up your sessions yet';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Type your full name to sign';
  end if;
  insert into public.session_agreements (client_id, trainer_id, signed_name, agreement, fee, per_week, billing, policy, regular)
  values (p.client_id, p.trainer_id, btrim(p_name), p_agreement, p.fee, p.per_week, p.billing, p.policy, p.regular)
  returning * into saved;
  select c.name into who from public.clients c where c.id = p.client_id;
  perform public.push_to_user(
    p.trainer_id,
    '✍️ ' || coalesce(who, 'A client') || ' signed the session agreement',
    'Signed as ' || saved.signed_name || '.',
    jsonb_build_object('type', 'live_session', 'clientId', p.client_id)
  );
  return saved;
end;
$$;

-- The trainer books a one-off session (fee and length from the client's plan).
create or replace function public.add_live_session(p_client uuid, p_starts_at timestamptz, p_minutes integer default null)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.session_plans;
  s public.session_settings;
  saved public.live_sessions;
begin
  perform public.session_require_trainer(p_client);
  select * into p from public.session_plans where client_id = p_client;
  select * into s from public.session_settings where trainer_id = auth.uid();
  if p.client_id is null and s.fee is null then
    raise exception 'Set this client''s session fee first';
  end if;
  insert into public.live_sessions (trainer_id, client_id, starts_at, minutes, fee)
  values (auth.uid(), p_client, p_starts_at, coalesce(p_minutes, p.minutes, s.minutes, 60), coalesce(p.fee, s.fee))
  returning * into saved;
  if p_starts_at > now() then
    perform public.push_to_user(
      p_client,
      '🤝 Session booked',
      public.video_checkin_when(p_starts_at, public.session_tz(auth.uid())) || ' with your coach.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return saved;
end;
$$;

-- The trainer moves a session to another time; the client hears about it.
create or replace function public.move_live_session(p_id uuid, p_starts_at timestamptz)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
  old_at timestamptz;
  tz text := public.session_tz(auth.uid());
begin
  select starts_at into old_at from public.live_sessions where id = p_id and trainer_id = auth.uid();
  update public.live_sessions
  set starts_at = p_starts_at, asked_trainer = false, updated_at = now()
  where id = p_id and trainer_id = auth.uid() and status = 'booked'
  returning * into saved;
  if saved.id is null then
    raise exception 'Only a booked session can be moved';
  end if;
  perform public.push_to_user(
    saved.client_id,
    '🤝 Session moved',
    public.video_checkin_when(old_at, tz) || ' is now ' || public.video_checkin_when(p_starts_at, tz) || '.',
    jsonb_build_object('type', 'live_session')
  );
  return saved;
end;
$$;

-- The trainer takes a booked session off the calendar (booked by mistake).
-- Not a cancellation: if it was already invoiced, it's credited next month.
create or replace function public.remove_live_session(p_id uuid)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
begin
  update public.live_sessions
  set status = 'removed', updated_at = now()
  where id = p_id and trainer_id = auth.uid() and status = 'booked'
  returning * into saved;
  if saved.id is null then
    raise exception 'Only a booked session can be taken off';
  end if;
  return saved;
end;
$$;

-- Credit or charge for a cancellation from its notice and the client's rule.
create or replace function public.session_auto_charge(p_policy text, p_by text, p_starts_at timestamptz, p_cancelled_at timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_by = 'trainer' then 'credit'
    when p_policy = '24h' then case when p_starts_at - p_cancelled_at >= interval '24 hours' then 'credit' else 'charge' end
    when p_policy = '12h' then case when p_starts_at - p_cancelled_at >= interval '12 hours' then 'credit' else 'charge' end
    else null
  end
$$;

-- "30 hours' notice", "2 days' notice", "no notice" for notifications.
create or replace function public.session_notice_text(p_starts_at timestamptz, p_cancelled_at timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_starts_at <= p_cancelled_at then 'no notice'
    when p_starts_at - p_cancelled_at < interval '1 hour' then floor(extract(epoch from p_starts_at - p_cancelled_at) / 60)::int || ' minutes'' notice'
    when p_starts_at - p_cancelled_at < interval '48 hours' then floor(extract(epoch from p_starts_at - p_cancelled_at) / 3600)::int || ' hours'' notice'
    else floor(extract(epoch from p_starts_at - p_cancelled_at) / 86400)::int || ' days'' notice'
  end
$$;

-- The client cancels in the app, before the session starts. The time is
-- saved and the trainer hears straight away.
create or replace function public.cancel_live_session(p_id uuid, p_reason text default null)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
  pol text;
  who text;
  why text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  select coalesce(p.policy, s.policy, '24h') into pol
  from public.live_sessions ls
  left join public.session_plans p on p.client_id = ls.client_id
  left join public.session_settings s on s.trainer_id = ls.trainer_id
  where ls.id = p_id;
  update public.live_sessions
  set status = 'cancelled', cancelled_by = 'client', cancelled_at = now(), logged_by = 'client',
      charge = public.session_auto_charge(pol, 'client', starts_at, now()), note = why, updated_at = now()
  where id = p_id and client_id = auth.uid() and status = 'booked' and starts_at > now()
  returning * into saved;
  if saved.id is null then
    raise exception 'That session has started, passed or is already cancelled';
  end if;
  select c.name into who from public.clients c where c.id = saved.client_id;
  perform public.push_to_user(
    saved.trainer_id,
    '❌ ' || coalesce(who, 'A client') || ' cancelled ' || public.video_checkin_when(saved.starts_at, public.session_tz(saved.trainer_id)),
    'Gave ' || public.session_notice_text(saved.starts_at, saved.cancelled_at)
      || case saved.charge when 'charge' then '. Late: it will be charged.' when 'credit' then '. In time: it won''t be charged.'
         else '. Open the app to choose charge or credit.' end
      || coalesce(' "' || why || '"', ''),
    jsonb_build_object('type', 'live_session', 'clientId', saved.client_id)
  );
  return saved;
end;
$$;

-- The trainer logs a cancellation that came on WhatsApp (with the
-- screenshot), or one of their own. p_charge overrides the rule.
create or replace function public.log_session_cancellation(
  p_id uuid,
  p_by text,
  p_cancelled_at timestamptz,
  p_proof_path text default null,
  p_note text default null,
  p_charge text default null
)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
  pol text;
  v_at timestamptz := least(coalesce(p_cancelled_at, now()), now());
begin
  if p_by not in ('client', 'trainer') then
    raise exception 'Who cancelled?';
  end if;
  select coalesce(p.policy, s.policy, '24h') into pol
  from public.live_sessions ls
  left join public.session_plans p on p.client_id = ls.client_id
  left join public.session_settings s on s.trainer_id = ls.trainer_id
  where ls.id = p_id;
  update public.live_sessions
  set status = 'cancelled', cancelled_by = p_by, cancelled_at = v_at, logged_by = 'trainer',
      charge = coalesce(p_charge, public.session_auto_charge(pol, p_by, starts_at, v_at)),
      proof_path = coalesce(p_proof_path, proof_path),
      note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 500), ''), note),
      trainer_confirmed_at = null, asked_trainer = true, updated_at = now()
  where id = p_id and trainer_id = auth.uid() and status in ('booked', 'done', 'no_show', 'cancelled')
  returning * into saved;
  if saved.id is null then
    raise exception 'That session can''t be changed';
  end if;
  if p_by = 'trainer' and saved.starts_at > now() then
    perform public.push_to_user(
      saved.client_id,
      'Your coach cancelled ' || public.video_checkin_when(saved.starts_at, public.session_tz(saved.trainer_id)),
      'You won''t be charged for it.' || coalesce(' ' || saved.note, ''),
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return saved;
end;
$$;

-- After the session: the trainer says it happened ('done') or the client
-- didn't come ('no_show', charged). Done asks the client to confirm.
create or replace function public.set_session_outcome(p_id uuid, p_outcome text)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
  coach text;
begin
  if p_outcome not in ('done', 'no_show', 'booked') then
    raise exception 'Unknown outcome';
  end if;
  update public.live_sessions
  set status = p_outcome,
      charge = case when p_outcome = 'no_show' then 'charge' else null end,
      cancelled_by = null, cancelled_at = null, logged_by = null,
      trainer_confirmed_at = case when p_outcome = 'done' then now() else null end,
      client_confirmed_at = case when p_outcome = 'done' then client_confirmed_at else null end,
      client_disputed_at = null,
      asked_trainer = asked_trainer or p_outcome <> 'booked',
      updated_at = now()
  where id = p_id and trainer_id = auth.uid() and status <> 'removed'
    and (p_outcome = 'booked' or starts_at <= now() + interval '1 hour')
  returning * into saved;
  if saved.id is null then
    raise exception 'That session can''t be marked yet';
  end if;
  if p_outcome = 'done' and saved.client_confirmed_at is null then
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = saved.trainer_id;
    perform public.push_to_user(
      saved.client_id,
      '🤝 Did you train with ' || coalesce(coach, 'your coach') || '?',
      public.video_checkin_when(saved.starts_at, public.session_tz(saved.trainer_id)) || '. Tap to confirm with one touch.',
      jsonb_build_object('type', 'live_session_confirm', 'sessionId', saved.id)
    );
  end if;
  return saved;
end;
$$;

-- The trainer changes charge/credit on a cancellation or no-show.
create or replace function public.set_session_charge(p_id uuid, p_charge text)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
begin
  if p_charge not in ('charge', 'credit') then
    raise exception 'Charge or credit?';
  end if;
  update public.live_sessions
  set charge = p_charge, updated_at = now()
  where id = p_id and trainer_id = auth.uid() and status in ('cancelled', 'no_show')
  returning * into saved;
  if saved.id is null then
    raise exception 'Only a cancelled session can be charged or credited';
  end if;
  return saved;
end;
$$;

-- The client confirms a session happened, or says it didn't.
create or replace function public.client_confirm_session(p_id uuid, p_happened boolean)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
  who text;
begin
  update public.live_sessions
  set client_confirmed_at = case when p_happened then now() else null end,
      client_disputed_at = case when p_happened then null else now() end,
      updated_at = now()
  where id = p_id and client_id = auth.uid() and status = 'done'
  returning * into saved;
  if saved.id is null then
    raise exception 'That session isn''t marked as done';
  end if;
  if not p_happened then
    select c.name into who from public.clients c where c.id = saved.client_id;
    perform public.push_to_user(
      saved.trainer_id,
      coalesce(who, 'A client') || ' says a session didn''t happen',
      public.video_checkin_when(saved.starts_at, public.session_tz(saved.trainer_id)) || '. Check it on Live sessions.',
      jsonb_build_object('type', 'live_session', 'clientId', saved.client_id)
    );
  end if;
  return saved;
end;
$$;

-- What a session counts as on an invoice line.
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
    when p_status = 'no_show' then case when p_charge = 'credit' then 'notice' else 'no_show' end
    when p_status = 'removed' then 'removed'
    when p_by = 'trainer' then 'trainer'
    when p_charge = 'charge' then 'late'
    when p_charge = 'credit' then 'notice'
    else 'decide'
  end
$$;

-- Builds (or rebuilds, while still a draft) a client's invoice for a month.
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
begin
  select * into p from public.session_plans where client_id = p_client;
  if not found then
    raise exception 'This client has no session plan';
  end if;
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
    select ls.*, (ls.starts_at >= m_start and ls.starts_at < m_end) as in_month
    from public.live_sessions ls
    where ls.client_id = p_client and ls.trainer_id = p.trainer_id
      and (
        (ls.starts_at >= m_start and ls.starts_at < m_end)
        or (ls.starts_at < m_start and ls.invoice_id is null and ls.status <> 'removed')
        or (ls.invoice_id is not null and ls.credit_invoice_id is null and ls.starts_at < m_end)
      )
    order by ls.starts_at
  loop
    kind := public.live_session_kind(r.status, r.starts_at, r.minutes, r.charge, r.cancelled_by);
    role := null;
    amt := 0;
    if r.invoice_id is null then
      -- Not on any invoice yet: charge it if it's billable now.
      if kind in ('done', 'unconfirmed', 'late', 'no_show') and (r.in_month or r.starts_at < m_start)
         and (bill = 'advance' or r.starts_at < m_end) then
        role := 'charge';
      elsif kind = 'booked' and bill = 'advance' and r.in_month then
        role := 'charge';
      elsif r.in_month then
        role := 'diary';
      end if;
    elsif r.credit_invoice_id is null and kind in ('notice', 'trainer', 'removed')
          and exists (select 1 from public.session_invoices i where i.id = r.invoice_id and i.status <> 'draft') then
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
      'disputed', r.client_disputed_at is not null
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

-- The trainer (re)builds an invoice from the app.
create or replace function public.build_session_invoice(p_client uuid, p_month date)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.session_require_trainer(p_client);
  return public.build_session_invoice_for(p_client, p_month);
end;
$$;

-- The trainer sends it: rebuilt one last time, then locked. The client hears.
create or replace function public.send_session_invoice(p_id uuid)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
  coach text;
begin
  select * into inv from public.session_invoices where id = p_id and trainer_id = auth.uid();
  if not found then
    raise exception 'Invoice not found';
  end if;
  perform public.session_require_trainer(inv.client_id);
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

-- Paid (when the proof of payment came in) or back to not paid.
create or replace function public.set_session_invoice_paid(p_id uuid, p_paid boolean)
returns public.session_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.session_invoices;
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
  return inv;
end;
$$;

-- A live session run in the app ("Start live session") marks that day's
-- booked session done, so the trainer doesn't have to.
create or replace function public.live_session_done_from_workout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_sessions;
  coach text;
begin
  if not new.in_person then
    return new;
  end if;
  for s in
    update public.live_sessions ls
    set status = 'done', trainer_confirmed_at = now(), asked_trainer = true, updated_at = now()
    where ls.client_id = new.client_id and ls.status = 'booked'
      and (ls.starts_at at time zone public.session_tz(ls.trainer_id))::date = new.session_date
      and ls.starts_at <= now() + interval '2 hours'
    returning ls.*
  loop
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = s.trainer_id;
    perform public.push_to_user(
      s.client_id,
      '🤝 Did you train with ' || coalesce(coach, 'your coach') || '?',
      public.video_checkin_when(s.starts_at, public.session_tz(s.trainer_id)) || '. Tap to confirm with one touch.',
      jsonb_build_object('type', 'live_session_confirm', 'sessionId', s.id)
    );
  end loop;
  return new;
end;
$$;

create trigger live_session_done_from_workout
  after insert or update of in_person on public.workout_sessions
  for each row execute function public.live_session_done_from_workout();

-- Every 5 minutes: 15 minutes after a session should have ended, ask the
-- trainer whether it happened.
create or replace function public.live_session_asks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  for v in
    select ls.id, ls.trainer_id, ls.client_id, ls.starts_at, c.name as client_name
    from public.live_sessions ls
    join public.clients c on c.id = ls.client_id
    where ls.status = 'booked' and not ls.asked_trainer
      and ls.starts_at + make_interval(mins => ls.minutes) + interval '15 minutes' <= now()
      and ls.starts_at > now() - interval '2 days'
  loop
    update public.live_sessions set asked_trainer = true where id = v.id;
    perform public.push_to_user(
      v.trainer_id,
      '🤝 Did your ' || to_char(v.starts_at at time zone public.session_tz(v.trainer_id), 'HH24:MI') || ' with '
        || split_part(coalesce(v.client_name, 'your client'), ' ', 1) || ' happen?',
      'Tap Done, Cancelled or No-show so it''s on their invoice.',
      jsonb_build_object('type', 'live_session_ask', 'sessionId', v.id, 'clientId', v.client_id)
    );
  end loop;
end;
$$;

-- Every morning: keep the next two months filled in, and on the 1st make
-- every client's invoice (in advance: this month; in arrears: last month)
-- and tell each trainer how many are ready to send.
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

revoke execute on function public.session_tz(uuid) from public, anon;
revoke execute on function public.session_require_trainer(uuid) from public, anon, authenticated;
revoke execute on function public.fill_regular_sessions(uuid) from public, anon, authenticated;
revoke execute on function public.build_session_invoice_for(uuid, date) from public, anon, authenticated;
revoke execute on function public.live_session_done_from_workout() from public, anon, authenticated;
revoke execute on function public.live_session_asks() from public, anon, authenticated;
revoke execute on function public.session_month_end() from public, anon, authenticated;
revoke execute on function public.live_session_kind(text, timestamptz, integer, text, text) from public, anon;

do $$
declare
  f text;
begin
  foreach f in array array[
    'save_session_plan(uuid, numeric, integer, text, text, integer, jsonb, boolean)',
    'sign_session_agreement(text, text)',
    'add_live_session(uuid, timestamptz, integer)',
    'move_live_session(uuid, timestamptz)',
    'remove_live_session(uuid)',
    'cancel_live_session(uuid, text)',
    'log_session_cancellation(uuid, text, timestamptz, text, text, text)',
    'set_session_outcome(uuid, text)',
    'set_session_charge(uuid, text)',
    'client_confirm_session(uuid, boolean)',
    'build_session_invoice(uuid, date)',
    'send_session_invoice(uuid)',
    'set_session_invoice_paid(uuid, boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

select cron.schedule('live-session-asks', '*/5 * * * *', $$select public.live_session_asks();$$);
-- 03:30 UTC is 05:30 in South Africa: invoices are ready before the day starts.
select cron.schedule('session-month-end', '30 3 * * *', $$select public.session_month_end();$$);
