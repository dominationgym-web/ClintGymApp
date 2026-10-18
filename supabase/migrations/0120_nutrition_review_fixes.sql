-- Nutrition review fixes (2026-10-18): the programs' nutrition text gave
-- everyone the same 2-3 litres of water a day. Use about 30-35 ml per kg of
-- body weight, plus extra on training and hot days, as the trainer guide and
-- the app's check-in feedback now do.

update public.programs
set nutrition = replace(
  nutrition,
  'Drink 2-3 litres of water a day, more on hot days.',
  'Drink about 30-35 ml of water per kg of body weight a day, more on training and hot days.'
)
where nutrition like '%Drink 2-3 litres of water a day, more on hot days.%';

update public.programs
set nutrition = replace(
  nutrition,
  'Drink 2-3 litres of water a day.',
  'Drink about 30-35 ml of water per kg of body weight a day, more on training and hot days.'
)
where nutrition like '%Drink 2-3 litres of water a day.%';

update public.programs
set nutrition = replace(
  nutrition,
  'Drink 2.5-3 litres of water a day',
  'Drink about 30-35 ml of water per kg of body weight a day, more on training days'
)
where nutrition like '%Drink 2.5-3 litres of water a day%';
