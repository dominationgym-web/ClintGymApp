-- Switching the Phase 1 exercise library source from Muscle & Motion
-- (ambiguous embedding rights, recurring subscription) to MoveKit's
-- Complete package (explicit commercial license, one-time purchase).
-- external_url will point at files hosted in the public "exercise-library"
-- Supabase Storage bucket rather than deep-linking to another app.

alter table public.exercises drop constraint exercises_source_check;
alter table public.exercises add constraint exercises_source_check
  check (source in ('movekit', 'muscle_and_motion', 'own_library'));
alter table public.exercises alter column source set default 'movekit';

update public.exercises set source = 'movekit';
