-- No charges to trainers until the app is live on the stores (GRIZZ,
-- 2026-10-17: "for the next 2 weeks there will be no charge till we go live").
--
-- * Every trial that would end before 31 October now ends on 31 October, so no
--   trainer's trial runs out, no plan starts and no client fees build up in
--   the meantime. (Lockout was already off: billing_settings.lockout_enabled.)
-- * The three daily trainer reminder jobs (trial ending, plan and client fees
--   due, free-use fees starting) are paused, so nobody is told to pay.
--
-- To go live: set the trials to the new end date you want, then
--   select cron.alter_job(jobid, active := true) from cron.job
--   where jobname in ('trainer-trial-reminders-daily', 'trainer-billing-reminders-daily',
--                     'trainer-free-use-reminders-daily');

update public.trainers
set trial_ends_at = date '2026-10-31'
where not is_owner and trial_ends_at is not null and trial_ends_at < date '2026-10-31';

select cron.alter_job(jobid, active := false)
from cron.job
where jobname in ('trainer-trial-reminders-daily', 'trainer-billing-reminders-daily', 'trainer-free-use-reminders-daily');
