-- Standalone traffic-light status flag, settable by the client at any time
-- (not tied to the daily check-in form). Drives trainer dashboard priority
-- sort: red (urgent, needs guidance) above orange (wants general feedback)
-- above the existing distress_flag/missing-checkin logic above green
-- (all good, the default). Distinct from checkins.distress_flag, which
-- stays as the per-day "flagged in today's check-in" record.

create type public.client_status_flag as enum ('green', 'orange', 'red');

alter table public.clients
  add column status_flag public.client_status_flag not null default 'green',
  add column status_flag_note text,
  add column status_flag_updated_at timestamptz;

create index clients_status_flag_idx on public.clients (status_flag) where status_flag <> 'green';

-- No new RLS policy needed: "clients update own profile fields" already lets
-- a client update any column on their own row except what the privilege-
-- escalation trigger blocks (access_status/trainer_id/plan_*), and
-- "trainer manages own clients" already lets the trainer update it too
-- (used for the dashboard "mark resolved" action).
