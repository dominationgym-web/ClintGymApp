-- Publish public.clients over realtime so AuthContext can pick up an
-- access_status change while the client has the app open, instead of the client
-- having to force-quit and reopen before a confirmed payment lets them in.
--
-- Realtime applies the table's RLS policies to each subscriber, and
-- "clients select own or trainer" already limits a client to their own row, so
-- this exposes nothing a client could not already select. AuthContext
-- subscribes with filter `id=eq.<their own id>` on top of that.
-- Guarded on both sides so `supabase db reset` is repeatable and so a stack
-- without the realtime publication doesn't fail the migration chain.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'clients'
    )
  then
    alter publication supabase_realtime add table public.clients;
  end if;
end $$;
