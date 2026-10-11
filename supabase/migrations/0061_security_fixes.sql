-- Fixes from the loophole audit (2026-10-11).
--
--   1. Storage: the trainer read policies for client videos, avatars and shared
--      progress photos compared the client id with storage.foldername(c.name),
--      the client's display NAME, not the file path. So trainers couldn't see
--      their own clients' avatars or photos, and a trainer who renamed a
--      client could read someone else's files. They now use objects.name.
--      Training videos only accept video files.
--   2. Trainer notes move to their own table that only the trainer can read.
--      They were a column on clients, which the client could read and edit.
--      Old app versions still writing clients.trainer_notes are redirected.
--   3. A trainer who isn't approved (pending, or blocked by the owner) can't
--      write client, program, habit or message data. This was only enforced
--      by the app's screens.
--   4. Trainers can no longer create client rows; clients sign themselves up
--      with a join code.
--   5. Clients can't change their sign-up date or consent record, can only
--      change a habit's days and reminder, can only log habits for about
--      today, and can only check in for the past week.
--   6. A client's video row always expires 7 days after upload and must point
--      at their own folder, so nothing escapes the clean-up.
--   7. Database advisor fixes: fixed search_path on three functions, the plan
--      expiry job is no longer callable from the app, two missing indexes.

-- 1. Storage --------------------------------------------------------------

alter policy "trainer reads their clients' video folders" on storage.objects
  using (
    bucket_id = 'training-videos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(objects.name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );

alter policy "trainer reads their clients' avatars" on storage.objects
  using (
    bucket_id = 'client-avatars'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(objects.name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );

alter policy "trainer reads progress photos shared with them" on storage.objects
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(objects.name))[1]
        and c.trainer_id = (select auth.uid())
        and c.progress_photos_shared
    )
  );

update storage.buckets set allowed_mime_types = array['video/*'] where id = 'training-videos';

-- 2. Trainer notes --------------------------------------------------------

create table if not exists public.client_trainer_notes (
  client_id uuid primary key references public.clients (id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.client_trainer_notes enable row level security;

drop policy if exists "trainer manages notes for own clients" on public.client_trainer_notes;
create policy "trainer manages notes for own clients" on public.client_trainer_notes
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

insert into public.client_trainer_notes (client_id, notes)
select id, trainer_notes from public.clients where coalesce(trainer_notes, '') <> ''
on conflict (client_id) do nothing;

-- Old app versions save notes to clients.trainer_notes: move them across and
-- keep the column empty. Nobody else may write it.
create or replace function public.redirect_trainer_notes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trainer_notes is not distinct from old.trainer_notes then
    return new;
  end if;
  if auth.uid() is not null then
    if auth.uid() is distinct from old.trainer_id then
      raise exception 'only the trainer can write trainer notes';
    end if;
    -- An old app shows the moved notes as blank, so an empty save is ignored
    -- rather than wiping them.
    if coalesce(new.trainer_notes, '') <> '' then
      insert into public.client_trainer_notes (client_id, notes, updated_at)
      values (old.id, new.trainer_notes, now())
      on conflict (client_id) do update set notes = excluded.notes, updated_at = now();
    end if;
  end if;
  new.trainer_notes := null;
  return new;
end;
$$;

revoke execute on function public.redirect_trainer_notes() from public, anon, authenticated;

create or replace trigger clients_redirect_trainer_notes
  before update of trainer_notes on public.clients
  for each row execute function public.redirect_trainer_notes();

update public.clients set trainer_notes = null
where trainer_notes is not null and exists (select 1 from public.client_trainer_notes n where n.client_id = clients.id);

-- 3. Unapproved trainers can't write --------------------------------------

-- False only for a trainer account that isn't approved. Clients pass.
create or replace function public.not_unapproved_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.trainers t where t.id = (select auth.uid()) and not t.approved)
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['clients', 'client_programs', 'client_trainer_notes', 'coach_messages', 'habits', 'program_exercises', 'programs']
  loop
    execute format('drop policy if exists "approved trainers only (insert)" on public.%I', tbl);
    execute format('drop policy if exists "approved trainers only (update)" on public.%I', tbl);
    execute format('drop policy if exists "approved trainers only (delete)" on public.%I', tbl);
    execute format('create policy "approved trainers only (insert)" on public.%I as restrictive for insert to authenticated with check ((select public.not_unapproved_trainer()))', tbl);
    execute format('create policy "approved trainers only (update)" on public.%I as restrictive for update to authenticated using ((select public.not_unapproved_trainer()))', tbl);
    execute format('create policy "approved trainers only (delete)" on public.%I as restrictive for delete to authenticated using ((select public.not_unapproved_trainer()))', tbl);
  end loop;
end $$;

-- 4. Clients sign themselves up -------------------------------------------

alter policy "trainer inserts own clients" on public.clients with check (false);

-- 5. Client-writable fields -----------------------------------------------

create or replace function public.prevent_client_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
      or new.created_at is distinct from old.created_at
      or (old.consent_accepted_at is not null and new.consent_accepted_at is distinct from old.consent_accepted_at)
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$$;

-- A client may only change a habit's days and reminder; the trainer sets the rest.
create or replace function public.guard_client_habit_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.client_id
    and (to_jsonb(new) - 'active_days' - 'reminder_enabled' - 'reminder_time')
      is distinct from (to_jsonb(old) - 'active_days' - 'reminder_enabled' - 'reminder_time')
  then
    raise exception 'clients can only change a habit''s days and reminder';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_client_habit_update() from public, anon, authenticated;

create or replace trigger habits_guard_client_update
  before update on public.habits
  for each row execute function public.guard_client_habit_update();

-- Habit logs: about today only, and no more than the target.
create or replace function public.guard_habit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target integer;
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.log_date < public.sa_today() - 1 or new.log_date > public.sa_today() + 1 then
    raise exception 'habits can only be logged for today';
  end if;
  select h.reps_target into target from public.habits h where h.id = new.habit_id;
  if new.reps_completed < 0 or (target is not null and new.reps_completed > target) then
    raise exception 'that is more than the habit target';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_habit_log() from public, anon, authenticated;

create or replace trigger habit_logs_guard
  before insert or update on public.habit_logs
  for each row execute function public.guard_habit_log();

-- Check-ins: up to a week back (to catch up on missed days), never the future.
create or replace function public.guard_checkin_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.checkin_date is not distinct from old.checkin_date then
    return new;
  end if;
  if new.checkin_date < public.sa_today() - 7 or new.checkin_date > public.sa_today() + 1 then
    raise exception 'check-ins can only be for the past week';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_checkin_date() from public, anon, authenticated;

create or replace trigger checkins_guard_date
  before insert or update on public.checkins
  for each row execute function public.guard_checkin_date();

-- 6. Video rows -----------------------------------------------------------

create or replace function public.guard_client_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = new.client_id then
    if new.storage_provider = 'supabase' and new.storage_path not like auth.uid()::text || '/%' then
      raise exception 'videos must be in your own folder';
    end if;
    new.uploaded_at := now();
    new.expires_at := now() + interval '7 days';
    new.deleted_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_client_video() from public, anon, authenticated;

create or replace trigger videos_guard_client_insert
  before insert on public.videos
  for each row execute function public.guard_client_video();

-- 7. Advisor fixes --------------------------------------------------------

alter function public.auto_expire_plans() set search_path = public;
alter function public.client_monthly_consistency(uuid, date) set search_path = public;
alter function public.sa_today() set search_path = public;
revoke execute on function public.auto_expire_plans() from public, anon, authenticated;

create index if not exists trainers_referred_by_idx on public.trainers (referred_by);
create index if not exists workout_logs_exercise_id_idx on public.workout_logs (exercise_id);
