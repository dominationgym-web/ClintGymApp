-- Weekend catch-up reminder at 6am SA instead of 9am, so clients see it when
-- they wake (GRIZZ, 2026-10-17). 04:00 UTC is 06:00 in South Africa.
select cron.unschedule('weekend-catch-up-reminders')
where exists (select 1 from cron.job where jobname = 'weekend-catch-up-reminders');
select cron.schedule('weekend-catch-up-reminders', '0 4 * * 6,0', $$select public.weekend_catch_up_reminders();$$);
