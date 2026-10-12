-- Change exercise for the Health Reset workouts (GRIZZ, 2026-10-12): the
-- exercises a client can swap one for when the gym is busy, the same body
-- part as public.swap_group() counts it, home-friendly ones only for home
-- training. Security definer because a client without full library access
-- can't otherwise read exercises outside their program's body parts.
create or replace function public.swap_options_for(p_exercise uuid, p_home boolean default false)
returns table (id uuid, name text, category text, external_url text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.name, e.category, e.external_url
  from public.exercises e
  join public.exercises base on base.id = p_exercise
  where public.swap_group(e.category) = public.swap_group(base.category)
    and e.id <> base.id
    and e.category <> 'Overhead Press'
    and (not p_home or e.home_friendly)
    and auth.uid() is not null
  order by e.name;
$$;
revoke execute on function public.swap_options_for(uuid, boolean) from public, anon;
grant execute on function public.swap_options_for(uuid, boolean) to authenticated;
