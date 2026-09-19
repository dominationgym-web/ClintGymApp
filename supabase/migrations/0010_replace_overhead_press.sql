-- Trainer's call: overhead barbell pressing is too risky for most clients.
-- Swap it for two safer shoulder builders.
delete from public.exercises where name = 'Overhead Press';

insert into public.exercises (name, category, source, external_url, sort_order) values
  ('Dumbbell Lateral Raise', 'Shoulders', 'movekit', null, 5),
  ('Incline Dumbbell Press', 'Shoulders', 'movekit', null, 11);
