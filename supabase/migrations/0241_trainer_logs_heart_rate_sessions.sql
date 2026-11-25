-- Heart rate in the trainer's live workout (GRIZZ, 2026-11-25: "Trainer must
-- have access to everything his clients do"). When the trainer runs a client's
-- heart rate session on their own phone, Finish saves it on the client's Other
-- exercise, like the client's own sessions. Trainers could only read these
-- before; now they can add them for their own clients.
create policy "activities trainer adds" on public.client_activities
  for insert to authenticated
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));
