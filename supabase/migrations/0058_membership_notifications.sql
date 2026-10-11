-- Membership notifications (2026-10-11). On top of sign-up and activation
-- (0056), the client and their trainer hear when a plan is about to end
-- (7 days before, when it moves to expiring_soon) and when it has ended.
-- The nightly expiry job (0021) moves to 08:00 South African time (06:00 UTC)
-- so these don't arrive at 4am.

create or replace function public.notify_client_signup_and_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ends text := coalesce(to_char(new.plan_expires_at, 'FMDD FMMonth'), 'soon');
begin
  if tg_op = 'INSERT' then
    perform public.push_to_user(
      new.trainer_id,
      'New client signed up',
      coalesce(new.name, 'Someone') || ' just signed up. Activate them on the Clients tab once they''ve paid.',
      jsonb_build_object('type', 'client_signup', 'clientId', new.id)
    );
  elsif old.access_status = 'expired' and new.access_status in ('active', 'expiring_soon') then
    perform public.push_to_user(
      new.id,
      'You''re in! 🎉',
      'Your trainer has activated your account. Open the app to get started.',
      jsonb_build_object('type', 'client_activated')
    );
  elsif old.access_status = 'active' and new.access_status = 'expiring_soon' then
    perform public.push_to_user(
      new.id,
      'Your plan ends ' || ends,
      'Renew with your trainer before then to keep your access and your streaks going.',
      jsonb_build_object('type', 'plan_expiring')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan ends ' || ends,
      'They''ve been reminded to renew.',
      jsonb_build_object('type', 'client_plan_expiring', 'clientId', new.id)
    );
  elsif old.access_status in ('active', 'expiring_soon') and new.access_status = 'expired' then
    perform public.push_to_user(
      new.id,
      'Your plan has ended',
      'Renew with your trainer to get your access back. Open the app for the payment details.',
      jsonb_build_object('type', 'plan_expired')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan has ended',
      'Their access is paused until you activate them again.',
      jsonb_build_object('type', 'client_plan_expired', 'clientId', new.id)
    );
  end if;
  return new;
exception when others then
  raise warning 'client membership notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_client_signup_and_activation() from public, anon, authenticated;

select cron.schedule('auto-expire-plans-daily', '0 6 * * *', $$select public.auto_expire_plans();$$);
