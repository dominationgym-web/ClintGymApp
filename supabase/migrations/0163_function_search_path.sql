-- Stress test 2026-10-24: pin the search path on three helper functions the
-- Supabase security advisor flagged as mutable. Applied live.
alter function public.training_level_suggest() set search_path = public, pg_temp;
alter function public.weigh_in_days(text) set search_path = public, pg_temp;
alter function public.add_offseason_program(text, text, text, text, jsonb, jsonb) set search_path = public, pg_temp;
