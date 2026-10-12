-- Form videos for the trainer (GRIZZ, 2026-10-12): the client can say which
-- exercise a video shows, the trainer is told the moment one is uploaded, and
-- watches it on the client's Training tab. viewed_at marks it as watched so
-- the dashboard can show how many are new.

alter table public.videos add column if not exists exercise_name text;
alter table public.videos add column if not exists viewed_at timestamptz;

create or replace function public.notify_form_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  first_name text;
begin
  select id, name, trainer_id into c from public.clients where id = new.client_id;
  if c.trainer_id is null then
    return new;
  end if;
  first_name := split_part(coalesce(c.name, 'Your client'), ' ', 1);
  begin
    perform public.push_to_user(
      c.trainer_id,
      '🎥 New form video from ' || first_name,
      first_name || ' sent a video'
        || case when coalesce(trim(new.exercise_name), '') <> '' then ' of ' || left(trim(new.exercise_name), 60) else '' end
        || '. Watch it on their Training tab.',
      jsonb_build_object('type', 'form_video', 'client_id', new.client_id)
    );
  exception when others then
    -- A failed push must never stop the upload.
    null;
  end;
  return new;
end;
$$;

revoke execute on function public.notify_form_video() from public, anon, authenticated;

create or replace trigger videos_notify_trainer
  after insert on public.videos
  for each row execute function public.notify_form_video();

/** The trainer watched a client's video. */
create or replace function public.mark_video_viewed(p_video uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.videos v
    set viewed_at = coalesce(v.viewed_at, now())
    from public.clients c
    where v.id = p_video and c.id = v.client_id and c.trainer_id = auth.uid();
$$;

revoke execute on function public.mark_video_viewed(uuid) from public, anon;
grant execute on function public.mark_video_viewed(uuid) to authenticated;
