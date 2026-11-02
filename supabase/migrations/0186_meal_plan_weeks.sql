-- A week of meals at a time, and plans that learn what the client likes
-- (GRIZZ, 2026-11-02: "the option to work out diet for a week at a time. And
-- use AI to adapt the diet to their preferred foods ... and make changes over
-- time accordingly").
--
-- week:  {startsOn: Monday "YYYY-MM-DD", days: 7 plan days}, for a weekly plan.
-- taste: {liked: {food: score}, disliked: {food: score}, adaptedOn, note}:
--        learned from what the client swaps in, leaves out and puts in their
--        own meals, and read by the adapt-meal-plan function each new week.
alter table public.client_meal_plans
  add column if not exists week jsonb not null default '{}'::jsonb
    check (jsonb_typeof(week) = 'object' and pg_column_size(week) < 300000),
  add column if not exists taste jsonb not null default '{}'::jsonb
    check (jsonb_typeof(taste) = 'object' and pg_column_size(taste) < 20000);
