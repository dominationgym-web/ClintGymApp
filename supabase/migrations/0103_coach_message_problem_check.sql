-- Trainers can now send a check-in note from a body-and-mind report on the
-- Notes tab (GRIZZ, 2026-10-17), linked to the client's open problem so the
-- client can reply. Make sure a linked problem is that same client's.
create policy "coach message problem is the client's" on public.coach_messages
  as restrictive
  for insert to authenticated
  with check (
    problem_id is null
    or exists (
      select 1 from public.client_problems p
      where p.id = coach_messages.problem_id
        and p.client_id = coach_messages.client_id
    )
  );
