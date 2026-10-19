-- "Weight loss" becomes "Fat loss" everywhere the app shows it (GRIZZ,
-- 2026-10-19). Built-in program names only; ids stay the same, so clients'
-- calendars and history keep pointing at the same programs. The app finds
-- foundation programs by name ("Beginner Foundation - Fat loss").
update programs
set name = replace(name, 'Weight loss', 'Fat loss')
where trainer_id is null and name like '%Weight loss%';

-- Sports Strength nutrition notes said "if you're losing weight".
update programs
set nutrition = replace(nutrition, 'if you''re losing weight', 'if you''re dieting for fat loss')
where trainer_id is null and nutrition like '%if you''re losing weight%';

-- The intake goal was "Lose weight"; it's now "Lose fat".
update clients
set intake_responses = jsonb_set(
  intake_responses, '{training_goals}',
  to_jsonb(replace(intake_responses->>'training_goals', 'Lose weight', 'Lose fat'))
)
where intake_responses->>'training_goals' like '%Lose weight%';

update clients
set first_intake_responses = jsonb_set(
  first_intake_responses, '{training_goals}',
  to_jsonb(replace(first_intake_responses->>'training_goals', 'Lose weight', 'Lose fat'))
)
where first_intake_responses->>'training_goals' like '%Lose weight%';
