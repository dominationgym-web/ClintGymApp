-- Proof of payment photos uploaded but the trainer couldn't open them
-- (GRIZZ, 2026-10-27: "Made a test POP payment and sent a pic. And the pic
-- doesnt upload."). In 0117 and 0092 the storage rules said
-- `storage.foldername(name)` inside `select ... from public.clients c` (and
-- `public.trainers t`), and Postgres read `name` as the client's or trainer's
-- name rather than the file's. So the folder never matched, and the trainer
-- (or the owner for trainer proofs) got "not found". Naming objects.name fixes
-- it. Same mix-up in the equipment photo rules, which a trainer uses to add
-- photos of a client's home equipment.

alter policy "payment proof sender and receiver read" on storage.objects
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(objects.name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(objects.name))[1] and c.trainer_id = (select auth.uid())
      )
      or (
        public.is_app_owner()
        and exists (select 1 from public.trainers t where t.id::text = (storage.foldername(objects.name))[1])
      )
    )
  );

alter policy "trainer uploads their clients' equipment photos" on storage.objects
  with check (
    bucket_id = 'equipment-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(objects.name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );

alter policy "trainer reads their clients' equipment photos" on storage.objects
  using (
    bucket_id = 'equipment-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(objects.name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );

alter policy "trainer deletes their clients' equipment photos" on storage.objects
  using (
    bucket_id = 'equipment-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(objects.name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );
