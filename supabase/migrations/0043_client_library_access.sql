-- Per-client access to the full exercise library (GRIZZ, 2026-10-10). A
-- client sees only the exercises in their own program until their trainer
-- switches library_access on for them. Trainers always see everything.

alter table public.clients add column library_access boolean not null default false;

-- Clients can't switch it on for themselves.
create or replace function public.prevent_client_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() = old.id and auth.uid() <> old.trainer_id then
    if new.access_status is distinct from old.access_status
      or new.trainer_id is distinct from old.trainer_id
      or new.plan_type is distinct from old.plan_type
      or new.plan_started_at is distinct from old.plan_started_at
      or new.plan_expires_at is distinct from old.plan_expires_at
      or new.package_type is distinct from old.package_type
      or new.lifestyle_reset_started_at is distinct from old.lifestyle_reset_started_at
      or new.library_access is distinct from old.library_access
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$function$;

-- Or at signup.
create or replace function public.library_access_off_at_client_signup()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.uid() = new.id then
    new.library_access := false;
  end if;
  return new;
end;
$function$;

create trigger clients_library_access_off_at_signup
  before insert on public.clients
  for each row execute function public.library_access_off_at_client_signup();

-- True for trainers (and anyone who isn't a client); for a client, whether
-- their trainer has given them the full library. Security definer so the
-- exercises policy can read clients without going through its policies.
create or replace function public.my_library_access()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select c.library_access from public.clients c where c.id = auth.uid()), true);
$function$;

revoke all on function public.my_library_access() from public, anon;
grant execute on function public.my_library_access() to authenticated;

-- Without access, a client reads only the exercises in their own program.
alter policy "exercises readable by authenticated" on public.exercises
  using (
    (select auth.role()) = 'authenticated'
    and (
      (select public.my_library_access())
      or id in (
        select pe.exercise_id from public.program_exercises pe
        where pe.program_id = (select public.my_program_id())
      )
    )
  );
