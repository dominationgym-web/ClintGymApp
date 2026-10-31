-- People in the diary who aren't in the app yet (GRIZZ, 2026-10-31, with a
-- real week of his Google Calendar: "Need the trainer to be able to load this
-- and it must slot into their diary on the app with ability to edit
-- obviously afterwards"). Most of the names in it (Wasi, Rob V, Sharde ...)
-- have no app account, so a session can now carry just a name. When that
-- person joins, the trainer links the name to their account: all their
-- unbilled sessions move over and later imports match the name by itself.
--
-- A name-only session has no client, so no notifications and no invoice;
-- moving, taking off, marking done/no-show and cancelling all work as usual.

alter table public.live_sessions alter column client_id drop not null;
alter table public.live_sessions
  add column if not exists guest_name text check (guest_name is null or char_length(guest_name) between 1 and 60);
alter table public.live_sessions drop constraint if exists live_sessions_who;
alter table public.live_sessions
  add constraint live_sessions_who check (client_id is not null or guest_name is not null);

-- Calendar names the trainer has matched to a client ("Q" is Quraish Behari).
create table if not exists public.diary_name_links (
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  name_key text not null check (char_length(name_key) between 1 and 60),
  client_id uuid not null references public.clients (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (trainer_id, name_key)
);
alter table public.diary_name_links enable row level security;
drop policy if exists diary_name_links_read on public.diary_name_links;
create policy diary_name_links_read on public.diary_name_links
  for select to authenticated using (trainer_id = (select auth.uid()));

create or replace function public.diary_name_key(p_name text)
returns text
language sql
immutable
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')), '')
$$;

-- A name worth remembering: not "???" or other placeholders.
create or replace function public.diary_name_real(p_name text)
returns boolean
language sql
immutable
as $$
  select public.diary_name_key(p_name) is not null and public.diary_name_key(p_name) ~ '[[:alpha:]]'
$$;

-- An app client booked in person needs a session plan for invoices: one is
-- made from the trainer's settings when there isn't one yet.
create or replace function public.session_ensure_plan(p_client uuid, p_per_week integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.session_settings;
begin
  if exists (select 1 from public.session_plans where client_id = p_client) then
    return;
  end if;
  select * into s from public.session_settings where trainer_id = auth.uid();
  if s.fee is null then
    raise exception 'Set a session fee first (Live sessions › Setup)';
  end if;
  insert into public.session_plans (client_id, trainer_id, fee, per_week, billing, policy, minutes)
  values (p_client, auth.uid(), s.fee, greatest(1, least(coalesce(p_per_week, 1), 14)),
          coalesce(s.billing, 'advance'), coalesce(s.policy, '24h'), coalesce(s.minutes, 60))
  on conflict (client_id) do nothing;
end;
$$;

revoke execute on function public.session_ensure_plan(uuid, integer) from public, anon, authenticated;

-- Books what the trainer ticked: rows {starts_at, minutes, client_id} for app
-- clients or {starts_at, minutes, name} for names only. A name the trainer
-- linked before goes to that client. Nothing is booked twice, picks are
-- remembered, and each app client gets one notification.
create or replace function public.import_live_sessions(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_client uuid;
  v_name text;
  v_seen text;
  v_at timestamptz;
  p public.session_plans;
  s public.session_settings;
  v_added integer := 0;
  v_skipped integer := 0;
  v_future jsonb := '{}'::jsonb;
  v_count jsonb := '{}'::jsonb;
  v_weeks integer;
  k text;
  coach text;
begin
  if not public.not_unapproved_trainer() then
    raise exception 'Trainers only';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 400 then
    raise exception 'Send up to 400 sessions at a time';
  end if;
  select * into s from public.session_settings where trainer_id = auth.uid();
  if s.fee is null then
    raise exception 'Set a session fee first (Live sessions › Setup)';
  end if;

  -- Sessions a week for a new plan: each app client's sessions in this
  -- import over the weeks it covers.
  select greatest(1, count(distinct date_trunc('week', (e ->> 'starts_at')::timestamptz))) into v_weeks
  from jsonb_array_elements(p_rows) e;
  for r in select * from jsonb_array_elements(p_rows) loop
    if nullif(r ->> 'client_id', '') is not null then
      v_count := jsonb_set(v_count, array[r ->> 'client_id'], to_jsonb(coalesce((v_count ->> (r ->> 'client_id'))::int, 0) + 1));
    end if;
  end loop;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_client := nullif(r ->> 'client_id', '')::uuid;
    v_seen := left(btrim(coalesce(r ->> 'name', r ->> 'seen_name', '')), 60);
    v_name := null;
    v_at := (r ->> 'starts_at')::timestamptz;
    if v_client is null then
      select l.client_id into v_client from public.diary_name_links l
      where l.trainer_id = auth.uid() and l.name_key = public.diary_name_key(v_seen);
    end if;
    if v_client is not null then
      perform public.session_require_trainer(v_client);
      perform public.session_ensure_plan(v_client, ceil(coalesce((v_count ->> v_client::text)::numeric, 1) / v_weeks)::int);
      if public.diary_name_real(v_seen) then
        insert into public.diary_name_links (trainer_id, name_key, client_id)
        values (auth.uid(), public.diary_name_key(v_seen), v_client)
        on conflict (trainer_id, name_key) do update set client_id = excluded.client_id, updated_at = now();
      end if;
    else
      v_name := nullif(v_seen, '');
      if v_name is null then
        raise exception 'Every session needs a client or a name';
      end if;
    end if;
    select * into p from public.session_plans where client_id = v_client;
    if exists (
      select 1 from public.live_sessions ls
      where ls.trainer_id = auth.uid() and ls.starts_at = v_at and ls.status <> 'removed'
        and (ls.client_id = v_client or (v_client is null and public.diary_name_key(ls.guest_name) = public.diary_name_key(v_name)))
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.live_sessions (trainer_id, client_id, guest_name, starts_at, minutes, fee)
    values (auth.uid(), v_client, v_name, v_at,
            coalesce(nullif(r ->> 'minutes', '')::int, p.minutes, s.minutes, 60),
            coalesce(p.fee, s.fee));
    v_added := v_added + 1;
    if v_client is not null and v_at > now() then
      v_future := jsonb_set(v_future, array[v_client::text], to_jsonb(coalesce((v_future ->> v_client::text)::int, 0) + 1));
    end if;
  end loop;

  select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = auth.uid();
  for k in select jsonb_object_keys(v_future) loop
    perform public.push_to_user(
      k::uuid,
      '🤝 ' || (v_future ->> k) || case when (v_future ->> k)::int = 1 then ' session' else ' sessions' end || ' booked',
      coalesce(coach, 'Your coach') || ' added them to your calendar. Open My sessions to see them.',
      jsonb_build_object('type', 'live_session')
    );
  end loop;
  return jsonb_build_object('added', v_added, 'skipped', v_skipped);
end;
$$;

revoke execute on function public.import_live_sessions(jsonb) from public, anon;
grant execute on function public.import_live_sessions(jsonb) to authenticated;

-- Changes who a booked session is for: an app client or a name. With
-- p_all, a name's other unbilled sessions go to that client too, and the
-- name is remembered for later imports.
create or replace function public.set_live_session_person(p_id uuid, p_client uuid, p_name text default null, p_all boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ls public.live_sessions;
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 60), '');
  v_moved integer := 0;
  v_future integer := 0;
  coach text;
begin
  select * into ls from public.live_sessions where id = p_id and trainer_id = auth.uid();
  if ls.id is null or ls.invoice_id is not null or ls.status = 'removed' then
    raise exception 'That session is already on an invoice, so it can''t change hands';
  end if;
  if p_client is null and v_name is null then
    raise exception 'Pick a client or type a name';
  end if;
  if p_client is not null then
    perform public.session_require_trainer(p_client);
    perform public.session_ensure_plan(p_client);
    v_name := null;
  end if;

  if p_all and p_client is not null and ls.guest_name is not null then
    with moved as (
      update public.live_sessions x
      set client_id = p_client, guest_name = null, updated_at = now()
      where x.trainer_id = auth.uid() and x.client_id is null and x.invoice_id is null and x.status <> 'removed'
        and public.diary_name_key(x.guest_name) = public.diary_name_key(ls.guest_name)
      returning x.starts_at
    )
    select count(*), count(*) filter (where starts_at > now()) into v_moved, v_future from moved;
    if public.diary_name_real(ls.guest_name) then
      insert into public.diary_name_links (trainer_id, name_key, client_id)
      values (auth.uid(), public.diary_name_key(ls.guest_name), p_client)
      on conflict (trainer_id, name_key) do update set client_id = excluded.client_id, updated_at = now();
    end if;
  else
    update public.live_sessions
    set client_id = p_client, guest_name = v_name, updated_at = now()
    where id = p_id;
    v_moved := 1;
    v_future := case when p_client is not null and ls.starts_at > now() and ls.status = 'booked' then 1 else 0 end;
  end if;

  if p_client is not null and v_future > 0 then
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = auth.uid();
    perform public.push_to_user(
      p_client,
      '🤝 ' || v_future || case when v_future = 1 then ' session' else ' sessions' end || ' booked',
      coalesce(coach, 'Your coach') || ' added them to your calendar. Open My sessions to see them.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return jsonb_build_object('moved', v_moved);
end;
$$;

revoke execute on function public.set_live_session_person(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.set_live_session_person(uuid, uuid, text, boolean) to authenticated;

-- "Did your 06:30 with Wasi happen?" asks about name-only sessions too.
create or replace function public.live_session_asks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  -- One question per time slot, so a group session asks once.
  for v in
    select ls.trainer_id, ls.starts_at, array_agg(ls.id) as ids, count(*) as n,
           string_agg(split_part(coalesce(c.name, ls.guest_name, 'client'), ' ', 1), ', ' order by coalesce(c.name, ls.guest_name)) as names,
           (array_agg(ls.client_id))[1] as client_id
    from public.live_sessions ls
    left join public.clients c on c.id = ls.client_id
    where ls.status = 'booked' and not ls.asked_trainer
      and ls.starts_at + make_interval(mins => ls.minutes) + interval '15 minutes' <= now()
      and ls.starts_at > now() - interval '2 days'
    group by ls.trainer_id, ls.starts_at
  loop
    update public.live_sessions set asked_trainer = true where id = any (v.ids);
    perform public.push_to_user(
      v.trainer_id,
      case when v.n > 1
        then '👥 Who came to your ' || to_char(v.starts_at at time zone public.session_tz(v.trainer_id), 'HH24:MI') || ' group?'
        else '🤝 Did your ' || to_char(v.starts_at at time zone public.session_tz(v.trainer_id), 'HH24:MI') || ' with ' || v.names || ' happen?'
      end,
      case when v.n > 1 then v.names || '. Tick who came so it''s on their invoices.'
        else 'Tap Done, Cancelled or No-show so it''s on their invoice.' end,
      jsonb_build_object('type', 'live_session_ask', 'clientId', v.client_id)
    );
  end loop;
end;
$$;
