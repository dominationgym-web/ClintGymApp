-- Ski Erg as a heart rate zone exercise (GRIZZ, 2026-11-25).
alter table public.client_hr_zones drop constraint if exists client_hr_zones_exercise_check;
alter table public.client_hr_zones add constraint client_hr_zones_exercise_check
  check (exercise is null or exercise in ('walk', 'bike', 'elliptical', 'rower', 'skierg'));
