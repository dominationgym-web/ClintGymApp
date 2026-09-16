-- Wrap auth.<fn>() calls in RLS policies as (select auth.<fn>()) so Postgres
-- evaluates them once per query instead of once per row (Supabase performance
-- advisor recommendation, no behavior change).

alter policy "trainers select own" on public.trainers
  using (id = (select auth.uid()));
alter policy "trainers update own" on public.trainers
  using (id = (select auth.uid()));

alter policy "clients select own or trainer" on public.clients
  using (id = (select auth.uid()) or trainer_id = (select auth.uid()));
alter policy "clients update own profile fields" on public.clients
  using (id = (select auth.uid()));
alter policy "trainer manages own clients" on public.clients
  using (trainer_id = (select auth.uid()));
alter policy "trainer inserts own clients" on public.clients
  with check (trainer_id = (select auth.uid()));
alter policy "client inserts own signup row" on public.clients
  with check (id = (select auth.uid()) and access_status = 'expired');

alter policy "checkins select own or trainer" on public.checkins
  using (
    client_id = (select auth.uid())
    or exists (
      select 1 from public.clients c
      where c.id = checkins.client_id and c.trainer_id = (select auth.uid())
    )
  );
alter policy "checkins insert own" on public.checkins
  with check (client_id = (select auth.uid()));
alter policy "checkins update own" on public.checkins
  using (client_id = (select auth.uid()));

alter policy "videos select own or trainer" on public.videos
  using (
    client_id = (select auth.uid())
    or exists (
      select 1 from public.clients c
      where c.id = videos.client_id and c.trainer_id = (select auth.uid())
    )
  );
alter policy "videos insert own" on public.videos
  with check (client_id = (select auth.uid()));

alter policy "exercises readable by authenticated" on public.exercises
  using ((select auth.role()) = 'authenticated');

alter policy "push tokens owned by user" on public.push_tokens
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Missing covering index on a foreign key (Supabase performance advisor).
create index videos_checkin_id_idx on public.videos (checkin_id);
