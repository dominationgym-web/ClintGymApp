-- Form video feedback (GRIZZ, 2026-10-13): the trainer writes their
-- correction under the video while it plays, and the message is linked to
-- that video so the client sees it with the video in their Video log.

alter table public.coach_messages
  add column if not exists video_id uuid references public.videos(id) on delete set null;

create index if not exists coach_messages_video_idx on public.coach_messages (video_id) where video_id is not null;

-- The linked video must be that client's own.
create policy "coach message video is the client's" on public.coach_messages
  as restrictive
  for insert to authenticated
  with check (
    video_id is null
    or exists (
      select 1 from public.videos v
      where v.id = coach_messages.video_id
        and v.client_id = coach_messages.client_id
    )
  );
