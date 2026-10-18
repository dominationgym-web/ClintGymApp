-- Remaining training review items (2026-10-18, training.md 13, 15, 16, 17).
-- Built-in programs only (trainer_id is null).

-- 1. Deload alert and the programs' own easy weeks. A program week with 70%
--    or fewer of the sets of the week before is a built-in easy (or test)
--    week, the same rule as programEasyWeeks in src/lib/deload.ts.
create or replace function public.program_easy_week(p_program uuid, p_week int)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    p_week > 1
    and (select sum(sets) from public.program_exercises where program_id = p_program and week_number = p_week)
      <= 0.7 * (select sum(sets) from public.program_exercises where program_id = p_program and week_number = p_week - 1),
    false
  )
$$;

revoke execute on function public.program_easy_week(uuid, int) from public, anon;
grant execute on function public.program_easy_week(uuid, int) to authenticated;

-- deload_check: the last deload is also the last built-in easy week, no alert
-- while one is on the calendar or due within the next 2 program weeks, and
-- the no-improvements sign is skipped right after one.
create or replace function public.deload_check_internal(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := public.sa_today();
  this_monday date := today - ((extract(isodow from today)::int) - 1);
  last_deload date;
  planned_deload date;
  weeks int := 0;
  wk date;
  n int;
  reasons text[] := '{}';
  sets_total int;
  sets_failure int;
  tired int;
  missed int;
  quality numeric;
  done14 int;
  improved int;
  due boolean;
  easy_last date;
  easy_next date;
  easy_soon boolean := false;
begin
  select max(workout_date) filter (where workout_date <= today), min(workout_date) filter (where workout_date > today)
    into last_deload, planned_deload
  from public.client_calendar_workouts where client_id = p_client and deload;

  -- The program's own easy weeks (review 2026-10-18) count as a deload: the
  -- 12-week programs' weeks 4, 8 and 12, the sports and fight programs' 4 and 8.
  select max(w.workout_date) filter (where w.workout_date <= today), min(w.workout_date) filter (where w.workout_date > today)
    into easy_last, easy_next
  from public.client_calendar_workouts w
  where w.client_id = p_client and w.day_slot is not null and not w.deload
    and public.program_easy_week(w.program_id, (w.day_slot - 1) / 7 + 1);
  last_deload := greatest(last_deload, easy_last);

  -- Week by week plans only put the next week on the calendar, so also look
  -- at the program weeks after the last one placed: an easy week within the
  -- next 2 means one is coming anyway.
  if easy_next is null then
    select exists (
      select 1
      from public.client_program_plans pl
      cross join lateral (
        select w.day_slot from public.client_calendar_workouts w
        where w.client_id = p_client and w.program_id = pl.program_id and w.day_slot is not null
        order by w.workout_date desc limit 1
      ) lastw
      where pl.client_id = p_client and pl.ended_at is null and pl.placed_until >= today - 7
        and exists (
          select 1 from generate_series((lastw.day_slot - 1) / 7 + 2, (lastw.day_slot - 1) / 7 + 3) g(wk)
          where public.program_easy_week(pl.program_id, g.wk)
        )
    ) into easy_soon;
  end if;

  -- Weeks in a row (Monday to Sunday) with 2+ workouts, counting back from
  -- last week (this week once it has 2), stopping at the last deload.
  wk := this_monday;
  select count(*) into n from public.workout_sessions
    where client_id = p_client and session_date between wk and wk + 6 and status in ('complete', 'partial');
  if n < 2 then wk := wk - 7; end if;
  loop
    exit when weeks >= 20 or (last_deload is not null and wk + 6 >= last_deload);
    select count(*) into n from public.workout_sessions
      where client_id = p_client and session_date between wk and wk + 6 and status in ('complete', 'partial');
    exit when n < 2;
    weeks := weeks + 1;
    wk := wk - 7;
  end loop;

  -- Signs of fatigue in the last 14 days.
  select count(*) filter (where not coalesce(gauge, false)), count(*) filter (where effort = 'failure' and not coalesce(gauge, false))
    into sets_total, sets_failure
  from public.workout_logs where client_id = p_client and log_date between today - 13 and today and not coalesce(warm_up, false);
  if sets_total >= 20 and sets_failure::numeric / sets_total >= 0.4 then
    reasons := reasons || (round(100.0 * sets_failure / sets_total) || '% of sets went to failure');
  end if;

  select count(*) into tired
  from public.checkins where client_id = p_client and checkin_date between today - 13 and today and fatigue_status = 'reported';
  if tired >= 3 then reasons := reasons || ('tired on ' || tired || ' days'); end if;
  select avg(sleep_quality) into quality
  from public.checkins where client_id = p_client and checkin_date between today - 13 and today and sleep_quality is not null;
  if quality is not null and quality <= 2.5 then reasons := reasons || 'poor sleep'; end if;

  select count(*) into missed from public.workout_sessions
  where client_id = p_client and session_date between today - 13 and today and status in ('missed', 'partial');
  if missed >= 2 then reasons := reasons || (missed || ' workouts missed or not finished'); end if;

  select count(*), count(*) filter (where star or jsonb_array_length(coalesce(improvements, '[]'::jsonb)) > 0)
    into done14, improved
  from public.workout_sessions where client_id = p_client and session_date between today - 13 and today and status in ('complete', 'partial');
  -- Not across a deload or easy week, when nobody is meant to improve.
  if done14 >= 4 and improved = 0 and (last_deload is null or last_deload < today - 13) then reasons := reasons || 'no improvements in 2 weeks'; end if;

  due := planned_deload is null
    and easy_next is null
    and not easy_soon
    and (last_deload is null or last_deload < today - 21)
    and (weeks >= 6 or (weeks >= 4 and cardinality(reasons) >= 2) or (weeks >= 3 and cardinality(reasons) >= 3));

  return jsonb_build_object(
    'weeks', weeks,
    'reasons', to_jsonb(reasons),
    'due', due,
    'last_deload', last_deload,
    'planned_deload', planned_deload,
    'program_easy_next', easy_next,
    'program_easy_soon', easy_soon or easy_next is not null
  );
end;
$$;

revoke execute on function public.deload_check_internal(uuid) from public, anon, authenticated;

-- add_deload_week: refuses a week that is already a built-in easy week.
create or replace function public.add_deload_week(p_client uuid, p_start date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
  added int := 0;
begin
  if not exists (select 1 from public.clients c where c.id = p_client and c.trainer_id = auth.uid()) then
    raise exception 'Not your client';
  end if;
  if not public.not_unapproved_trainer() then
    raise exception 'Your trainer account is waiting for approval';
  end if;
  if p_start <= public.sa_today() then
    raise exception 'A deload week can start tomorrow at the earliest';
  end if;
  if exists (select 1 from public.client_calendar_workouts where client_id = p_client and deload and workout_date >= public.sa_today()) then
    raise exception 'A deload week is already on the calendar';
  end if;
  if exists (select 1 from public.client_calendar_workouts where client_id = p_client and deload and workout_date between p_start - 6 and p_start + 6) then
    raise exception 'That overlaps their last deload week';
  end if;
  -- A built-in easy week would get its sets halved twice.
  if exists (
    select 1 from public.client_calendar_workouts w
    where w.client_id = p_client and w.workout_date between p_start and p_start + 6
      and w.day_slot is not null and public.program_easy_week(w.program_id, (w.day_slot - 1) / 7 + 1)
  ) then
    raise exception 'That week is already an easy week in their program, so it needs no extra deload';
  end if;

  -- Move every main workout from that day back a week, latest first so no
  -- two land on the same day.
  for w in
    select id from public.client_calendar_workouts
    where client_id = p_client and workout_date >= p_start
    order by workout_date desc
  loop
    update public.client_calendar_workouts set workout_date = workout_date + 7 where id = w.id;
  end loop;
  update public.client_calendar_blocks set workout_date = workout_date + 7
    where client_id = p_client and workout_date >= p_start and removed_at is null;

  -- The week that was there goes back into the gap as the deload week.
  insert into public.client_calendar_workouts (client_id, workout_date, program_id, day_slot, deload)
  select client_id, workout_date - 7, program_id, day_slot, true
  from public.client_calendar_workouts
  where client_id = p_client and workout_date between p_start + 7 and p_start + 13;
  get diagnostics added = row_count;
  insert into public.client_calendar_blocks (client_id, workout_date, program_id, day_slot, position)
  select client_id, workout_date - 7, program_id, day_slot, position
  from public.client_calendar_blocks
  where client_id = p_client and workout_date between p_start + 7 and p_start + 13 and removed_at is null;

  -- Running weekly plans carry on a week later.
  update public.client_program_plans
  set start_date = start_date + 7,
      placed_until = placed_until + 7,
      asked_until = asked_until + 7
  where client_id = p_client and ended_at is null and placed_until >= p_start;

  update public.clients set deload_alerted_on = public.sa_today() where id = p_client;
  return added;
end;
$$;

revoke execute on function public.add_deload_week(uuid, date) from public, anon;
grant execute on function public.add_deload_week(uuid, date) to authenticated;

-- 2. Weight loss 12-week: lift heavy enough to keep muscle in a deficit. The
--    first big lift of each day rests 2 minutes (90 seconds in easy weeks),
--    every other rest at least 60 seconds. Supersets (rest 0) stay paired.
update public.program_exercises pe
set rest_seconds = case
  when pe.sort_order = 1 then greatest(pe.rest_seconds, case when pe.week_number in (4, 8, 12) then 90 else 120 end)
  else greatest(pe.rest_seconds, 60)
end
from public.programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name = 'Weight loss 12-week program'
  and pe.kind = 'exercise'
  and pe.rest_seconds > 0
  and ((pe.sort_order = 1 and pe.rest_seconds < 120) or pe.rest_seconds < 60);

update public.programs
set description = replace(
  replace(
    description,
    'Phase 2 (weeks 5-8) adds a set to the big lifts, shortens the rests and adds 2 interval rounds.',
    'Phase 2 (weeks 5-8) adds a set to the big lifts and adds 2 interval rounds.'
  ),
  'Phase 3 (weeks 9-12) adds sets to the first four exercises, shortens the rests again and adds 4 interval rounds.',
  'Phase 3 (weeks 9-12) adds sets to the first four exercises and adds 4 interval rounds. Rests stay long enough to lift heavy: 2 minutes on the first big lift and at least 1 minute on the others, because heavy weights are what keep your muscle. The cardio at the end does the extra calorie burn.'
)
where trainer_id is null
  and name = 'Weight loss 12-week program';

-- 3. Bodybuilding 12-week: 3 minutes on heavy squats and RDLs, 2.5 to 3 on hip
--    thrusts, 2.5 on the 6-8 rep presses and rows of weeks 9-11. The 8-12 rep
--    presses, rows and leg press keep 2 minutes.
update public.program_exercises pe
set rest_seconds = case
  when pe.exercise_name in ('Barbell Back Squat', 'Romanian Deadlift') then 180
  when pe.exercise_name = 'Hip Thrust' and pe.reps in ('6-8', '5-6') then 180
  else 150
end
from public.programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name = 'Bodybuilding 12-week program'
  and pe.rest_seconds = 120
  and (
    pe.exercise_name in ('Barbell Back Squat', 'Romanian Deadlift', 'Hip Thrust')
    or (pe.reps in ('6-8', '5-6') and pe.exercise_name in ('Flat Dumbbell Press', 'Incline Dumbbell Press', 'Lat Pulldown', 'Chest-Supported Row'))
  );

-- 4. Test weeks with a real test. Week 8 stays at half the sets, and the last
--    set of each main lift is the test: their best clean set, never a grind.
update public.program_exercises pe
set reps = pe.reps || ', last set: test your best clean ' || pe.reps || ' (1-2 reps left)'
from public.programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name = 'Sports Strength 1 – Base Strength'
  and pe.week_number = 8
  and pe.sort_order in (1, 3)
  and pe.exercise_name in ('Barbell Back Squat', 'Bench Press', 'Trap Bar Deadlift')
  and pe.reps ~ '^\d+$';

update public.program_exercises pe
set reps = pe.reps || ', last set: test your heaviest clean 3 (1 rep left)'
from public.programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name = 'Sports Strength 3 – Max Strength'
  and pe.week_number = 8
  and pe.sort_order = 1
  and pe.reps in ('3', '2-3');

-- Explosive Power 3: a measured broad jump in place of the jump squats, and
-- the chest pass measured for distance.
update public.program_exercises pe
set exercise_id = e.id,
    exercise_name = e.name,
    sets = 3,
    reps = '3, test: measure your longest jump (toes to the back of your heels)'
from public.programs p, public.exercises e
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name = 'Explosive Power 3 – Elite Power'
  and pe.week_number = 8
  and pe.day_number = 1
  and pe.exercise_name = 'Jump Squat'
  and e.name = 'Broad Jump';

update public.program_exercises pe
set reps = '3, test: measure your longest throw'
from public.programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name = 'Explosive Power 3 – Elite Power'
  and pe.week_number = 8
  and pe.exercise_name = 'Medicine Ball Chest Pass'
  and pe.reps = '4 max effort';

update public.programs
set description = replace(
  description,
  'week 8 is a test week: half the sets at full quality, so you finish fresh and can see how far you''ve come.',
  'week 8 is a test week: half the sets, and the last set of each main lift is a test of your best clean set (1-2 reps left, never a grind), so you can see how far you''ve come.'
)
where trainer_id is null
  and name in ('Sports Strength 1 – Base Strength', 'Sports Strength 3 – Max Strength');

update public.programs
set description = replace(
  description,
  'week 8 is a test week: half the sets at full quality, so you finish fresh and can see how far you''ve come.',
  'week 8 is a test week: half the sets, plus a broad jump and a chest pass you measure, so you can see how far you''ve come.'
)
where trainer_id is null
  and name = 'Explosive Power 3 – Elite Power';
