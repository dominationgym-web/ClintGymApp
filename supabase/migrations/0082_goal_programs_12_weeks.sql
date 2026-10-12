-- The 3-week goal programs become 12-week programs (GRIZZ, 2026-10-12):
-- three 4-week phases, each with three building weeks and an easier
-- (deload) week 4, 8 and 12. Weeks 1-3 stay as they were (phase 1). Each
-- later phase reuses the same three weeks of sessions with more load:
--
-- Strength: the main lifts go down a rep (phase 2) and two reps (phase 3) with
--   heavier weights, and phase 3 gets 30 seconds more rest on them.
-- Bodybuilding: phase 2 adds a set to the first two exercises of each
--   session; phase 3 keeps that and makes them heavier (fewer reps).
-- Weight loss: phase 2 adds a set to the first two exercises, cuts rests by
--   15 seconds and adds 2 interval rounds; phase 3 adds sets to the first
--   four, cuts rests by 30 seconds and adds 4 rounds.
-- Deload weeks repeat week 1's sessions with half the sets.
--
-- Nobody is on these programs yet, so they are changed in place. Rows for
-- weeks 4-12 are only added when they aren't there yet.

create or replace function pg_temp.shift_reps(p_reps text, p_by int, p_floor int)
returns text language plpgsql immutable as $f$
declare
  m text[];
  lo int;
  hi int;
begin
  m := regexp_match(p_reps, '^\s*(\d+)\s*-\s*(\d+)\s*$');
  if m is null or p_by = 0 then
    return p_reps;
  end if;
  lo := greatest(p_floor, m[1]::int - p_by);
  hi := greatest(lo + 1, m[2]::int - p_by);
  return lo || '-' || hi;
end $f$;

create or replace function pg_temp.more_rounds(p_reps text, p_more int)
returns text language plpgsql immutable as $f$
declare
  m text[];
begin
  m := regexp_match(p_reps, '^(\d+) x (.*?)(\s*\([^)]*\))?$');
  if m is null or p_more = 0 then
    return p_reps;
  end if;
  return (m[1]::int + p_more) || ' x ' || m[2];
end $f$;

do $$
declare
  p record;
  week_no int;
  phase int;
  wk int;
  deload boolean;
  titles text[];
  d int;
begin
  for p in
    select id, name, day_titles from public.programs
    where trainer_id is null and name in ('Strength 3-week block', 'Bodybuilding 3-week block', 'Weight loss 3-week block')
  loop
    if not exists (select 1 from public.program_exercises where program_id = p.id and week_number > 3) then
      for week_no in 4..12 loop
        phase := (week_no - 1) / 4 + 1;
        wk := (week_no - 1) % 4 + 1;
        deload := wk = 4;
        insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
        select p.id, week_no, pe.day_number, pe.sort_order, pe.exercise_id, pe.exercise_name,
          case
            when pe.kind <> 'exercise' then pe.sets
            when deload then ceil(pe.sets / 2.0)::smallint
            when p.name like 'Bodybuilding%' and pe.sort_order <= 2 then least(5, pe.sets + 1)
            when p.name like 'Weight loss%' and phase = 2 and pe.sort_order <= 2 then least(4, pe.sets + 1)
            when p.name like 'Weight loss%' and phase = 3 and pe.sort_order <= 4 then least(4, pe.sets + 1)
            else pe.sets
          end,
          case
            when deload then pe.reps
            when pe.kind = 'cardio' then pg_temp.more_rounds(pe.reps, case phase when 2 then 2 when 3 then 4 else 0 end)
            when p.name like 'Strength%' and (pe.sort_order = 1 or pe.rest_seconds >= 180) then pg_temp.shift_reps(pe.reps, phase - 1, 2)
            when p.name like 'Bodybuilding%' and phase = 3 and pe.sort_order <= 2 then pg_temp.shift_reps(pe.reps, 2, 5)
            else pe.reps
          end,
          case
            when pe.kind <> 'exercise' or deload then pe.rest_seconds
            when p.name like 'Strength%' and phase = 3 and (pe.sort_order = 1 or pe.rest_seconds >= 180) then pe.rest_seconds + 30
            when p.name like 'Weight loss%' and pe.rest_seconds > 0 and phase = 2 then greatest(45, pe.rest_seconds - 15)
            when p.name like 'Weight loss%' and pe.rest_seconds > 0 and phase = 3 then greatest(30, pe.rest_seconds - 30)
            else pe.rest_seconds
          end,
          pe.kind
        from public.program_exercises pe
        where pe.program_id = p.id and pe.week_number = case when deload then 1 else wk end;
      end loop;
    end if;

    -- 12 weeks of day titles; deload weeks say so.
    titles := '{}';
    for week_no in 1..12 loop
      for d in 1..7 loop
        titles := titles || (
          case when week_no % 4 = 0 and p.day_titles[d] <> 'Rest day' then p.day_titles[d] || ' (easy week)' else p.day_titles[d] end
        );
      end loop;
    end loop;

    update public.programs
      set weeks = 12,
          day_titles = titles,
          name = replace(p.name, '3-week block', '12-week program'),
          description = case
            when p.name like 'Strength%' then
              'For lifters who want a bigger squat, bench, deadlift and row. 12 weeks in three 4-week phases, training upper and lower body twice a week with the heavy main lifts first and long rests. Phase 1 (weeks 1-4) builds your base. Phase 2 (weeks 5-8) takes a rep off the main lifts so you lift heavier. Phase 3 (weeks 9-12) is the heaviest, with 2-4 reps on the main lifts and 30 seconds more rest. In each phase the first week leaves 3 reps in the tank, the second 2 and the third 1. Weeks 4, 8 and 12 are easy weeks: half the sets and about 10% lighter, so your body recovers and comes back stronger. When you hit the top of the rep range on every set with clean form, add 2.5-5 kg next time. Sleep 7-9 hours.'
            when p.name like 'Bodybuilding%' then
              'For clients chasing muscle size. 12 weeks in three 4-week phases on an upper/lower split, training each muscle twice a week. Phase 1 (weeks 1-4) builds from about 12 to 15-18 hard sets per muscle. Phase 2 (weeks 5-8) adds a set to the first two big exercises of each session. Phase 3 (weeks 9-12) keeps the extra sets and makes those big exercises heavier with fewer reps, with week 11 the hardest week of the program. In each phase the first week leaves 2-3 reps in the tank, the second 1-2, and in the third take the last set of each exercise to 0-1. Weeks 4, 8 and 12 are easy weeks: half the sets and lighter weights, so you recover and keep growing. When you hit the top of the rep range on every set, add weight next session. Paired exercises with 0 rest are supersets. Sleep 7-9 hours.'
            else
              'For clients who want to lose fat while keeping their muscle. 12 weeks in three 4-week phases. Every session trains the whole body with weights first, then finishes with cardio intervals. Phase 1 (weeks 1-4) builds the habit. Phase 2 (weeks 5-8) adds a set to the big lifts, shortens the rests and adds 2 interval rounds. Phase 3 (weeks 9-12) adds sets to the first four exercises, shortens the rests again and adds 4 interval rounds. Weeks 4, 8 and 12 are easy weeks with half the sets, so you recover and keep going. Paired exercises with 0 rest are supersets. When you hit the top of the rep range on every set, add weight, because lifting heavy is what tells your body to keep its muscle. Walk 7,000-10,000 steps a day and sleep 7-9 hours.'
          end
      where id = p.id;
  end loop;
end $$;
