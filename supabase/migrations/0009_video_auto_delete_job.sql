-- Actually implements the 30-day video auto-delete that videos.expires_at
-- was always meant to drive, closing the gap before the privacy policy
-- claims this happens (it didn't, until now).

create extension if not exists pg_cron;

create or replace function public.delete_expired_videos()
returns void as $$
begin
  -- Remove the underlying file in Storage for expired Supabase-hosted
  -- videos. Deleting a storage.objects row deletes the actual object.
  delete from storage.objects
  where bucket_id = 'training-videos'
    and name in (
      select storage_path from public.videos
      where storage_provider = 'supabase'
        and expires_at < now()
        and deleted_at is null
    );

  -- Soft-delete every expired video row (any provider) - the row itself
  -- stays so the trainer's historical notes about it still make sense,
  -- only the underlying media is gone.
  update public.videos
  set deleted_at = now()
  where expires_at < now()
    and deleted_at is null;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.delete_expired_videos() from public;
revoke execute on function public.delete_expired_videos() from anon;
revoke execute on function public.delete_expired_videos() from authenticated;

select cron.schedule('delete-expired-videos-daily', '0 3 * * *', $$select public.delete_expired_videos();$$);
