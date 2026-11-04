-- 1 on 1 Today › Not signed yet (GRIZZ, 2026-11-04): the trainer can send a
-- client a reminder to sign the session agreement, or clear them off the list
-- when a signature isn't needed. Cleared holds the terms it was cleared for,
-- so a change of fee, rule, billing or times puts the client back on the list.

alter table public.session_plans
  add column if not exists agreement_sent_at timestamptz,
  add column if not exists agreement_cleared jsonb;

-- The trainer reminds the client to sign (a push to their phone).
create or replace function public.send_session_agreement(p_client uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.session_plans;
  coach text;
begin
  perform public.session_require_trainer(p_client);
  select * into p from public.session_plans where client_id = p_client and trainer_id = auth.uid();
  if not found then
    raise exception 'Set up their sessions first';
  end if;
  select coalesce(nullif(btrim(t.business_name), ''), t.name) into coach from public.trainers t where t.id = auth.uid();
  perform public.push_to_user(
    p_client,
    '✍️ ' || coalesce(coach, 'Your coach') || ' asks you to sign your session agreement',
    'Open the app: Menu › My sessions. It takes a minute.',
    jsonb_build_object('type', 'live_session')
  );
  update public.session_plans set agreement_sent_at = now() where client_id = p_client;
  return now();
end;
$$;

-- The trainer clears the client off Not signed yet for their current terms,
-- or puts them back (p_clear false).
create or replace function public.clear_session_agreement(p_client uuid, p_clear boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.session_require_trainer(p_client);
  update public.session_plans
  set agreement_cleared = case when p_clear then jsonb_build_object(
      'fee', fee, 'per_week', per_week, 'group_size', group_size,
      'billing', billing, 'policy', policy, 'regular', regular
    ) else null end
  where client_id = p_client and trainer_id = auth.uid();
end;
$$;

revoke execute on function public.send_session_agreement(uuid) from public, anon;
revoke execute on function public.clear_session_agreement(uuid, boolean) from public, anon;
grant execute on function public.send_session_agreement(uuid) to authenticated;
grant execute on function public.clear_session_agreement(uuid, boolean) to authenticated;
