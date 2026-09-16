-- Supabase's security advisor flagged prevent_client_self_privilege_escalation()
-- as callable directly via PostgREST's auto-exposed RPC endpoint
-- (/rest/v1/rpc/...), since it's SECURITY DEFINER and lives in the public
-- schema. It's meant to run only as a BEFORE UPDATE trigger on
-- public.clients (Postgres invokes trigger functions regardless of the
-- caller's EXECUTE privilege, so this doesn't break the trigger itself) -
-- revoke direct EXECUTE from anon/authenticated so it isn't reachable as an
-- RPC call at all.
revoke execute on function public.prevent_client_self_privilege_escalation() from public;
revoke execute on function public.prevent_client_self_privilege_escalation() from anon;
revoke execute on function public.prevent_client_self_privilege_escalation() from authenticated;
