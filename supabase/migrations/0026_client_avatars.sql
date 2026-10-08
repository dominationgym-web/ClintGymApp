-- Profile photos, so the trainer can put a face to every name.
--
-- The client picks a photo on their Profile tab; the trainer sees it on the
-- client list and the client detail screen. The file lives in a private bucket
-- keyed as "<client_id>/<filename>", the same folder convention as
-- training-videos (0003), and clients.avatar_path points at the current one.
-- The app shows it through short-lived signed URLs.
--
-- Unlike check-ins and videos (0022), setting a photo is NOT gated on
-- access_status: a brand-new signup starts 'expired' until the trainer confirms
-- payment, and that is exactly when the trainer most needs to see who they
-- are activating. The bucket caps file size and type, and each client only
-- ever has one current photo (the app deletes the previous one), so this
-- can't grow into a storage bill.

alter table public.clients add column avatar_path text;

-- A client can only point their row at a file in their own folder.
alter table public.clients add constraint clients_avatar_path_own_folder
  check (avatar_path is null or avatar_path like id::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-avatars', 'client-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "client uploads own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "client reads own avatar" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "client deletes own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "trainer reads their clients' avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-avatars'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );
