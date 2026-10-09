-- Fixes the nightly 30-day video clean-up from 0009. Supabase now blocks
-- deleting rows from storage.objects in SQL ("Direct deletion from storage
-- tables is not allowed"), so delete_expired_videos() failed every night and
-- no file was ever removed. Files have to go through the Storage API, so the
-- work moves to the cleanup-expired-videos Edge Function, which pg_cron now
-- calls over HTTP with pg_net.
--
-- The cron job proves it's the caller with a random secret that is generated
-- here, kept in Vault and never leaves the database: the function checks it
-- with video_cleanup_secret_ok(), which only the service role can run.
--
-- Also schedules auto-expire-plans-daily from 0021, which was never scheduled
-- on the live project (the function existed, the cron job didn't).

create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'video_cleanup_cron_secret')
where not exists (select 1 from vault.secrets where name = 'video_cleanup_cron_secret');

create or replace function public.video_cleanup_secret_ok(p_secret text)
returns boolean as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'video_cleanup_cron_secret' and decrypted_secret = p_secret
  );
$$ language sql security definer set search_path = public;

revoke execute on function public.video_cleanup_secret_ok(text) from public;
revoke execute on function public.video_cleanup_secret_ok(text) from anon;
revoke execute on function public.video_cleanup_secret_ok(text) from authenticated;
grant execute on function public.video_cleanup_secret_ok(text) to service_role;

select cron.unschedule('delete-expired-videos-daily')
where exists (select 1 from cron.job where jobname = 'delete-expired-videos-daily');

drop function if exists public.delete_expired_videos();

select cron.schedule(
  'cleanup-expired-videos-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://vrasgqqubyurzoknsbgm.supabase.co/functions/v1/cleanup-expired-videos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'video_cleanup_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Run daily at 2 AM (before the 3 AM video cleanup, so plan status is fresh).
select cron.schedule('auto-expire-plans-daily', '0 2 * * *', $$select public.auto_expire_plans();$$);
