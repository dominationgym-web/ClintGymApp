-- Multi-week programs (2026-10-11): GRIZZ's 3-week Strength, Bodybuilding and
-- Weight loss blocks have 12 different sessions, 4 a week. A program now has
-- a number of weeks, and each session a week as well as a weekday. Existing
-- programs are all 1 week, so nothing about them changes.
--
--   * programs.weeks: how many weeks before it starts again from week 1.
--   * programs.nutrition: the nutrition options shown with the program.
--   * program_exercises.week_number: which week the session is in.
--   * client_programs.current_week: the week the client is up to (with
--     current_day, from 0037).
--   * set_my_program_week_progress replaces set_my_program_progress for the
--     app (the old one stays for older app versions). It also only lets a
--     client move on to the NEXT session, or move today's to tomorrow, so they
--     can't jump ahead (from the 2026-10-11 audit).

alter table public.programs
  add column if not exists weeks smallint not null default 1 check (weeks between 1 and 12),
  add column if not exists nutrition text;

alter table public.program_exercises
  add column if not exists week_number smallint not null default 1 check (week_number between 1 and 12);

alter table public.client_programs
  add column if not exists current_week smallint check (current_week between 1 and 12);

create or replace function public.set_my_program_week_progress(
  p_current_week smallint,
  p_current_day smallint,
  p_due_on date,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cp public.client_programs;
  slots integer[];
  target integer := (p_current_week - 1) * 7 + p_current_day;
  cur integer;
  allowed integer[];
begin
  if me is null or not exists (
    select 1 from public.clients c where c.id = me and c.access_status <> 'expired'
  ) then
    raise exception 'no access';
  end if;

  select * into cp from public.client_programs where client_id = me;
  if cp.program_id is null then
    raise exception 'not on a program';
  end if;

  select array_agg(s order by s) into slots
  from (
    select distinct (e.week_number - 1) * 7 + e.day_number as s
    from public.program_exercises e
    where e.program_id = cp.program_id
  ) x;

  if slots is null or not (target = any (slots)) then
    raise exception 'that day is not a training day in this program';
  end if;

  -- Where they may go: the same session (moved) or the next one (completed).
  -- Before their first session is set, any week-1 session counts as current.
  if cp.current_day is not null then
    cur := (coalesce(cp.current_week, 1) - 1) * 7 + cp.current_day;
    allowed := array[cur];
  else
    select array_agg(s) into allowed from unnest(slots) s where s <= 7;
  end if;

  if p_completed then
    allowed := (
      select array_agg(coalesce(
        (select min(s2) from unnest(slots) s2 where s2 > a),
        slots[1]
      ))
      from unnest(allowed) a
    );
  end if;

  if not (target = any (allowed)) then
    raise exception 'that isn''t your next session';
  end if;

  if p_due_on < current_date - 2 or p_due_on > current_date + 8 then
    raise exception 'that date is out of range';
  end if;

  update public.client_programs
  set current_week = p_current_week,
      current_day = p_current_day,
      due_on = p_due_on,
      last_completed_at = case when p_completed then now() else last_completed_at end
  where client_id = me;
end;
$$;

revoke execute on function public.set_my_program_week_progress(smallint, smallint, date, boolean) from public, anon;
grant execute on function public.set_my_program_week_progress(smallint, smallint, date, boolean) to authenticated;
