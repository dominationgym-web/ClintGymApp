-- Swap with tomorrow (GRIZZ, 2026-10-28): a client who doesn't feel like
-- today's workout (legs, say) can swap it with their next one on the training
-- calendar. They do the next workout today and today's moves to that day. The
-- trainer gets a notification, and both days show "Swapped" on the calendars.
--
-- Only before anything is logged today, once a day, with a workout in the
-- next 7 days, and a workout that was swapped onto its day can't be swapped
-- again, so legs can't keep being pushed further away. Undo puts both back
-- while nothing is logged yet.
--
-- The calendar rows keep their dates and swap their workout (program_id,
-- day_slot, deload), so everything that reads the calendar just works.
-- No deletes: undo sets undone_at.

create table if not exists public.client_workout_swaps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- The day the client swapped on (their workout for it came from later_date).
  swapped_on date not null,
  -- The day today's workout moved to.
  later_date date not null check (later_date > swapped_on),
  -- What each day had before the swap, for the notification and Undo.
  today_program_id uuid not null,
  later_program_id uuid not null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create unique index if not exists client_workout_swaps_one_a_day
  on public.client_workout_swaps (client_id, swapped_on) where undone_at is null;
create index if not exists client_workout_swaps_client_later_idx on public.client_workout_swaps (client_id, later_date);

alter table public.client_workout_swaps enable row level security;

-- The client and their trainer read them; only the functions below write.
create policy "workout swaps select own or trainer" on public.client_workout_swaps
  for select to authenticated using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );

-- Swaps today's calendar workout with the one on p_with.
create or replace function public.swap_my_workout(p_with date)
returns public.client_workout_swaps
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := public.sa_today();
  who text;
  coach uuid;
  mine public.client_calendar_workouts;
  later public.client_calendar_workouts;
  saved public.client_workout_swaps;
  today_name text;
  later_name text;
begin
  select c.name, c.trainer_id into who, coach from public.clients c where c.id = me;
  if not found then
    raise exception 'Only clients can swap workouts';
  end if;
  if p_with is null or p_with <= today or p_with > today + 7 then
    raise exception 'You can only swap with a workout in the next 7 days';
  end if;
  if exists (select 1 from public.workout_sessions s where s.client_id = me and s.session_date = today)
    or exists (select 1 from public.workout_logs l where l.client_id = me and l.log_date = today) then
    raise exception 'You''ve already started today''s training, so it can''t be swapped now';
  end if;
  if exists (select 1 from public.client_workout_swaps w where w.client_id = me and w.swapped_on = today and w.undone_at is null) then
    raise exception 'You''ve already swapped today''s workout';
  end if;
  if exists (select 1 from public.client_workout_swaps w where w.client_id = me and w.later_date = today and w.undone_at is null) then
    raise exception 'This workout was already swapped onto today, so it can''t be moved again';
  end if;

  select * into mine from public.client_calendar_workouts where client_id = me and workout_date = today for update;
  select * into later from public.client_calendar_workouts where client_id = me and workout_date = p_with for update;
  if mine.id is null or later.id is null then
    raise exception 'There''s no workout to swap with on that day';
  end if;

  update public.client_calendar_workouts
  set program_id = later.program_id, day_slot = later.day_slot, deload = later.deload
  where id = mine.id;
  update public.client_calendar_workouts
  set program_id = mine.program_id, day_slot = mine.day_slot, deload = mine.deload
  where id = later.id;

  insert into public.client_workout_swaps (client_id, swapped_on, later_date, today_program_id, later_program_id)
  values (me, today, p_with, mine.program_id, later.program_id)
  returning * into saved;

  if coach is not null then
    select p.name into today_name from public.programs p where p.id = mine.program_id;
    select p.name into later_name from public.programs p where p.id = later.program_id;
    perform public.push_to_user(
      coach,
      '🔄 ' || coalesce(who, 'A client') || ' swapped today''s workout',
      'Doing ' || coalesce(later_name, trim(to_char(p_with, 'Day')) || '''s workout') || ' today. '
        || coalesce(today_name, 'Today''s workout') || ' moved to ' || trim(to_char(p_with, 'Day')) || '.',
      jsonb_build_object('type', 'workout_swap', 'clientId', me)
    );
  end if;
  return saved;
end;
$$;

revoke execute on function public.swap_my_workout(date) from public, anon;
grant execute on function public.swap_my_workout(date) to authenticated;

-- Puts today's swap back, while nothing is logged today.
create or replace function public.undo_my_workout_swap()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := public.sa_today();
  who text;
  coach uuid;
  swap public.client_workout_swaps;
  mine public.client_calendar_workouts;
  later public.client_calendar_workouts;
begin
  select c.name, c.trainer_id into who, coach from public.clients c where c.id = me;
  if not found then
    raise exception 'Only clients can swap workouts';
  end if;
  select * into swap from public.client_workout_swaps w
  where w.client_id = me and w.swapped_on = today and w.undone_at is null for update;
  if swap.id is null then
    raise exception 'There''s no swap to undo today';
  end if;
  if exists (select 1 from public.workout_sessions s where s.client_id = me and s.session_date = today)
    or exists (select 1 from public.workout_logs l where l.client_id = me and l.log_date = today) then
    raise exception 'You''ve already started today''s training, so the swap stays';
  end if;

  select * into mine from public.client_calendar_workouts where client_id = me and workout_date = today for update;
  select * into later from public.client_calendar_workouts where client_id = me and workout_date = swap.later_date for update;
  -- Swap back only what is still as the swap left it (the coach may have changed a day since).
  if mine.id is not null and later.id is not null
    and mine.program_id = swap.later_program_id and later.program_id = swap.today_program_id then
    update public.client_calendar_workouts
    set program_id = later.program_id, day_slot = later.day_slot, deload = later.deload
    where id = mine.id;
    update public.client_calendar_workouts
    set program_id = mine.program_id, day_slot = mine.day_slot, deload = mine.deload
    where id = later.id;
  else
    raise exception 'Your coach has changed these days since, so the swap can''t be undone';
  end if;

  update public.client_workout_swaps set undone_at = now() where id = swap.id;

  if coach is not null then
    perform public.push_to_user(
      coach,
      coalesce(who, 'A client') || ' undid their workout swap',
      'Back to the planned workout today and on ' || trim(to_char(swap.later_date, 'Day')) || '.',
      jsonb_build_object('type', 'workout_swap', 'clientId', me)
    );
  end if;
end;
$$;

revoke execute on function public.undo_my_workout_swap() from public, anon;
grant execute on function public.undo_my_workout_swap() to authenticated;
