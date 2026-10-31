-- Bring sessions in from the trainer's own calendar (GRIZZ, 2026-10-31: "the
-- trainer is gonna need to log his client sessions into the App Calendar ...
-- Can this be done with screenshots"). The read-calendar edge function reads
-- the screenshots; the trainer checks the list, then this books the ticked
-- ones in one go: fee and length from each client's plan, nothing booked
-- twice, and one notification per client instead of one per session.
create or replace function public.import_live_sessions(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_client uuid;
  v_at timestamptz;
  p public.session_plans;
  s public.session_settings;
  v_added integer := 0;
  v_skipped integer := 0;
  v_future jsonb := '{}'::jsonb;
  k text;
  coach text;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 400 then
    raise exception 'Send up to 400 sessions at a time';
  end if;
  select * into s from public.session_settings where trainer_id = auth.uid();
  for r in select * from jsonb_array_elements(p_rows) loop
    v_client := (r ->> 'client_id')::uuid;
    v_at := (r ->> 'starts_at')::timestamptz;
    perform public.session_require_trainer(v_client);
    select * into p from public.session_plans where client_id = v_client;
    if p.client_id is null and s.fee is null then
      raise exception 'Set a session fee first (Live sessions › Setup)';
    end if;
    if exists (
      select 1 from public.live_sessions ls
      where ls.client_id = v_client and ls.starts_at = v_at and ls.status <> 'removed'
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.live_sessions (trainer_id, client_id, starts_at, minutes, fee)
    values (auth.uid(), v_client, v_at,
            coalesce(nullif(r ->> 'minutes', '')::int, p.minutes, s.minutes, 60),
            coalesce(p.fee, s.fee));
    v_added := v_added + 1;
    if v_at > now() then
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
