-- Lists the uploaded exercise clip file names so the website build can make
-- a still picture (thumbnail) of each one. Only file names, nothing private.
create or replace function public.exercise_clip_files()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct f order by f), '{}')
  from (
    select substring(external_url from '/storage/v1/object/public/exercise-library/([A-Za-z0-9._-]+\.mp4)$') as f
    from public.exercises
    where external_url like '%/storage/v1/object/public/exercise-library/%'
  ) s
  where f is not null;
$$;

grant execute on function public.exercise_clip_files() to anon, authenticated;
