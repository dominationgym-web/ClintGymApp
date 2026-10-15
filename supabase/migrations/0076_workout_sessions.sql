-- Workout completion dots and the gold star (GRIZZ, 2026-10-12).
--
-- When a client finishes a workout the app records how it went: green when
-- every set (and cardio block) was done, orange when only part of it was, and
-- red when they couldn't train. Orange and red need a reason, and the trainer
-- gets it as a phone notification.
--
-- A gold star means they pushed their weights up compared with the last time
-- they did that exercise (heavier, or more reps at the same weight). The
-- improvements are kept so the trainer's training log can highlight them, and
-- the trainer gets a notification listing them.
--
-- One row per client per day; finishing again the same day (after doing the
-- rest of the sets, say) updates it.

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  session_date date not null default public.sa_today(),
  title text not null default '' check (char_length(title) <= 120),
  status text not null check (status in ('complete', 'partial', 'missed')),
  sets_done integer not null default 0 check (sets_done between 0 and 1000),
  sets_planned integer not null default 0 check (sets_planned between 0 and 1000),
  reason text check (reason is null or char_length(reason) <= 500),
  improvements jsonb not null default '[]'::jsonb check (jsonb_typeof(improvements) = 'array' and pg_column_size(improvements) < 20000),
  star boolean generated always as (jsonb_array_length(improvements) > 0) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, session_date)
);

alter table public.workout_sessions enable row level security;

create policy "workout sessions select own or trainer" on public.workout_sessions
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );

-- The client's Finish button. Orange and red need a reason. The trainer is
-- told when the result changes to orange or red, or a star is newly earned.
create or replace function public.record_workout_session(
  p_title text,
  p_status text,
  p_sets_done integer,
  p_sets_planned integer,
  p_reason text default null,
  p_improvements jsonb default '[]'::jsonb
)
returns public.workout_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
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

  insert into public.workout_sessions (client_id, session_date, title, status, sets_done, sets_planned, reason, improvements)
  values (
    me, public.sa_today(), left(coalesce(p_title, ''), 120), p_status,
    greatest(0, least(coalesce(p_sets_done, 0), 1000)), greatest(0, least(coalesce(p_sets_planned, 0), 1000)),
    case when p_status = 'complete' then null else why end,
    coalesce(p_improvements, '[]'::jsonb)
  )
  on conflict (client_id, session_date) do update
  set title = excluded.title, status = excluded.status, sets_done = excluded.sets_done,
      sets_planned = excluded.sets_planned, reason = excluded.reason, improvements = excluded.improvements,
      updated_at = now()
  returning * into saved;

  if coach is not null then
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
revoke all on function public.record_workout_session(text, text, integer, integer, text, jsonb) from public, anon;
grant execute on function public.record_workout_session(text, text, integer, integer, text, jsonb) to authenticated;
