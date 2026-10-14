-- Stability programs move to the trainer's side (GRIZZ, 2026-10-14): the
-- trainer starts, switches and stops a client's stability programs; the
-- client only does and logs the ones their coach gave them. Clients can no
-- longer start or end one themselves (their policies are switched off rather
-- than removed).

alter policy "stability programs insert own" on public.client_stability_programs with check (false);
alter policy "stability programs update own" on public.client_stability_programs using (false) with check (false);

create policy "stability programs trainer inserts" on public.client_stability_programs
  for insert to authenticated with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and (select public.not_unapproved_trainer())
  );
create policy "stability programs trainer updates" on public.client_stability_programs
  for update to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid()))
    and (select public.not_unapproved_trainer())
  );
