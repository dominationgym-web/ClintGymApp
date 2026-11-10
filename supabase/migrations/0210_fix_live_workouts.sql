-- Fix or remove a live session afterwards (GRIZZ, 2026-11-10: "if we go out
-- by mistake ... go into that live session ... edit a set if we made a
-- mistake with our reps ... I can't even delete it if I wanted to").
--
-- Editing a set already works for the client's own trainer ("workout logs
-- trainer corrects live", 0134), on any day. This adds removing:
--   * a trainer can remove the sets THEY logged for their own client (never
--     the sets the client logged themselves), one set or the whole day;
--   * a trainer can remove the in-person session result (🤝) of their own
--     client's day;
--   * resync_live_day() tidies the day afterwards: set numbers close up
--     (1, 2, 3 again) and the 🤝 result shows the sets that are left.
-- The app does the removing through these policies, so this file has no
-- removal statements of its own.

create policy "workout logs trainer removes live" on public.workout_logs
  for delete to authenticated
  using (
    logged_by = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );

create policy "workout sessions trainer removes live" on public.workout_sessions
  for delete to authenticated
  using (
    in_person
    and exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );

create or replace function public.resync_live_day(p_client uuid, p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  if not exists (select 1 from public.clients c where c.id = p_client and c.trainer_id = auth.uid()) then
    raise exception 'Only the client''s own trainer can change their live session';
  end if;

  -- Working sets numbered 1, 2, 3 again per exercise (warm-ups keep theirs).
  update public.workout_logs w
  set set_number = n.rn
  from (
    select id, row_number() over (partition by exercise_name order by set_number, created_at) as rn
    from public.workout_logs
    where client_id = p_client and log_date = p_date and not coalesce(warm_up, false)
  ) n
  where w.id = n.id and w.set_number <> n.rn;

  select count(*) into remaining
  from public.workout_logs
  where client_id = p_client and log_date = p_date and not coalesce(warm_up, false);

  update public.workout_sessions
  set sets_done = least(remaining, 1000),
      sets_planned = greatest(least(remaining, 1000), sets_planned),
      updated_at = now()
  where client_id = p_client and session_date = p_date and in_person and status <> 'missed';

  return remaining;
end;
$$;
revoke all on function public.resync_live_day(uuid, date) from public, anon;
grant execute on function public.resync_live_day(uuid, date) to authenticated;
