-- A client stops training with the coach (GRIZZ, 2026-11-10: "add the option
-- to remove a client from the calendar if they stop training with you. Then
-- replace with available and turn green").
--
-- stop_client_training() takes every upcoming session of theirs off the
-- calendar from a chosen day: booked ones, weekly repeats (ended, so no new
-- weeks fill in), their plan's regular times (plan switched off) and any held
-- for Away or not paying. Those times then show as green Available gaps.
-- Past sessions, invoices and catch-ups owed stay as they are.
-- Nothing is deleted: sessions get status 'removed' and remember the stop, so
-- undo_client_stop() can put them back (except slots given to someone else).

create table if not exists public.client_stops (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  guest_name text,
  guest_key text,
  -- First day they no longer train.
  from_on date not null,
  from_at timestamptz not null,
  -- What the stop switched off, so undo can switch it back on.
  plan_was_active boolean not null default false,
  repeat_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  constraint client_stops_who check (client_id is not null or guest_key is not null)
);
create index if not exists client_stops_trainer_idx on public.client_stops (trainer_id) where undone_at is null;

alter table public.client_stops enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'client_stops' and policyname = 'client_stops_read') then
    create policy client_stops_read on public.client_stops
      for select to authenticated using (trainer_id = (select auth.uid()));
  end if;
end $$;

alter table public.live_sessions add column if not exists stop_id uuid references public.client_stops (id) on delete set null;

create or replace function public.stop_client_training(p_client uuid, p_guest text, p_from date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  tz text;
  gkey text := public.diary_name_key(p_guest);
  v_from_at timestamptz;
  v_plan_active boolean := false;
  v_repeats uuid[];
  st public.client_stops;
  n integer;
begin
  if me is null or not exists (select 1 from public.trainers where id = me) then
    raise exception 'Only a coach can do this';
  end if;
  if p_client is null and gkey is null then
    raise exception 'Pick who stopped training';
  end if;
  if p_client is not null and not exists (select 1 from public.clients where id = p_client and trainer_id = me) then
    raise exception 'That isn''t one of your clients';
  end if;
  tz := public.session_tz(me);
  if p_from is null or p_from < (now() at time zone tz)::date then
    raise exception 'Pick today or a later day';
  end if;
  -- From the start of that day, or from now when it's today.
  v_from_at := greatest(p_from::timestamp at time zone tz, now());

  if p_client is not null then
    select coalesce(active, false) into v_plan_active from public.session_plans where client_id = p_client and trainer_id = me;
    v_plan_active := coalesce(v_plan_active, false);
  end if;

  select coalesce(array_agg(r.id), '{}') into v_repeats
  from public.live_repeats r
  where r.trainer_id = me
    and (r.ended_at is null or r.ended_at > v_from_at)
    and (case when p_client is not null then r.client_id = p_client
              else r.client_id is null and public.diary_name_key(r.guest_name) = gkey end);

  insert into public.client_stops (trainer_id, client_id, guest_name, guest_key, from_on, from_at, plan_was_active, repeat_ids)
  values (me, p_client, case when p_client is null then btrim(p_guest) end, case when p_client is null then gkey end,
          p_from, v_from_at, v_plan_active, v_repeats)
  returning * into st;

  -- No new weeks fill in.
  update public.live_repeats set ended_at = v_from_at, updated_at = now() where id = any (v_repeats);
  -- Their plan's regular times stop filling in (the plan shows "stopped").
  if v_plan_active then
    update public.session_plans set active = false, updated_at = now() where client_id = p_client and trainer_id = me;
  end if;

  -- Every upcoming session of theirs comes off: booked, or held for Away /
  -- not paying. Other cancellations stay for the coach to decide.
  update public.live_sessions ls
  set status = 'removed', stop_id = st.id, updated_at = now()
  where ls.trainer_id = me
    and ls.starts_at >= v_from_at
    and (ls.status = 'booked' or (ls.status = 'cancelled' and ls.away_id is not null))
    and (case when p_client is not null then ls.client_id = p_client
              else ls.client_id is null and public.diary_name_key(ls.guest_name) = gkey end);
  get diagnostics n = row_count;

  return jsonb_build_object('stop_id', st.id, 'removed', n);
end;
$$;

-- Changed their mind: their sessions come back (Away/held ones as they were),
-- weekly times and the plan switch back on. A slot the coach has since given
-- to someone else stays with them.
create or replace function public.undo_client_stop(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.client_stops;
  s public.live_sessions;
  back integer := 0;
  taken jsonb := '[]'::jsonb;
begin
  select * into st from public.client_stops where id = p_id and trainer_id = auth.uid() and undone_at is null;
  if st.id is null then
    raise exception 'That''s already undone';
  end if;
  for s in
    select * from public.live_sessions
    where stop_id = st.id and status = 'removed' and starts_at > now()
    order by starts_at
  loop
    if exists (
      select 1 from public.live_sessions o
      where o.trainer_id = s.trainer_id and o.id <> s.id and o.status = 'booked'
        and o.starts_at < s.starts_at + make_interval(mins => s.minutes)
        and o.starts_at + make_interval(mins => o.minutes) > s.starts_at
        -- Booked after they stopped: someone took the slot.
        and o.created_at > st.created_at
    ) then
      taken := taken || to_jsonb(s.starts_at);
      continue;
    end if;
    update public.live_sessions
    set status = case when away_id is not null then 'cancelled' else 'booked' end, stop_id = null, updated_at = now()
    where id = s.id;
    back := back + 1;
  end loop;

  update public.live_repeats set ended_at = null, updated_at = now()
  where id = any (st.repeat_ids) and ended_at = st.from_at;
  if st.plan_was_active and st.client_id is not null then
    update public.session_plans set active = true, updated_at = now() where client_id = st.client_id and trainer_id = st.trainer_id;
    perform public.fill_regular_sessions(st.client_id);
  end if;
  update public.client_stops set undone_at = now() where id = st.id;
  perform public.fill_live_repeats(st.trainer_id);
  return jsonb_build_object('back', back, 'taken', taken);
end;
$$;

revoke execute on function public.stop_client_training(uuid, text, date) from public, anon;
grant execute on function public.stop_client_training(uuid, text, date) to authenticated;
revoke execute on function public.undo_client_stop(uuid) from public, anon;
grant execute on function public.undo_client_stop(uuid) to authenticated;
