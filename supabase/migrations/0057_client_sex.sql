-- Male or female, asked on the intake form (2026-10-11). Men don't see the
-- Women's Health Reset (menu section, Reset tab, trainer's Enroll button).
-- Null for clients from before it was asked: they see everything as before.
alter table public.clients
  add column if not exists sex text check (sex in ('male', 'female'));
