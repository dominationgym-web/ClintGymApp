-- GRIZZ, 2026-10-12: the 30 Upper/Lower Body calendar workouts (0069) had
-- 9-10 exercises, which is too many. Cut each to 6, keeping a balanced
-- spread and the superset pairs intact:
--   Upper Body N:           chest press, back, lateral raise, rear delt, curl, triceps
--   Upper Body Superset N:  chest + back, the two shoulder moves, biceps + triceps
--   Lower Body N:           compound lift, quad, hinge, hamstring curl, glutes, calves
--   Lower Body Superset N:  compound lift, two quad + hamstring pairs, then glutes
-- The rest move to a hidden program (loadAvailablePrograms skips it by name)
-- rather than being deleted, so nothing is lost if one is wanted back.
insert into public.programs (trainer_id, name, kind, place, weeks, description, day_titles)
select null, 'Retired workout exercises', 'custom', 'gym', 1,
  'Exercises taken out of the Upper/Lower Body workouts on 2026-10-12. Never shown in the app.', '{}'::text[]
where not exists (select 1 from public.programs where trainer_id is null and name = 'Retired workout exercises');

update public.program_exercises pe
set program_id = (select id from public.programs where trainer_id is null and name = 'Retired workout exercises' limit 1)
from public.programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and (
    (p.name ~ '^Upper Body \d+$' and pe.sort_order not in (1, 3, 5, 6, 7, 9))
    or (p.name ~ '^Upper Body Superset \d+$' and pe.sort_order not in (1, 2, 5, 6, 7, 8))
    or (p.name ~ '^Lower Body \d+$' and pe.sort_order not in (1, 2, 4, 5, 6, 8))
    or (p.name ~ '^Lower Body Superset \d+$' and pe.sort_order not in (1, 2, 3, 4, 5, 6))
  );

-- The glute move ended a superset pair; on its own now, it gets a rest.
update public.program_exercises pe
set rest_seconds = 60
from public.programs p
where p.id = pe.program_id
  and p.trainer_id is null
  and p.name ~ '^Lower Body Superset \d+$'
  and pe.sort_order = 6;

-- Number what's left 1-6.
update public.program_exercises pe
set sort_order = r.n
from (
  select pe2.id, row_number() over (partition by pe2.program_id order by pe2.sort_order) as n
  from public.program_exercises pe2
  join public.programs p on p.id = pe2.program_id
  where p.trainer_id is null and p.name ~ '^(Upper|Lower) Body (Superset )?\d+$'
) r
where r.id = pe.id;

update public.programs set description = replace(description,
  'chest, back, shoulders, biceps and triceps, 2 exercises each, 3 sets of every exercise. ',
  '6 exercises covering chest, back, shoulders, biceps and triceps, 3 sets of every exercise. ')
where trainer_id is null and name ~ '^Upper Body \d+$';
update public.programs set description = replace(description,
  '(chest with back, the two shoulder moves, biceps with triceps), then rest before the next round. 3 rounds of each pair. ',
  '(chest with back, the two shoulder moves, biceps with triceps), then rest before the next round. 6 exercises, 3 rounds of each pair. ')
where trainer_id is null and name ~ '^Upper Body Superset \d+$';
update public.programs set description = replace(description,
  'one big compound lift first, then quads, hamstrings, glutes and calves, 2 exercises each, 3 sets of every exercise. ',
  '6 exercises: one big compound lift first, then quads, hamstrings, glutes and calves, 3 sets of every exercise. ')
where trainer_id is null and name ~ '^Lower Body \d+$';
update public.programs set description = replace(description,
  'then do each pair back to back with no rest (quads with hamstrings, glutes with calves) and rest before the next round. 3 rounds of each pair. ',
  'then do each pair of quads and hamstrings back to back with no rest, and finish with glutes on their own. 6 exercises, 3 rounds of each. ')
where trainer_id is null and name ~ '^Lower Body Superset \d+$';
