-- Public holidays before invoicing (GRIZZ 2026-11-25: "when doing the monthly
-- invoicing ... see when there are public holidays and confirm with the
-- trainers if they will be working on those public holidays").
--
-- The app works out the holidays for the trainer's country (South Africa built
-- in, other countries from Nager.Date) and asks about each one that has 1 on 1
-- sessions booked, from the 15th for next month. One row per answer, so the
-- trainer is asked once on every phone and laptop:
--   * working = true: nothing changes.
--   * working = false: the app adds a one-day coach holiday
--     (add_trainer_holiday), so the sessions are cancelled free and go on the
--     catch-up list like any holiday; the trainer picks Catch-up or Credit for
--     each client (GRIZZ: "Some will want to catchup. Other will be
--     credited."). catch_ups: true all catch-ups, false all credit, null mixed.

create table if not exists public.trainer_public_holiday_answers (
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  day date not null,
  name text not null default '',
  working boolean not null,
  catch_ups boolean,
  answered_at timestamptz not null default now(),
  primary key (trainer_id, day)
);

alter table public.trainer_public_holiday_answers enable row level security;

create policy trainer_public_holiday_answers_own on public.trainer_public_holiday_answers
  for all to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

grant select, insert, update on public.trainer_public_holiday_answers to authenticated;
