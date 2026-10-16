-- Every Sunday at 5pm South Africa time, remind everyone with the installed
-- app to fully close and reopen it twice so the latest update loads (GRIZZ, 2026-10-16).
create or replace function public.weekly_update_reminder()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  for u in select distinct user_id from public.push_tokens where user_id is not null loop
    perform public.push_to_user(
      u,
      'Get the latest Daily Evolution',
      'Fully close the app, open it, wait 10 seconds, then close and open it again to load this week''s updates.',
      '{}'::jsonb
    );
  end loop;
end;
$$;

revoke execute on function public.weekly_update_reminder() from public, anon, authenticated;

select cron.unschedule('weekly-update-reminder')
where exists (select 1 from cron.job where jobname = 'weekly-update-reminder');
-- 15:00 UTC on Sunday is 17:00 in South Africa.
select cron.schedule('weekly-update-reminder', '0 15 * * 0', $$select public.weekly_update_reminder();$$);
