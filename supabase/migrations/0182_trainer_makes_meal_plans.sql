-- The trainer works out the client's meal plan (GRIZZ, 2026-11-02: "the
-- trainer has control of the meal planning"). The meal plan maker moved to the
-- trainer's Diet tab, so the client's trainer can now make and change the
-- plan in client_meal_plans (0077). The client keeps updating it: swaps,
-- foods left out, their own meals and the shopping list days.

create policy "meal plan trainer inserts" on public.client_meal_plans
  for insert to authenticated with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
create policy "meal plan trainer updates" on public.client_meal_plans
  for update to authenticated using (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
  );
