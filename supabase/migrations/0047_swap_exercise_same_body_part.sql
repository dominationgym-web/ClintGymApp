-- Change exercise (GRIZZ, 2026-10-10): when the gym is busy a client can swap
-- an exercise in their program for another one for the same body part. So a
-- client whose coach hasn't opened the full library (0043) can still see the
-- exercises for the body parts in their program, and the app only offers the
-- ones for the body part being swapped, so nobody swaps a hard one for an easy
-- one from somewhere else.

-- Incline Dumbbell Press is a chest press, filed under Shoulders by mistake.
update public.exercises set category = 'Push'
where name = 'Incline Dumbbell Press' and category = 'Shoulders';

-- Body parts that count as the same for a swap. Must match swapGroup() in
-- src/lib/exerciseFilter.ts. Hamstring curls and Romanian deadlifts both work
-- the hamstrings; everything else swaps within its own category.
create or replace function public.swap_group(p_category text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_category in ('Hamstrings', 'Posterior Chain') then 'Hamstrings' else p_category end;
$$;

grant execute on function public.swap_group(text) to authenticated;

-- The swap groups of the exercises in the signed-in client's program.
create or replace function public.my_program_swap_groups()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct public.swap_group(e.category)), '{}')
  from public.program_exercises pe
  join public.exercises e on e.id = pe.exercise_id
  where pe.program_id = public.my_program_id() and e.category is not null;
$$;

revoke execute on function public.my_program_swap_groups() from public, anon;
grant execute on function public.my_program_swap_groups() to authenticated;

alter policy "exercises readable by authenticated" on public.exercises
  using (
    (select auth.role()) = 'authenticated'
    and (
      (select public.my_library_access())
      or id in (
        select pe.exercise_id from public.program_exercises pe
        where pe.program_id = (select public.my_program_id())
      )
      or (
        category <> 'Overhead Press'
        and public.swap_group(category) in (select unnest(public.my_program_swap_groups()))
      )
    )
  );
