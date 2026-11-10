-- Link a new app client to their name on the 1 on 1 calendar (GRIZZ,
-- 2026-11-10: "I just realized that I have to go and find the client and link
-- them myself personally. If the client joins the app, you must send a
-- pop-up"). When a client signs up, the trainer's app pops up with the names
-- on their calendar that aren't in the app yet; one tap links the name and
-- everything booked under it moves over to the client's account.

-- The trainer's answer for each new client, so the pop-up asks only once.
create table if not exists public.client_link_answers (
  client_id uuid primary key references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  -- The calendar name they were linked to; null = "a new client, not on my calendar".
  linked_name text,
  answered_at timestamptz not null default now()
);
alter table public.client_link_answers enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'client_link_answers' and policyname = 'client_link_answers_read') then
    create policy client_link_answers_read on public.client_link_answers
      for select to authenticated using (trainer_id = (select auth.uid()));
  end if;
end $$;

-- Moves everything kept under a calendar name to an app client: unbilled
-- sessions (also ones taken off, so Undo on a stop still works), weekly
-- repeats, away and on-hold dates, stops, and remembers the name for later
-- calendar imports. The client gets a session plan at the name's price.
create or replace function public.link_diary_name(p_client uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  k text := public.diary_name_key(p_name);
  v_fee numeric;
  v_per_week integer;
  v_moved integer := 0;
  v_future integer := 0;
  s public.session_settings;
  coach text;
begin
  perform public.session_require_trainer(p_client);
  if k is null then
    raise exception 'Pick a name from your calendar';
  end if;

  -- A session plan, so their sessions land on invoices like any 1 on 1 client.
  if not exists (select 1 from public.session_plans where client_id = p_client) then
    select * into s from public.session_settings where trainer_id = me;
    select f.fee into v_fee from public.diary_name_fees f where f.trainer_id = me and f.name_key = k;
    if v_fee is null then
      select ls.fee into v_fee from public.live_sessions ls
      where ls.trainer_id = me and ls.client_id is null and public.diary_name_key(ls.guest_name) = k and ls.fee is not null
      order by ls.starts_at desc limit 1;
    end if;
    select count(*) into v_per_week from public.live_repeats r
    where r.trainer_id = me and r.client_id is null and r.ended_at is null and public.diary_name_key(r.guest_name) = k;
    insert into public.session_plans (client_id, trainer_id, fee, per_week, billing, policy, minutes)
    values (p_client, me, coalesce(v_fee, s.fee, 0), greatest(1, least(coalesce(nullif(v_per_week, 0), 1), 14)),
            coalesce(s.billing, 'advance'), coalesce(s.policy, '24h'), coalesce(s.minutes, 60))
    on conflict (client_id) do nothing;
  end if;

  with moved as (
    update public.live_sessions x
    set client_id = p_client, guest_name = null, updated_at = now()
    where x.trainer_id = me and x.client_id is null and x.invoice_id is null
      and public.diary_name_key(x.guest_name) = k
    returning x.starts_at, x.status
  )
  select count(*), count(*) filter (where starts_at > now() and status = 'booked') into v_moved, v_future from moved;

  update public.live_repeats r
  set client_id = p_client, guest_name = null
  where r.trainer_id = me and r.client_id is null and public.diary_name_key(r.guest_name) = k;

  update public.client_away a
  set client_id = p_client, guest_name = null, guest_key = null
  where a.trainer_id = me and a.client_id is null and a.guest_key = k;

  update public.client_stops st
  set client_id = p_client, guest_name = null, guest_key = null
  where st.trainer_id = me and st.client_id is null and st.guest_key = k;

  if public.diary_name_real(p_name) then
    insert into public.diary_name_links (trainer_id, name_key, client_id)
    values (me, k, p_client)
    on conflict (trainer_id, name_key) do update set client_id = excluded.client_id, updated_at = now();
  end if;

  insert into public.client_link_answers (client_id, trainer_id, linked_name)
  values (p_client, me, left(btrim(p_name), 60))
  on conflict (client_id) do update set linked_name = excluded.linked_name, answered_at = now();

  if v_future > 0 then
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = me;
    perform public.push_to_user(
      p_client,
      '🤝 ' || v_future || case when v_future = 1 then ' session' else ' sessions' end || ' booked',
      coalesce(coach, 'Your coach') || ' added them to your calendar. Open My sessions to see them.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return jsonb_build_object('moved', v_moved, 'future', v_future);
end;
$$;
revoke execute on function public.link_diary_name(uuid, text) from public, anon;
grant execute on function public.link_diary_name(uuid, text) to authenticated;

-- "A new client, not on my calendar": the pop-up stops asking about them.
create or replace function public.skip_client_link(p_client uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.session_require_trainer(p_client);
  insert into public.client_link_answers (client_id, trainer_id, linked_name)
  values (p_client, auth.uid(), null)
  on conflict (client_id) do nothing;
end;
$$;
revoke execute on function public.skip_client_link(uuid) from public, anon;
grant execute on function public.skip_client_link(uuid) to authenticated;

-- What the pop-up needs: the trainer's clients not answered or linked yet,
-- and the names on their calendar not in the app (seen in the last 90 days
-- or coming up). The app picks who to ask: new sign-ups, plus older clients
-- whose first name matches a calendar name.
create or replace function public.clients_to_link()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with names as (
    select public.diary_name_key(ls.guest_name) as k,
           mode() within group (order by btrim(ls.guest_name)) as name,
           count(*) filter (where ls.starts_at > now() and ls.status = 'booked') as coming
    from public.live_sessions ls
    where ls.trainer_id = auth.uid() and ls.client_id is null and ls.invoice_id is null
      and public.diary_name_real(ls.guest_name) and ls.guest_name not like '%???%'
      and ls.starts_at > now() - interval '90 days'
    group by 1
  ),
  people as (
    select c.id, c.name, c.created_at
    from public.clients c
    where c.trainer_id = auth.uid() and c.id <> auth.uid() and c.archived_at is null
      and not exists (select 1 from public.client_link_answers a where a.client_id = c.id)
      and not exists (select 1 from public.diary_name_links l where l.client_id = c.id)
  )
  select case when exists (select 1 from names) and exists (select 1 from people) then
    jsonb_build_object(
      'clients', (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'created_at', created_at) order by created_at desc) from people),
      'names', (select jsonb_agg(jsonb_build_object('key', k, 'name', name, 'coming', coming) order by name) from names)
    )
  else jsonb_build_object('clients', '[]'::jsonb, 'names', '[]'::jsonb) end
$$;
revoke execute on function public.clients_to_link() from public, anon;
grant execute on function public.clients_to_link() to authenticated;

-- "All their sessions" on a session's Who sheet now moves everything too
-- (weekly repeats, away dates, stops), not just the sessions.
create or replace function public.set_live_session_person(p_id uuid, p_client uuid, p_name text default null, p_all boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ls public.live_sessions;
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 60), '');
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

  if p_all and p_client is not null and ls.guest_name is not null then
    return public.link_diary_name(p_client, ls.guest_name);
  end if;

  if p_client is not null then
    perform public.session_require_trainer(p_client);
    perform public.session_ensure_plan(p_client);
    v_name := null;
  end if;
  update public.live_sessions
  set client_id = p_client, guest_name = v_name, updated_at = now()
  where id = p_id;
  v_future := case when p_client is not null and ls.starts_at > now() and ls.status = 'booked' then 1 else 0 end;

  if v_future > 0 then
    select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = auth.uid();
    perform public.push_to_user(
      p_client,
      '🤝 1 session booked',
      coalesce(coach, 'Your coach') || ' added it to your calendar. Open My sessions to see it.',
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return jsonb_build_object('moved', 1);
end;
$$;
revoke execute on function public.set_live_session_person(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.set_live_session_person(uuid, uuid, text, boolean) to authenticated;

-- The sign-up push tells the trainer the app will ask about linking.
create or replace function public.notify_client_signup_and_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ends text := coalesce(to_char(new.plan_expires_at, 'FMDD FMMonth'), 'soon');
  has_names boolean;
begin
  if new.id = new.trainer_id then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select exists (
      select 1 from public.live_sessions ls
      where ls.trainer_id = new.trainer_id and ls.client_id is null and ls.invoice_id is null
        and public.diary_name_real(ls.guest_name) and ls.starts_at > now() - interval '90 days'
    ) into has_names;
    perform public.push_to_user(
      new.trainer_id,
      'New client signed up',
      coalesce(new.name, 'Someone') || ' just signed up. ' ||
        case when has_names
          then 'Open the app to link them to their name on your 1 on 1 calendar.'
          else 'Activate them on the Clients tab once they''ve paid.' end,
      jsonb_build_object('type', 'client_signup', 'clientId', new.id)
    );
  elsif old.access_status = 'expired' and new.access_status in ('active', 'expiring_soon') then
    perform public.push_to_user(
      new.id,
      'You''re in! 🎉',
      'Your trainer has activated your account. Open the app to get started.',
      jsonb_build_object('type', 'client_activated')
    );
  elsif old.access_status = 'active' and new.access_status = 'expiring_soon' then
    perform public.push_to_user(
      new.id,
      'Your plan ends ' || ends,
      'Renew with your trainer before then to keep your access and your streaks going.',
      jsonb_build_object('type', 'plan_expiring')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan ends ' || ends,
      'They''ve been reminded to renew.',
      jsonb_build_object('type', 'client_plan_expiring', 'clientId', new.id)
    );
  elsif old.access_status in ('active', 'expiring_soon') and new.access_status = 'expired' then
    perform public.push_to_user(
      new.id,
      'Your plan has ended',
      'Renew with your trainer to get your access back. Open the app for the payment details.',
      jsonb_build_object('type', 'plan_expired')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan has ended',
      'Their access is paused until you activate them again.',
      jsonb_build_object('type', 'client_plan_expired', 'clientId', new.id)
    );
  end if;
  return new;
exception when others then
  raise warning 'client membership notification failed: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function public.notify_client_signup_and_activation() from public, anon, authenticated;
