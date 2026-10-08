-- Scheduled job to auto-transition clients based on plan_expires_at.
-- Moves active clients to expiring_soon 7 days before expiry, then to
-- expired on the actual expiry date.

create or replace function public.auto_expire_plans()
returns void as $$
declare
  v_expiring_soon date;
begin
  v_expiring_soon := current_date + interval '7 days';

  -- Move clients to "expired" if their plan has passed the expiry date.
  update public.clients
  set access_status = 'expired'
  where access_status in ('active', 'expiring_soon')
    and plan_expires_at < current_date;

  -- Move active clients to "expiring_soon" if within 7 days of expiry.
  update public.clients
  set access_status = 'expiring_soon'
  where access_status = 'active'
    and plan_expires_at is not null
    and plan_expires_at <= v_expiring_soon
    and plan_expires_at >= current_date;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.auto_expire_plans() from public;
revoke execute on function public.auto_expire_plans() from anon;
revoke execute on function public.auto_expire_plans() from authenticated;

-- Run daily at 2 AM (before the 3 AM video cleanup, so plan status is fresh).
select cron.schedule('auto-expire-plans-daily', '0 2 * * *', $$select public.auto_expire_plans();$$);
