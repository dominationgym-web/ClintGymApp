-- Two security definer functions were callable without signing in. Both
-- already check who is calling, but there's no reason to expose them.
revoke execute on function public.client_fees_start(uuid) from anon, public;
revoke execute on function public.acknowledge_habit_win(uuid, text) from anon, public;
grant execute on function public.client_fees_start(uuid) to authenticated, service_role;
grant execute on function public.acknowledge_habit_win(uuid, text) to authenticated, service_role;
