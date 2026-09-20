-- The trainer decides what habit is needed and how often (e.g. "supplements
-- 3x/day" or "gym 3x/week"), but only the client knows their real schedule -
-- they pick which specific days and reminder time actually fit their life.
create policy "habits update own schedule by client" on public.habits
  for update using (client_id = auth.uid())
  with check (client_id = auth.uid());
