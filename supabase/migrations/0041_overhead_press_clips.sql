-- Overhead pressing clips from the MoveKit upload. GRIZZ keeps these out of
-- his own programs (too risky for most clients) but wants them available to
-- other trainers (2026-10-09). They get their own "Overhead Press" body part
-- so they're easy to spot, and the client's exercise list leaves that body
-- part out unless it's in the client's own program.

insert into public.exercises (name, category, source, external_url, sort_order)
select v.name, 'Overhead Press', 'movekit',
  'https://vrasgqqubyurzoknsbgm.supabase.co/storage/v1/object/public/exercise-library/' || v.file,
  v.sort_order
from (values
  ('Arnold Press', 'arnold-press.mp4', 500),
  ('Band Overhead Press', 'band-overhead-press.mp4', 501),
  ('Barbell Clean and Press', 'barbell-clean-and-press.mp4', 502),
  ('Barbell Overhead Press', 'barbell-overhead-press.mp4', 503),
  ('Barbell Thruster', 'barbell-thruster.mp4', 504),
  ('Behind-the-Neck Press', 'behind-the-neck-press.mp4', 505),
  ('Cable Overhead Press', 'cable-overhead-press.mp4', 506),
  ('Cuban Press', 'cuban-press.mp4', 507),
  ('Dumbbell Overhead Squat', 'dumbbell-overhead-squat.mp4', 508),
  ('Dumbbell Push Press', 'dumbbell-push-press.mp4', 509),
  ('Dumbbell Seated Overhead Press', 'dumbbell-seated-overhead-press.mp4', 510),
  ('Dumbbell Single-Arm Clean and Press', 'dumbbell-single-arm-clean-and-press.mp4', 511),
  ('Dumbbell Thruster', 'dumbbell-thruster.mp4', 512),
  ('Kettlebell Push Press', 'kettlebell-push-press.mp4', 513),
  ('Kettlebell Seated Overhead Press', 'kettlebell-seated-overhead-press.mp4', 514),
  ('Kettlebell Thruster', 'kettlebell-thruster.mp4', 515),
  ('Machine Front Military Press', 'machine-front-military-press.mp4', 516),
  ('Man Maker', 'man-maker.mp4', 517),
  ('Push Jerk', 'push-jerk.mp4', 518),
  ('Single-Arm Dumbbell Overhead Press', 'single-arm-dumbbell-overhead-press.mp4', 519),
  ('Smith Machine Seated Overhead Press', 'smith-machine-seated-overhead-press.mp4', 520),
  ('Split Jerk', 'split-jerk.mp4', 521),
  ('Z-Press', 'z-press.mp4', 522)
) as v (name, file, sort_order)
where not exists (select 1 from public.exercises e where e.name = v.name);
