-- Tighten who can call the 0029 helpers directly over the API (Supabase's
-- security advisor flags security definer functions anyone can call).
--
-- * guard_trainer_columns is a trigger function; nobody needs to call it.
-- * is_app_owner, is_trainer and trainer_is_approved are used inside RLS
--   policies, which run as the signed-in user, so `authenticated` keeps
--   EXECUTE; signed-out visitors don't need them.
-- * trainer_for_join_code stays open to `anon` on purpose: the signup screen
--   looks a code up before the client has an account.
revoke execute on function public.guard_trainer_columns() from public, anon, authenticated;

revoke execute on function public.is_app_owner() from public, anon;
revoke execute on function public.is_trainer(uuid) from public, anon;
revoke execute on function public.trainer_is_approved(uuid) from public, anon;
grant execute on function public.is_app_owner() to authenticated;
grant execute on function public.is_trainer(uuid) to authenticated;
grant execute on function public.trainer_is_approved(uuid) to authenticated;
