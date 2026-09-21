-- Make the red/orange/green flag auditable, and stop trusting the device clock.
--
-- Two problems this fixes:
--
-- 1. Resolving a flag destroyed the record. ClientDetailScreen's "Mark as
--    resolved" writes status_flag='green', status_flag_note=null, and the
--    client's own green selection does the same, so after either one there was
--    no trace that the client ever flagged, what they said, or how long it took
--    to answer. For the signal the coaching relationship is built on, nothing
--    was auditable.
--
-- 2. status_flag_updated_at was sent by the app as `new Date().toISOString()`,
--    i.e. the phone's clock. A client with a skewed clock produced a "Set ..."
--    time the trainer could not trust, and one that sorted wrong against
--    server-stamped created_at values.
--
-- The three columns on `clients` stay as the current-state cache that every
-- screen already reads. This adds an append-only event log beside them, so
-- "green" is now a recorded event rather than an erasure, and questions like
-- "how quickly do I answer red flags?" become answerable (the gap between a
-- red event and the next green one for that client).

create table public.client_status_flag_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  flag public.client_status_flag not null,
  note text,
  -- auth.uid() that made the change; null when it came from a job or the
  -- service role rather than a signed-in user.
  set_by uuid,
  set_by_role text not null check (set_by_role in ('client', 'trainer', 'system')),
  created_at timestamptz not null default now()
);

-- Also covers the client_id foreign key (performance advisor).
create index client_status_flag_events_client_idx
  on public.client_status_flag_events (client_id, created_at desc);

alter table public.client_status_flag_events enable row level security;

-- Readable by the client it belongs to and by their trainer. There are
-- deliberately no insert/update/delete policies: the only writer is the
-- SECURITY DEFINER trigger below, so the log cannot be edited or erased from
-- the app by either side.
create policy "flag events select own or trainer" on public.client_status_flag_events
  for select using (
    client_id = (select auth.uid())
    or exists (
      select 1 from public.clients c
      where c.id = client_status_flag_events.client_id
        and c.trainer_id = (select auth.uid())
    )
  );

-- Stamps status_flag_updated_at server-side and records the event. Runs on
-- every flag or note change, whoever made it, so the app no longer needs to
-- send a timestamp at all - and any timestamp it does still send is overwritten
-- with now().
create or replace function public.record_client_status_flag_change()
returns trigger as $$
begin
  if new.status_flag is distinct from old.status_flag
    or new.status_flag_note is distinct from old.status_flag_note
  then
    new.status_flag_updated_at := now();

    insert into public.client_status_flag_events (client_id, flag, note, set_by, set_by_role)
    values (
      new.id,
      new.status_flag,
      new.status_flag_note,
      auth.uid(),
      case
        when auth.uid() = new.id then 'client'
        when auth.uid() = new.trainer_id then 'trainer'
        else 'system'
      end
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- SECURITY DEFINER because the log has no insert policy - nobody writes it
-- directly. Same treatment as 0004: revoke direct EXECUTE so it is not
-- reachable as a PostgREST RPC. Postgres invokes trigger functions regardless
-- of the caller's EXECUTE privilege, so the trigger itself keeps working.
revoke execute on function public.record_client_status_flag_change() from public;
revoke execute on function public.record_client_status_flag_change() from anon;
revoke execute on function public.record_client_status_flag_change() from authenticated;

create trigger clients_record_status_flag_change
  before update on public.clients
  for each row execute function public.record_client_status_flag_change();

-- ---------------------------------------------------------------------------
-- Tighten the signup insert.
--
-- "client inserts own signup row" only ever pinned `id` and `access_status`,
-- and prevent_client_self_privilege_escalation is a BEFORE UPDATE trigger so
-- it never sees the insert. That left every other trainer-owned column
-- client-supplied at signup: a client could post themselves in with a
-- plan_expires_at the trainer never agreed to (which 0021's auto_expire_plans
-- now reads), a non-green status_flag, or trainer_notes.
--
-- plan_type and package_type stay client-supplied - the signup form legitimately
-- collects what the client is signing up for, and the trainer confirms it when
-- they confirm payment.
-- ---------------------------------------------------------------------------
alter policy "client inserts own signup row" on public.clients
  with check (
    id = (select auth.uid())
    and access_status = 'expired'
    and status_flag = 'green'
    and status_flag_note is null
    and status_flag_updated_at is null
    and plan_started_at is null
    and plan_expires_at is null
    and lifestyle_reset_started_at is null
    and trainer_notes is null
  );
