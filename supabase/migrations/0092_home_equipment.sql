-- Home equipment list (GRIZZ, 2026-10-14): a client who trains at home lists
-- what they have (dumbbells, kettlebells, barbell, bench, bands, a multi
-- station and so on), with photos where it helps. The trainer sees it on the
-- client's Training tab, can edit it, and loads the exercises a multi station
-- can do. The app then picks home exercises that fit the list.
--
-- clients.home_equipment is a list of items, see src/lib/equipment.ts. Photos
-- live in a private bucket keyed "<client_id>/<filename>", like the other
-- client buckets, and are deleted with the account (delete-account).

alter table public.clients add column if not exists home_equipment jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipment-photos', 'equipment-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "client uploads own equipment photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "client reads own equipment photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "client deletes own equipment photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "trainer uploads their clients' equipment photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipment-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );

create policy "trainer reads their clients' equipment photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'equipment-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );

create policy "trainer deletes their clients' equipment photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'equipment-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.trainer_id = (select auth.uid())
    )
  );
