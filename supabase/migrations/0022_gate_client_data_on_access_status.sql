-- Enforce the access gate in the database, not just in the app bundle.
--
-- Until now `clients.access_status` was checked in exactly one place:
-- RootNavigator deciding which navigator to render. Every RLS policy on the
-- client's own data keyed on `client_id = auth.uid()` alone, so a client whose
-- plan had lapsed still held a valid JWT and could read and write check-ins,
-- videos, habit logs, workout logs and lifestyle-reset logs straight against
-- the REST API. docs/access-gating.md called access_status "the single field
-- that gates what a client sees" - this migration makes that true on the
-- server side as well.
--
-- Rules:
--   * WRITES (insert/update/delete) by a client require access.
--   * SELECT stays open, so a lapsed client can still see their own history
--     and the trainer can still review it while chasing a renewal.
--   * Trainer-side policies are untouched - the trainer manages lapsed
--     clients on purpose.
--
-- "Has access" means `access_status <> 'expired'`, so it covers both 'active'
-- and 'expiring_soon'. `expiring_soon` is a client who is still paid up and
-- inside their renewal window (0021's auto_expire_plans sets it 7 days before
-- expiry) - locking them out of their own data would be wrong.

create or replace function public.client_has_access(p_client_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.access_status <> 'expired'
  );
$$ language sql stable set search_path = public;

-- Deliberately NOT security definer: it runs as the caller, so it reads
-- public.clients through the existing "clients select own or trainer" policy.
-- If that policy ever hides the row the function returns false and the write
-- is refused, which is the safe direction to fail. It also means there is no
-- SECURITY DEFINER function newly reachable over PostgREST (the problem 0004
-- had to clean up). anon has no business calling it at all.
revoke execute on function public.client_has_access(uuid) from public;
grant execute on function public.client_has_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Check-ins
-- ---------------------------------------------------------------------------
alter policy "checkins insert own" on public.checkins
  with check (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );
alter policy "checkins update own" on public.checkins
  using (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------
alter policy "videos insert own" on public.videos
  with check (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );

-- ---------------------------------------------------------------------------
-- Habit logs (the habits themselves are trainer-managed already)
-- ---------------------------------------------------------------------------
alter policy "habit logs insert own" on public.habit_logs
  with check (
    exists (
      select 1 from public.habits h
      where h.id = habit_logs.habit_id
        and h.client_id = (select auth.uid())
        and public.client_has_access(h.client_id)
    )
  );
alter policy "habit logs update own" on public.habit_logs
  using (
    exists (
      select 1 from public.habits h
      where h.id = habit_logs.habit_id
        and h.client_id = (select auth.uid())
        and public.client_has_access(h.client_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Workout logs
-- ---------------------------------------------------------------------------
alter policy "workout logs insert own" on public.workout_logs
  with check (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );
alter policy "workout logs update own" on public.workout_logs
  using (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );
alter policy "workout logs delete own" on public.workout_logs
  using (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );

-- ---------------------------------------------------------------------------
-- Lifestyle Reset daily logs
-- ---------------------------------------------------------------------------
alter policy "reset logs insert own" on public.lifestyle_reset_daily_logs
  with check (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );
alter policy "reset logs update own" on public.lifestyle_reset_daily_logs
  using (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );

-- ---------------------------------------------------------------------------
-- Video uploads to Storage
--
-- public.videos rows are gated above, but the file upload is a separate
-- storage.objects policy - without this a lapsed client could still push bytes
-- into the bucket (and into the trainer's storage bill) even though they could
-- not record the row pointing at it.
-- ---------------------------------------------------------------------------
alter policy "client uploads own video folder" on storage.objects
  with check (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.client_has_access((select auth.uid()))
  );
