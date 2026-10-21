-- Live in-person sessions (GRIZZ, 2026-10-21): a workout the trainer
-- finished with the client in a live session is marked in person, and stays
-- in person if the client adds to it later the same day.
alter table public.workout_sessions add column if not exists in_person boolean not null default false;

create or replace function public.record_workout_session(p_title text, p_status text, p_sets_done integer, p_sets_planned integer, p_reason text default null, p_improvements jsonb default '[]'::jsonb)
returns public.workout_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.acting_client();
  before public.workout_sessions;
  saved public.workout_sessions;
  who text;
  coach uuid;
  why text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  ups text;
begin
  if p_status not in ('complete', 'partial', 'missed') then
    raise exception 'Unknown status %', p_status;
  end if;
  if p_status <> 'complete' and why is null then
    raise exception 'Tell your coach why first';
  end if;
  select c.name, c.trainer_id into who, coach from public.clients c where c.id = me;
  if not found then
    raise exception 'Only clients can record a workout';
  end if;

  select * into before from public.workout_sessions where client_id = me and session_date = public.sa_today();

  insert into public.workout_sessions (client_id, session_date, title, status, sets_done, sets_planned, reason, improvements, in_person)
  values (
    me, public.sa_today(), left(coalesce(p_title, ''), 120), p_status,
    greatest(0, least(coalesce(p_sets_done, 0), 1000)), greatest(0, least(coalesce(p_sets_planned, 0), 1000)),
    case when p_status = 'complete' then null else why end,
    coalesce(p_improvements, '[]'::jsonb),
    me is distinct from auth.uid()
  )
  on conflict (client_id, session_date) do update
  set title = excluded.title, status = excluded.status, sets_done = excluded.sets_done,
      sets_planned = excluded.sets_planned, reason = excluded.reason, improvements = excluded.improvements,
      in_person = workout_sessions.in_person or excluded.in_person,
      updated_at = now()
  returning * into saved;

  -- No push when the trainer finished it with the client in a live session.
  if coach is not null and coach is distinct from auth.uid() then
    if saved.status <> 'complete' and (before.id is null or before.status is distinct from saved.status) then
      perform public.push_to_user(
        coach,
        case when saved.status = 'partial'
          then coalesce(who, 'A client') || ' only partly finished ' || coalesce(nullif(saved.title, ''), 'their workout')
          else coalesce(who, 'A client') || ' couldn''t train today' end,
        'Why: ' || saved.reason,
        jsonb_build_object('type', 'workout_session', 'clientId', me)
      );
    end if;
    if saved.star and not coalesce(before.star, false) then
      select string_agg(x->>'exercise' || ' ' || coalesce(x->>'before', '') || ' → ' || coalesce(x->>'after', ''), ', ')
      into ups from jsonb_array_elements(saved.improvements) x;
      perform public.push_to_user(
        coach,
        '⭐ ' || coalesce(who, 'A client') || ' pushed their weights up',
        coalesce(ups, ''),
        jsonb_build_object('type', 'workout_star', 'clientId', me)
      );
    end if;
  end if;
  return saved;
end;
$$;
