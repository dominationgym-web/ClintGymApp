-- Group live sessions (GRIZZ, 2026-10-21): a trainer trains up to 4 clients
-- at once on one phone. Every set is written with the client's own id (the
-- trainer insert policy from 0134 checks each one is the trainer's client),
-- and at the end each client's day is saved here, named by id, never by
-- whoever is "live". Only the client's own approved trainer can save it.
create or replace function public.record_live_session_for(p_client uuid, p_title text, p_sets_done integer, p_sets_planned integer, p_improvements jsonb default '[]'::jsonb)
returns public.workout_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.workout_sessions;
begin
  if not exists (select 1 from public.clients c where c.id = p_client and c.trainer_id = auth.uid())
     or not public.not_unapproved_trainer() then
    raise exception 'Only the client''s own trainer can save their live session';
  end if;
  insert into public.workout_sessions (client_id, session_date, title, status, sets_done, sets_planned, reason, improvements, in_person)
  values (
    p_client, public.sa_today(), left(coalesce(p_title, ''), 120), 'complete',
    greatest(0, least(coalesce(p_sets_done, 0), 1000)), greatest(0, least(coalesce(p_sets_planned, 0), 1000)),
    null, coalesce(p_improvements, '[]'::jsonb), true
  )
  on conflict (client_id, session_date) do update
  set title = excluded.title, status = 'complete', sets_done = excluded.sets_done,
      sets_planned = excluded.sets_planned, reason = null, improvements = excluded.improvements,
      in_person = true, updated_at = now()
  returning * into saved;
  return saved;
end;
$$;
revoke all on function public.record_live_session_for(uuid, text, integer, integer, jsonb) from public, anon;
grant execute on function public.record_live_session_for(uuid, text, integer, integer, jsonb) to authenticated;
