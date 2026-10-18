-- A short lower back stretching program in the Flexibility section (GRIZZ,
-- 2026-10-18: "a little stretching program for clients with lower back
-- tightness. Keep it in the flexibility section."). Built the same way as the
-- Flexibility 1-3 programs (0093): a built-in weekly program, gym and home
-- copies, Monday/Wednesday/Friday, 4 weeks. Every exercise is already in the
-- library. Only inserts what isn't there yet; nothing is removed.

create or replace function pg_temp.add_sports_program(p_name text, p_place text, p_weeks int, p_description text, p_nutrition text, p_warm_up text, p_titles jsonb, p_rest text, p_tpl jsonb)
returns void language plpgsql as $f$
declare
  prog uuid;
  titles text[] := '{}';
  w int;
  dd int;
  ph text;
  wp int;
  half boolean;
  tag text;
  d text;
  r jsonb;
  i int;
  n int;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name and place = p_place) then
    return;
  end if;
  for w in 1..p_weeks loop
    tag := case when p_weeks = 8 and w = 4 then ' (easy week)' when p_weeks = 8 and w = 8 then ' (test week)' else '' end;
    for dd in 1..7 loop
      titles := titles || coalesce((p_titles ->> dd::text) || tag, p_rest);
    end loop;
  end loop;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, nutrition, warm_up, day_titles)
  values (null, p_name, 'weekly', p_place, p_weeks, p_description, p_nutrition, p_warm_up, titles)
  returning id into prog;
  for w in 1..p_weeks loop
    if p_weeks = 8 then
      ph := case when w <= 4 then 'p1' else 'p2' end;
      half := w in (4, 8);
      wp := case when w <= 3 then w when w between 5 and 7 then w - 4 else 1 end;
    else
      ph := case when w <= 3 then 'p1' else 'p2' end;
      half := false;
      wp := case when w <= 3 then w else w - 3 end;
    end if;
    for d in select jsonb_object_keys(p_tpl -> ph) loop
      i := 0;
      for r in select * from jsonb_array_elements(p_tpl -> ph -> d) loop
        i := i + 1;
        n := (r->>1)::int;
        n := case when half then greatest(1, ceil(n / 2.0)::int) when (r->>4)::boolean then greatest(n, least(6, n + wp - 1)) else n end;
        insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
        values (prog, w, d::smallint, i,
          (select e.id from public.exercises e where e.name = r->>0 order by e.sort_order limit 1),
          r->>0, n, r->>2, (r->>3)::smallint, 'exercise');
      end loop;
    end loop;
  end loop;
  if exists (select 1 from public.program_exercises pe where pe.program_id = prog and pe.exercise_id is null) then
    raise exception 'an exercise in % is not in the library', p_name;
  end if;
end $f$;

do $$
declare
  place text;
begin
  foreach place in array array['gym', 'home'] loop
    perform pg_temp.add_sports_program('Flexibility 4 – Lower Back Release', place, 4,
      'A short, gentle routine for a tight lower back: it loosens the hips, glutes, hamstrings and spine that pull on it, and wakes up the deep core and glutes that support it. About 10-15 minutes. Move slowly, breathe out into each stretch and stop at a mild pull, never pain. Stop and see a doctor or physio if the pain is sharp, goes down a leg, or comes with numbness or pins and needles. It runs for 4 weeks: weeks 1-3 build the base (a set is added to one move each week), then week 4 uses longer holds. Do it Monday, Wednesday and Friday. On a day your back feels tight, any one of the sessions is fine to do as well, for example after sitting a long time or before bed.',
      'No special diet is needed for mobility and flexibility work, but well-hydrated muscles stretch better: drink 35 ml of water per kg of bodyweight a day. Eating enough protein (about 1.6 g per kg a day) and getting 7-9 hours of sleep helps your muscles and joints recover so they move better.', 'Warm up first, never stretch cold: 3-5 minutes of easy movement (a brisk walk, marching on the spot, gentle hip circles). Move slowly and breathe out as you go into each position. Work to a mild stretch you can breathe through, never pain.',
      '{"1":"Lower back release A","3":"Lower back release B","5":"Lower back release C"}'::jsonb, 'Rest (or an easy walk)',
      '{"p1": {"1": [["Cat-Cow", 2, "10 slow", 15, false], ["Child''s Pose Lat Stretch", 2, "30 sec each side", 15, false], ["Lying Spinal Twist", 2, "30 sec each side", 15, true], ["Figure-Four Glute Stretch", 2, "30 sec each side", 15, false], ["Glute Bridge", 2, "10 slow, squeeze at the top", 30, false]], "3": [["Cat-Cow", 2, "10 slow", 15, false], ["Half-Kneeling Hip Flexor Stretch", 2, "30 sec each side", 15, true], ["Lying Hamstring Stretch", 2, "30 sec each side, use a towel", 15, false], ["Pigeon Stretch", 2, "30 sec each side", 15, false], ["Bird Dog", 2, "6 each side, slow", 30, false]], "5": [["Cat-Cow", 2, "10 slow", 15, false], ["Child''s Pose Lat Stretch", 2, "30 sec each side", 15, true], ["Thread the Needle", 2, "8 each side", 15, false], ["Lying Spinal Twist", 2, "30 sec each side", 15, false], ["Dead Bug", 2, "6 each side, slow", 30, false]]}, "p2": {"1": [["Cat-Cow", 2, "12 slow", 15, false], ["Child''s Pose Lat Stretch", 2, "45 sec each side", 15, false], ["Lying Spinal Twist", 3, "45 sec each side", 15, false], ["Figure-Four Glute Stretch", 2, "45 sec each side", 15, false], ["Glute Bridge", 2, "12 slow, hold 2 sec at the top", 30, false]], "3": [["Cat-Cow", 2, "12 slow", 15, false], ["Half-Kneeling Hip Flexor Stretch", 3, "45 sec each side", 15, false], ["Lying Hamstring Stretch", 2, "45 sec each side, use a towel", 15, false], ["Pigeon Stretch", 2, "45 sec each side", 15, false], ["Bird Dog", 2, "8 each side, hold 2 sec", 30, false]], "5": [["Cat-Cow", 2, "12 slow", 15, false], ["Child''s Pose Lat Stretch", 3, "45 sec each side", 15, false], ["Thread the Needle", 2, "8 each side, hold 3 sec", 15, false], ["Lying Spinal Twist", 2, "45 sec each side", 15, false], ["Dead Bug", 2, "8 each side, slow", 30, false]]}}'::jsonb);
  end loop;
end $$;
