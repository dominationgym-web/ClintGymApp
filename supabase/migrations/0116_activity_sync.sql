-- Workouts from the client's watch (GRIZZ, 2026-10-18: "how do we link up
-- the 1st one? Can you do it for me?"). The app reads finished workouts from
-- Apple Health on iPhones and Health Connect on Android (where Samsung Health,
-- Garmin Connect and Polar Flow can sync them) and saves each one as Other
-- exercise. source says where it came from; external_id is the workout's id
-- there, so the same workout is never saved twice.
alter table public.client_activities
  add column if not exists source text check (source is null or source in ('apple_health', 'health_connect')),
  add column if not exists external_id text check (external_id is null or char_length(external_id) <= 200);

alter table public.client_activities
  add constraint client_activities_external_unique unique (client_id, external_id);
