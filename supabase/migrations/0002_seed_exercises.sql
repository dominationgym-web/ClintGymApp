-- Seed the Phase 1 exercise reference library: the trainer's most-assigned
-- movements. Replace external_url with the actual Muscle & Motion deep link
-- (or embed id) for each once the licensing terms are confirmed to cover
-- display inside this app; until then these are placeholders.

insert into public.exercises (name, category, source, external_url, sort_order) values
  ('Barbell Back Squat', 'Legs', 'muscle_and_motion', null, 1),
  ('Conventional Deadlift', 'Posterior Chain', 'muscle_and_motion', null, 2),
  ('Bench Press', 'Push', 'muscle_and_motion', null, 3),
  ('Bent-Over Barbell Row', 'Pull', 'muscle_and_motion', null, 4),
  ('Overhead Press', 'Push', 'muscle_and_motion', null, 5),
  ('Romanian Deadlift', 'Posterior Chain', 'muscle_and_motion', null, 6),
  ('Pull-Up', 'Pull', 'muscle_and_motion', null, 7),
  ('Walking Lunge', 'Legs', 'muscle_and_motion', null, 8),
  ('Plank', 'Core', 'muscle_and_motion', null, 9),
  ('Dumbbell Shoulder Press', 'Push', 'muscle_and_motion', null, 10);
