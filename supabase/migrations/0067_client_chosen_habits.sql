-- Clients choose their own habits (2026-10-11, GRIZZ): on the Habits tab a
-- client picks from a list of suggested habits (or types their own) and can
-- stop the ones they chose. Habits the trainer sets stay the trainer's.
--
--   * habits.chosen_by_client marks a habit the client added.
--   * Clients may add habits for themselves (up to 15 of theirs running).
--   * On a habit they chose, a client may also set end_date to stop it, or
--     clear it to start it again. Rows are never removed, so the trainer
--     still sees the history.

alter table public.habits
  add column if not exists chosen_by_client boolean not null default false;

do $$
begin
  create policy "habits insert own by client" on public.habits
    for insert to authenticated
    with check (
      client_id = (select auth.uid())
      and public.client_has_access(client_id)
      and chosen_by_client
      and char_length(btrim(name)) between 1 and 60
      and reps_target between 1 and 10
      and end_date is null
      and start_date between public.sa_today() - 1 and public.sa_today() + 1
    );
exception
  when duplicate_object then null;
end $$;

-- Up to 15 running habits a client chose (a trigger, because a policy that
-- reads habits from a habits policy recurses).
create or replace function public.guard_client_habit_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chosen_by_client and (
    select count(*) from public.habits h
    where h.client_id = new.client_id
      and h.chosen_by_client
      and (h.end_date is null or h.end_date >= public.sa_today())
  ) >= 15 then
    raise exception 'that''s 15 habits already: stop one before adding another';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_client_habit_count() from public, anon, authenticated;

create or replace trigger habits_guard_client_count
  before insert on public.habits
  for each row execute function public.guard_client_habit_count();

-- A client may change a habit's days and reminder; on a habit they chose,
-- also when it ends. The trainer sets the rest.
create or replace function public.guard_client_habit_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_fields text[] := array['active_days', 'reminder_enabled', 'reminder_time'];
begin
  if auth.uid() = old.client_id then
    if old.chosen_by_client then
      free_fields := free_fields || array['end_date'];
    end if;
    if (to_jsonb(new) - free_fields) is distinct from (to_jsonb(old) - free_fields) then
      raise exception 'clients can only change a habit''s days and reminder';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_client_habit_update() from public, anon, authenticated;
