-- Keeps training videos inside the free plan's 1 GB of Storage (GRIZZ chose
-- this on 2026-10-09 rather than upgrading):
--   * videos are kept 7 days instead of 30,
--   * a client's videos are removed as soon as their plan becomes "expired",
--   * the training-videos bucket refuses files over 50 MB (the free plan's
--     per-file cap, so the error is ours and clear rather than Storage's).
-- The 3 AM cleanup-expired-videos job (0032) does the actual deleting; this
-- only moves expires_at earlier.

alter table public.videos alter column expires_at set default (now() + interval '7 days');

update public.videos
set expires_at = uploaded_at + interval '7 days'
where deleted_at is null
  and expires_at > uploaded_at + interval '7 days';

create or replace function public.expire_videos_when_plan_expires()
returns trigger as $$
begin
  update public.videos
  set expires_at = now()
  where client_id = new.id
    and deleted_at is null
    and expires_at > now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.expire_videos_when_plan_expires() from public;
revoke execute on function public.expire_videos_when_plan_expires() from anon;
revoke execute on function public.expire_videos_when_plan_expires() from authenticated;

drop trigger if exists clients_expire_videos_on_plan_expiry on public.clients;
create trigger clients_expire_videos_on_plan_expiry
  after update of access_status on public.clients
  for each row
  when (new.access_status = 'expired' and old.access_status is distinct from 'expired')
  execute function public.expire_videos_when_plan_expires();

update storage.buckets set file_size_limit = 52428800 where id = 'training-videos';
