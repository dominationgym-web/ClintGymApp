-- Trainer wants to avoid overhead pressing entirely, not just barbell variants.
delete from public.exercises where name = 'Dumbbell Shoulder Press';
