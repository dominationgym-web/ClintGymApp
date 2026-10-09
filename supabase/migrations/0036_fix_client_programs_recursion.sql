-- Fix "infinite recursion detected in policy for relation client_programs"
-- when a trainer picks a program for a client (0035).
--
-- The "programs select" policy looked up client_programs so a client can read
-- the program they are on, and the "client programs trainer writes" check
-- looks up programs. Each table's policy ran the other's, so Postgres refused
-- the write. The client's lookup now goes through a security definer function,
-- which reads client_programs without running its policies and so breaks the
-- loop. It only ever returns the signed-in user's own program.

create or replace function public.my_program_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select program_id from public.client_programs where client_id = auth.uid();
$$;

revoke execute on function public.my_program_id() from public, anon;
grant execute on function public.my_program_id() to authenticated;

alter policy "programs select" on public.programs
  using (
    trainer_id is null
    or trainer_id = (select auth.uid())
    or id = (select public.my_program_id())
  );
