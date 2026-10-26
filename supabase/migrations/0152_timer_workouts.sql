-- Timer workouts (GRIZZ, 2026-10-25): EMOM, Tabata and custom interval
-- timers people save on the Timers page, with or without exercises. A trainer
-- can make one for one of their clients (client_id), and the client gets a
-- phone notification and finds it under Saved. The timer itself
-- (work, rest, rounds, exercises) is in settings, read by
-- src/lib/timerWorkouts.ts.

create table public.timer_workouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The client it was made for, or null for the owner's own.
  client_id uuid references public.clients (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  settings jsonb not null check (jsonb_typeof(settings) = 'object' and settings ? 'kind'),
  created_at timestamptz not null default now()
);

create index timer_workouts_owner_idx on public.timer_workouts (owner_id, created_at desc);
create index timer_workouts_client_idx on public.timer_workouts (client_id, created_at desc) where client_id is not null;

alter table public.timer_workouts enable row level security;

create policy "timer workouts read own or mine"
  on public.timer_workouts for select to authenticated
  using (owner_id = (select auth.uid()) or client_id = (select auth.uid()));

-- Your own, or for one of your own clients.
create policy "timer workouts insert own"
  on public.timer_workouts for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      client_id is null
      or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    )
  );

create policy "timer workouts delete own"
  on public.timer_workouts for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.timer_workouts from anon, authenticated;
grant select, insert, delete on public.timer_workouts to authenticated;

-- Tells the client when their trainer makes them one.
create or replace function public.notify_client_timer_workout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null and new.client_id <> new.owner_id then
    perform public.push_to_user(
      new.client_id,
      '⏱ New timer workout from your coach',
      new.name || '. Open the menu, then Timers, then Saved.',
      jsonb_build_object('type', 'timer_workout', 'timerId', new.id)
    );
  end if;
  return new;
exception when others then
  raise warning 'timer workout notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_client_timer_workout() from public, anon, authenticated;

create trigger timer_workouts_notify
  after insert on public.timer_workouts
  for each row execute function public.notify_client_timer_workout();
