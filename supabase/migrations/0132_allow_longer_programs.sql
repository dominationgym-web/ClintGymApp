-- The Longevity (60+) programs are 24 weeks (GRIZZ, 2026-10-20: raise the
-- 12-week limit to 52). Already applied live.
alter table public.programs drop constraint programs_weeks_check, add constraint programs_weeks_check check (weeks >= 1 and weeks <= 52);
alter table public.program_exercises drop constraint program_exercises_week_number_check, add constraint program_exercises_week_number_check check (week_number >= 1 and week_number <= 52);
alter table public.client_programs drop constraint client_programs_current_week_check, add constraint client_programs_current_week_check check (current_week >= 1 and current_week <= 52);
