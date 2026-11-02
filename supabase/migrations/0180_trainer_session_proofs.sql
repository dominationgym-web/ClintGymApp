-- Cancellation screenshots for people not in the app yet (GRIZZ 2026-11-02:
-- "when client cancels the trainer can load cancellation ... ask for
-- screenshot"). They have no client folder, so the screenshot goes in the
-- trainer's own folder. Reading it is already allowed (0168: your own folder).
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname = 'trainer adds own session proofs') then
    create policy "trainer adds own session proofs" on storage.objects
      for insert to authenticated with check (
        bucket_id = 'session-proofs'
        and (storage.foldername(objects.name))[1] = (select auth.uid())::text
        and exists (select 1 from public.trainers t where t.id = (select auth.uid()))
      );
  end if;
end $$;
